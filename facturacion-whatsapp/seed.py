import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models import User


async def main():
    async with AsyncSessionLocal() as db:
        exists = (await db.execute(select(User).limit(1))).scalar_one_or_none()
        if exists:
            print("Ya existe usuario:", exists.id, exists.name)
            return
        u = User(
            whatsapp_id="51999000001",
            name="Tienda Demo",
            business_name="Tienda Demo EIRL",
            ruc="20123456789",
            address="Av. Lima 123",
            district="Miraflores",
            province="Lima",
            department="Lima",
            phone="51999000001",
            email="demo@tienda.pe",
            nubefact_token="",
            nubefact_ruc="20123456789",
            nubefact_user="demo",
            nubefact_password="demo",
            is_active=True,
            is_verified=True,
        )
        db.add(u)
        await db.commit()
        print("Usuario creado:", u.id, u.name)


asyncio.run(main())