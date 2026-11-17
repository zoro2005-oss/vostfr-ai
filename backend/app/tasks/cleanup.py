import logging
import os
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.paths import (
    SUBTITLE_DIR,
    VIDEO_DIR,
    audio_file_path,
    subtitle_file_path,
    video_file_path,
)
from app.db.session import SessionLocal
from app.models.project import Project
from app.models.subtitle import Subtitle

logger = logging.getLogger(__name__)


def _remove_file(path: str | None) -> None:
    if not path:
        return
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError:
        logger.warning("Impossible de supprimer le fichier %s", path, exc_info=True)


def delete_project_data(db: Session, project: Project) -> None:
    _remove_file(video_file_path(project.video_filename))
    for subtitle in list(project.subtitles):
        _remove_file(subtitle_file_path(subtitle.filename))
    for extension in (".flac", ".wav"):
        _remove_file(audio_file_path(project.id, extension))

    db.delete(project)
    db.commit()


def cleanup_expired_projects(db: Session, retention_hours: int | None = None) -> int:
    hours = settings.FILE_RETENTION_HOURS if retention_hours is None else retention_hours
    if hours <= 0:
        return 0

    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    expired = (
        db.query(Project)
        .filter(
            Project.status == "completed",
            or_(
                Project.completed_at < cutoff,
                and_(Project.completed_at.is_(None), Project.created_at < cutoff),
            ),
        )
        .all()
    )

    removed = 0
    for project in expired:
        try:
            delete_project_data(db, project)
            removed += 1
        except Exception:
            db.rollback()
            logger.exception("Échec de la suppression du projet expiré %s", project.id)

    if removed:
        logger.info("%s projet(s) expiré(s) supprimé(s) après %sh", removed, hours)
    return removed


def _cleanup_orphan_directory(directory: str, known_names: set[str], cutoff: float) -> int:
    removed = 0
    try:
        entries = list(os.scandir(directory))
    except OSError:
        logger.warning("Dossier introuvable pour le nettoyage : %s", directory, exc_info=True)
        return 0

    for entry in entries:
        if not entry.is_file() or entry.name in known_names:
            continue
        try:
            if entry.stat().st_mtime > cutoff:
                continue
            os.remove(entry.path)
            removed += 1
        except OSError:
            logger.warning("Impossible de supprimer le fichier orphelin %s", entry.path, exc_info=True)
    return removed


def cleanup_orphan_files(db: Session, grace_minutes: int | None = None) -> int:
    minutes = settings.ORPHAN_FILE_GRACE_MINUTES if grace_minutes is None else grace_minutes
    cutoff = time.time() - max(minutes, 0) * 60

    video_names = {name for (name,) in db.query(Project.video_filename).all()}
    subtitle_names = {name for (name,) in db.query(Subtitle.filename).all()}

    removed = _cleanup_orphan_directory(VIDEO_DIR, video_names, cutoff)
    removed += _cleanup_orphan_directory(SUBTITLE_DIR, subtitle_names, cutoff)

    if removed:
        logger.info("%s fichier(s) orphelin(s) supprimé(s)", removed)
    return removed


def run_cleanup_task() -> tuple[int, int]:
    db = SessionLocal()
    try:
        expired = cleanup_expired_projects(db)
        orphans = cleanup_orphan_files(db)
        return expired, orphans
    finally:
        db.close()
