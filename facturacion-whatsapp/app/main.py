from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
import logging

from app.core.config import settings
from app.core.database import init_db, close_db
from app.api import whatsapp_webhook, dashboard

# Configurar logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Iniciando Facturación WhatsApp Bot...")
    await init_db()
    logger.info("Base de datos inicializada")
    yield
    # Shutdown
    logger.info("Cerrando aplicación...")
    await close_db()


app = FastAPI(
    title=settings.APP_NAME,
    description="Bot de facturación electrónica por WhatsApp para emprendedores peruanos",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# Session middleware (para dashboard)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SECRET_KEY,
    max_age=30 * 24 * 60 * 60,  # 30 días
    same_site="lax",
    https_only=not settings.DEBUG,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(whatsapp_webhook.router, prefix=settings.API_V1_PREFIX)
app.include_router(dashboard.router)


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "dashboard": "/dashboard/",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/webhook-test")
async def webhook_test():
    """Endpoint de prueba para verificar webhook"""
    return {
        "message": "Webhook endpoint activo",
        "verify_token": settings.WHATSAPP_VERIFY_TOKEN,
        "provider": settings.WHATSAPP_PROVIDER,
    }