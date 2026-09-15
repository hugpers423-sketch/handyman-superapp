import logging
from typing import List, Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.models import Product, StockAlert, User
from app.services.whatsapp_service import WhatsAppService

logger = logging.getLogger(__name__)


class StockAlertService:
    """Monitorea stock y envía alertas por WhatsApp"""
    
    # Umbrales por defecto
    DEFAULT_THRESHOLDS = {
        "low_stock": 5,
        "critical_stock": 2,
        "out_of_stock": 0
    }
    
    def __init__(self, db: AsyncSession):
        self.db = db

    async def check_and_alert(self, user_id: int) -> List[StockAlert]:
        """Verificar stock bajo y crear alertas"""
        # Obtener productos con stock bajo
        result = await self.db.execute(
            select(Product).where(
                Product.user_id == user_id,
                Product.is_active == True,
                Product.stock <= 5  # Umbral por defecto
            )
        )
        low_stock_products = result.scalars().all()
        
        alerts_created = []
        
        for product in low_stock_products:
            # Determinar tipo de alerta
            if product.stock == 0:
                alert_type = "out_of_stock"
                threshold = 0
            elif product.stock <= 2:
                alert_type = "critical_stock"
                threshold = 2
            else:
                alert_type = "low_stock"
                threshold = 5
            
            # Verificar si ya existe alerta activa para este producto/tipo
            existing = await self.db.execute(
                select(StockAlert).where(
                    StockAlert.user_id == user_id,
                    StockAlert.product_id == product.id,
                    StockAlert.alert_type == alert_type,
                    StockAlert.status.in_(["pending", "sent"])
                )
            )
            if existing.scalar_one_or_none():
                continue  # Ya hay alerta activa
            
            # Crear alerta
            alert = StockAlert(
                user_id=user_id,
                product_id=product.id,
                alert_type=alert_type,
                threshold=threshold,
                current_stock=product.stock,
                status="pending"
            )
            self.db.add(alert)
            alerts_created.append(alert)
        
        if alerts_created:
            await self.db.commit()
            for alert in alerts_created:
                await self.db.refresh(alert)
        
        return alerts_created

    async def send_pending_alerts(self, user_id: int, whatsapp_service: WhatsAppService) -> int:
        """Enviar alertas pendientes por WhatsApp"""
        result = await self.db.execute(
            select(StockAlert).where(
                StockAlert.user_id == user_id,
                StockAlert.status == "pending"
            ).join(Product)
        )
        pending_alerts = result.scalars().all()
        
        sent_count = 0
        user_result = await self.db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        
        if not user:
            return 0
        
        for alert in pending_alerts:
            await self.db.refresh(alert, ["product"])
            product = alert.product
            
            if not product:
                continue
            
            # Construir mensaje según tipo
            emoji_map = {
                "low_stock": "⚠️",
                "critical_stock": "🔴",
                "out_of_stock": "❌"
            }
            emoji = emoji_map.get(alert.alert_type, "⚠️")
            
            messages = {
                "low_stock": f"{emoji} *Stock bajo: {product.name}*\nQuedan {product.stock} {product.unit} (umbral: {alert.threshold})",
                "critical_stock": f"{emoji} *Stock CRÍTICO: {product.name}*\nSolo {product.stock} {product.unit} ¡Reabastece ya!",
                "out_of_stock": f"{emoji} *AGOTADO: {product.name}*\nStock en 0 {product.unit}. No se puede vender."
            }
            
            message = messages.get(alert.alert_type, messages["low_stock"])
            
            # Agregar sugerencia de reorden
            if alert.alert_type in ["critical_stock", "out_of_stock"]:
                message += "\n\n💡 *Sugerencia:* Registra compra con: 'Compra 50 " + product.name + " a 20 soles'"
            
            try:
                await whatsapp_service.send_text_message(user.whatsapp_id, message)
                
                alert.status = "sent"
                alert.sent_at = datetime.utcnow()
                await self.db.commit()
                sent_count += 1
                
            except Exception as e:
                logger.error(f"Error enviando alerta stock: {e}")
        
        return sent_count

    async def acknowledge_alert(self, alert_id: int, user_id: int) -> bool:
        """Marcar alerta como vista/atendida por el usuario"""
        result = await self.db.execute(
            select(StockAlert).where(
                StockAlert.id == alert_id,
                StockAlert.user_id == user_id
            )
        )
        alert = result.scalar_one_or_none()
        
        if alert and alert.status in ["pending", "sent"]:
            alert.status = "acknowledged"
            alert.acknowledged_at = datetime.utcnow()
            await self.db.commit()
            return True
        return False

    async def resolve_alert(self, alert_id: int, user_id: int) -> bool:
        """Marcar alerta como resuelta (stock repuesto)"""
        result = await self.db.execute(
            select(StockAlert).where(
                StockAlert.id == alert_id,
                StockAlert.user_id == user_id
            )
        )
        alert = result.scalar_one_or_none()
        
        if alert:
            alert.status = "resolved"
            alert.resolved_at = datetime.utcnow()
            await self.db.commit()
            return True
        return False

    async def get_active_alerts(self, user_id: int) -> List[StockAlert]:
        """Obtener alertas activas no resueltas"""
        result = await self.db.execute(
            select(StockAlert)
            .where(
                StockAlert.user_id == user_id,
                StockAlert.status.in_(["pending", "sent", "acknowledged"])
            )
            .join(Product)
            .order_by(StockAlert.created_at.desc())
        )
        return result.scalars().all()

    async def auto_resolve_on_restock(self, product_id: int, new_stock: int):
        """Resolver alertas automáticamente cuando se repone stock"""
        result = await self.db.execute(
            select(StockAlert).where(
                StockAlert.product_id == product_id,
                StockAlert.status.in_(["pending", "sent", "acknowledged"])
            )
        )
        alerts = result.scalars().all()
        
        for alert in alerts:
            if new_stock > alert.threshold:
                alert.status = "resolved"
                alert.resolved_at = datetime.utcnow()
        
        if alerts:
            await self.db.commit()


# ===== Tarea programada Celery =====
"""
@celery_app.task
def check_all_users_stock():
    '''Ejecutar cada hora para verificar stock de todos los usuarios'''
    import asyncio
    from app.core.database import AsyncSessionLocal
    from app.models import User
    from app.services.whatsapp_service import WhatsAppService
    
    async def _check():
        async with AsyncSessionLocal() as db:
            # Obtener usuarios activos
            result = await db.execute(select(User).where(User.is_active == True))
            users = result.scalars().all()
            
            whatsapp = WhatsAppService()
            
            for user in users:
                service = StockAlertService(db)
                await service.check_and_alert(user.id)
                await service.send_pending_alerts(user.id, whatsapp)
    
    asyncio.run(_check())
"""


# ===== Integración con NLP para comandos de stock =====
STOCK_COMMANDS = {
    "ver alertas": "show_alerts",
    "alertas": "show_alerts",
    "stock bajo": "show_alerts",
    "reponer": "restock_product",
    "comprar": "restock_product",
    "pedido": "restock_product",
}

async def handle_stock_command(text: str, user_id: int, db: AsyncSession, whatsapp_service: WhatsAppService):
    """Manejar comandos de stock desde WhatsApp"""
    text_lower = text.lower().strip()
    
    service = StockAlertService(db)
    
    if any(cmd in text_lower for cmd in ["ver alertas", "alertas", "stock bajo"]):
        alerts = await service.get_active_alerts(user_id)
        
        if not alerts:
            await whatsapp_service.send_text_message(
                user_id, "✅ No hay alertas de stock activas. Todo bien."
            )
            return
        
        msg = "⚠️ *Alertas de Stock Activas:*\n\n"
        for alert in alerts:
            await db.refresh(alert, ["product"])
            if alert.product:
                emoji = {"low_stock": "⚠️", "critical_stock": "🔴", "out_of_stock": "❌"}.get(alert.alert_type, "⚠️")
                msg += f"{emoji} {alert.product.name}: {alert.current_stock} {alert.product.unit} (umbral: {alert.threshold})\n"
        
        msg += "\nResponde *REPONER [producto] [cantidad]* para marcar como resuelto."
        await whatsapp_service.send_text_message(user.whatsapp_id, msg)
    
    elif text_lower.startswith(("reponer ", "comprar ", "pedido ")):
        # Parsear: "reponer polo negro 50"
        parts = text_lower.split()
        if len(parts) >= 3:
            product_name = " ".join(parts[1:-1])
            try:
                qty = int(parts[-1])
                
                # Buscar producto
                result = await db.execute(
                    select(Product).where(
                        Product.user_id == user_id,
                        Product.name.ilike(f"%{product_name}%"),
                        Product.is_active == True
                    )
                )
                product = result.scalars().first()
                
                if product:
                    product.stock += qty
                    await service.auto_resolve_on_restock(product.id, product.stock)
                    await db.commit()
                    
                    await whatsapp_service.send_text_message(
                        user.whatsapp_id,
                        f"✅ Stock actualizado: {product.name} ahora tiene {product.stock} {product.unit}"
                    )
                else:
                    await whatsapp_service.send_text_message(
                        user.whatsapp_id,
                        f"❌ No encontré el producto '{product_name}'"
                    )
            except ValueError:
                await whatsapp_service.send_text_message(
                    user.whatsapp_id,
                    "Formato: *reponer [nombre producto] [cantidad]*\nEj: reponer polo negro 50"
                )