from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "facturacion",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Lima",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 min
    task_soft_time_limit=25 * 60,
    worker_prefetch_multiplier=4,
    worker_max_tasks_per_child=100,
)

# Rutas de tareas
celery_app.conf.task_routes = {
    "app.tasks.process_audio": {"queue": "audio"},
    "app.tasks.process_image": {"queue": "images"},
    "app.tasks.send_to_sunat": {"queue": "sunat"},
    "app.tasks.sync_products": {"queue": "default"},
    "app.tasks.generate_monthly_reports": {"queue": "reports"},
    "app.tasks.check_stock_alerts": {"queue": "alerts"},
    "app.tasks.send_monthly_profit_report": {"queue": "reports"},
    "app.tasks.detect_anomalies": {"queue": "analytics"},
}


@celery_app.task(bind=True, max_retries=3)
def process_audio(self, audio_bytes: bytes, user_id: int, whatsapp_id: str):
    """Procesar audio en background"""
    import asyncio
    from app.services.audio_service import AudioService
    from app.services.whatsapp_service import WhatsAppService
    from app.services.nlp_service import NLPService
    from app.services.invoice_service import InvoiceService
    from app.core.database import AsyncSessionLocal
    
    async def _process():
        audio_service = AudioService()
        text = await audio_service.transcribe(audio_bytes)
        
        # Procesar con NLP y crear factura
        async with AsyncSessionLocal() as db:
            nlp_service = NLPService()
            processed = await nlp_service.extract_invoice_data(text)
            
            if processed.get("intent") == "create_invoice":
                invoice_service = InvoiceService(db)
                invoice = await invoice_service.create_invoice(user_id, processed)
                result = await invoice_service.send_to_sunat(invoice.id)
                
                whatsapp = WhatsAppService()
                if result.get("success"):
                    await whatsapp.send_document(whatsapp_id, result["pdf_url"], f"Factura.pdf")
                    await whatsapp.send_text_message(whatsapp_id, "Factura generada y enviada")
                else:
                    await whatsapp.send_text_message(whatsapp_id, f"Error: {result.get('error')}")
    
    asyncio.run(_process())


@celery_app.task(bind=True, max_retries=3)
def process_image(self, image_bytes: bytes, user_id: int, whatsapp_id: str, caption: str = ""):
    """Procesar imagen para reconocimiento de producto"""
    import asyncio
    from app.services.product_recognition_service import product_recognition, ocr_service
    from app.services.whatsapp_service import WhatsAppService
    from app.services.invoice_service import InvoiceService
    from app.core.database import AsyncSessionLocal
    
    async def _process():
        # Reconocer producto
        product = await product_recognition.recognize_product(image_bytes, user_id)
        
        async with AsyncSessionLocal() as db:
            whatsapp = WhatsAppService()
            
            if product:
                # Extraer cantidad del caption
                import re
                qty_match = re.search(r'(\d+)', caption)
                quantity = float(qty_match.group(1)) if qty_match else 1
                
                # Crear factura directa
                invoice_service = InvoiceService(db)
                invoice_data = {
                    "customer_doc": caption if re.match(r'^\d{8,11}$', caption.strip()) else "",
                    "items": [{
                        "product_id": product.id,
                        "description": product.name,
                        "quantity": quantity,
                        "unit_price": product.price,
                        "unit": product.unit,
                        "tax_type": product.tax_type,
                    }]
                }
                
                invoice = await invoice_service.create_invoice(user_id, invoice_data)
                result = await invoice_service.send_to_sunat(invoice.id)
                
                if result.get("success"):
                    await whatsapp.send_document(whatsapp_id, result["pdf_url"], f"Factura_{invoice.series}-{invoice.number}.pdf")
                    await whatsapp.send_text_message(
                        whatsapp_id,
                        f"Factura generada por foto\n{product.name} x{quantity}\nTotal: S/ {invoice.total:.2f}"
                    )
                else:
                    await whatsapp.send_text_message(whatsapp_id, f"Error: {result.get('error')}")
            else:
                # No reconocido, ofrecer registrar
                await whatsapp.send_text_message(
                    whatsapp_id,
                    "No reconocí el producto. ¿Quieres registrarlo?\n"
                    "Responde: REGISTRAR Nombre, Precio, Stock"
                )
    
    asyncio.run(_process())


@celery_app.task(bind=True, max_retries=3)
def send_to_sunat(self, invoice_id: int):
    """Enviar factura a SUNAT en background"""
    import asyncio
    from app.services.invoice_service import InvoiceService
    from app.core.database import AsyncSessionLocal
    
    async def _send():
        async with AsyncSessionLocal() as db:
            invoice_service = InvoiceService(db)
            result = await invoice_service.send_to_sunat(invoice_id)
            return result
    
    return asyncio.run(_send())


@celery_app.task
def sync_products(user_id: int):
    """Sincronizar índice de productos para un usuario"""
    import asyncio
    from app.services.product_recognition_service import product_recognition
    
    async def _sync():
        await product_recognition.build_index(user_id)
    
    asyncio.run(_sync())


# Tareas periódicas
from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    "sync-all-products-daily": {
        "task": "app.tasks.sync_all_users_products",
        "schedule": crontab(hour=3, minute=0),  # 3 AM
    },
}


@celery_app.task
def sync_all_users_products():
    """Sincronizar productos de todos los usuarios activos"""
    import asyncio
    from sqlalchemy import select
    from app.models import User
    from app.core.database import AsyncSessionLocal
    from app.services.product_recognition_service import product_recognition
    
    async def _sync():
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(User.id).where(User.is_active == True)
            )
            user_ids = result.scalars().all()
            
            for user_id in user_ids:
                await product_recognition.build_index(user_id)
    
    asyncio.run(_sync())


# ===== NUEVAS TAREAS PROGRAMADAS =====

@celery_app.task(bind=True, max_retries=2)
def generate_monthly_reports(self, user_id: int = None, year: int = None, month: int = None):
    """Generar reportes SUNAT mensuales (ventas, compras, diario)"""
    import asyncio
    from app.services.sunat_report_service import generate_monthly_reports
    from app.services.whatsapp_service import WhatsAppService
    from app.core.database import AsyncSessionLocal
    
    async def _generate():
        async with AsyncSessionLocal() as db:
            from sqlalchemy import select
            from app.models import User
            
            if user_id:
                users = [user_id]
            else:
                result = await db.execute(select(User.id).where(User.is_active == True))
                users = result.scalars().all()
            
            whatsapp = WhatsAppService()
            
            for uid in users:
                try:
                    result = await generate_monthly_reports(uid, year, month)
                    if result.get("success"):
                        # En producción: subir archivos a S3 y enviar enlaces
                        await whatsapp.send_text_message(
                            uid,
                            f"📊 *Reportes SUNAT {result['period']} generados*\n\n"
                            f"✅ Registro de Ventas (8.1)\n"
                            f"✅ Registro de Compras (8.2)\n"
                            f"✅ Libro Diario\n\n"
                            f"Descarga desde el dashboard: /dashboard/"
                        )
                    else:
                        await whatsapp.send_text_message(
                            uid,
                            f"❌ Error generando reportes: {result.get('error')}"
                        )
                except Exception as e:
                    logger.error(f"Error reportes user {uid}: {e}")
    
    asyncio.run(_generate())


@celery_app.task
def check_stock_alerts():
    """Verificar stock bajo y enviar alertas (cada hora)"""
    import asyncio
    from sqlalchemy import select
    from app.models import User
    from app.core.database import AsyncSessionLocal
    from app.services.stock_alert_service import StockAlertService
    from app.services.whatsapp_service import WhatsAppService
    
    async def _check():
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User.id).where(User.is_active == True))
            user_ids = result.scalars().all()
            
            whatsapp = WhatsAppService()
            
            for user_id in user_ids:
                service = StockAlertService(db)
                await service.check_and_alert(user_id)
                await service.send_pending_alerts(user_id, whatsapp)
    
    asyncio.run(_check())


@celery_app.task
def send_monthly_profit_report():
    """Enviar reporte de utilidad mensual (día 1 de cada mes 8 AM)"""
    import asyncio
    from sqlalchemy import select
    from app.models import User
    from app.core.database import AsyncSessionLocal
    from app.services.expense_service import ExpenseService
    from app.services.whatsapp_service import WhatsAppService
    from datetime import datetime
    
    async def _send():
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User.id).where(User.is_active == True))
            user_ids = result.scalars().all()
            
            whatsapp = WhatsAppService()
            
            # Mes anterior
            today = datetime.now()
            if today.month == 1:
                year, month = today.year - 1, 12
            else:
                year, month = today.year, today.month - 1
            
            for user_id in user_ids:
                try:
                    service = ExpenseService(db)
                    report = await service.get_profit_report(user_id, year, month)
                    p = report["profit"]
                    s = report["sales"]
                    e = report["expenses"]
                    
                    msg = (
                        f"📊 *Reporte Mensual {month:02d}/{year}*\n\n"
                        f"💰 Ventas: S/ {s['total']:.2f} ({s['count']} facturas)\n"
                        f"💸 Gastos: S/ {e['total']:.2f} ({e['count']} items)\n"
                        f"{'─' * 25}\n"
                        f"{'📈' if p['gross_profit'] >= 0 else '📉'} *Utilidad: S/ {p['gross_profit']:.2f}*\n"
                        f"📊 Margen: {p['margin_percent']:.1f}%\n\n"
                        f"🧾 IGV Ventas: S/ {s['igv']:.2f}\n"
                        f"📥 IGV Compras: S/ {e['igv']:.2f}\n"
                        f"⚖️ IGV a pagar: S/ {p['igv_net_to_pay']:.2f}\n\n"
                        f"Ver detalle en dashboard 👉 /dashboard/"
                    )
                    
                    # Obtener WhatsApp ID del usuario
                    user_result = await db.execute(select(User).where(User.id == user_id))
                    user = user_result.scalar_one_or_none()
                    if user:
                        await whatsapp.send_text_message(user.whatsapp_id, msg)
                except Exception as e:
                    logger.error(f"Error reporte utilidad user {user_id}: {e}")
    
    asyncio.run(_send())


@celery_app.task
def detect_anomalies():
    """Detectar anomalías en ventas/gastos (cada 6 horas)"""
    import asyncio
    from sqlalchemy import select
    from app.models import User
    from app.core.database import AsyncSessionLocal
    from app.services.analytics_service import detect_anomalies as detect_fn
    from app.services.whatsapp_service import WhatsAppService
    
    async def _detect():
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User.id).where(User.is_active == True))
            user_ids = result.scalars().all()
            
            whatsapp = WhatsAppService()
            
            for user_id in user_ids:
                anomalies = await detect_fn(user_id, db)
                
                if anomalies:
                    user_result = await db.execute(select(User).where(User.id == user_id))
                    user = user_result.scalar_one_or_none()
                    if user:
                        msg = "🔍 *Anomalías detectadas:*\n\n"
                        for a in anomalies[:5]:  # Max 5
                            emoji = {"high_sales": "📈", "low_sales": "📉", "high_expense": "💸"}.get(a["type"], "⚠️")
                            msg += f"{emoji} {a['message']}\n"
                        
                        await whatsapp.send_text_message(user.whatsapp_id, msg)
    
    asyncio.run(_detect())


# ===== PROGRAMACIÓN (Beat Schedule) =====
celery_app.conf.beat_schedule.update({
    # Cada hora: verificar stock
    "check-stock-hourly": {
        "task": "app.tasks.check_stock_alerts",
        "schedule": crontab(minute=0),  # En punto cada hora
    },
    # Día 1 de cada mes a las 3 AM: reportes SUNAT
    "monthly-sunat-reports": {
        "task": "app.tasks.generate_monthly_reports",
        "schedule": crontab(day_of_month=1, hour=3, minute=0),
    },
    # Día 1 de cada mes a las 8 AM: reporte utilidad
    "monthly-profit-report": {
        "task": "app.tasks.send_monthly_profit_report",
        "schedule": crontab(day_of_month=1, hour=8, minute=0),
    },
    # Cada 6 horas: detectar anomalías
    "detect-anomalies": {
        "task": "app.tasks.detect_anomalies",
        "schedule": crontab(minute=0, hour="*/6"),  # 0, 6, 12, 18
    },
    # Diario 3 AM: sincronizar productos (ya existía)
    "sync-all-products-daily": {
        "task": "app.tasks.sync_all_users_products",
        "schedule": crontab(hour=3, minute=0),
    },
})