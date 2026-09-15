import os

# Aislar los tests de la BD/credenciales de desarrollo (prioridad sobre .env)
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_facturacion.db")
os.environ.setdefault("WHATSAPP_VERIFY_TOKEN", "facturacion_test_verify")
os.environ.setdefault("WHATSAPP_APP_SECRET", "")

# BD de test siempre limpia
if os.path.exists("test_facturacion.db"):
    os.remove("test_facturacion.db")

import pytest
import asyncio


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# Configurar pytest-asyncio
pytest_plugins = ("pytest_asyncio",)