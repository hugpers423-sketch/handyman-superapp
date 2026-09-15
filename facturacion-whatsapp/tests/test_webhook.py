import json
import uuid
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from app.core.database import AsyncSessionLocal
from app.models import Invoice, InvoiceItem, Product


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _text_payload(whatsapp_id: str, body: str, message_id: str = None) -> dict:
    message_id = message_id or f"wamid.{uuid.uuid4()}"
    return {
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "101",
            "changes": [{
                "value": {
                    "messaging_product": "whatsapp",
                    "metadata": {
                        "display_phone_number": "16505551111",
                        "phone_number_id": "101",
                    },
                    "contacts": [{
                        "profile": {"name": "Cliente Demo"},
                        "wa_id": whatsapp_id,
                    }],
                    "messages": [{
                        "from": whatsapp_id,
                        "id": message_id,
                        "timestamp": "1700000000",
                        "type": "text",
                        "text": {"body": body},
                    }],
                },
                "field": "messages",
            }],
        }],
    }


def _post_message(client, whatsapp_id: str, body: str):
    return client.post(
        "/api/v1/webhook",
        json=_text_payload(whatsapp_id, body),
        headers={"X-Hub-Signature-256": "sha256=testdev"},
    )


class TestWebhookVerify:
    def test_verify_ok(self, client):
        r = client.get(
            "/api/v1/webhook",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": "facturacion_test_verify",
                "hub.challenge": "12345",
            },
        )
        assert r.status_code == 200
        assert r.json() == 12345

    def test_verify_denied(self, client):
        r = client.get(
            "/api/v1/webhook",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": "token-invalido",
                "hub.challenge": "12345",
            },
        )
        assert r.status_code == 403


class TestInvoiceFlow:
    @pytest.mark.asyncio
    async def test_create_invoice_message(self, client):
        sent = []

        async def record(wid, text):
            sent.append(text)

        async def record_doc(wid, url, name):
            sent.append(f"[doc] {name}")

        with patch(
            "app.services.whatsapp_service.WhatsAppService.send_text_message",
            new=AsyncMock(side_effect=record),
        ), patch(
            "app.services.whatsapp_service.WhatsAppService.send_document",
            new=AsyncMock(side_effect=record_doc),
        ), patch(
            "app.services.invoice_service.InvoiceService.send_to_sunat",
            new=AsyncMock(return_value={
                "success": True,
                "pdf_url": "http://test/1.pdf",
                "xml_url": "http://test/1.xml",
            }),
        ):
            r = _post_message(
                client, "51999000001", "Polo negro talla M, 30 soles, DNI 12345678"
            )
            assert r.status_code == 200
            assert r.json() == {"status": "ok"}

        assert any("Boleta generada" in t for t in sent)
        assert any("[doc] Boleta_B001-1.pdf" in t for t in sent)

        async with AsyncSessionLocal() as db:
            invoices = (await db.execute(select(Invoice))).scalars().all()
            assert len(invoices) == 1
            inv = invoices[0]
            assert inv.customer_doc == "12345678"
            assert inv.document_type == "03"
            assert inv.series == "B001"
            assert inv.total == 35.4
            items = (await db.execute(select(InvoiceItem))).scalars().all()
            assert len(items) == 1
            assert items[0].description.lower() == "polo negro talla m"
            assert items[0].unit_price == 30.0

    def test_register_product_asks_for_photo(self, client):
        sent = []

        async def record(wid, text):
            sent.append(text)

        with patch(
            "app.services.whatsapp_service.WhatsAppService.send_text_message",
            new=AsyncMock(side_effect=record),
        ):
            r = _post_message(
                client, "51999000002", "registrar producto Casaca azul L, 80 soles, 10 unidades"
            )
            assert r.status_code == 200

        assert any("Registrar producto" in t for t in sent)

    def test_no_items_sends_help(self, client):
        sent = []

        async def record(wid, text):
            sent.append(text)

        with patch(
            "app.services.whatsapp_service.WhatsAppService.send_text_message",
            new=AsyncMock(side_effect=record),
        ):
            r = _post_message(client, "51999000003", "hola")
            assert r.status_code == 200

        assert any("productos" in t.lower() or "ayuda" in t.lower() or "comando" in t.lower() for t in sent)
