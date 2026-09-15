from fastapi import APIRouter, Request, HTTPException, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any
import httpx
import json
import hashlib
import hmac
import logging
from datetime import datetime

from app.core.config import settings
from app.core.database import get_db
from app.services.whatsapp_service import WhatsAppService
from app.services.conversation_service import ConversationService
from app.services.audio_service import AudioService
from app.services.nlp_service import NLPService
from app.services.invoice_service import InvoiceService
from app.services.product_recognition_service import ProductRecognitionService

router = APIRouter()
logger = logging.getLogger(__name__)


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """Verificar firma de Meta WhatsApp Cloud API"""
    if not settings.WHATSAPP_APP_SECRET:
        return True  # Skip en desarrollo
    
    expected_signature = hmac.new(
        settings.WHATSAPP_APP_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(f"sha256={expected_signature}", signature)


@router.get("/webhook")
async def verify_webhook(request: Request):
    """Verificación de webhook de Meta"""
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")
    
    if mode == "subscribe" and token == settings.WHATSAPP_VERIFY_TOKEN:
        logger.info("Webhook verificado correctamente")
        return int(challenge)
    
    raise HTTPException(status_code=403, detail="Verificación fallida")


@router.post("/webhook")
async def whatsapp_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Recibir mensajes de WhatsApp"""
    signature = request.headers.get("X-Hub-Signature-256", "")
    payload = await request.body()
    
    if not verify_webhook_signature(payload, signature):
        logger.warning("Firma de webhook inválida")
        raise HTTPException(status_code=401, detail="Firma inválida")
    
    data = json.loads(payload)
    logger.info(f"Webhook recibido: {json.dumps(data, indent=2)}")
    
    background_tasks.add_task(process_whatsapp_message, data, db)
    
    return {"status": "ok"}


async def process_whatsapp_message(data: Dict[str, Any], db: AsyncSession):
    """Procesar mensaje entrante de WhatsApp"""
    try:
        whatsapp_service = WhatsAppService()
        conversation_service = ConversationService(db)
        audio_service = AudioService()
        nlp_service = NLPService()
        invoice_service = InvoiceService(db)
        product_recognition = ProductRecognitionService(db)
        
        entry = data.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})
        messages = value.get("messages", [])
        contacts = value.get("contacts", [])
        
        if not messages:
            return
        
        message = messages[0]
        contact = contacts[0] if contacts else {}
        
        whatsapp_id = message.get("from")
        message_id = message.get("id")
        message_type = message.get("type")
        
        user = await conversation_service.get_or_create_user(whatsapp_id, contact)
        
        if not user.is_active:
            await whatsapp_service.send_text_message(
                whatsapp_id,
                "Tu cuenta está desactivada. Contacta al administrador."
            )
            return
        
        incoming_text = ""
        media_url = None
        
        if message_type == "text":
            incoming_text = message.get("text", {}).get("body", "")
            
        elif message_type == "audio":
            audio_data = message.get("audio", {})
            media_id = audio_data.get("id")
            
            media_url = await whatsapp_service.get_media_url(media_id)
            audio_bytes = await whatsapp_service.download_media(media_url)
            incoming_text = await audio_service.transcribe(audio_bytes)
            
            if not incoming_text.strip():
                await whatsapp_service.send_text_message(
                    whatsapp_id,
                    "No pude transcribir el audio. Esta instalación no tiene "
                    "el motor de voz (Whisper). Envíame el pedido por texto.\n"
                    "Ejemplo: Polo negro M, 30 soles, DNI 12345678"
                )
                return
            
        elif message_type == "image":
            image_data = message.get("image", {})
            media_id = image_data.get("id")
            caption = image_data.get("caption", "")
            
            media_url = await whatsapp_service.get_media_url(media_id)
            image_bytes = await whatsapp_service.download_media(media_url)
            
            recognized_product = await product_recognition.recognize_product(image_bytes, user.id)
            
            if recognized_product:
                await handle_product_recognition_invoice(
                    recognized_product, user, whatsapp_id, whatsapp_service, 
                    invoice_service, conversation_service, message_id, caption
                )
                return
            else:
                incoming_text = caption or "Foto de producto recibida"
                
        elif message_type == "document":
            doc_data = message.get("document", {})
            media_id = doc_data.get("id")
            mime_type = doc_data.get("mime_type")
            filename = doc_data.get("filename", "")
            
            if mime_type and mime_type.startswith("image/"):
                media_url = await whatsapp_service.get_media_url(media_id)
                image_bytes = await whatsapp_service.download_media(media_url)
                
                recognized_product = await product_recognition.recognize_product(image_bytes, user.id)
                
                if recognized_product:
                    await handle_product_recognition_invoice(
                        recognized_product, user, whatsapp_id, whatsapp_service,
                        invoice_service, conversation_service, message_id, 
                        doc_data.get("caption", "")
                    )
                    return
            
            incoming_text = f"Documento recibido: {filename}"
        
        conversation = await conversation_service.create_conversation(
            user_id=user.id,
            whatsapp_message_id=message_id,
            message_type=message_type,
            incoming_text=incoming_text,
        )
        
        processed_data = await nlp_service.extract_invoice_data(incoming_text)
        conversation.processed_data = processed_data
        conversation.intent = processed_data.get("intent", "unknown")
        await db.commit()
        
        intent = processed_data.get("intent", "unknown")
        
        if intent == "create_invoice":
            await handle_create_invoice(
                processed_data, user, whatsapp_id, whatsapp_service,
                invoice_service, conversation_service, conversation
            )
        elif intent == "register_product":
            await handle_register_product(
                processed_data, user, whatsapp_id, whatsapp_service,
                product_recognition, conversation_service, conversation
            )
        elif intent == "query_stock":
            await handle_query_stock(
                processed_data, user, whatsapp_id, whatsapp_service
            )
        elif intent == "stock_alert":
            await handle_stock_alert(
                processed_data, user, whatsapp_id, whatsapp_service, db
            )
        elif intent == "customer_management":
            await handle_customer_management(
                processed_data, user, whatsapp_id, whatsapp_service, db
            )
        elif intent == "expense_tracking":
            await handle_expense_tracking(
                processed_data, user, whatsapp_id, whatsapp_service, db
            )
        elif intent == "payment_qr":
            await handle_payment_qr(
                processed_data, user, whatsapp_id, whatsapp_service, db
            )
        elif intent == "reports":
            await handle_reports(
                processed_data, user, whatsapp_id, whatsapp_service, db
            )
        elif intent == "note":
            await handle_note(
                processed_data, user, whatsapp_id, whatsapp_service, db
            )
        else:
            await send_help_message(whatsapp_id, whatsapp_service)
            
    except Exception as e:
        logger.error(f"Error procesando mensaje: {e}", exc_info=True)
        if 'whatsapp_id' in locals():
            whatsapp_service = WhatsAppService()
            await whatsapp_service.send_text_message(
                whatsapp_id,
                "Ocurrio un error procesando tu mensaje. Intenta de nuevo."
            )


async def handle_product_recognition_invoice(
    product, user, whatsapp_id, whatsapp_service,
    invoice_service, conversation_service, message_id, caption
):
    """Crear factura directa cuando se reconoce producto por foto"""
    import re
    qty_match = re.search(r'(\d+)\s*(unid|unidades|kilos?|metros?)?', caption.lower())
    quantity = float(qty_match.group(1)) if qty_match else 1
    
    invoice_data = {
        "customer_doc": caption if re.match(r'^\d{8,11}$', caption.strip()) else "",
        "customer_name": "",
        "items": [{
            "product_id": product.id,
            "description": product.name,
            "quantity": quantity,
            "unit_price": product.price,
            "unit": product.unit,
            "tax_type": product.tax_type,
        }]
    }
    
    invoice = await invoice_service.create_invoice(user.id, invoice_data)
    result = await invoice_service.send_to_sunat(invoice.id)
    
    if result.get("success"):
        pdf_url = result.get("pdf_url")
        await whatsapp_service.send_document(whatsapp_id, pdf_url, f"Factura_{invoice.series}-{invoice.number}.pdf")
        await whatsapp_service.send_text_message(
            whatsapp_id,
            f"Factura generada\n"
            f"{product.name}\n"
            f"Cantidad: {quantity} {product.unit}\n"
            f"Total: S/ {invoice.total:.2f}\n"
            f"PDF enviado arriba"
        )
    else:
        await whatsapp_service.send_text_message(
            whatsapp_id,
            f"Error al generar factura: {result.get('error')}"
        )


async def handle_create_invoice(
    data, user, whatsapp_id, whatsapp_service,
    invoice_service, conversation_service, conversation
):
    """Manejar creacion de factura desde texto/audio"""
    if not data.get("items"):
        await whatsapp_service.send_text_message(
            whatsapp_id,
            "No detecte productos en tu mensaje.\n"
            "Ejemplo: Polo negro Talla M, 30 soles, DNI 12345678"
        )
        return
    
    invoice = await invoice_service.create_invoice(user.id, data)
    result = await invoice_service.send_to_sunat(invoice.id)
    
    if result.get("success"):
        pdf_url = result.get("pdf_url")
        xml_url = result.get("xml_url")
        
        await whatsapp_service.send_document(whatsapp_id, pdf_url, f"Boleta_{invoice.series}-{invoice.number}.pdf")
        await whatsapp_service.send_document(whatsapp_id, xml_url, f"Boleta_{invoice.series}-{invoice.number}.xml")
        
        items_text = "\n".join([
            f"  {item['description']} x{item['quantity']} = "
            f"S/ {item['quantity'] * item['unit_price']:.2f}"
            for item in data["items"]
        ])
        
        await whatsapp_service.send_text_message(
            whatsapp_id,
            f"{invoice.document_type_name} generada\n"
            f"{invoice.series}-{invoice.number}\n"
            f"{items_text}\n"
            f"Total: S/ {invoice.total:.2f}\n"
            f"PDF y XML enviados arriba"
        )
    else:
        await whatsapp_service.send_text_message(
            whatsapp_id,
            f"Error SUNAT: {result.get('error')}"
        )


async def handle_register_product(
    data, user, whatsapp_id, whatsapp_service,
    product_recognition, conversation_service, conversation
):
    """Registrar producto nuevo"""
    await whatsapp_service.send_text_message(
        whatsapp_id,
        "Registrar producto\n\n"
        "Enviame una foto del producto (etiqueta, codigo de barras o el producto mismo)\n"
        "y opcionalmente escribe: Nombre, Precio, Stock, Unidad\n\n"
        "Ejemplo foto + texto: Polo algodon, 45 soles, 50 unidades"
    )


async def handle_query_stock(
    data, user, whatsapp_id, whatsapp_service
):
    """Consultar stock"""
    from sqlalchemy import select
    from app.services.stock_alert_service import StockAlertService
    
    from app.models import Product
    from app.core.database import AsyncSessionLocal
    
    async with AsyncSessionLocal() as db:
        query = select(Product).where(Product.user_id == user.id, Product.is_active == True)
        if data.get("product_name"):
            query = query.where(Product.name.ilike(f"%{data['product_name']}%"))
        
        result = await db.execute(query.limit(10))
        products = result.scalars().all()
        
        if not products:
            await whatsapp_service.send_text_message(whatsapp_id, "No hay productos registrados")
            return
        
        text = "Tu inventario:\n\n"
        for p in products:
            text += f"{p.name} - Stock: {p.stock} {p.unit} - S/ {p.price:.2f}\n"
        
        alert_service = StockAlertService(db)
        active_alerts = await alert_service.get_active_alerts(user.id)
        if active_alerts:
            text += "\n\n⚠ *PRODUCTOS CON STOCK BAJO*\n\n"
            for a in active_alerts[:5]:
                await db.refresh(a, ["product"])
                if a.product:
                    text += f"{a.product.name}: {a.current_stock} (umbral {a.threshold})\n"
        
        await whatsapp_service.send_text_message(whatsapp_id, text)


async def handle_stock_alert(
    data, user, whatsapp_id, whatsapp_service, db
):
    """Consultar alertas de stock bajo y reportar umbrales"""
    from sqlalchemy import select
    from app.models import StockAlert
    from app.services.stock_alert_service import StockAlertService
    
    service = StockAlertService(db)
    
    if data.get("product_name") and data.get("stock") is not None:
        await whatsapp_service.send_text_message(
            whatsapp_id,
            f"📢 *Alerta de stock*\n\n"
            f"Vigilaré '{data['product_name']}' por debajo de {data['stock']} unidades.\n\n"
            f"Por defecto se avisa cuando el stock ≤ 5, crítico ≤ 2 y agotado = 0.\n\n"
            f"Escribe 'ver alertas' para listar las alertas activas."
        )
        return
    
    alerts = await service.get_active_alerts(user.id)
    if not alerts:
        await whatsapp_service.send_text_message(
            whatsapp_id,
            "✅ No hay alertas de stock activas.\n\n"
            "El sistema avisa automáticamente cuando un producto está bajo, crítico o agotado.\n"
            "Escribe 'stock' para ver tu inventario."
        )
        return
    
    text = "⚠️ *Alertas de stock activas:*\n\n"
    for a in alerts:
        await db.refresh(a, ["product"])
        emoji = {"low_stock": "⚠️", "critical_stock": "🔴", "out_of_stock": "❌"}.get(a.alert_type, "⚠️")
        if a.product:
            text += f"{emoji} {a.product.name}: {a.current_stock} {a.product.unit} (umbral: {a.threshold})\n"
    text += "\nResponde 'reponer [producto] [cantidad]' para marcar como resuelto."
    await whatsapp_service.send_text_message(whatsapp_id, text)


async def handle_customer_management(
    data, user, whatsapp_id, whatsapp_service, db
):
    """Consultar/revisar estado de clientes"""
    from app.services.customer_service import CustomerService
    
    service = CustomerService(db)
    
    if data.get("customer_doc"):
        doc = data["customer_doc"]
        customers = await service.search_customers(user.id, doc, 1)
        customer = customers[0] if customers else None
        if customer:
            summary = await service.get_customer_summary(customer.id)
            await whatsapp_service.send_text_message(
                whatsapp_id,
                f"*Cliente:* {customer.name}\n"
                f"*Doc:* {customer.doc_number}\n"
                f"*Total compras:* S/ {customer.total_purchases:.2f}\n"
                f"*Facturas:* {customer.total_invoices}\n"
                f"*Crédito usado:* S/ {customer.credit_used:.2f} / S/ {customer.credit_limit:.2f}"
            )
            return
        await whatsapp_service.send_text_message(
            whatsapp_id,
            f"No encontré el cliente con documento {doc}"
        )
        return
    
    debtors = await service.get_customers_with_debt(user.id)
    if not debtors:
        await whatsapp_service.send_text_message(
            whatsapp_id,
            "✅ No hay clientes con deuda.\n"
            "Los clientes de tus facturas se guardan automáticamente.\n"
            "Escribe: cliente [DNI] para ver su historial"
        )
        return
    
    text = "📋 *Clientes con deuda:*\n\n"
    for c in debtors[:10]:
        status = "🔴 bloqueado" if c.is_blocked else "🟡 al día"
        text += f"• {c.name} • S/ {c.credit_used:.2f} • {status}\n"
    text += "\nPara cobrar: *COBRAR [DNI] [monto]*"
    await whatsapp_service.send_text_message(whatsapp_id, text)


async def handle_expense_tracking(
    data, user, whatsapp_id, whatsapp_service, db
):
    """Registrar o consultar gastos"""
    from app.services.expense_service import ExpenseService
    
    service = ExpenseService(db)
    
    if data.get("amount") is not None and data.get("category"):
        expense = await service.create_expense(
            user_id=user.id,
            category=data["category"],
            description=data.get("product_name") or data.get("description") or "",
            amount=data["amount"],
            expense_date=datetime.now()
        )
        await whatsapp_service.send_text_message(
            whatsapp_id,
            f"✅ Gasto registrado\n"
            f"{data['category'].replace('_', ' ').title()}\n"
            f"Monto: S/ {expense.total:.2f}\n\n"
            f"Escribe 'gastos' para ver tu resumen del mes"
        )
        return
    
    now = datetime.now()
    summary = await service.get_monthly_summary(user.id, now.year, now.month)
    profit = await service.get_profit_report(user.id, now.year, now.month)
    
    await whatsapp_service.send_text_message(
        whatsapp_id,
        f"*Resumen de gastos {now.strftime('%B %Y')}:*\n\n"
        f"💰 Ventas: S/ {profit['sales']['total']:.2f}\n"
        f"💸 Gastos: S/ {summary['total_expenses']:.2f}\n"
        f"📈 Utilidad: S/ {profit['profit']['gross_profit']:.2f} "
        f"({profit['profit']['margin_percent']:.1f}%)\n\n"
        f"Registra un gasto así:\n"
        f"gasto alquiler 500\n"
        f"gasto mercaderia 1200"
    )


async def handle_payment_qr(
    data, user, whatsapp_id, whatsapp_service, db
):
    """Generar código QR de pago Yape/Plin compartible"""
    from app.services.payment_qr_service import create_payment_qr, send_payment_qr_whatsapp
    
    if data.get("amount") is not None:
        payment_qr = await create_payment_qr(
            db=db,
            user=user,
            amount=data["amount"],
            concept=data.get("description") or data.get("product_name") or f"Pago {data['amount']:.2f}",
            provider="yape"
        )
        await send_payment_qr_whatsapp(whatsapp_id, payment_qr, whatsapp_service)
        return
    
    await whatsapp_service.send_text_message(
        whatsapp_id,
        "Para generar un QR de cobro Yape/Plin escribe:\n"
        "cobra 25\n"
        "pago 40 por polo\n\n"
        "Genera el QR y compártelo para recibir el pago."
    )


async def handle_reports(
    data, user, whatsapp_id, whatsapp_service, db
):
    """Resumen de ventas / reportes SUNAT del mes"""
    from sqlalchemy import func as sa_func
    from app.models import Invoice as InvoiceModel
    
    now = datetime.now()
    year = int(data.get("report_period_year") or now.year)
    month = int(data.get("report_period_month") or now.month)
    
    from datetime import date as date_type
    from calendar import monthrange
    start_date = date_type(year, month, 1)
    end_date = date_type(year, month, monthrange(year, month)[1])
    
    result = await db.execute(
        select(
            sa_func.count(InvoiceModel.id),
            sa_func.sum(InvoiceModel.total),
            sa_func.sum(InvoiceModel.tax_amount),
            sa_func.sum(InvoiceModel.subtotal)
        ).where(
            InvoiceModel.user_id == user.id,
            InvoiceModel.sunat_status == "accepted",
            sa_func.date(InvoiceModel.created_at) >= start_date,
            sa_func.date(InvoiceModel.created_at) <= end_date
        )
    )
    total_invoices, total_amount, total_igv, subtotal = result.first()
    
    total_invoices = total_invoices or 0
    total_amount = float(total_amount or 0)
    total_igv = float(total_igv or 0)
    
    await whatsapp_service.send_text_message(
        whatsapp_id,
        f"📊 *Reporte {month:02d}/{year}*\n\n"
        f"🧾 Comprobantes aceptados: {total_invoices}\n"
        f"💰 Total ventas: S/ {total_amount:.2f}\n"
        f"📄 Subtotal: S/ {float(subtotal or 0):.2f}\n"
        f"🧾 IGV: S/ {total_igv:.2f}\n\n"
        f"📥 El reporte SUNAT completo (8.1 Ventas, 8.2 Compras, "
        f"Libro Diario) lo descargas en:\n"
        f"Dashboard → Analytics → Backup/Reportes"
    )


async def handle_note(
    data, user, whatsapp_id, whatsapp_service, db
):
    """Emitir nota de crédito (07) o débito (08) sobre un comprobante"""
    from sqlalchemy import select, desc
    from app.models import Invoice as InvoiceModel
    from app.services.invoice_service import InvoiceService

    invoice_service = InvoiceService(db)
    note_type = data.get("note_type", "07")
    reason_code = data.get("reason_code", "01")

    target = None
    reference = data.get("reference", "")
    if reference and "-" in reference:
        series, number = reference.split("-", 1)
        result = await db.execute(
            select(InvoiceModel).where(
                InvoiceModel.user_id == user.id,
                InvoiceModel.series == series,
                InvoiceModel.number == int(number)
            )
        )
        target = result.scalar_one_or_none()

    if not target and data.get("use_last"):
        result = await db.execute(
            select(InvoiceModel)
            .where(
                InvoiceModel.user_id == user.id,
                InvoiceModel.status.in_(["sent", "accepted"]),
                InvoiceModel.document_type.in_(["01", "03"])
            )
            .order_by(desc(InvoiceModel.created_at))
            .limit(1)
        )
        target = result.scalar_one_or_none()

    if not target:
        await whatsapp_service.send_text_message(
            whatsapp_id,
            "No encontré el comprobante a modificar.\n\n"
            "Escribe así:\n"
            "anular B001-0002\n"
            "nota credito F001-0001\n"
            "nota debito B001-0003 por interes\n\n"
            "O escribe solo 'anular' para modificar el último comprobante."
        )
        return

    try:
        if note_type == "08":
            note = await invoice_service.create_debit_note(
                user.id, target.id, reason_code=reason_code
            )
        else:
            note = await invoice_service.create_credit_note(
                user.id, target.id, reason_code=reason_code
            )
    except ValueError as e:
        await whatsapp_service.send_text_message(whatsapp_id, str(e))
        return

    result = await invoice_service.send_to_sunat(note.id)

    if result.get("success"):
        pdf_url = result.get("pdf_url")
        await whatsapp_service.send_document(
            whatsapp_id, pdf_url,
            f"{note.document_type_name.replace(' ', '_')}_{note.series}-{note.number}.pdf"
        )
        await whatsapp_service.send_text_message(
            whatsapp_id,
            f"{note.document_type_name} emitida\n"
            f"{note.series}-{note.number}\n"
            f"Referencia: {target.series}-{target.number}\n"
            f"Total: S/ {abs(note.total):.2f}\n"
            f"Estado SUNAT: {'Aceptada' if note.sunat_status == 'accepted' else note.sunat_status}\n"
            f"PDF enviado arriba"
        )
        if note_type == "07":
            target.status = "cancelled"
            await db.commit()
    else:
        await whatsapp_service.send_text_message(
            whatsapp_id,
            f"Error SUNAT: {result.get('error')}"
        )


async def send_help_message(whatsapp_id, whatsapp_service):
    """Enviar menu de ayuda"""
    help_text = (
        "Facturacion Bot - Comandos\n\n"
        "Crear factura/boleta:\n"
        "Escribe: Polo negro M, 30 soles, DNI 12345678\n"
        "O envia nota de voz con los datos\n\n"
        "Registrar producto:\n"
        "Envia foto del producto + texto: Nombre, Precio, Stock\n\n"
        "Ver stock:\n"
        "Escribe: stock o inventario\n\n"
        "Factura por foto:\n"
        "Envia foto de un producto ya registrado\n"
        "Agrega cantidad y DNI en el caption\n\n"
        "Anular / Nota de crédito:\n"
        "Escribe: anular B001-0002\n\n"
        "Tip: Usa notas de voz, es mas rapido"
    )
    await whatsapp_service.send_text_message(whatsapp_id, help_text)