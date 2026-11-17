from pydantic import BaseModel


class TranslationPreferences(BaseModel):
    default_target_language: str = "fr"
    tone: str = "neutral"
    keep_expressions: bool = False
    auto_sync: bool = True


class NotificationPreferences(BaseModel):
    email_on_complete: bool = True
    email_on_error: bool = True
    product_updates: bool = False


class SettingsUpdate(BaseModel):
    preferred_language: str | None = None
    theme: str | None = None
    translation_preferences: TranslationPreferences | None = None
    notifications: NotificationPreferences | None = None


class SettingsResponse(BaseModel):
    preferred_language: str
    theme: str
    translation_preferences: TranslationPreferences
    notifications: NotificationPreferences
