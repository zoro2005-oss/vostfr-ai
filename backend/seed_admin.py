import sys

from app.core.permissions import ADMIN_ROLES
from app.db.session import SessionLocal
from app.models.user import User


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python seed_admin.py <email> [role]")
        return 1
    email = sys.argv[1].strip().lower()
    role = sys.argv[2] if len(sys.argv) > 2 else "super_admin"
    if role not in ADMIN_ROLES:
        print(f"Rôle invalide. Choix : {', '.join(sorted(ADMIN_ROLES))}")
        return 1

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            print("Aucun compte ne correspond à cet email. Inscrivez-vous d'abord sur l'application.")
            return 1
        user.role = role
        user.is_active = True
        user.token_version += 1
        db.commit()
        print(f"{email} est maintenant {role}. Reconnectez-vous pour obtenir un nouveau jeton.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
