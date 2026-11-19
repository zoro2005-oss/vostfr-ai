import os
import re
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, status
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.subtitle import Subtitle
from app.models.admin import Plan, Subscription
from app.core.config import settings
from app.core.paths import audio_file_path, subtitle_file_path, video_file_path
from app.tasks.process import probe_duration

router = APIRouter()
FREE_VIDEO_LIMIT_MINUTES = 150.0


def current_plan(db: Session, user_id: int) -> Plan | None:
    now = datetime.now(timezone.utc)
    subscription = db.query(Subscription).filter(
        Subscription.user_id == user_id,
        Subscription.status == "active",
        or_(Subscription.ends_at.is_(None), Subscription.ends_at >= now),
    ).order_by(Subscription.id.desc()).first()
    if subscription:
        return db.get(Plan, subscription.plan_id)
    return db.query(Plan).filter(Plan.code == "FREE").first()

@router.post("/upload")
async def upload_video(
    file: UploadFile = File(...),
    source_language: str = Form("auto"),
    target_language: str = Form("fr"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    original_filename = os.path.basename(file.filename or "")
    allowed_extensions = {'.mp4', '.mkv', '.avi', '.mov', '.webm'}
    ext = os.path.splitext(original_filename)[1].lower()
    if not original_filename or ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Format de vidéo non supporté")

    filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid4().hex}{ext}"
    file_path = video_file_path(filename)

    size = 0
    try:
        with open(file_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > settings.MAX_UPLOAD_SIZE:
                    raise HTTPException(status_code=413, detail="Fichier trop volumineux")
                buffer.write(chunk)

        plan = current_plan(db, current_user.id)
        if not plan or plan.code == "FREE":
            limit_minutes = float(plan.video_max_minutes or FREE_VIDEO_LIMIT_MINUTES) if plan else FREE_VIDEO_LIMIT_MINUTES
            if (probe_duration(file_path) or 0) > limit_minutes * 60:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail=(
                        f"Votre vidéo dépasse {int(limit_minutes)} minutes. "
                        "Cette durée est réservée aux formules Premium : passez à Premium pour traiter toutes vos vidéos sans limite de durée."
                    ),
                )
    except HTTPException:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise
    finally:
        await file.close()

    project = Project(
        user_id=current_user.id,
        title=os.path.splitext(original_filename)[0] or "Vidéo",
        original_filename=original_filename,
        video_filename=filename,
        source_language=source_language,
        target_language=target_language,
        status="pending",
        progress=0
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    
    return {"id": project.id, "message": "Upload réussi"}

@router.get("")
def list_projects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    projects = db.query(Project).filter(Project.user_id == current_user.id).order_by(Project.created_at.desc()).all()
    result = []
    for p in projects:
        result.append({
            "id": p.id,
            "title": p.title,
            "filename": p.original_filename,
            "source": p.source_language,
            "target": p.target_language,
            "date": p.created_at.strftime("%d/%m/%Y %H:%M") if p.created_at else "",
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "status": "Terminé" if p.status == "completed" else "En cours" if p.status == "processing" else "Erreur" if p.status == "error" else "En attente",
            "progress": p.progress,
            "duration": p.duration or "-",
            "segments": p.segments_count or 0
        })
    return result

@router.get("/{project_id}")
def get_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    return {
        "id": project.id,
        "title": project.title,
        "filename": project.original_filename,
        "source": project.source_language,
        "target": project.target_language,
        "source_language": project.source_language,
        "target_language": project.target_language,
        "date": project.created_at.strftime("%d/%m/%Y %H:%M") if project.created_at else "",
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "status": project.status,
        "progress": project.progress,
        "duration": project.duration,
        "segments": project.segments_count or 0,
    }

@router.post("/{project_id}/translate")
def start_translation(project_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    
    project.status = "processing"
    project.progress = 10
    db.commit()
    
    background_tasks.add_task(process_project_task, project_id)
    
    return {"message": "Traitement lancé", "status": "processing"}

@router.get("/{project_id}/progress")
def get_progress(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    return {"status": project.status, "progress": project.progress}

def _parse_subtitle_blocks(content: str, skip_headers: bool = False) -> list[dict]:
    segments = []
    for block in re.split(r"\n\s*\n", content.strip()):
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if not lines:
            continue
        if skip_headers and lines[0].upper().startswith(("WEBVTT", "NOTE")):
            continue
        index = 1 if lines[0].isdigit() else 0
        if index >= len(lines) or "-->" not in lines[index]:
            continue
        start, end = [part.strip() for part in lines[index].split("-->", 1)]
        end = end.split()[0]
        text = "\n".join(lines[index + 1:]).strip()
        if text:
            segments.append({"start": start, "end": end, "translated": text})
    return segments


def _read_subtitle_segments(subtitle: Subtitle | None) -> list[dict]:
    if not subtitle:
        return []
    path = subtitle_file_path(subtitle.filename)
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as file:
        content = file.read()
    segments = _parse_subtitle_blocks(content, skip_headers=subtitle.format == "vtt")
    for index, segment in enumerate(segments, start=1):
        segment["id"] = index
    return segments


@router.get("/{project_id}/subtitles")
def get_subtitles(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")

    subtitle = (
        db.query(Subtitle)
        .filter(Subtitle.project_id == project_id)
        .order_by(Subtitle.id)
        .first()
    )
    return _read_subtitle_segments(subtitle)

@router.get("/{project_id}/download")
def download_subtitle(project_id: int, format: str = "srt", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    
    if format not in {"srt", "vtt"}:
        raise HTTPException(status_code=400, detail="Format non supporté")

    subtitle = db.query(Subtitle).filter(Subtitle.project_id == project_id, Subtitle.format == format).first()
    if not subtitle:
        raise HTTPException(status_code=404, detail="Fichier non trouvé")

    media_type = "text/vtt" if format == "vtt" else "text/plain"
    path = subtitle_file_path(subtitle.filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Fichier non trouvé")

    return FileResponse(path, filename=subtitle.filename, media_type=media_type)

@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    
    try:
        path = video_file_path(project.video_filename)
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass

    for sub in project.subtitles:
        try:
            path = subtitle_file_path(sub.filename)
            if os.path.exists(path):
                os.remove(path)
        except Exception:
            pass

    for extension in (".flac", ".wav"):
        try:
            audio_path = audio_file_path(project.id, extension)
            if os.path.exists(audio_path):
                os.remove(audio_path)
        except Exception:
            pass

    db.delete(project)
    db.commit()
    return {"message": "Projet supprimé"}

def process_project_task(project_id: int):
    from app.db.session import SessionLocal
    from app.tasks.process import process_project
    db = SessionLocal()
    try:
        process_project(db, project_id)
    finally:
        db.close()
