from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Facturación WhatsApp Bot"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/facturacion"
    REDIS_URL: str = "redis://localhost:6379/0"

    # WhatsApp (Meta Cloud API / Twilio / WAPI)
    WHATSAPP_PROVIDER: str = "meta"  # meta, twilio, wapi
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_ACCESS_TOKEN: str = ""
    WHATSAPP_VERIFY_TOKEN: str = "facturacion_bot_verify_2024"
    WHATSAPP_APP_SECRET: str = ""
    WHATSAPP_WEBHOOK_URL: str = ""

    # Nubefact
    NUBEFACT_API_URL: str = "https://api.nubefact.com/api/v1"
    NUBEFACT_TOKEN: str = ""
    NUBEFACT_RUC: str = ""
    NUBEFACT_USER: str = ""
    NUBEFACT_PASSWORD: str = ""
    NUBEFACT_SANDBOX: bool = True

    # Whisper (local)
    WHISPER_MODEL: str = "base"  # tiny, base, small, medium, large
    WHISPER_DEVICE: str = "cpu"  # cpu, cuda

    # Product Recognition (CLIP) - nombre del modelo openai/CLIP (RN50, ViT-B/32, ...)
    CLIP_MODEL: str = "RN50"
    PRODUCT_SIMILARITY_THRESHOLD: float = 0.82
    MAX_PRODUCT_IMAGES: int = 5

    # OCR (Tesseract via pytesseract or easyocr)
    OCR_LANGUAGES: list = ["es", "en"]

    # Security
    SECRET_KEY: str = "change-me-in-production-very-long-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()