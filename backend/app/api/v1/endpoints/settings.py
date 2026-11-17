from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.setting import Setting
from app.models.user import User
from app.schemas.setting import (
    NotificationPreferences,
    SettingsResponse,
    SettingsUpdate,
    TranslationPreferences,
)

router = APIRouter()


def _serialize(setting: Setting) -> SettingsResponse:
    return SettingsResponse(
        preferred_language=setting.preferred_language or "fr",
        theme=setting.theme or "dark",
        translation_preferences=TranslationPreferences(**(setting.translation_preferences or {})),
        notifications=NotificationPreferences(**(setting.notifications or {})),
    )


def _get_or_create(db: Session, user: User) -> Setting:
    setting = db.query(Setting).filter(Setting.user_id == user.id).first()
    if setting:
        return setting

    setting = Setting(
        user_id=user.id,
        preferred_language="fr",
        theme="dark",
        translation_preferences=TranslationPreferences().model_dump(),
        notifications=NotificationPreferences().model_dump(),
    )
    db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting


@router.get("", response_model=SettingsResponse)
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _serialize(_get_or_create(db, current_user))


@router.put("", response_model=SettingsResponse)
def update_settings(
    payload: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    setting = _get_or_create(db, current_user)

    if payload.preferred_language is not None:
        setting.preferred_language = payload.preferred_language
    if payload.theme is not None:
        setting.theme = payload.theme
    if payload.translation_preferences is not None:
        setting.translation_preferences = payload.translation_preferences.model_dump()
    if payload.notifications is not None:
        setting.notifications = payload.notifications.model_dump()

    db.commit()
    db.refresh(setting)
    return _serialize(setting)
