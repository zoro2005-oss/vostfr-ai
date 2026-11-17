from sqlalchemy import Column, Integer, String, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.base import Base

class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    preferred_language = Column(String, default="fr")
    theme = Column(String, default="dark")
    translation_preferences = Column(JSON, default=dict)
    notifications = Column(JSON, default=dict)

    user = relationship("User", back_populates="settings")
