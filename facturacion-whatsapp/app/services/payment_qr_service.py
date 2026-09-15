import qrcode
import io
import base64
import logging
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta

from app.models import PaymentQR, User, Invoice
from app.core.config import settings
from app.services.whatsapp_service import WhatsAppService

logger = logging.getLogger(__name__)


class PaymentQRService:
    """Genera códigos QR para pagos Yape/Plin/BCP/Interbank/BBVA"""
    
    # Formato EMVCo para QR de pagos Perú
    @staticmethod
    def build_emvco_qr(
        provider: str,
        phone: str,
        amount: float,
        currency: str = "PEN",
        merchant_name: str = "",
        merchant_city: str = "LIMA",
        transaction_ref: str = "",
        concept: str = ""
    ) -> str:
        """
        Construye string EMVCo QR para pagos Perú.
        Formato basado en estándar EMVCo + especificaciones locales.
        """
        # Payload Format Indicator (ID 00) - siempre "01"
        payload = "01"
        
        # Point of Initiation Method (ID 01) - "11" estático, "12" dinámico
        payload += "01" + "02" + "11"
        
        # Merchant Account Information (ID 26-51) - para cada proveedor
        if provider.lower() == "yape":
            # Yape usa ID 26 con GUID específico
            guid = "00000000-0000-0000-0000-000000000000"  # En producción: GUID real del comercio
            merchant_info = f"0016com.yape.merchant{guid}"
            payload += "26" + f"{len(merchant_info):02d}" + merchant_info
            
        elif provider.lower() == "plin":
            # Plin usa ID 26 con identificador
            merchant_info = f"0013com.plin.merchant{phone[-9:]}"
            payload += "26" + f"{len(merchant_info):02d}" + merchant_info
            
        elif provider.lower() in ["bcp", "interbank", "bbva", "scotiabank"]:
            # Bancos usan ID 26 con identificador propio
            bank_codes = {"bcp": "002", "interbank": "003", "bbva": "004", "scotiabank": "005"}
            code = bank_codes.get(provider.lower(), "000")
            merchant_info = f"00{len(phone)+3:02d}{code}{phone}"
            payload += "26" + f"{len(merchant_info):02d}" + merchant_info
        
        # Merchant Category Code (ID 52) - 4 dígitos
        payload += "52" + "04" + "5399"  # Miscellaneous General Merchandise
        
        # Transaction Currency (ID 53) - ISO 4217
        payload += "53" + "03" + ("604" if currency == "PEN" else "840")
        
        # Transaction Amount (ID 54) - opcional para QR dinámico
        if amount > 0:
            amount_str = f"{amount:.2f}"
            payload += "54" + f"{len(amount_str):02d}" + amount_str
        
        # Country Code (ID 58) - ISO 3166-1 alpha-2
        payload += "58" + "02" + "PE"
        
        # Merchant Name (ID 59)
        if merchant_name:
            name = merchant_name[:25]
            payload += "59" + f"{len(name):02d}" + name
        
        # Merchant City (ID 60)
        city = merchant_city[:15]
        payload += "60" + f"{len(city):02d}" + city
        
        # Additional Data Field Template (ID 62)
        additional = ""
        if transaction_ref:
            # Reference Label (ID 05)
            ref = transaction_ref[:25]
            additional += "05" + f"{len(ref):02d}" + ref
        
        if concept:
            # Description (ID 08) - para concepto
            desc = concept[:25]
            additional += "08" + f"{len(desc):02d}" + desc
        
        if additional:
            payload += "62" + f"{len(additional):02d}" + additional
        
        # CRC (ID 63) - Calcular CRC16 CCITT
        crc = PaymentQRService._calculate_crc16(payload + "6304")
        payload += "63" + "04" + crc
        
        return payload

    @staticmethod
    def _calculate_crc16(data: str) -> str:
        """Calcula CRC16 CCITT (XModem) para EMVCo"""
        crc = 0xFFFF
        for byte in data.encode('utf-8'):
            crc ^= (byte << 8)
            for _ in range(8):
                if crc & 0x8000:
                    crc = (crc << 1) ^ 0x1021
                else:
                    crc = (crc << 1)
                crc &= 0xFFFF
        return f"{crc:04X}"

    @staticmethod
    def generate_qr_image(qr_string: str, size: int = 10, border: int = 4) -> bytes:
        """Genera imagen PNG del QR"""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=size,
            border=border,
        )
        qr.add_data(qr_string)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        return buffer.getvalue()

    @staticmethod
    def generate_qr_base64(qr_string: str) -> str:
        """Genera QR como base64 para embed en HTML"""
        img_bytes = PaymentQRService.generate_qr_image(qr_string)
        return base64.b64encode(img_bytes).decode('utf-8')


async def create_payment_qr(
    db: AsyncSession,
    user: User,
    amount: float,
    concept: str,
    provider: str = "yape",
    invoice_id: int = None,
    expires_hours: int = 24
) -> PaymentQR:
    """Crear QR de pago y guardar en BD"""
    
    # Obtener teléfono del comerciante (desde config o user)
    phone = user.nubefact_ruc or user.phone or "999888777"  # fallback
    merchant_name = user.business_name or user.name or "Mi Negocio"
    
    # Generar referencia única
    import uuid
    txn_ref = f"INV{invoice_id or 0}-{uuid.uuid4().hex[:8].upper()}"
    
    # Construir QR EMVCo
    qr_string = PaymentQRService.build_emvco_qr(
        provider=provider,
        phone=phone,
        amount=amount,
        merchant_name=merchant_name,
        transaction_ref=txn_ref,
        concept=concept
    )
    
    # Generar imagen
    qr_image_bytes = PaymentQRService.generate_qr_image(qr_string)
    
    # En producción: subir a S3/Cloudinary y guardar URL
    # Por ahora guardamos base64
    qr_base64 = base64.b64encode(qr_image_bytes).decode('utf-8')
    qr_data_url = f"data:image/png;base64,{qr_base64}"
    
    # Crear registro
    payment_qr = PaymentQR(
        user_id=user.id,
        invoice_id=invoice_id,
        amount=amount,
        concept=concept,
        provider=provider.lower(),
        phone_number=phone,
        qr_data=qr_string,
        qr_image_url=qr_data_url,
        expires_at=datetime.utcnow() + timedelta(hours=expires_hours),
        status="generated"
    )
    
    db.add(payment_qr)
    await db.commit()
    await db.refresh(payment_qr)
    
    return payment_qr


async def send_payment_qr_whatsapp(
    whatsapp_id: str,
    payment_qr: PaymentQR,
    whatsapp_service: WhatsAppService
) -> bool:
    """Enviar QR de pago por WhatsApp"""
    try:
        # En producción: subir imagen a hosting y enviar URL
        # Por ahora enviamos como documento base64 (limitación WhatsApp)
        
        caption = (
            f"💳 *Pago con {payment_qr.provider.upper()}*\n\n"
            f"💰 Monto: S/ {payment_qr.amount:.2f}\n"
            f"📝 Concepto: {payment_qr.concept}\n"
            f"📱 Escanea el código QR desde tu app\n\n"
            f"⏰ Expira: {payment_qr.expires_at.strftime('%d/%m/%Y %H:%M') if payment_qr.expires_at else 'Sin expiración'}"
        )
        
        # Convertir base64 a bytes para enviar
        import base64
        header, data = payment_qr.qr_image_url.split(",", 1)
        img_bytes = base64.b64decode(data)
        
        # Subir a hosting temporal o enviar como media
        # Por simplicidad, enviamos texto con instrucciones
        await whatsapp_service.send_text_message(whatsapp_id, caption)
        
        # En producción: usar whatsapp_service.send_image con URL real
        # await whatsapp_service.send_image(whatsapp_id, real_url, caption)
        
        return True
    except Exception as e:
        logger.error(f"Error enviando QR WhatsApp: {e}")
        return False


# ===== Detección automática de pago (Webhook simulado) =====
class PaymentWebhookHandler:
    """Maneja notificaciones de pago de Yape/Plin/Bancos"""
    
    @staticmethod
    async def handle_yape_webhook(payload: Dict[str, Any], db: AsyncSession) -> Dict[str, Any]:
        """Procesar webhook de Yape"""
        # Estructura típica Yape:
        # {
        #   "transactionId": "YAPE123456",
        #   "amount": 50.00,
        #   "currency": "PEN",
        #   "merchantPhone": "999888777",
        #   "customerPhone": "988777666",
        #   "status": "COMPLETED",
        #   "timestamp": "2024-01-15T10:30:00Z",
        #   "reference": "INV123-ABC12345"
        # }
        
        reference = payload.get("reference", "")
        amount = payload.get("amount", 0)
        status = payload.get("status", "")
        txn_id = payload.get("transactionId", "")
        
        # Buscar QR por referencia
        from sqlalchemy import select
        result = await db.execute(
            select(PaymentQR).where(PaymentQR.transaction_id == reference)
        )
        payment_qr = result.scalar_one_or_none()
        
        if not payment_qr:
            # Buscar por monto y teléfono si no hay referencia
            result = await db.execute(
                select(PaymentQR).where(
                    PaymentQR.phone_number == payload.get("merchantPhone"),
                    PaymentQR.amount == amount,
                    PaymentQR.status == "generated"
                ).order_by(PaymentQR.created_at.desc())
            )
            payment_qr = result.scalars().first()
        
        if payment_qr and status in ["COMPLETED", "APPROVED", "SUCCESS"]:
            payment_qr.status = "paid"
            payment_qr.paid_at = datetime.utcnow()
            payment_qr.paid_amount = amount
            payment_qr.transaction_id = txn_id
            
            # Si tiene factura asociada, marcar como pagada
            if payment_qr.invoice_id:
                from app.models import Invoice
                inv_result = await db.execute(
                    select(Invoice).where(Invoice.id == payment_qr.invoice_id)
                )
                invoice = inv_result.scalar_one_or_none()
                if invoice:
                    invoice.sent_to_customer = True
                    invoice.sent_at = datetime.utcnow()
            
            await db.commit()
            return {"success": True, "payment_qr_id": payment_qr.id}
        
        return {"success": False, "error": "QR no encontrado o pago no completado"}

    @staticmethod
    async def handle_plin_webhook(payload: Dict[str, Any], db: AsyncSession) -> Dict[str, Any]:
        """Procesar webhook de Plin"""
        # Similar a Yape pero con campos Plin
        return await PaymentWebhookHandler.handle_yape_webhook(payload, db)


# ===== API Endpoints para QR =====
"""
@router.post("/api/v1/payment/qr/generate")
async def generate_payment_qr(
    amount: float = Form(...),
    concept: str = Form(...),
    provider: str = Form("yape"),
    invoice_id: int = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    payment_qr = await create_payment_qr(db, user, amount, concept, provider, invoice_id)
    return {
        "qr_string": payment_qr.qr_data,
        "qr_image_base64": payment_qr.qr_image_url.split(",")[1],
        "expires_at": payment_qr.expires_at
    }


@router.post("/api/v1/payment/webhook/yape")
async def yape_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.json()
    return await PaymentWebhookHandler.handle_yape_webhook(payload, db)


@router.post("/api/v1/payment/webhook/plin")
async def plin_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.json()
    return await PaymentWebhookHandler.handle_plin_webhook(payload, db)
"""