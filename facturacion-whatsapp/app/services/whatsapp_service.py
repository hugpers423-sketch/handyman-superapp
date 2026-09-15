import httpx
import logging
from typing import Optional, Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)


class WhatsAppService:
    def __init__(self):
        self.base_url = f"https://graph.facebook.com/v18.0/{settings.WHATSAPP_PHONE_NUMBER_ID}"
        self.headers = {
            "Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}",
            "Content-Type": "application/json",
        }
        self.client = httpx.AsyncClient(timeout=30.0)

    async def get_media_url(self, media_id: str) -> str:
        """Obtener URL de descarga de media de Meta"""
        url = f"https://graph.facebook.com/v18.0/{media_id}"
        response = await self.client.get(url, headers=self.headers)
        response.raise_for_status()
        data = response.json()
        return data.get("url", "")

    async def download_media(self, media_url: str) -> bytes:
        """Descargar archivo de media"""
        response = await self.client.get(media_url, headers=self.headers)
        response.raise_for_status()
        return response.content

    async def send_text_message(self, to: str, text: str) -> Dict[str, Any]:
        """Enviar mensaje de texto"""
        url = f"{self.base_url}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "text",
            "text": {"body": text[:4096]},  # Límite WhatsApp
        }
        response = await self.client.post(url, json=payload, headers=self.headers)
        response.raise_for_status()
        return response.json()

    async def send_document(self, to: str, document_url: str, filename: str, caption: str = "") -> Dict[str, Any]:
        """Enviar documento (PDF, XML)"""
        url = f"{self.base_url}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "document",
            "document": {
                "link": document_url,
                "filename": filename,
                "caption": caption[:1024],
            },
        }
        response = await self.client.post(url, json=payload, headers=self.headers)
        response.raise_for_status()
        return response.json()

    async def send_image(self, to: str, image_url: str, caption: str = "") -> Dict[str, Any]:
        """Enviar imagen"""
        url = f"{self.base_url}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "image",
            "image": {
                "link": image_url,
                "caption": caption[:1024],
            },
        }
        response = await self.client.post(url, json=payload, headers=self.headers)
        response.raise_for_status()
        return response.json()

    async def send_interactive_buttons(self, to: str, body: str, buttons: list) -> Dict[str, Any]:
        """Enviar botones interactivos"""
        url = f"{self.base_url}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {"text": body},
                "action": {
                    "buttons": [
                        {"type": "reply", "reply": {"id": btn["id"], "title": btn["title"][:20]}}
                        for btn in buttons[:3]
                    ]
                },
            },
        }
        response = await self.client.post(url, json=payload, headers=self.headers)
        response.raise_for_status()
        return response.json()

    async def mark_as_read(self, message_id: str) -> Dict[str, Any]:
        """Marcar mensaje como leído"""
        url = f"{self.base_url}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "status": "read",
            "message_id": message_id,
        }
        response = await self.client.post(url, json=payload, headers=self.headers)
        response.raise_for_status()
        return response.json()

    async def close(self):
        await self.client.aclose()


class TwilioWhatsAppService:
    """Alternativa usando Twilio"""
    def __init__(self):
        from twilio.rest import Client
        self.client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        self.from_number = settings.TWILIO_WHATSAPP_NUMBER

    async def send_text_message(self, to: str, text: str):
        message = self.client.messages.create(
            body=text,
            from_=f"whatsapp:{self.from_number}",
            to=f"whatsapp:{to}"
        )
        return message.sid

    async def send_media(self, to: str, media_url: str, caption: str = ""):
        message = self.client.messages.create(
            body=caption,
            from_=f"whatsapp:{self.from_number}",
            to=f"whatsapp:{to}",
            media_url=[media_url]
        )
        return message.sid