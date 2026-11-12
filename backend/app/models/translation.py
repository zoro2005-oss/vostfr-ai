from sqlalchemy import Column, Integer, String, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.base import Base

class Translation(Base):
    __tablename__ = "translations"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    original_text = Column(Text, nullable=False)
    translated_text = Column(Text, nullable=True)
    start_time = Column(String, nullable=False)
    end_time = Column(String, nullable=False)
    sequence_number = Column(Integer, nullable=False)

    project = relationship("Project", back_populates="translations")
