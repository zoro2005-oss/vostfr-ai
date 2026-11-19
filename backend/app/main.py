import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

import app.models  # noqa: F401 - enregistre tous les modèles SQLAlchemy
from app.api.v1.router import api_router
from app.core.bootstrap import bootstrap_admin_data
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.tasks.cleanup import run_cleanup_task

logger = logging.getLogger(__name__)


def _ensure_schema() -> None:
    Base.metadata.create_all(bind=engine)
    if engine.dialect.name != "postgresql":
        return

    with engine.begin() as connection:
        for statement in (
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(30) DEFAULT 'user' NOT NULL",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0 NOT NULL",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0 NOT NULL",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE",
            "ALTER TABLE projects ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE",
            "ALTER TABLE plans ALTER COLUMN is_archived SET DEFAULT false",
        ):
            connection.execute(text(statement))
        connection.execute(
            text(
                "ALTER TABLE settings "
                "ADD COLUMN IF NOT EXISTS notifications JSON DEFAULT '{}'::json"
            )
        )

        project_columns = {
            row[0]
            for row in connection.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name = 'projects'"
                )
            )
        }
        if "video_path" in project_columns and "video_filename" not in project_columns:
            connection.execute(
                text("ALTER TABLE projects RENAME COLUMN video_path TO video_filename")
            )

        connection.execute(
            text(
                "UPDATE projects "
                "SET video_filename = regexp_replace(video_filename, '^.*/', '') "
                "WHERE video_filename LIKE '%/%'"
            )
        )
        connection.execute(text("ALTER TABLE subtitles DROP COLUMN IF EXISTS file_path"))
        connection.execute(
            text(
                "UPDATE subtitles "
                "SET filename = regexp_replace(filename, '^.*/', '') "
                "WHERE filename LIKE '%/%'"
            )
        )

    bootstrap_admin_data()


async def _cleanup_loop() -> None:
    while True:
        try:
            await asyncio.to_thread(run_cleanup_task)
        except Exception:
            logger.exception("Échec du nettoyage des fichiers expirés")
        await asyncio.sleep(max(settings.CLEANUP_INTERVAL_MINUTES, 1) * 60)


@asynccontextmanager
async def lifespan(_: FastAPI):
    _ensure_schema()

    cleanup_task = None
    if settings.FILE_RETENTION_HOURS > 0:
        cleanup_task = asyncio.create_task(_cleanup_loop())

    try:
        yield
    finally:
        if cleanup_task:
            cleanup_task.cancel()
            with suppress(asyncio.CancelledError):
                await cleanup_task


app = FastAPI(
    title="VOSTFR AI API",
    description="API Backend pour VOSTFR AI - Génération automatique de sous-titres",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")

@app.get("/")
def root():
    return {"message": "VOSTFR AI API", "status": "running"}
