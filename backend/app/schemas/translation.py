from pydantic import BaseModel

class SubtitleSegment(BaseModel):
    id: int
    start: str
    end: str
    translated: str | None = None

    class Config:
        from_attributes = True
