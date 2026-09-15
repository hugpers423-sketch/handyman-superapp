from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.models import User, Conversation
from datetime import datetime


class ConversationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_user(self, whatsapp_id: str, contact: dict) -> User:
        """Obtener o crear usuario desde WhatsApp"""
        result = await self.db.execute(
            select(User).where(User.whatsapp_id == whatsapp_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            user = User(
                whatsapp_id=whatsapp_id,
                name=contact.get("profile", {}).get("name", ""),
                phone=whatsapp_id,
                is_active=True,
                is_verified=False,
            )
            self.db.add(user)
            await self.db.commit()
            await self.db.refresh(user)
        
        return user

    async def create_conversation(
        self,
        user_id: int,
        whatsapp_message_id: str,
        message_type: str,
        incoming_text: str,
    ) -> Conversation:
        """Guardar conversación entrante"""
        conversation = Conversation(
            user_id=user_id,
            whatsapp_message_id=whatsapp_message_id,
            message_type=message_type,
            incoming_text=incoming_text,
            status="pending",
        )
        self.db.add(conversation)
        await self.db.commit()
        await self.db.refresh(conversation)
        return conversation

    async def update_conversation_response(
        self,
        conversation_id: int,
        response_text: str,
        response_media_url: str = None,
        status: str = "completed",
        error_message: str = None,
        processing_time_ms: int = None,
    ):
        """Actualizar conversación con respuesta"""
        result = await self.db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conversation = result.scalar_one_or_none()
        
        if conversation:
            conversation.response_text = response_text
            conversation.response_media_url = response_media_url
            conversation.status = status
            conversation.error_message = error_message
            conversation.processing_time_ms = processing_time_ms
            await self.db.commit()

    async def get_user_conversations(self, user_id: int, limit: int = 50) -> list:
        """Obtener historial de conversaciones"""
        result = await self.db.execute(
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .order_by(Conversation.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()