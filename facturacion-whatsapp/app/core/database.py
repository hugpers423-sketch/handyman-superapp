from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from app.core.config import settings
from app.models import Base


class BaseModel(DeclarativeBase):
    pass


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Migración idempotente para BD existentes (columnas de notas)
        if engine.dialect.name == "sqlite":
            rows = (await conn.execute(text("PRAGMA table_info(invoices)"))).fetchall()
            cols = {row[1] for row in rows}
            if "related_invoice_id" not in cols:
                await conn.execute(text("ALTER TABLE invoices ADD COLUMN related_invoice_id INTEGER"))
            if "credit_note_reason" not in cols:
                await conn.execute(text("ALTER TABLE invoices ADD COLUMN credit_note_reason VARCHAR(10)"))
        else:
            await conn.execute(text(
                "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS related_invoice_id INTEGER"
            ))
            await conn.execute(text(
                "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS credit_note_reason VARCHAR(10)"
            ))


async def close_db():
    await engine.dispose()