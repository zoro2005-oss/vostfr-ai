import json

from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine

DEFAULT_PLANS = [
    {
        "code": "FREE",
        "name": "Gratuit",
        "description": "3 générations par mois pour découvrir VOSTFR AI. Vidéos jusqu'à 2 h 30 incluses ; au-delà, passez à Premium. Vidéos conservées 2 heures.",
        "price": 0,
        "currency": "USD",
        "duration_days": 30,
        "generation_limit": 3,
        "video_max_minutes": 150,
        "backup_enabled": False,
        "retention_minutes": 120,
        "features": {
            "reset_monthly": True,
            "premium": False,
            "price_fcfa": 0,
            "highlight": "Pour découvrir",
        },
    },
    {
        "code": "PREMIUM_15",
        "name": "Premium 15 jours",
        "description": "15 générations valables 15 jours, sans sauvegarde, sans limite de durée par vidéo. Idéal pour un essai sérieux.",
        "price": 7.99,
        "currency": "USD",
        "duration_days": 15,
        "generation_limit": 15,
        "video_max_minutes": None,
        "backup_enabled": False,
        "retention_minutes": 120,
        "features": {
            "premium": True,
            "price_fcfa": 4800,
            "highlight": "Essai premium",
        },
    },
    {
        "code": "PREMIUM_30_BACKUP",
        "name": "Premium 30 jours – 30 générations",
        "description": "30 générations valables 30 jours avec sauvegarde, conservation permanente et aucune limite de durée par vidéo.",
        "price": 19.99,
        "currency": "USD",
        "duration_days": 30,
        "generation_limit": 30,
        "video_max_minutes": None,
        "backup_enabled": True,
        "retention_minutes": 0,
        "features": {
            "premium": True,
            "download": True,
            "price_fcfa": 12000,
            "highlight": "Le plus choisi",
        },
    },
    {
        "code": "PREMIUM_30_UNLIMITED",
        "name": "Premium 30 jours – Illimité",
        "description": "Générations illimitées valables 30 jours, sans sauvegarde, sans limite de durée par vidéo. Suppression automatique après 15 minutes.",
        "price": 29.99,
        "currency": "USD",
        "duration_days": 30,
        "generation_limit": None,
        "video_max_minutes": None,
        "backup_enabled": False,
        "retention_minutes": 15,
        "features": {
            "premium": True,
            "unlimited_mode": "no_hard_count",
            "price_fcfa": 18000,
            "highlight": "Gros volumes",
        },
    },
]

DEFAULT_LANGUAGES = [
    {"code": "fr", "name": "Français", "source": True, "target": True, "voices": []},
    {"code": "ja", "name": "Japonais", "source": True, "target": True, "voices": []},
    {"code": "zh", "name": "Chinois", "source": True, "target": True, "voices": []},
    {"code": "ko", "name": "Coréen", "source": True, "target": True, "voices": []},
    {"code": "en", "name": "Anglais", "source": True, "target": True, "voices": []},
    {"code": "es", "name": "Espagnol", "source": True, "target": True, "voices": []},
]

DEFAULT_SETTINGS = {
    "platform": {
        "name": "VOSTFR AI",
        "description": "Traduction et doublage automatique de vidéos par intelligence artificielle.",
        "contact_email": "",
        "maintenance": False,
    },
    "subscriptions": {"currency": "USD", "trial_days": 0, "monthly_reset": True},
    "storage": {"provider": "local", "max_size_gb": 10},
    "notifications": {"email_enabled": False},
    "legal": {"terms": "", "privacy": ""},
}


def bootstrap_admin_data() -> None:
    """Prépare le premier administrateur et les données de configuration initiales."""
    if engine.dialect.name != "postgresql":
        return

    with engine.begin() as connection:
        if settings.ADMIN_EMAIL.strip():
            connection.execute(
                text("UPDATE users SET role = 'super_admin' WHERE lower(email) = :email"),
                {"email": settings.ADMIN_EMAIL.strip().lower()},
            )

        for plan in DEFAULT_PLANS:
            connection.execute(
                text(
                    "INSERT INTO plans "
                    "(code, name, description, price, currency, duration_days, generation_limit, "
                    "video_max_minutes, backup_enabled, retention_minutes, features, is_active, is_archived) "
                    "VALUES (CAST(:code AS varchar), CAST(:name AS varchar), CAST(:description AS varchar), "
                    "CAST(:price AS numeric), CAST(:currency AS varchar), CAST(:duration_days AS integer), "
                    "CAST(:generation_limit AS integer), CAST(:video_max_minutes AS integer), "
                    "CAST(:backup_enabled AS boolean), CAST(:retention_minutes AS integer), "
                    "CAST(:features AS json), true, false) "
                    "ON CONFLICT (code) DO NOTHING"
                ),
                {
                    **plan,
                    "features": json.dumps(plan["features"]),
                },
            )

        for key, value in {**DEFAULT_SETTINGS, "languages": DEFAULT_LANGUAGES}.items():
            connection.execute(
                text(
                    "INSERT INTO global_settings (key, value) "
                    "VALUES (:key, CAST(:value AS json)) "
                    "ON CONFLICT (key) DO NOTHING"
                ),
                {"key": key, "value": json.dumps(value)},
            )
