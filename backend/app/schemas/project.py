from pydantic import BaseModel
from datetime import datetime

class ProjectBase(BaseModel):
    title: str
    source_language: str = "auto"
    target_language: str = "fr"

class ProjectResponse(BaseModel):
    id: int
    title: str
    filename: str | None = None
    original_filename: str | None = None
    source: str | None = None
    target: str | None = None
    source_language: str | None = None
    target_language: str | None = None
    date: str | None = None
    created_at: datetime | None = None
    status: str
    progress: int
    duration: str | None = None
    segments: int | None = 0

    class Config:
        from_attributes = True

class ProgressResponse(BaseModel):
    status: str
    progress: int
    message: str | None = None
