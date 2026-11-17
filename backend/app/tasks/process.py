import logging
import os
import subprocess
import time
from datetime import datetime, timezone

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.paths import audio_file_path, subtitle_file_path, video_file_path
from app.models.project import Project
from app.models.subtitle import Subtitle
from app.services.translation import translate_segments

logger = logging.getLogger(__name__)


def format_timestamp_srt(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def format_timestamp_vtt(seconds: float) -> str:
    return format_timestamp_srt(seconds).replace(",", ".")


def format_duration(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def probe_duration(video_path: str) -> float | None:
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                video_path,
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        return float(result.stdout.strip())
    except Exception:
        return None


def extract_audio(video_path: str, audio_path: str) -> None:
    result = subprocess.run(
        [
            "ffmpeg", "-y", "-i", video_path,
            "-vn", "-acodec", "flac", "-ar", "16000", "-ac", "1",
            audio_path,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr[-1000:] or "Extraction audio impossible")


def transcribe_segments_local(audio_path: str) -> list[tuple[str, float, float]]:
    from faster_whisper import WhisperModel

    model = WhisperModel(settings.WHISPER_MODEL, device="cpu", compute_type="int8")
    segments, _ = model.transcribe(audio_path, beam_size=5)
    return [(segment.text.strip(), segment.start, segment.end) for segment in segments]


def _groq_transcribe_file(
    audio_path: str, offset: float, language: str | None
) -> list[tuple[str, float, float]]:
    data = {
        "model": settings.GROQ_WHISPER_MODEL,
        "response_format": "verbose_json",
    }
    if language and language != "auto":
        data["language"] = language

    headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}"}
    with open(audio_path, "rb") as audio_file:
        files = {"file": (os.path.basename(audio_path), audio_file, "audio/flac")}
        with httpx.Client(timeout=600) as client:
            response = client.post(
                f"{settings.GROQ_API_BASE}/audio/transcriptions",
                headers=headers,
                data=data,
                files=files,
            )
            response.raise_for_status()
            payload = response.json()

    segments: list[tuple[str, float, float]] = []
    for segment in payload.get("segments") or []:
        text = (segment.get("text") or "").strip()
        if not text:
            continue
        start = offset + float(segment.get("start") or 0)
        end = offset + float(segment.get("end") or 0)
        segments.append((text, start, end))

    if not segments and payload.get("text"):
        duration = float(payload.get("duration") or 0)
        segments.append((payload["text"].strip(), offset, offset + duration))

    return segments


def _split_audio(audio_path: str) -> list[tuple[str, float]]:
    chunk_seconds = settings.GROQ_AUDIO_CHUNK_SECONDS
    duration = probe_duration(audio_path) or 0
    if duration <= chunk_seconds:
        return [(audio_path, 0.0)]

    base, ext = os.path.splitext(audio_path)
    parts: list[tuple[str, float]] = []
    offset = 0.0
    index = 0
    while offset < duration:
        part_path = f"{base}.part{index:03d}{ext}"
        result = subprocess.run(
            [
                "ffmpeg", "-y", "-ss", str(offset), "-t", str(chunk_seconds),
                "-i", audio_path, "-acodec", "flac", "-ar", "16000", "-ac", "1",
                part_path,
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr[-1000:] or "Découpage audio impossible")
        parts.append((part_path, offset))
        offset += chunk_seconds
        index += 1
    return parts


def _split_audio_part(part_path: str, offset: float) -> list[tuple[str, float]]:
    duration = probe_duration(part_path) or 0
    if duration < 20:
        return []

    base, ext = os.path.splitext(part_path)
    middle = duration / 2
    pieces: list[tuple[str, float]] = []
    for index, (start, length) in enumerate(((0.0, middle), (middle, duration - middle))):
        sub_path = f"{base}.sub{index}{ext}"
        result = subprocess.run(
            [
                "ffmpeg", "-y", "-ss", str(start), "-t", str(length),
                "-i", part_path, "-acodec", "flac", "-ar", "16000", "-ac", "1",
                sub_path,
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr[-1000:] or "Découpage audio impossible")
        pieces.append((sub_path, offset + start))
    return pieces


def _transcribe_part(
    part_path: str, offset: float, language: str | None, depth: int = 0
) -> list[tuple[str, float, float]]:
    attempts = 3
    last_error: Exception | None = None

    for attempt in range(attempts):
        try:
            return _groq_transcribe_file(part_path, offset, language)
        except httpx.HTTPStatusError as exc:
            last_error = exc
            status = exc.response.status_code
            logger.warning(
                "Groq a renvoyé %s pour %s (essai %s/%s)",
                status, os.path.basename(part_path), attempt + 1, attempts,
            )
            if status == 429:
                if attempt < attempts - 1:
                    time.sleep(5 * (attempt + 1))
                    continue
                raise
            if status == 524 or status >= 500:
                if depth < 3:
                    pieces = _split_audio_part(part_path, offset)
                    if pieces:
                        try:
                            segments: list[tuple[str, float, float]] = []
                            for sub_path, sub_offset in pieces:
                                segments.extend(_transcribe_part(sub_path, sub_offset, language, depth + 1))
                            return segments
                        finally:
                            for sub_path, _ in pieces:
                                if os.path.exists(sub_path):
                                    os.remove(sub_path)
                if attempt < attempts - 1:
                    time.sleep(2 * (attempt + 1))
                    continue
            raise
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            last_error = exc
            logger.warning(
                "Erreur réseau Groq pour %s (essai %s/%s)",
                os.path.basename(part_path), attempt + 1, attempts,
            )
            if depth < 3:
                pieces = _split_audio_part(part_path, offset)
                if pieces:
                    try:
                        segments = []
                        for sub_path, sub_offset in pieces:
                            segments.extend(_transcribe_part(sub_path, sub_offset, language, depth + 1))
                        return segments
                    finally:
                        for sub_path, _ in pieces:
                            if os.path.exists(sub_path):
                                os.remove(sub_path)
            if attempt < attempts - 1:
                time.sleep(2 * (attempt + 1))
                continue
            raise

    if last_error:
        raise last_error
    return []


def transcribe_segments_groq(
    audio_path: str, language: str | None
) -> list[tuple[str, float, float]]:
    if not settings.GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY manquant")

    duration = probe_duration(audio_path) or 0
    needs_split = (
        os.path.getsize(audio_path) > settings.GROQ_MAX_AUDIO_BYTES
        or duration > settings.GROQ_AUDIO_CHUNK_SECONDS
    )
    parts = _split_audio(audio_path) if needs_split else [(audio_path, 0.0)]

    segments: list[tuple[str, float, float]] = []
    try:
        for part_path, offset in parts:
            segments.extend(_transcribe_part(part_path, offset, language))
    finally:
        for part_path, _ in parts:
            if part_path != audio_path and os.path.exists(part_path):
                os.remove(part_path)
    return segments


def transcribe_segments(
    audio_path: str, language: str | None = None
) -> list[tuple[str, float, float]]:
    if (settings.TRANSCRIPTION_PROVIDER or "").lower() == "groq" and settings.GROQ_API_KEY:
        return transcribe_segments_groq(audio_path, language)
    if (settings.TRANSCRIPTION_PROVIDER or "").lower() == "groq":
        logger.warning("GROQ_API_KEY absent : repli sur Whisper local (CPU)")
    return transcribe_segments_local(audio_path)


def write_srt(path: str, cues: list[dict]) -> str:
    lines = []
    for cue in cues:
        lines.append(f"{cue['sequence_number']}\n")
        lines.append(f"{cue['start_time']} --> {cue['end_time']}\n")
        lines.append(f"{cue['text']}\n\n")
    content = "".join(lines)
    with open(path, "w", encoding="utf-8") as file:
        file.write(content)
    return content


def write_vtt(path: str, cues: list[dict]) -> str:
    lines = ["WEBVTT\n\n"]
    for cue in cues:
        start = cue["start_time"].replace(",", ".")
        end = cue["end_time"].replace(",", ".")
        lines.append(f"{start} --> {end}\n")
        lines.append(f"{cue['text']}\n\n")
    content = "".join(lines)
    with open(path, "w", encoding="utf-8") as file:
        file.write(content)
    return content


def process_project(db: Session, project_id: int) -> None:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return

    try:
        project.status = "processing"
        project.progress = 10
        db.commit()

        video_path = video_file_path(project.video_filename)
        duration = probe_duration(video_path)
        if duration:
            project.duration = format_duration(duration)
        project.progress = 20
        db.commit()

        audio_path = audio_file_path(project_id)
        extract_audio(video_path, audio_path)

        project.progress = 40
        db.commit()

        segments = transcribe_segments(audio_path, project.source_language)

        db.query(Subtitle).filter(Subtitle.project_id == project.id).delete()
        db.commit()

        project.progress = 50
        db.commit()

        texts = [text for text, _, _ in segments]

        def update_progress(done: int, total: int) -> None:
            project.progress = 50 + int(20 * done / max(total, 1))
            db.commit()

        translated_texts = translate_segments(
            texts,
            project.source_language,
            project.target_language,
            on_progress=update_progress,
        )

        cues = [
            {
                "sequence_number": sequence_number,
                "start_time": format_timestamp_srt(start),
                "end_time": format_timestamp_srt(end),
                "text": translated or "",
            }
            for sequence_number, ((_, start, end), translated) in enumerate(
                zip(segments, translated_texts), start=1
            )
        ]
        project.segments_count = len(cues)

        project.progress = 70
        db.commit()

        base_name = os.path.splitext(os.path.basename(project.original_filename))[0]
        suffix = project.target_language or "fr"
        srt_filename = f"{base_name}.{suffix}.srt"
        vtt_filename = f"{base_name}.{suffix}.vtt"

        write_srt(subtitle_file_path(srt_filename), cues)
        write_vtt(subtitle_file_path(vtt_filename), cues)

        db.add(Subtitle(project_id=project.id, filename=srt_filename, format="srt"))
        db.add(Subtitle(project_id=project.id, filename=vtt_filename, format="vtt"))

        project.completed_at = datetime.now(timezone.utc)
        project.progress = 100
        project.status = "completed"
        db.commit()

    except Exception:
        logger.exception("Échec du traitement du projet %s", project_id)
        db.rollback()
        project = db.query(Project).filter(Project.id == project_id).first()
        if project:
            project.status = "error"
            project.progress = 0
            db.commit()
    finally:
        for extension in (".flac", ".wav"):
            audio_path = audio_file_path(project_id, extension)
            if os.path.exists(audio_path):
                os.remove(audio_path)
