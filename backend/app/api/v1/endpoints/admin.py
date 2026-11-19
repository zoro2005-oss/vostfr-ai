import csv
import io
import json
import os
from base64 import urlsafe_b64encode
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from hashlib import sha256

from cryptography.fernet import Fernet
from fastapi import APIRouter, Body, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import distinct, func, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_admin_user, get_current_user, require_permission
from app.core.paths import AUDIO_DIR, SUBTITLE_DIR, VIDEO_DIR, audio_file_path, subtitle_file_path, video_file_path
from app.core.permissions import ADMIN_ROLES
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.session import get_db
from app.models.admin import (
    ApiSecret,
    AppNotification,
    AuditLog,
    CreditLedger,
    DataRequest,
    GenerationLog,
    GlobalSetting,
    Plan,
    PromoCode,
    Subscription,
    SupportTicket,
    TicketMessage,
    Transaction,
)
from app.models.project import Project
from app.models.subtitle import Subtitle
from app.models.user import User
from app.schemas.auth import UserLogin

router = APIRouter()

perm_users = require_permission("users")
perm_generations = require_permission("generations")
perm_plans = require_permission("plans")
perm_payments = require_permission("payments")
perm_credits = require_permission("credits")
perm_activity = require_permission("activity")
perm_notifications = require_permission("notifications")
perm_support = require_permission("support")
perm_analytics = require_permission("analytics")
perm_settings = require_permission("settings")
perm_security = require_permission("security")
perm_promotions = require_permission("promotions")
perm_languages = require_permission("languages")

PAID_STATUSES = ("success", "paid")


def now() -> datetime:
    return datetime.now(timezone.utc)


def iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def require_fields(payload: dict, fields: tuple[str, ...]) -> None:
    missing = [field for field in fields if field not in payload]
    if missing:
        raise HTTPException(status_code=400, detail=f"Champs requis : {', '.join(missing)}")


def audit(
    db: Session,
    admin: User,
    action: str,
    target_type: str | None = None,
    target_id: object = None,
    details: dict | None = None,
) -> None:
    db.add(AuditLog(
        admin_id=admin.id,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        details=details or {},
    ))


def get_or_404(db: Session, model, object_id: int):
    row = db.query(model).filter(model.id == object_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Ressource introuvable")
    return row


def active_subscription(db: Session, user_id: int) -> Subscription | None:
    return (
        db.query(Subscription)
        .join(Plan)
        .filter(
            Subscription.user_id == user_id,
            Subscription.status == "active",
            or_(Subscription.ends_at.is_(None), Subscription.ends_at >= now()),
        )
        .order_by(Subscription.id.desc())
        .first()
    )


def subscription_plan(db: Session, subscription: Subscription | None) -> Plan | None:
    if not subscription:
        return None
    return db.get(Plan, subscription.plan_id)


def user_summary(db: Session, user: User) -> dict:
    subscription = active_subscription(db, user.id)
    plan = subscription_plan(db, subscription)
    generations = db.query(func.count(Project.id)).filter(Project.user_id == user.id).scalar() or 0
    return {
        "id": user.id,
        "full_name": user.full_name or "",
        "email": user.email,
        "role": user.role,
        "credits": user.credits,
        "status": "active" if user.is_active else "suspended",
        "plan": plan.code if plan else "FREE",
        "plan_name": plan.name if plan else "Gratuit",
        "subscription_status": subscription.status if subscription else "none",
        "subscription_ends_at": iso(subscription.ends_at) if subscription else None,
        "generations": generations,
        "created_at": iso(user.created_at),
        "last_activity": iso(user.last_active_at),
    }


def project_summary(db: Session, project: Project) -> dict:
    user = db.query(User).filter(User.id == project.user_id).first()
    subscription = active_subscription(db, project.user_id)
    plan = subscription_plan(db, subscription)
    minutes = 0.0
    if project.duration and ":" in project.duration:
        try:
            parts = [float(part) for part in project.duration.split(":")]
            minutes = parts[0] * 60 + parts[1] + parts[2] / 60 if len(parts) == 3 else parts[0]
        except ValueError:
            minutes = 0.0
    processing = None
    if project.completed_at and project.created_at:
        processing = round((project.completed_at - project.created_at).total_seconds() / 60, 1)
    return {
        "id": project.id,
        "title": project.title,
        "filename": project.original_filename,
        "user": user.email if user else "—",
        "user_id": project.user_id,
        "source": project.source_language,
        "target": project.target_language,
        "duration": project.duration or "—",
        "duration_minutes": round(minutes, 1),
        "status": project.status,
        "progress": project.progress,
        "plan": plan.code if plan else "FREE",
        "cost": round(minutes * 0.02, 3),
        "backup": "Activée" if plan and plan.backup_enabled else "Désactivée",
        "processing_minutes": processing,
        "created_at": iso(project.created_at),
        "completed_at": iso(project.completed_at),
    }


def transaction_summary(db: Session, transaction: Transaction) -> dict:
    user = db.query(User).filter(User.id == transaction.user_id).first()
    plan = db.query(Plan).filter(Plan.id == transaction.plan_id).first() if transaction.plan_id else None
    return {
        "id": transaction.id,
        "reference": transaction.reference,
        "user": user.email if user else "—",
        "user_id": transaction.user_id,
        "amount": transaction.amount,
        "currency": transaction.currency,
        "method": transaction.method,
        "plan": plan.name if plan else "—",
        "status": transaction.status,
        "provider_reference": transaction.provider_reference or "",
        "created_at": iso(transaction.created_at),
    }


def log_summary(log: AuditLog) -> dict:
    return {
        "id": log.id,
        "admin": "Système" if log.admin_id is None else f"Admin #{log.admin_id}",
        "admin_id": log.admin_id,
        "action": log.action,
        "target_type": log.target_type,
        "target_id": log.target_id,
        "details": log.details or {},
        "created_at": iso(log.created_at),
    }


def get_setting(db: Session, key: str, default):
    row = db.query(GlobalSetting).filter(GlobalSetting.key == key).first()
    return row.value if row else default


def set_setting(db: Session, key: str, value) -> None:
    row = db.query(GlobalSetting).filter(GlobalSetting.key == key).first()
    if row is None:
        row = GlobalSetting(key=key, value=value)
        db.add(row)
    else:
        row.value = value


def daily_buckets(days: int, end: date | None = None) -> dict[str, float]:
    today = end or now().date()
    return {(today - timedelta(days=offset)).isoformat(): 0 for offset in range(days - 1, -1, -1)}


def bucket(records, date_attr, days: int, value=lambda _: 1, end: date | None = None) -> list[dict]:
    buckets = daily_buckets(days, end)
    for record in records:
        value_date = getattr(record, date_attr)
        if value_date is None:
            continue
        key = value_date.date().isoformat() if hasattr(value_date, "date") else str(value_date)[:10]
        if key in buckets:
            buckets[key] += value(record)
    return [{"date": day, "value": round(number, 2)} for day, number in buckets.items()]


def paginate(items: list, page: int, page_size: int) -> dict:
    total = len(items)
    start = (page - 1) * page_size
    return {"items": items[start:start + page_size], "total": total, "page": page, "page_size": page_size}


def fernet() -> Fernet:
    return Fernet(urlsafe_b64encode(sha256(settings.SECRET_KEY.encode()).digest()))


# ---------------------------------------------------------------------------
# Session admin
# ---------------------------------------------------------------------------

@router.post("/login")
def admin_login(user_in: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_in.email.strip().lower()).first()
    if not user or not verify_password(user_in.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Identifiants administrateur incorrects")
    if user.role not in ADMIN_ROLES or not user.is_active:
        raise HTTPException(status_code=403, detail="Ce compte n'a pas accès à l'administration")

    user.last_active_at = datetime.now(timezone.utc)
    db.add(AuditLog(
        admin_id=user.id,
        action="admin.login",
        target_type="user",
        target_id=str(user.id),
        details={"email": user.email, "via": "admin_form"},
    ))
    db.commit()

    token = create_access_token(data={"sub": str(user.id), "ver": user.token_version})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name or "",
            "role": user.role,
        },
    }


@router.get("/me")
def admin_me(admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    from app.core.permissions import PERMISSIONS
    return {
        "id": admin.id,
        "email": admin.email,
        "full_name": admin.full_name or "",
        "role": admin.role,
        "permissions": sorted(PERMISSIONS.get(admin.role, set())),
    }


@router.get("/messages")
def my_messages(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conditions = [
        AppNotification.audience == "all",
        AppNotification.user_id == current_user.id,
    ]
    subscription = active_subscription(db, current_user.id)
    plan = subscription_plan(db, subscription)
    if not (plan and plan.code != "FREE"):
        conditions.append(AppNotification.audience != "premium")
    query = db.query(AppNotification).filter(or_(*conditions))
    rows = query.order_by(AppNotification.created_at.desc()).limit(30).all()
    return [{
        "id": row.id,
        "title": row.title,
        "body": row.body,
        "kind": row.kind,
        "created_at": iso(row.created_at),
    } for row in rows]


# ---------------------------------------------------------------------------
# Vue d'ensemble
# ---------------------------------------------------------------------------

@router.get("/overview")
def overview(
    days: int = Query(30, ge=1, le=365),
    from_date: str | None = Query(None, alias="from_date"),
    to_date: str | None = Query(None, alias="to_date"),
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    end_date = now().date()
    if bool(from_date) != bool(to_date):
        raise HTTPException(status_code=400, detail="Les deux dates sont requises")
    if from_date and to_date:
        try:
            first_day = date.fromisoformat(from_date)
            last_day = date.fromisoformat(to_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Format de date invalide")
        if last_day < first_day:
            raise HTTPException(status_code=400, detail="La date de fin précède la date de début")
        end_date = last_day
        days = (last_day - first_day).days + 1
        if days > 365:
            raise HTTPException(status_code=400, detail="La période ne peut pas dépasser 365 jours")
        start = datetime(first_day.year, first_day.month, first_day.day, tzinfo=timezone.utc)
        end = datetime(last_day.year, last_day.month, last_day.day, tzinfo=timezone.utc) + timedelta(days=1)
    else:
        start = now() - timedelta(days=days)
        end = now()
    total_users = db.query(func.count(User.id)).scalar() or 0
    new_users = db.query(func.count(User.id)).filter(User.created_at >= start, User.created_at < end).scalar() or 0
    active_users = db.query(func.count(distinct(User.id))).filter(
        or_(
            User.last_active_at >= start,
            User.id.in_(db.query(Project.user_id).filter(Project.created_at >= start, Project.created_at < end)),
        )
    ).scalar() or 0
    premium_users = db.query(func.count(distinct(Subscription.user_id))).join(Plan).filter(
        Subscription.status == "active",
        Plan.code != "FREE",
    ).scalar() or 0
    active_subscriptions = db.query(func.count(Subscription.id)).filter(
        Subscription.status == "active",
        or_(Subscription.ends_at.is_(None), Subscription.ends_at >= now()),
    ).scalar() or 0
    expired_subscriptions = db.query(func.count(Subscription.id)).filter(
        or_(Subscription.status == "expired", Subscription.ends_at < now())
    ).scalar() or 0
    total_videos = db.query(func.count(Project.id)).scalar() or 0
    translations = db.query(func.count(Subtitle.id)).scalar() or 0
    running = db.query(func.count(Project.id)).filter(Project.status.in_(("pending", "processing", "analyzing", "translating", "audio", "assembling"))).scalar() or 0
    failed = db.query(func.count(Project.id)).filter(Project.status.in_(("error", "failed"))).scalar() or 0
    revenue_total = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(Transaction.status.in_(PAID_STATUSES)).scalar() or 0
    revenue_period = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.status.in_(PAID_STATUSES), Transaction.created_at >= start, Transaction.created_at < end
    ).scalar() or 0
    month_start = now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    revenue_month = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.status.in_(PAID_STATUSES), Transaction.created_at >= month_start
    ).scalar() or 0
    revenue_today = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.status.in_(PAID_STATUSES),
        func.date(Transaction.created_at) == now().date(),
    ).scalar() or 0

    distribution_rows = (
        db.query(Plan.code, func.count(Subscription.id))
        .join(Subscription, Subscription.plan_id == Plan.id)
        .filter(Subscription.status == "active")
        .group_by(Plan.code)
        .all()
    )
    recent_errors = (
        db.query(Project)
        .filter(Project.status.in_(("error", "failed")), Project.created_at >= start, Project.created_at < end)
        .order_by(Project.created_at.desc())
        .limit(5)
        .all()
    )

    return {
        "stats": {
            "total_users": total_users,
            "active_users": active_users,
            "new_users": new_users,
            "free_users": max(total_users - premium_users, 0),
            "premium_users": premium_users,
            "active_subscriptions": active_subscriptions,
            "expired_subscriptions": expired_subscriptions,
            "total_videos": total_videos,
            "translations": translations,
            "running_generations": running,
            "failed_generations": failed,
            "revenue_total": round(float(revenue_total), 2),
            "revenue_month": round(float(revenue_month), 2),
            "revenue_today": round(float(revenue_today), 2),
            "revenue_period": round(float(revenue_period), 2),
            "conversion_rate": round(premium_users * 100 / total_users, 2) if total_users else 0,
        },
        "charts": {
            "registrations": bucket(db.query(User).filter(User.created_at >= start, User.created_at < end).all(), "created_at", days, end=end_date),
            "revenue": bucket(
                db.query(Transaction).filter(Transaction.status.in_(PAID_STATUSES), Transaction.created_at >= start, Transaction.created_at < end).all(),
                "created_at", days, lambda row: row.amount, end=end_date,
            ),
            "generations": bucket(db.query(Project).filter(Project.created_at >= start, Project.created_at < end).all(), "created_at", days, end=end_date),
        },
        "subscription_distribution": [{"label": code, "value": count} for code, count in distribution_rows],
        "recent_activities": [log_summary(row) for row in db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(8).all()],
        "recent_transactions": [transaction_summary(db, row) for row in db.query(Transaction).order_by(Transaction.created_at.desc()).limit(5).all()],
        "recent_users": [user_summary(db, row) for row in db.query(User).order_by(User.created_at.desc()).limit(5).all()],
        "alerts": [project_summary(db, row) for row in recent_errors],
    }


# ---------------------------------------------------------------------------
# Utilisateurs
# ---------------------------------------------------------------------------

@router.get("/users")
def list_users(
    q: str = "",
    status: str = "",
    plan: str = "",
    from_date: str = "",
    to_date: str = "",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: User = Depends(perm_users),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if q:
        query = query.filter(or_(User.email.ilike(f"%{q}%"), User.full_name.ilike(f"%{q}%")))
    if status:
        query = query.filter(User.is_active == (status == "active"))
    if from_date:
        query = query.filter(User.created_at >= datetime.fromisoformat(from_date))
    if to_date:
        query = query.filter(User.created_at <= datetime.fromisoformat(to_date))
    users = query.order_by(User.created_at.desc()).all()
    summary = [user_summary(db, user) for user in users]
    if plan:
        summary = [row for row in summary if row["plan"] == plan]
    return paginate(summary, page, page_size)


@router.get("/users/{user_id}")
def get_user(
    user_id: int,
    admin: User = Depends(perm_users),
    db: Session = Depends(get_db),
):
    user = get_or_404(db, User, user_id)
    projects = db.query(Project).filter(Project.user_id == user_id).order_by(Project.created_at.desc()).limit(20).all()
    transactions = db.query(Transaction).filter(Transaction.user_id == user_id).order_by(Transaction.created_at.desc()).limit(20).all()
    ledger = db.query(CreditLedger).filter(CreditLedger.user_id == user_id).order_by(CreditLedger.created_at.desc()).limit(20).all()
    return {
        **user_summary(db, user),
        "projects": [project_summary(db, project) for project in projects],
        "transactions": [transaction_summary(db, transaction) for transaction in transactions],
        "credits_history": [{
            "id": row.id, "delta": row.delta, "reason": row.reason, "created_at": iso(row.created_at)
        } for row in ledger],
    }


@router.patch("/users/{user_id}")
def update_user(
    user_id: int,
    payload: dict = Body(...),
    admin: User = Depends(perm_users),
    db: Session = Depends(get_db),
):
    user = get_or_404(db, User, user_id)
    allowed = {"full_name", "email", "is_active", "role"}
    changes = {key: value for key, value in payload.items() if key in allowed}
    if "role" in changes and admin.role != "super_admin":
        raise HTTPException(status_code=403, detail="Seul un super administrateur peut changer les rôles")
    if "role" in changes and changes["role"] not in ADMIN_ROLES | {"user"}:
        raise HTTPException(status_code=400, detail="Rôle invalide")
    if "email" in changes:
        exists = db.query(User).filter(User.email == changes["email"], User.id != user_id).first()
        if exists:
            raise HTTPException(status_code=400, detail="Email déjà utilisé")
    for key, value in changes.items():
        setattr(user, key, value)
    if "is_active" in changes or "role" in changes:
        user.token_version += 1
    audit(db, admin, "user.updated", "user", user_id, {"fields": sorted(changes)})
    db.commit()
    return user_summary(db, user)


@router.post("/users/{user_id}/credits")
def adjust_credits(
    user_id: int,
    payload: dict = Body(...),
    admin: User = Depends(perm_credits),
    db: Session = Depends(get_db),
):
    require_fields(payload, ("delta", "reason"))
    try:
        delta = int(payload["delta"])
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Delta invalide")
    user = get_or_404(db, User, user_id)
    if user.credits + delta < 0:
        raise HTTPException(status_code=400, detail="Solde insuffisant")
    user.credits += delta
    db.add(CreditLedger(user_id=user_id, admin_id=admin.id, delta=delta, reason=str(payload["reason"])))
    audit(db, admin, "credits.adjusted", "user", user_id, {"delta": delta, "reason": payload["reason"]})
    db.commit()
    return {"credits": user.credits}


@router.post("/users/{user_id}/subscription")
def assign_subscription(
    user_id: int,
    payload: dict = Body(...),
    admin: User = Depends(perm_plans),
    db: Session = Depends(get_db),
):
    require_fields(payload, ("plan_id",))
    plan = get_or_404(db, Plan, int(payload["plan_id"]))
    get_or_404(db, User, user_id)
    db.query(Subscription).filter(Subscription.user_id == user_id, Subscription.status == "active").update(
        {Subscription.status: "cancelled"}, synchronize_session=False
    )
    subscription = Subscription(
        user_id=user_id,
        plan_id=plan.id,
        status="active",
        starts_at=now(),
        ends_at=now() + timedelta(days=plan.duration_days) if plan.duration_days else None,
        auto_renew=bool(payload.get("auto_renew", False)),
    )
    db.add(subscription)
    audit(db, admin, "subscription.assigned", "user", user_id, {"plan": plan.code})
    db.commit()
    return {"id": subscription.id, "plan": plan.code}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    admin: User = Depends(perm_users),
    db: Session = Depends(get_db),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Impossible de supprimer votre propre compte")
    user = get_or_404(db, User, user_id)
    for project in db.query(Project).filter(Project.user_id == user_id).all():
        for path in (
            video_file_path(project.video_filename),
            audio_file_path(project.id, ".flac"),
            audio_file_path(project.id, ".wav"),
        ):
            if os.path.exists(path):
                os.remove(path)
        for subtitle in project.subtitles:
            path = subtitle_file_path(subtitle.filename)
            if os.path.exists(path):
                os.remove(path)
    db.query(TicketMessage).filter(TicketMessage.sender_id == user_id).delete(synchronize_session=False)
    db.query(AuditLog).filter(AuditLog.admin_id == user_id).update({AuditLog.admin_id: None}, synchronize_session=False)
    audit(db, admin, "user.deleted", "user", user_id, {"email": user.email})
    db.delete(user)
    db.commit()
    return {"message": "Compte supprimé"}


@router.post("/users/{user_id}/reset")
def reset_user_data(
    user_id: int,
    admin: User = Depends(perm_users),
    db: Session = Depends(get_db),
):
    user = get_or_404(db, User, user_id)
    for project in db.query(Project).filter(Project.user_id == user_id).all():
        for path in (video_file_path(project.video_filename), audio_file_path(project.id)):
            if os.path.exists(path):
                os.remove(path)
        db.delete(project)
    user.credits = 0
    user.token_version += 1
    audit(db, admin, "user.reset", "user", user_id, {})
    db.commit()
    return {"message": "Données de génération réinitialisées"}


@router.get("/users/{user_id}/activity")
def user_activity(
    user_id: int,
    admin: User = Depends(perm_activity),
    db: Session = Depends(get_db),
):
    projects = db.query(Project).filter(Project.user_id == user_id).order_by(Project.created_at.desc()).limit(30).all()
    transactions = db.query(Transaction).filter(Transaction.user_id == user_id).order_by(Transaction.created_at.desc()).limit(30).all()
    return {
        "projects": [project_summary(db, row) for row in projects],
        "transactions": [transaction_summary(db, row) for row in transactions],
    }


# ---------------------------------------------------------------------------
# Vidéos et générations IA
# ---------------------------------------------------------------------------

@router.get("/projects")
def list_projects(
    q: str = "",
    status: str = "",
    user_id: int | None = None,
    slow: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: User = Depends(perm_generations),
    db: Session = Depends(get_db),
):
    query = db.query(Project)
    if q:
        query = query.filter(or_(Project.title.ilike(f"%{q}%"), Project.original_filename.ilike(f"%{q}%")))
    if status:
        query = query.filter(Project.status == status)
    if user_id:
        query = query.filter(Project.user_id == user_id)
    rows = query.order_by(Project.created_at.desc()).all()
    items = [project_summary(db, row) for row in rows]
    if slow:
        items = [row for row in items if row["processing_minutes"] is None or row["processing_minutes"] > 10]
    return paginate(items, page, page_size)


@router.get("/projects/{project_id}")
def get_project(
    project_id: int,
    admin: User = Depends(perm_generations),
    db: Session = Depends(get_db),
):
    project = get_or_404(db, Project, project_id)
    logs = db.query(GenerationLog).filter(GenerationLog.project_id == project_id).order_by(GenerationLog.created_at.desc()).limit(100).all()
    return {
        **project_summary(db, project),
        "logs": [{
            "id": log.id, "level": log.level, "message": log.message,
            "resource": log.resource, "created_at": iso(log.created_at),
        } for log in logs],
    }


@router.get("/projects/{project_id}/logs")
def project_logs(
    project_id: int,
    admin: User = Depends(perm_generations),
    db: Session = Depends(get_db),
):
    logs = db.query(GenerationLog).filter(GenerationLog.project_id == project_id).order_by(GenerationLog.created_at.desc()).all()
    return [{
        "id": log.id, "level": log.level, "message": log.message,
        "resource": log.resource, "created_at": iso(log.created_at),
    } for log in logs]


@router.post("/projects/{project_id}/retry")
def retry_project(
    project_id: int,
    background_tasks: BackgroundTasks,
    admin: User = Depends(perm_generations),
    db: Session = Depends(get_db),
):
    project = get_or_404(db, Project, project_id)
    if project.status not in ("error", "failed", "cancelled", "expired"):
        raise HTTPException(status_code=400, detail="Seules les générations échouées ou annulées peuvent être relancées")
    project.status = "processing"
    project.progress = 10
    db.add(GenerationLog(project_id=project_id, level="warning", message="Relance demandée par l'administrateur", resource="admin"))
    audit(db, admin, "generation.retried", "project", project_id, {})
    db.commit()
    from app.api.v1.endpoints.projects import process_project_task
    background_tasks.add_task(process_project_task, project_id)
    return {"message": "Génération relancée", "status": "processing"}


@router.post("/projects/{project_id}/cancel")
def cancel_project(
    project_id: int,
    admin: User = Depends(perm_generations),
    db: Session = Depends(get_db),
):
    project = get_or_404(db, Project, project_id)
    if project.status in ("completed", "failed", "cancelled"):
        raise HTTPException(status_code=400, detail="Cette génération ne peut plus être annulée")
    project.status = "cancelled"
    db.add(GenerationLog(project_id=project_id, level="warning", message="Génération annulée par l'administrateur", resource="admin"))
    audit(db, admin, "generation.cancelled", "project", project_id, {})
    db.commit()
    return {"message": "Génération annulée", "status": "cancelled"}


# ---------------------------------------------------------------------------
# Abonnements et forfaits
# ---------------------------------------------------------------------------

@router.get("/plans")
def list_plans(
    admin: User = Depends(perm_plans),
    db: Session = Depends(get_db),
):
    rows = db.query(Plan).order_by(Plan.id).all()
    return [{
        "id": plan.id,
        "code": plan.code,
        "name": plan.name,
        "description": plan.description or "",
        "price": plan.price,
        "currency": plan.currency,
        "duration_days": plan.duration_days,
        "generation_limit": plan.generation_limit,
        "video_max_minutes": plan.video_max_minutes,
        "backup_enabled": plan.backup_enabled,
        "retention_minutes": plan.retention_minutes,
        "features": plan.features or {},
        "is_active": plan.is_active,
        "is_archived": plan.is_archived,
        "subscribers": db.query(func.count(Subscription.id)).filter(
            Subscription.plan_id == plan.id, Subscription.status == "active"
        ).scalar() or 0,
    } for plan in rows]


@router.post("/plans")
def create_plan(
    payload: dict = Body(...),
    admin: User = Depends(perm_plans),
    db: Session = Depends(get_db),
):
    require_fields(payload, ("code", "name"))
    if db.query(Plan).filter(Plan.code == payload["code"]).first():
        raise HTTPException(status_code=400, detail="Code de forfait déjà utilisé")
    plan = Plan(
        code=str(payload["code"]).upper().replace(" ", "_"),
        name=str(payload["name"]),
        description=payload.get("description"),
        price=float(payload.get("price", 0)),
        currency=str(payload.get("currency", "USD")),
        duration_days=int(payload.get("duration_days", 30)),
        generation_limit=payload.get("generation_limit"),
        video_max_minutes=payload.get("video_max_minutes"),
        backup_enabled=bool(payload.get("backup_enabled", False)),
        retention_minutes=int(payload.get("retention_minutes", 120)),
        features=payload.get("features", {}),
        is_active=bool(payload.get("is_active", True)),
    )
    db.add(plan)
    audit(db, admin, "plan.created", "plan", plan.code, payload)
    db.commit()
    return {"id": plan.id, "message": "Forfait créé"}


@router.patch("/plans/{plan_id}")
def update_plan(
    plan_id: int,
    payload: dict = Body(...),
    admin: User = Depends(perm_plans),
    db: Session = Depends(get_db),
):
    plan = get_or_404(db, Plan, plan_id)
    allowed = {
        "name", "description", "price", "currency", "duration_days", "generation_limit",
        "video_max_minutes", "backup_enabled", "retention_minutes", "features", "is_active", "is_archived",
    }
    changes = {key: value for key, value in payload.items() if key in allowed}
    for key, value in changes.items():
        setattr(plan, key, value)
    audit(db, admin, "plan.updated", "plan", plan_id, {"fields": sorted(changes)})
    db.commit()
    return {"message": "Forfait mis à jour"}


@router.delete("/plans/{plan_id}")
def archive_plan(
    plan_id: int,
    admin: User = Depends(perm_plans),
    db: Session = Depends(get_db),
):
    plan = get_or_404(db, Plan, plan_id)
    plan.is_archived = True
    plan.is_active = False
    audit(db, admin, "plan.archived", "plan", plan_id, {})
    db.commit()
    return {"message": "Forfait archivé"}


@router.get("/plans/{plan_id}/subscribers")
def plan_subscribers(
    plan_id: int,
    admin: User = Depends(perm_plans),
    db: Session = Depends(get_db),
):
    subscriptions = db.query(Subscription).filter(Subscription.plan_id == plan_id).order_by(Subscription.id.desc()).all()
    return [{
        "id": row.id,
        "user": db.query(User).filter(User.id == row.user_id).first().email,
        "status": row.status,
        "starts_at": iso(row.starts_at),
        "ends_at": iso(row.ends_at),
        "generations_used": row.generations_used,
    } for row in subscriptions]


@router.get("/subscriptions")
def list_subscriptions(
    status: str = "",
    plan_id: int | None = None,
    admin: User = Depends(perm_plans),
    db: Session = Depends(get_db),
):
    query = db.query(Subscription)
    if status:
        query = query.filter(Subscription.status == status)
    if plan_id:
        query = query.filter(Subscription.plan_id == plan_id)
    rows = query.order_by(Subscription.id.desc()).limit(200).all()
    return [{
        "id": row.id,
        "user": db.query(User).filter(User.id == row.user_id).first().email,
        "plan": db.query(Plan).filter(Plan.id == row.plan_id).first().name,
        "status": row.status,
        "starts_at": iso(row.starts_at),
        "ends_at": iso(row.ends_at),
        "renewals": 0,
    } for row in rows]


# ---------------------------------------------------------------------------
# Paiements et transactions
# ---------------------------------------------------------------------------

@router.get("/transactions")
def list_transactions(
    q: str = "",
    status: str = "",
    method: str = "",
    from_date: str = "",
    to_date: str = "",
    export: str = "",
    admin: User = Depends(perm_payments),
    db: Session = Depends(get_db),
):
    query = db.query(Transaction)
    if q:
        query = query.filter(Transaction.reference.ilike(f"%{q}%"))
    if status:
        query = query.filter(Transaction.status == status)
    if method:
        query = query.filter(Transaction.method == method)
    if from_date:
        query = query.filter(Transaction.created_at >= datetime.fromisoformat(from_date))
    if to_date:
        query = query.filter(Transaction.created_at <= datetime.fromisoformat(to_date))
    rows = query.order_by(Transaction.created_at.desc()).all()
    items = [transaction_summary(db, row) for row in rows]
    if export == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Référence", "Utilisateur", "Montant", "Devise", "Moyen", "Forfait", "Statut", "Date"])
        for row in items:
            writer.writerow([
                row["reference"], row["user"], row["amount"], row["currency"], row["method"],
                row["plan"], row["status"], row["created_at"],
            ])
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=transactions.csv"},
        )
    return {"items": items, "total": len(items)}


@router.get("/transactions/{transaction_id}")
def get_transaction(
    transaction_id: int,
    admin: User = Depends(perm_payments),
    db: Session = Depends(get_db),
):
    return transaction_summary(db, get_or_404(db, Transaction, transaction_id))


@router.post("/transactions/{transaction_id}/refund")
def refund_transaction(
    transaction_id: int,
    payload: dict = Body(default={}),
    admin: User = Depends(perm_payments),
    db: Session = Depends(get_db),
):
    transaction = get_or_404(db, Transaction, transaction_id)
    if transaction.status == "refunded":
        raise HTTPException(status_code=400, detail="Transaction déjà remboursée")
    transaction.status = "refunded"
    audit(db, admin, "payment.refunded", "transaction", transaction_id, {
        "amount": transaction.amount, "reason": payload.get("reason", ""),
    })
    db.commit()
    return {"message": "Remboursement enregistré", "status": "refunded"}


@router.get("/revenue")
def revenue(
    days: int = Query(30, ge=1, le=365),
    admin: User = Depends(perm_payments),
    db: Session = Depends(get_db),
):
    start = now() - timedelta(days=days)
    rows = db.query(Transaction).filter(Transaction.status.in_(PAID_STATUSES), Transaction.created_at >= start).all()
    by_method = defaultdict(float)
    for row in rows:
        by_method[row.method] += row.amount
    refunds = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(Transaction.status == "refunded").scalar() or 0
    return {
        "total": round(sum(row.amount for row in rows), 2),
        "by_method": [{"method": key, "amount": round(value, 2)} for key, value in by_method.items()],
        "refunds": round(float(refunds), 2),
        "series": bucket(rows, "created_at", days, lambda row: row.amount),
    }


# ---------------------------------------------------------------------------
# Crédits
# ---------------------------------------------------------------------------

@router.get("/credits")
def credits_overview(
    q: str = "",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: User = Depends(perm_credits),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if q:
        query = query.filter(or_(User.email.ilike(f"%{q}%"), User.full_name.ilike(f"%{q}%")))
    users = query.order_by(User.credits.desc()).all()
    items = []
    for user in users:
        subscription = active_subscription(db, user.id)
        plan = subscription_plan(db, subscription)
        items.append({
            "id": user.id,
            "user": user.email,
            "full_name": user.full_name or "",
            "credits": user.credits,
            "consumed": db.query(func.count(Project.id)).filter(Project.user_id == user.id).scalar() or 0,
            "plan": plan.code if plan else "FREE",
        })
    return paginate(items, page, page_size)


@router.get("/credits/ledger")
def credits_ledger(
    user_id: int | None = None,
    admin: User = Depends(perm_credits),
    db: Session = Depends(get_db),
):
    query = db.query(CreditLedger)
    if user_id:
        query = query.filter(CreditLedger.user_id == user_id)
    rows = query.order_by(CreditLedger.created_at.desc()).limit(200).all()
    return [{
        "id": row.id,
        "user": db.query(User).filter(User.id == row.user_id).first().email,
        "delta": row.delta,
        "reason": row.reason,
        "created_at": iso(row.created_at),
    } for row in rows]


@router.get("/credits/rules")
def get_credit_rules(
    admin: User = Depends(perm_credits),
    db: Session = Depends(get_db),
):
    return get_setting(db, "credit_rules", {"monthly_reset": True, "cost_per_generation": 1, "anomaly_threshold": 50})


@router.put("/credits/rules")
def update_credit_rules(
    payload: dict = Body(...),
    admin: User = Depends(perm_credits),
    db: Session = Depends(get_db),
):
    set_setting(db, "credit_rules", payload)
    audit(db, admin, "credits.rules_updated", "setting", "credit_rules", payload)
    db.commit()
    return payload


# ---------------------------------------------------------------------------
# Historique et activités
# ---------------------------------------------------------------------------

@router.get("/activity")
def activity(
    q: str = "",
    action: str = "",
    user_id: int | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: User = Depends(perm_activity),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if user_id:
        query = query.filter(AuditLog.admin_id == user_id)
    rows = query.order_by(AuditLog.created_at.desc()).all()
    items = [log_summary(row) for row in rows]
    if q:
        items = [row for row in items if q.lower() in json.dumps(row, ensure_ascii=False).lower()]
    return paginate(items, page, page_size)


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

@router.get("/notifications")
def list_notifications(
    admin: User = Depends(perm_notifications),
    db: Session = Depends(get_db),
):
    rows = db.query(AppNotification).order_by(AppNotification.created_at.desc()).limit(100).all()
    return [{
        "id": row.id, "title": row.title, "body": row.body,
        "audience": row.audience, "kind": row.kind, "created_at": iso(row.created_at),
    } for row in rows]


@router.post("/notifications")
def create_notification(
    payload: dict = Body(...),
    admin: User = Depends(perm_notifications),
    db: Session = Depends(get_db),
):
    require_fields(payload, ("title", "body", "audience"))
    if payload["audience"] not in ("all", "premium", "user"):
        raise HTTPException(status_code=400, detail="Audience invalide")
    if payload["audience"] == "user":
        require_fields(payload, ("user_id",))
        get_or_404(db, User, int(payload["user_id"]))
    notification = AppNotification(
        title=str(payload["title"]),
        body=str(payload["body"]),
        audience=payload["audience"],
        user_id=int(payload["user_id"]) if payload["audience"] == "user" else None,
        kind=str(payload.get("kind", "info")),
    )
    db.add(notification)
    audit(db, admin, "notification.sent", "notification", None, {"audience": payload["audience"]})
    db.commit()
    return {"id": notification.id, "message": "Notification envoyée"}


@router.delete("/notifications/{notification_id}")
def delete_notification(
    notification_id: int,
    admin: User = Depends(perm_notifications),
    db: Session = Depends(get_db),
):
    db.delete(get_or_404(db, AppNotification, notification_id))
    audit(db, admin, "notification.deleted", "notification", notification_id, {})
    db.commit()
    return {"message": "Notification supprimée"}


# ---------------------------------------------------------------------------
# Support
# ---------------------------------------------------------------------------

def ticket_summary(db: Session, ticket: SupportTicket) -> dict:
    user = db.query(User).filter(User.id == ticket.user_id).first()
    messages = db.query(func.count(TicketMessage.id)).filter(TicketMessage.ticket_id == ticket.id).scalar() or 0
    return {
        "id": ticket.id,
        "subject": ticket.subject,
        "user": user.email if user else "—",
        "status": ticket.status,
        "priority": ticket.priority,
        "assigned_to": ticket.assigned_admin_id,
        "messages": messages,
        "created_at": iso(ticket.created_at),
        "updated_at": iso(ticket.updated_at),
    }


@router.get("/tickets")
def list_tickets(
    q: str = "",
    status: str = "",
    admin: User = Depends(perm_support),
    db: Session = Depends(get_db),
):
    query = db.query(SupportTicket)
    if status:
        query = query.filter(SupportTicket.status == status)
    if q:
        query = query.filter(SupportTicket.subject.ilike(f"%{q}%"))
    return [ticket_summary(db, row) for row in query.order_by(SupportTicket.updated_at.desc()).all()]


@router.get("/tickets/{ticket_id}")
def get_ticket(
    ticket_id: int,
    admin: User = Depends(perm_support),
    db: Session = Depends(get_db),
):
    ticket = get_or_404(db, SupportTicket, ticket_id)
    messages = db.query(TicketMessage).filter(TicketMessage.ticket_id == ticket_id).order_by(TicketMessage.created_at).all()
    return {
        **ticket_summary(db, ticket),
        "message_list": [{
            "id": row.id,
            "sender": db.query(User).filter(User.id == row.sender_id).first().email,
            "role": row.sender_role,
            "body": row.body,
            "created_at": iso(row.created_at),
        } for row in messages],
    }


@router.patch("/tickets/{ticket_id}")
def update_ticket(
    ticket_id: int,
    payload: dict = Body(...),
    admin: User = Depends(perm_support),
    db: Session = Depends(get_db),
):
    ticket = get_or_404(db, SupportTicket, ticket_id)
    for key in ("status", "priority", "assigned_admin_id"):
        if key in payload:
            setattr(ticket, key, payload[key])
    audit(db, admin, "ticket.updated", "ticket", ticket_id, payload)
    db.commit()
    return ticket_summary(db, ticket)


@router.post("/tickets/{ticket_id}/messages")
def reply_ticket(
    ticket_id: int,
    payload: dict = Body(...),
    admin: User = Depends(perm_support),
    db: Session = Depends(get_db),
):
    require_fields(payload, ("body",))
    get_or_404(db, SupportTicket, ticket_id)
    message = TicketMessage(
        ticket_id=ticket_id, sender_id=admin.id, sender_role=admin.role, body=str(payload["body"])
    )
    db.add(message)
    db.query(SupportTicket).filter(SupportTicket.id == ticket_id).update(
        {SupportTicket.status: "pending" if payload.get("status") is None else payload["status"]},
        synchronize_session=False,
    )
    audit(db, admin, "ticket.replied", "ticket", ticket_id, {})
    db.commit()
    return {"id": message.id, "message": "Réponse enregistrée"}


# ---------------------------------------------------------------------------
# Analyses et statistiques
# ---------------------------------------------------------------------------

@router.get("/analytics")
def analytics(
    days: int = Query(30, ge=1, le=365),
    admin: User = Depends(perm_analytics),
    db: Session = Depends(get_db),
):
    start = now() - timedelta(days=days)
    month_start = now() - timedelta(days=30)
    dau = db.query(func.count(distinct(User.id))).filter(User.last_active_at >= now() - timedelta(days=1)).scalar() or 0
    mau = db.query(func.count(distinct(User.id))).filter(User.last_active_at >= month_start).scalar() or 0
    total_users = db.query(func.count(User.id)).scalar() or 0
    premium = db.query(func.count(distinct(Subscription.user_id))).join(Plan).filter(
        Subscription.status == "active", Plan.code != "FREE"
    ).scalar() or 0
    active_subs = db.query(func.count(Subscription.id)).filter(Subscription.status == "active").scalar() or 0
    expired_subs = db.query(func.count(Subscription.id)).filter(Subscription.status == "expired").scalar() or 0
    revenue_month = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.status.in_(PAID_STATUSES), Transaction.created_at >= month_start
    ).scalar() or 0
    projects = db.query(Project).filter(Project.created_at >= start).all()
    failed_count = sum(1 for project in projects if project.status in ("error", "failed"))
    durations = [
        (project.completed_at - project.created_at).total_seconds() / 60
        for project in projects if project.completed_at and project.created_at
    ]
    total_minutes = 0.0
    for project in projects:
        if project.duration and len(project.duration.split(":")) == 3:
            hours, mins, seconds = (int(part) for part in project.duration.split(":"))
            total_minutes += hours * 60 + mins + seconds / 60
    paid = float(revenue_month)
    return {
        "dau": dau,
        "mau": mau,
        "conversion_rate": round(premium * 100 / total_users, 2) if total_users else 0,
        "renewal_rate": round(active_subs * 100 / (active_subs + expired_subs), 2) if active_subs + expired_subs else 0,
        "churn_rate": round(expired_subs * 100 / (active_subs + expired_subs), 2) if active_subs + expired_subs else 0,
        "mrr": round(paid, 2),
        "arpu": round(paid / total_users, 2) if total_users else 0,
        "generations_per_day": round(len(projects) / days, 2),
        "average_processing_minutes": round(sum(durations) / len(durations), 2) if durations else 0,
        "failure_rate": round(failed_count * 100 / len(projects), 2) if projects else 0,
        "cost_per_minute": round(paid / total_minutes, 3) if total_minutes else 0,
        "margins": [{
            "plan": plan.code,
            "revenue": round(float(db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
                Transaction.plan_id == plan.id, Transaction.status.in_(PAID_STATUSES)
            ).scalar() or 0), 2),
            "subscribers": db.query(func.count(Subscription.id)).filter(
                Subscription.plan_id == plan.id, Subscription.status == "active"
            ).scalar() or 0,
        } for plan in db.query(Plan).all()],
        "series": bucket(projects, "created_at", days),
    }


# ---------------------------------------------------------------------------
# Langues, moteurs et voix
# ---------------------------------------------------------------------------

@router.get("/languages")
def list_languages(
    admin: User = Depends(perm_languages),
    db: Session = Depends(get_db),
):
    return get_setting(db, "languages", [])


@router.put("/languages")
def save_languages(
    payload: list = Body(...),
    admin: User = Depends(perm_languages),
    db: Session = Depends(get_db),
):
    set_setting(db, "languages", payload)
    audit(db, admin, "languages.updated", "setting", "languages", {"count": len(payload)})
    db.commit()
    return payload


@router.get("/engines")
def list_engines(
    admin: User = Depends(perm_languages),
    db: Session = Depends(get_db),
):
    return {
        "translation": get_setting(db, "translation_engines", [
            {"id": "groq", "name": "Groq", "enabled": True},
            {"id": "libretranslate", "name": "LibreTranslate", "enabled": False},
            {"id": "google", "name": "Google Translate", "enabled": False},
        ]),
        "voice": get_setting(db, "voice_engines", [
            {"id": "groq_tts", "name": "Groq TTS", "enabled": True, "quality": "high"},
        ]),
    }


@router.put("/engines/{kind}")
def save_engines(
    kind: str,
    payload: list = Body(...),
    admin: User = Depends(perm_languages),
    db: Session = Depends(get_db),
):
    if kind not in ("translation", "voice"):
        raise HTTPException(status_code=400, detail="Type de moteur invalide")
    set_setting(db, f"{kind}_engines", payload)
    audit(db, admin, "engines.updated", "setting", kind, {"count": len(payload)})
    db.commit()
    return payload


# ---------------------------------------------------------------------------
# Paramètres de la plateforme et secrets
# ---------------------------------------------------------------------------

@router.get("/settings")
def platform_settings(
    admin: User = Depends(perm_settings),
    db: Session = Depends(get_db),
):
    values = {
        row.key: row.value for row in db.query(GlobalSetting).all()
        if row.key not in ("languages", "translation_engines", "voice_engines")
    }
    secrets = [{
        "id": row.id,
        "service": row.service,
        "hint": row.hint,
        "updated_at": iso(row.updated_at),
    } for row in db.query(ApiSecret).all()]
    return {"values": values, "secrets": secrets}


@router.put("/settings/{key}")
def update_platform_setting(
    key: str,
    payload: dict = Body(...),
    admin: User = Depends(perm_settings),
    db: Session = Depends(get_db),
):
    set_setting(db, key, payload)
    audit(db, admin, "settings.updated", "setting", key, {"keys": sorted(payload)})
    db.commit()
    return payload


@router.post("/secrets")
def save_secret(
    payload: dict = Body(...),
    admin: User = Depends(perm_settings),
    db: Session = Depends(get_db),
):
    require_fields(payload, ("service", "value"))
    service = str(payload["service"])
    value = str(payload["value"])
    hint = "••••••••" + value[-4:] if len(value) >= 4 else "••••••••"
    row = db.query(ApiSecret).filter(ApiSecret.service == service).first()
    encrypted = fernet().encrypt(value.encode()).decode()
    if row is None:
        row = ApiSecret(service=service, encrypted_value=encrypted, hint=hint)
        db.add(row)
    else:
        row.encrypted_value = encrypted
        row.hint = hint
    audit(db, admin, "secret.updated", "secret", service, {})
    db.commit()
    return {"service": service, "hint": hint}


@router.delete("/secrets/{secret_id}")
def delete_secret(
    secret_id: int,
    admin: User = Depends(perm_settings),
    db: Session = Depends(get_db),
):
    row = get_or_404(db, ApiSecret, secret_id)
    service = row.service
    db.delete(row)
    audit(db, admin, "secret.deleted", "secret", service, {})
    db.commit()
    return {"message": "Clé supprimée"}


# ---------------------------------------------------------------------------
# Sécurité et administrateurs
# ---------------------------------------------------------------------------

@router.get("/assignees")
def support_assignees(
    admin: User = Depends(perm_support),
    db: Session = Depends(get_db),
):
    rows = db.query(User).filter(User.role.in_(ADMIN_ROLES), User.is_active.is_(True)).order_by(User.id).all()
    return [{"id": row.id, "email": row.email, "full_name": row.full_name or ""} for row in rows]


@router.get("/admins")
def list_admins(
    admin: User = Depends(perm_security),
    db: Session = Depends(get_db),
):
    rows = db.query(User).filter(User.role.in_(ADMIN_ROLES)).order_by(User.id).all()
    return [{
        "id": row.id,
        "email": row.email,
        "full_name": row.full_name or "",
        "role": row.role,
        "is_active": row.is_active,
        "last_active_at": iso(row.last_active_at),
        "sessions": row.token_version,
    } for row in rows]


@router.post("/admins")
def create_admin(
    payload: dict = Body(...),
    admin: User = Depends(perm_security),
    db: Session = Depends(get_db),
):
    require_fields(payload, ("email", "password", "role"))
    if payload["role"] not in ADMIN_ROLES:
        raise HTTPException(status_code=400, detail="Rôle invalide")
    if admin.role != "super_admin" and payload["role"] != "support":
        raise HTTPException(status_code=403, detail="Seul un super administrateur peut créer ce rôle")
    if db.query(User).filter(User.email == payload["email"]).first():
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    user = User(
        email=str(payload["email"]),
        full_name=payload.get("full_name"),
        password_hash=get_password_hash(str(payload["password"])),
        role=payload["role"],
        is_active=True,
    )
    db.add(user)
    audit(db, admin, "admin.created", "user", user.email, {"role": user.role})
    db.commit()
    return {"id": user.id, "message": "Administrateur créé"}


@router.patch("/admins/{admin_id}")
def update_admin(
    admin_id: int,
    payload: dict = Body(...),
    admin: User = Depends(perm_security),
    db: Session = Depends(get_db),
):
    if admin.role != "super_admin":
        raise HTTPException(status_code=403, detail="Réservé au super administrateur")
    target = get_or_404(db, User, admin_id)
    if target.role not in ADMIN_ROLES:
        raise HTTPException(status_code=400, detail="Ce compte n'est pas un administrateur")
    if "role" in payload:
        if payload["role"] not in ADMIN_ROLES:
            raise HTTPException(status_code=400, detail="Rôle invalide")
        target.role = payload["role"]
    if "is_active" in payload:
        target.is_active = bool(payload["is_active"])
    target.token_version += 1
    audit(db, admin, "admin.updated", "user", admin_id, payload)
    db.commit()
    return {"message": "Administrateur mis à jour"}


@router.post("/admins/{admin_id}/logout")
def force_logout(
    admin_id: int,
    admin: User = Depends(perm_security),
    db: Session = Depends(get_db),
):
    target = get_or_404(db, User, admin_id)
    target.token_version += 1
    audit(db, admin, "admin.forced_logout", "user", admin_id, {})
    db.commit()
    return {"message": "Sessions révoquées"}


@router.get("/security/logs")
def security_logs(
    admin: User = Depends(perm_security),
    db: Session = Depends(get_db),
):
    rows = db.query(AuditLog).filter(
        or_(AuditLog.action.like("admin.%"), AuditLog.action.like("security.%"))
    ).order_by(AuditLog.created_at.desc()).limit(100).all()
    return [log_summary(row) for row in rows]


# ---------------------------------------------------------------------------
# Promotions, parrainage et demandes de données
# ---------------------------------------------------------------------------

@router.get("/promo-codes")
def list_promos(
    admin: User = Depends(perm_promotions),
    db: Session = Depends(get_db),
):
    rows = db.query(PromoCode).order_by(PromoCode.id.desc()).all()
    return [{
        "id": row.id, "code": row.code, "plan_id": row.plan_id,
        "discount_percent": row.discount_percent, "max_uses": row.max_uses,
        "uses": row.uses, "expires_at": iso(row.expires_at), "is_active": row.is_active,
    } for row in rows]


@router.post("/promo-codes")
def create_promo(
    payload: dict = Body(...),
    admin: User = Depends(perm_promotions),
    db: Session = Depends(get_db),
):
    require_fields(payload, ("code",))
    if db.query(PromoCode).filter(PromoCode.code == payload["code"]).first():
        raise HTTPException(status_code=400, detail="Code déjà utilisé")
    promo = PromoCode(
        code=str(payload["code"]).upper(),
        plan_id=payload.get("plan_id"),
        discount_percent=float(payload.get("discount_percent", 10)),
        max_uses=payload.get("max_uses"),
        expires_at=datetime.fromisoformat(payload["expires_at"]) if payload.get("expires_at") else None,
        is_active=bool(payload.get("is_active", True)),
    )
    db.add(promo)
    audit(db, admin, "promo.created", "promo", promo.code, payload)
    db.commit()
    return {"id": promo.id, "message": "Code promo créé"}


@router.patch("/promo-codes/{promo_id}")
def update_promo(
    promo_id: int,
    payload: dict = Body(...),
    admin: User = Depends(perm_promotions),
    db: Session = Depends(get_db),
):
    promo = get_or_404(db, PromoCode, promo_id)
    for key in ("discount_percent", "max_uses", "is_active", "plan_id"):
        if key in payload:
            setattr(promo, key, payload[key])
    if payload.get("expires_at"):
        promo.expires_at = datetime.fromisoformat(payload["expires_at"])
    audit(db, admin, "promo.updated", "promo", promo_id, payload)
    db.commit()
    return {"message": "Code promo mis à jour"}


@router.delete("/promo-codes/{promo_id}")
def delete_promo(
    promo_id: int,
    admin: User = Depends(perm_promotions),
    db: Session = Depends(get_db),
):
    db.delete(get_or_404(db, PromoCode, promo_id))
    audit(db, admin, "promo.deleted", "promo", promo_id, {})
    db.commit()
    return {"message": "Code promo supprimé"}


@router.get("/data-requests")
def data_requests(
    admin: User = Depends(perm_settings),
    db: Session = Depends(get_db),
):
    rows = db.query(DataRequest).order_by(DataRequest.created_at.desc()).all()
    return [{
        "id": row.id, "email": row.email, "status": row.status,
        "created_at": iso(row.created_at), "resolved_at": iso(row.resolved_at),
    } for row in rows]


@router.post("/data-requests")
def create_data_request(
    payload: dict = Body(...),
    admin: User = Depends(perm_settings),
    db: Session = Depends(get_db),
):
    require_fields(payload, ("email",))
    row = DataRequest(email=str(payload["email"]), user_id=payload.get("user_id"))
    db.add(row)
    audit(db, admin, "data_request.created", "data_request", None, {"email": row.email})
    db.commit()
    return {"id": row.id, "message": "Demande enregistrée"}


@router.patch("/data-requests/{request_id}")
def resolve_data_request(
    request_id: int,
    payload: dict = Body(...),
    admin: User = Depends(perm_settings),
    db: Session = Depends(get_db),
):
    row = get_or_404(db, DataRequest, request_id)
    row.status = payload.get("status", "resolved")
    row.resolved_at = now() if row.status == "resolved" else None
    audit(db, admin, "data_request.updated", "data_request", request_id, {"status": row.status})
    db.commit()
    return {"message": "Demande mise à jour"}


# ---------------------------------------------------------------------------
# Surveillance technique et factures
# ---------------------------------------------------------------------------

@router.get("/monitoring")
def monitoring(
    admin: User = Depends(perm_analytics),
    db: Session = Depends(get_db),
):
    size = 0
    count = 0
    for directory in (VIDEO_DIR, SUBTITLE_DIR, AUDIO_DIR):
        for root, _, files in os.walk(directory):
            for filename in files:
                path = os.path.join(root, filename)
                size += os.path.getsize(path)
                count += 1
    errors = db.query(GenerationLog).filter(GenerationLog.level == "error").order_by(GenerationLog.created_at.desc()).limit(20).all()
    return {
        "storage": {"bytes": size, "files": count, "limit_gb": 10},
        "api_errors": [{
            "id": row.id, "message": row.message, "resource": row.resource, "created_at": iso(row.created_at)
        } for row in errors],
        "failed_generations": db.query(func.count(Project.id)).filter(Project.status.in_(("error", "failed"))).scalar() or 0,
    }


@router.get("/invoices")
def invoices(
    admin: User = Depends(perm_payments),
    db: Session = Depends(get_db),
):
    rows = db.query(Transaction).filter(Transaction.status.in_(PAID_STATUSES)).order_by(Transaction.created_at.desc()).limit(100).all()
    return [{
        "number": f"FAC-{row.id:05d}",
        "reference": row.reference,
        "user": db.query(User).filter(User.id == row.user_id).first().email,
        "amount": row.amount,
        "currency": row.currency,
        "created_at": iso(row.created_at),
    } for row in rows]
