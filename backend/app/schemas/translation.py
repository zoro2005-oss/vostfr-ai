from pydantic import BaseModel

class SubtitleSegment(BaseModel):
    id: int
    start: str
    end: str
    original: str
    translated: str | None = None

    class Config:
        from_attributes = True
