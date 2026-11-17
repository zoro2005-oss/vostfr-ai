import os

from app.core.config import settings

UPLOAD_DIR = os.path.abspath(settings.UPLOAD_DIR)
VIDEO_DIR = os.path.join(UPLOAD_DIR, "videos")
SUBTITLE_DIR = os.path.join(UPLOAD_DIR, "subtitles")
AUDIO_DIR = os.path.join(UPLOAD_DIR, "audios")

for _directory in (VIDEO_DIR, SUBTITLE_DIR, AUDIO_DIR):
    os.makedirs(_directory, exist_ok=True)


def video_file_path(filename: str) -> str:
    return os.path.join(VIDEO_DIR, os.path.basename(filename))


def subtitle_file_path(filename: str) -> str:
    return os.path.join(SUBTITLE_DIR, os.path.basename(filename))


def audio_file_path(project_id: int, extension: str = ".flac") -> str:
    return os.path.join(AUDIO_DIR, f"{project_id}{extension}")
