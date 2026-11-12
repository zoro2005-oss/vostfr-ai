import os
from datetime import datetime
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.translation import Translation
from app.models.subtitle import Subtitle
from app.core.config import settings

router = APIRouter()

UPLOAD_DIR = os.path.abspath(settings.UPLOAD_DIR)
VIDEO_DIR = os.path.join(UPLOAD_DIR, "videos")
SUBTITLE_DIR = os.path.join(UPLOAD_DIR, "subtitles")

os.makedirs(VIDEO_DIR, exist_ok=True)
os.makedirs(SUBTITLE_DIR, exist_ok=True)

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
    file_path = os.path.join(VIDEO_DIR, filename)

    size = 0
    try:
        with open(file_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > settings.MAX_UPLOAD_SIZE:
                    raise HTTPException(status_code=413, detail="Fichier trop volumineux")
                buffer.write(chunk)
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
        video_path=file_path,
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
            "segments": len(p.translations)
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
        "segments": len(project.translations),
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

@router.get("/{project_id}/subtitles")
def get_subtitles(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    
    translations = db.query(Translation).filter(Translation.project_id == project_id).order_by(Translation.sequence_number).all()
    segments = []
    for t in translations:
        segments.append({
            "id": t.id,
            "start": t.start_time,
            "end": t.end_time,
            "original": t.original_text,
            "translated": t.translated_text
        })
    return segments

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
    if subtitle.content:
        return Response(
            content=subtitle.content,
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{subtitle.filename}"'},
        )

    if not os.path.exists(subtitle.file_path):
        raise HTTPException(status_code=404, detail="Fichier non trouvé")

    return FileResponse(subtitle.file_path, filename=subtitle.filename, media_type=media_type)

@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    
    try:
        if project.video_path and os.path.exists(project.video_path):
            os.remove(project.video_path)
    except:
        pass
    
    for sub in project.subtitles:
        try:
            if sub.file_path and os.path.exists(sub.file_path):
                os.remove(sub.file_path)
        except Exception:
            pass

    for extension in (".flac", ".wav"):
        try:
            audio_path = os.path.join(UPLOAD_DIR, "audios", f"{project.id}{extension}")
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
