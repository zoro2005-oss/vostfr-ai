from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg://user:password@localhost:5433/vostfr_ai"
    SECRET_KEY: str = "change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080
    ALGORITHM: str = "HS256"
    UPLOAD_DIR: str = "./storage"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024 * 1024
    FILE_RETENTION_HOURS: int = 2
    CLEANUP_INTERVAL_MINUTES: int = 10
    ORPHAN_FILE_GRACE_MINUTES: int = 60
    CORS_ORIGINS: str = "http://localhost:5173"
    TRANSLATION_PROVIDER: str = "groq"
    TRANSCRIPTION_PROVIDER: str = "groq"
    TRANSLATION_API_KEY: str = ""
    TRANSLATION_API_URL: str = ""
    WHISPER_MODEL: str = "small"
    GROQ_API_KEY: str = ""
    GROQ_API_BASE: str = "https://api.groq.com/openai/v1"
    GROQ_WHISPER_MODEL: str = "whisper-large-v3-turbo"
    GROQ_TRANSLATION_MODEL: str = "openai/gpt-oss-120b"
    GROQ_MAX_AUDIO_BYTES: int = 24 * 1024 * 1024
    GROQ_AUDIO_CHUNK_SECONDS: int = 300
    FRONTEND_URL: str = "http://localhost:5173"
    PASSWORD_RESET_EXPIRE_MINUTES: int = 30
    EXPOSE_RESET_URL: bool = False
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "no-reply@vostfr.ai"
    SMTP_TLS: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = True

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

settings = Settings()
