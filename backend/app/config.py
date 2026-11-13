import os
import secrets
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "EUE"
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1")
    FORCE_HTTPS: bool = os.getenv("FORCE_HTTPS", "False").lower() in ("true", "1")

    # Database (Uses least-privilege scoped connection in prod)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./eue_schedule.db")

    # Cryptographic Keys (Loaded from .env; auto-generates strong key if unset)
    SECRET_KEY: str = os.getenv("SECRET_KEY", secrets.token_urlsafe(48))
    DATA_ENCRYPTION_KEY: str = os.getenv("DATA_ENCRYPTION_KEY", "eue-field-encryption-master-key-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # Server-side only API keys (Never exposed to frontend)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    # Transactional Email APIs (HTTPS port 443 alternatives)
    BREVO_API_KEY: str = os.getenv("BREVO_API_KEY", "")
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    GAS_WEBHOOK_URL: str = os.getenv("GAS_WEBHOOK_URL", "")

    # SMTP Settings (TLS port 587)
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "EUE Schedule")

    ALLOWED_EMAIL_DOMAINS: List[str] = [
        "uol.eue.edu.eg",
        "uclan.eue.edu.eg",
        "uel.eue.edu.eg"
    ]
    ENFORCE_UNIVERSITY_DOMAIN: bool = True

    # Max upload size: 5 MB (Item #16)
    MAX_UPLOAD_BYTES: int = 5 * 1024 * 1024

    CORS_ORIGINS: List[str] = [
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:19006"
    ]

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
        case_sensitive = True

settings = Settings()
