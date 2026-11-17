import logging
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.security import (
    create_access_token,
    generate_password_reset_token,
    get_password_hash,
    hash_password_reset_token,
    verify_password,
)
from app.db.session import get_db
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    Token,
    UserCreate,
    UserLogin,
    UserResponse,
    UserUpdate,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def send_password_reset_email(to_email: str, reset_url: str) -> None:
    if not settings.SMTP_HOST:
        logger.warning(
            "SMTP non configuré : lien de réinitialisation pour %s → %s",
            to_email,
            reset_url,
        )
        return

    message = EmailMessage()
    message["Subject"] = "Réinitialisation de votre mot de passe — VOSTFR AI"
    message["From"] = settings.SMTP_FROM
    message["To"] = to_email
    message.set_content(
        "Bonjour,\n\n"
        "Vous avez demandé à réinitialiser votre mot de passe VOSTFR AI.\n"
        "Cliquez sur le bouton « Réinitialiser mon mot de passe » dans cet email.\n\n"
        f"Ce lien expire dans {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutes.\n"
        "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n"
    )
    message.add_alternative(
        f"""\
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Réinitialisation de votre mot de passe</title>
</head>
<body style="margin:0;padding:0;background-color:#0f1115;font-family:Arial,Helvetica,sans-serif;color:#e6e8ee;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0f1115;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#171a21;border:1px solid #2a2f3a;border-radius:14px;padding:32px;">
          <tr>
            <td align="center" style="padding-bottom:8px;">
              <span style="font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">VOSTFR AI</span>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 0 4px;">
              <h1 style="margin:0;font-size:20px;font-weight:600;color:#ffffff;">Réinitialisation du mot de passe</h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:12px 0 24px;">
              <p style="margin:0;font-size:14px;line-height:22px;color:#b6bcc9;">
                Vous avez demandé à réinitialiser votre mot de passe VOSTFR AI.<br>
                Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <a href="{reset_url}" target="_blank" rel="noopener"
                 style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:10px;">
                Réinitialiser mon mot de passe
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:16px;">
              <p style="margin:0;font-size:13px;line-height:20px;color:#8b93a3;">
                Ce lien expire dans {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutes.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
""",
        subtype="html",
    )

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            if settings.SMTP_TLS:
                server.starttls()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(message)
    except Exception:
        logger.exception("Échec de l'envoi de l'email de réinitialisation à %s", to_email)


@router.post("/register", response_model=Token)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user_in.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email déjà utilisé")

    user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        password_hash=get_password_hash(user_in.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer", "user": UserResponse.model_validate(user)}


@router.post("/login", response_model=Token)
def login(user_in: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_in.email).first()
    if not user or not verify_password(user_in.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )

    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer", "user": UserResponse.model_validate(user)}


@router.post("/forgot-password")
def forgot_password(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == payload.email).first()
    reset_url = None

    if user:
        now = datetime.now(timezone.utc)
        raw_token, token_hash = generate_password_reset_token()

        # Invalide les éventuels liens précédents encore valides.
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        ).update({PasswordResetToken.used_at: now}, synchronize_session=False)

        db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=token_hash,
                expires_at=now + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES),
            )
        )
        db.commit()

        reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={raw_token}"
        background_tasks.add_task(send_password_reset_email, user.email, reset_url)

    response = {
        "message": "Si un compte existe pour cette adresse, un email de réinitialisation a été envoyé."
    }
    # En développement uniquement, on peut renvoyer le lien pour tester sans SMTP.
    if reset_url and not settings.SMTP_HOST and settings.EXPOSE_RESET_URL:
        response["reset_url"] = reset_url
    return response


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères")

    invalid_link = HTTPException(
        status_code=400, detail="Lien de réinitialisation invalide ou expiré"
    )

    token_hash = hash_password_reset_token(payload.token)
    reset_entry = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == token_hash)
        .first()
    )
    now = datetime.now(timezone.utc)
    if not reset_entry or reset_entry.used_at is not None:
        raise invalid_link

    expires_at = reset_entry.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now:
        raise invalid_link

    user = db.query(User).filter(User.id == reset_entry.user_id).first()
    if not user:
        raise invalid_link

    user.password_hash = get_password_hash(payload.password)

    # Le lien est à usage unique : on invalide celui-ci et tous les autres.
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
    ).update({PasswordResetToken.used_at: now}, synchronize_session=False)

    db.commit()
    return {"message": "Mot de passe mis à jour. Vous pouvez maintenant vous connecter."}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_me(user_in: UserUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user_in.full_name is not None:
        current_user.full_name = user_in.full_name
        db.commit()
        db.refresh(current_user)
    return current_user


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Le nouveau mot de passe doit contenir au moins 6 caractères",
        )

    current_user.password_hash = get_password_hash(payload.new_password)
    now = datetime.now(timezone.utc)
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == current_user.id,
        PasswordResetToken.used_at.is_(None),
    ).update({PasswordResetToken.used_at: now}, synchronize_session=False)
    db.commit()
    return {"message": "Mot de passe mis à jour."}
