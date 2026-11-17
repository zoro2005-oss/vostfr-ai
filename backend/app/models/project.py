from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    video_filename = Column(String, nullable=False)
    duration = Column(String, nullable=True)
    source_language = Column(String, default="auto")
    target_language = Column(String, default="fr")
    status = Column(String, default="pending")  # pending, processing, completed, error
    progress = Column(Integer, default=0)
    segments_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="projects")
    subtitles = relationship("Subtitle", back_populates="project", cascade="all, delete-orphan")
