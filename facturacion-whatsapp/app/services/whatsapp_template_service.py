import logging
from typing import List, Optional, Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import WhatsAppTemplate, User
from app.services.whatsapp_service import WhatsAppService

logger = logging.getLogger(__name__)


class WhatsAppTemplateService:
    """Gestión de plantillas WhatsApp pre-aprobadas (Meta Business API)"""
    
    # Plantillas predefinidas para casos comunes
    DEFAULT_TEMPLATES = [
        {
            "name": "invoice_ready",
            "category": "utility",
            "header_type": "text",
            "header_text": "📄 Tu comprobante está listo",
            "body_text": "Hola {{1}},\n\nTu {{2}} {{3}} ha sido generada correctamente.\n\n💰 Total: S/ {{4}}\n📅 Fecha: {{5}}\n\nLos archivos PDF y XML están adjuntos.\n\n¡Gracias por tu compra!",
            "footer_text": "Facturación WhatsApp Bot",
            "buttons": [
                {"type": "quick_reply", "text": "Ver en dashboard"},
                {"type": "quick_reply", "text": "Descargar PDF"}
            ]
        },
        {
            "name": "payment_reminder",
            "category": "utility",
            "header_type": "text",
            "header_text": "💳 Recordatorio de pago",
            "body_text": "Hola {{1}},\n\nTienes un saldo pendiente de *S/ {{2}}*.\n\n📅 Vencimiento: {{3}}\n💳 Paga con Yape/Plin escaneando el QR adjunto.\n\n¿Ya pagaste? Responde *PAGADO* para confirmar.",
            "footer_text": "Facturación WhatsApp Bot",
            "buttons": [
                {"type": "quick_reply", "text": "Ya pagué"},
                {"type": "quick_reply", "text": "Enviar QR"}
            ]
        },
        {
            "name": "low_stock_alert",
            "category": "utility",
            "header_type": "text",
            "header_text": "⚠️ Alerta de stock",
            "body_text": "El producto *{{1}}* tiene stock bajo.\n\n📦 Stock actual: {{2}} {{3}}\n🎯 Umbral: {{4}}\n\n¿Deseas registrar una compra?\nResponde: *COMPRAR {{1}} [cantidad] [precio]*",
            "footer_text": "Facturación WhatsApp Bot",
            "buttons": [
                {"type": "quick_reply", "text": "Registrar compra"},
                {"type": "quick_reply", "text": "Ver inventario"}
            ]
        },
        {
            "name": "monthly_report",
            "category": "marketing",
            "header_type": "text",
            "header_text": "📊 Tu reporte mensual",
            "body_text": "Hola {{1}},\n\nAquí tu resumen de *{{2}}*:\n\n💰 Ventas: S/ {{3}}\n💸 Gastos: S/ {{4}}\n📈 Utilidad: S/ {{5}} ({{6}}%)\n\nVer detalle completo en tu dashboard.",
            "footer_text": "Facturación WhatsApp Bot",
            "buttons": [
                {"type": "quick_reply", "text": "Ver dashboard"},
                {"type": "quick_reply", "text": "Descargar Excel"}
            ]
        },
        {
            "name": "new_product_suggestion",
            "category": "marketing",
            "header_type": "text",
            "header_text": "✨ Nuevo producto sugerido",
            "body_text": "Basado en tus ventas, te sugerimos agregar:\n\n*{{1}}*\n💰 Precio sugerido: S/ {{2}}\n📦 Stock inicial: {{3}}\n\n¿Lo agregamos? Responde *SÍ* para registrar.",
            "footer_text": "Facturación WhatsApp Bot",
            "buttons": [
                {"type": "quick_reply", "text": "Sí, agregarlo"},
                {"type": "quick_reply", "text": "No, gracias"}
            ]
        },
        {
            "name": "welcome_new_user",
            "category": "utility",
            "header_type": "text",
            "header_text": "👋 ¡Bienvenido a FacturaBot!",
            "body_text": "Hola {{1}},\n\nYa puedes facturar por WhatsApp en segundos:\n\n🎤 *Audio:* \"Polo negro M, 30 soles, DNI 12345678\"\n📝 *Texto:* Polo negro M, 30 soles, DNI 12345678\n📸 *Foto:* Envía foto de tu producto\n\n💡 *Comandos útiles:*\n• \"stock\" - Ver inventario\n• \"gasto alquiler 1500\" - Registrar gasto\n• \"utilidad\" - Ver ganancias\n\n¿Necesitas ayuda? Escribe *AYUDA*",
            "footer_text": "Facturación WhatsApp Bot",
            "buttons": [
                {"type": "quick_reply", "text": "Registrar producto"},
                {"type": "quick_reply", "text": "Configurar Nubefact"}
            ]
        }
    ]

    def __init__(self, db: AsyncSession):
        self.db = db

    async def initialize_default_templates(self, user_id: int) -> List[WhatsAppTemplate]:
        """Crear plantillas por defecto para nuevo usuario"""
        templates = []
        
        for tmpl_data in self.DEFAULT_TEMPLATES:
            # Verificar si ya existe
            result = await self.db.execute(
                select(WhatsAppTemplate).where(
                    WhatsAppTemplate.user_id == user_id,
                    WhatsAppTemplate.name == tmpl_data["name"]
                )
            )
            existing = result.scalar_one_or_none()
            
            if not existing:
                template = WhatsAppTemplate(
                    user_id=user_id,
                    **tmpl_data,
                    is_active=True
                )
                self.db.add(template)
                templates.append(template)
        
        if templates:
            await self.db.commit()
            for t in templates:
                await self.db.refresh(t)
        
        return templates

    async def get_template(self, user_id: int, name: str) -> Optional[WhatsAppTemplate]:
        """Obtener plantilla por nombre"""
        result = await self.db.execute(
            select(WhatsAppTemplate).where(
                WhatsAppTemplate.user_id == user_id,
                WhatsAppTemplate.name == name,
                WhatsAppTemplate.is_active == True
            )
        )
        return result.scalar_one_or_none()

    async def render_template(
        self,
        user_id: int,
        template_name: str,
        variables: Dict[str, str]
    ) -> Optional[str]:
        """Renderizar plantilla con variables"""
        template = await self.get_template(user_id, template_name)
        if not template:
            return None
        
        text = template.body_text
        for key, value in variables.items():
            text = text.replace(f"{{{{{key}}}}}", value)
        
        # Header
        if template.header_text:
            header = template.header_text
            for key, value in variables.items():
                header = header.replace(f"{{{{{key}}}}}", value)
            text = header + "\n\n" + text
        
        # Footer
        if template.footer_text:
            text = text + "\n\n" + template.footer_text
        
        return text

    async def send_template_message(
        self,
        whatsapp_id: str,
        user_id: int,
        template_name: str,
        variables: Dict[str, str],
        whatsapp_service: WhatsAppService,
        media_url: str = None
    ) -> bool:
        """Enviar mensaje usando plantilla"""
        try:
            # Renderizar
            rendered = await self.render_template(user_id, template_name, variables)
            if not rendered:
                logger.warning(f"Plantilla {template_name} no encontrada para user {user_id}")
                return False
            
            # Enviar
            if media_url:
                await whatsapp_service.send_image(whatsapp_id, media_url, rendered)
            else:
                await whatsapp_service.send_text_message(whatsapp_id, rendered)
            
            return True
        except Exception as e:
            logger.error(f"Error enviando plantilla: {e}")
            return False

    async def create_custom_template(
        self,
        user_id: int,
        name: str,
        category: str,
        body_text: str,
        header_text: str = None,
        footer_text: str = None,
        buttons: List[Dict] = None
    ) -> WhatsAppTemplate:
        """Crear plantilla personalizada"""
        template = WhatsAppTemplate(
            user_id=user_id,
            name=name,
            category=category,
            header_type="text" if header_text else None,
            header_text=header_text,
            body_text=body_text,
            footer_text=footer_text,
            buttons=buttons or [],
            is_active=True
        )
        self.db.add(template)
        await self.db.commit()
        await self.db.refresh(template)
        return template

    async def list_templates(self, user_id: int) -> List[WhatsAppTemplate]:
        """Listar plantillas del usuario"""
        result = await self.db.execute(
            select(WhatsAppTemplate)
            .where(WhatsAppTemplate.user_id == user_id)
            .order_by(WhatsAppTemplate.category, WhatsAppTemplate.name)
        )
        return result.scalars().all()


# ===== Funciones de conveniencia para envíos comunes =====

async def send_invoice_ready(
    whatsapp_id: str,
    user_id: int,
    customer_name: str,
    doc_type: str,
    series_number: str,
    total: float,
    date_str: str,
    whatsapp_service: WhatsAppService,
    pdf_url: str = None,
    db: AsyncSession = None
):
    """Enviar notificación de factura lista"""
    if db:
        service = WhatsAppTemplateService(db)
        await service.send_template_message(
            whatsapp_id, user_id, "invoice_ready",
            {
                "1": customer_name,
                "2": "Factura" if doc_type == "01" else "Boleta",
                "3": series_number,
                "4": f"{total:.2f}",
                "5": date_str
            },
            whatsapp_service
        )
    else:
        # Fallback sin plantilla
        msg = (
            f"✅ *{('Factura' if doc_type == '01' else 'Boleta')} generada*\n\n"
            f"👤 {customer_name}\n"
            f"📄 {series_number}\n"
            f"💰 Total: S/ {total:.2f}\n"
            f"📅 {date_str}"
        )
        await whatsapp_service.send_text_message(whatsapp_id, msg)
        if pdf_url:
            await whatsapp_service.send_document(whatsapp_id, pdf_url, f"{series_number}.pdf")


async def send_payment_reminder_template(
    whatsapp_id: str,
    user_id: int,
    customer_name: str,
    amount: float,
    due_date: str,
    whatsapp_service: WhatsAppService,
    qr_url: str = None,
    db: AsyncSession = None
):
    """Enviar recordatorio de pago con plantilla"""
    if db:
        service = WhatsAppTemplateService(db)
        await service.send_template_message(
            whatsapp_id, user_id, "payment_reminder",
            {
                "1": customer_name,
                "2": f"{amount:.2f}",
                "3": due_date
            },
            whatsapp_service,
            media_url=qr_url
        )


async def send_low_stock_alert_template(
    whatsapp_id: str,
    user_id: int,
    product_name: str,
    current_stock: int,
    unit: str,
    threshold: int,
    whatsapp_service: WhatsAppService,
    db: AsyncSession = None
):
    """Enviar alerta de stock bajo"""
    if db:
        service = WhatsAppTemplateService(db)
        await service.send_template_message(
            whatsapp_id, user_id, "low_stock_alert",
            {
                "1": product_name,
                "2": str(current_stock),
                "3": unit,
                "4": str(threshold)
            },
            whatsapp_service
        )


async def send_monthly_report_template(
    whatsapp_id: str,
    user_id: int,
    customer_name: str,
    period: str,
    sales: float,
    expenses: float,
    profit: float,
    margin: float,
    whatsapp_service: WhatsAppService,
    db: AsyncSession = None
):
    """Enviar reporte mensual"""
    if db:
        service = WhatsAppTemplateService(db)
        await service.send_template_message(
            whatsapp_id, user_id, "monthly_report",
            {
                "1": customer_name,
                "2": period,
                "3": f"{sales:.2f}",
                "4": f"{expenses:.2f}",
                "5": f"{profit:.2f}",
                "6": f"{margin:.1f}"
            },
            whatsapp_service
        )


async def send_welcome_message(
    whatsapp_id: str,
    user_id: int,
    user_name: str,
    whatsapp_service: WhatsAppService,
    db: AsyncSession = None
):
    """Enviar mensaje de bienvenida a nuevo usuario"""
    if db:
        service = WhatsAppTemplateService(db)
        await service.initialize_default_templates(user_id)
        await service.send_template_message(
            whatsapp_id, user_id, "welcome_new_user",
            {"1": user_name},
            whatsapp_service
        )