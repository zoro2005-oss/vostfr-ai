ADMIN_ROLES = {"super_admin", "admin", "finance", "support", "tech"}

PERMISSIONS = {
    "super_admin": {"*"},
    "admin": {
        "users", "generations", "plans", "payments", "credits", "activity",
        "notifications", "support", "analytics", "settings", "promotions", "languages",
    },
    "finance": {"plans", "payments", "credits", "analytics", "activity", "promotions"},
    "support": {"users", "support", "notifications", "activity", "generations"},
    "tech": {"generations", "languages", "settings", "analytics", "activity"},
}


def has_permission(role: str, permission: str) -> bool:
    granted = PERMISSIONS.get(role, set())
    return "*" in granted or permission in granted
