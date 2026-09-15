import logging
from typing import List, Optional, Dict, Any
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta

from app.models import Customer, User, Invoice
from app.services.whatsapp_service import WhatsAppService
from app.services.nlp_service import NLPService

logger = logging.getLogger(__name__)


class CustomerService:
    """Gestión de clientes frecuentes, historial y control de crédito"""
    
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_customer(
        self,
        user_id: int,
        doc_type: str,
        doc_number: str,
        name: str = None,
        **kwargs
    ) -> Customer:
        """Obtener cliente existente o crear nuevo"""
        result = await self.db.execute(
            select(Customer).where(
                Customer.user_id == user_id,
                Customer.doc_type == doc_type,
                Customer.doc_number == doc_number
            )
        )
        customer = result.scalar_one_or_none()
        
        if not customer:
            customer = Customer(
                user_id=user_id,
                doc_type=doc_type,
                doc_number=doc_number,
                name=name or f"Cliente {doc_number}",
                **kwargs
            )
            self.db.add(customer)
            await self.db.commit()
            await self.db.refresh(customer)
        elif name and not customer.name.startswith("Cliente"):
            # Actualizar nombre si era genérico
            customer.name = name
            await self.db.commit()
        
        return customer

    async def update_customer_from_invoice(self, customer: Customer, invoice: Invoice):
        """Actualizar estadísticas del cliente tras una factura"""
        customer.total_purchases += invoice.total
        customer.total_invoices += 1
        customer.last_purchase_date = invoice.created_at
        if not customer.first_purchase_date:
            customer.first_purchase_date = invoice.created_at
        
        # Actualizar crédito usado si es venta a crédito
        if customer.credit_days > 0:
            customer.credit_used += invoice.total
            # Verificar límite
            if customer.credit_limit > 0 and customer.credit_used > customer.credit_limit:
                customer.is_blocked = True
        
        await self.db.commit()

    async def get_customer_history(
        self,
        customer_id: int,
        limit: int = 20
    ) -> List[Invoice]:
        """Obtener historial de compras del cliente"""
        result = await self.db.execute(
            select(Invoice)
            .where(Invoice.customer_id == customer_id)
            .order_by(Invoice.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()

    async def get_frequent_customers(self, user_id: int, limit: int = 10) -> List[Customer]:
        """Top clientes por volumen de compras"""
        result = await self.db.execute(
            select(Customer)
            .where(Customer.user_id == user_id, Customer.is_active == True)
            .order_by(Customer.total_purchases.desc())
            .limit(limit)
        )
        return result.scalars().all()

    async def get_customers_with_debt(self, user_id: int) -> List[Customer]:
        """Clientes con deuda vencida (crédito)"""
        result = await self.db.execute(
            select(Customer).where(
                Customer.user_id == user_id,
                Customer.is_active == True,
                Customer.credit_used > 0
            )
            .order_by(Customer.credit_used.desc())
        )
        return result.scalars().all()

    async def search_customers(
        self,
        user_id: int,
        query: str,
        limit: int = 20
    ) -> List[Customer]:
        """Buscar clientes por nombre, DNI/RUC, teléfono"""
        search_term = f"%{query}%"
        result = await self.db.execute(
            select(Customer).where(
                Customer.user_id == user_id,
                Customer.is_active == True,
                or_(
                    Customer.name.ilike(search_term),
                    Customer.doc_number.ilike(search_term),
                    Customer.phone.ilike(search_term),
                    Customer.whatsapp_id.ilike(search_term),
                    Customer.trade_name.ilike(search_term)
                )
            )
            .limit(limit)
        )
        return result.scalars().all()

    async def send_payment_reminder(
        self,
        customer: Customer,
        whatsapp_service: WhatsAppService,
        custom_message: str = None
    ) -> bool:
        """Enviar recordatorio de pago por WhatsApp"""
        if not customer.whatsapp_id:
            return False
        
        if custom_message:
            message = custom_message
        else:
            message = (
                f"📋 *Recordatorio de pago*\n\n"
                f"Hola {customer.name},\n\n"
                f"Tienes un saldo pendiente de *S/ {customer.credit_used:.2f}*\n"
                f"Límite de crédito: S/ {customer.credit_limit:.2f}\n"
                f"Días de crédito: {customer.credit_days}\n\n"
                f"Por favor realiza el pago para seguir comprando a crédito.\n"
                f"💳 Paga con Yape/Plin escaneando el QR que te enviamos."
            )
        
        try:
            await whatsapp_service.send_text_message(customer.whatsapp_id, message)
            return True
        except Exception as e:
            logger.error(f"Error enviando recordatorio: {e}")
            return False

    async def get_customer_summary(self, customer_id: int) -> Dict[str, Any]:
        """Resumen completo del cliente para dashboard"""
        result = await self.db.execute(
            select(Customer).where(Customer.id == customer_id)
        )
        customer = result.scalar_one_or_none()
        
        if not customer:
            return {}
        
        # Últimas facturas
        invoices = await self.get_customer_history(customer_id, 5)
        
        # Deuda actual
        available_credit = customer.credit_limit - customer.credit_used if customer.credit_limit > 0 else 0
        
        return {
            "id": customer.id,
            "name": customer.name,
            "trade_name": customer.trade_name,
            "doc_type": customer.doc_type,
            "doc_number": customer.doc_number,
            "phone": customer.phone,
            "email": customer.email,
            "whatsapp_id": customer.whatsapp_id,
            "address": customer.address,
            "credit_limit": customer.credit_limit,
            "credit_used": customer.credit_used,
            "available_credit": available_credit,
            "credit_days": customer.credit_days,
            "is_blocked": customer.is_blocked,
            "total_purchases": customer.total_purchases,
            "total_invoices": customer.total_invoices,
            "last_purchase": customer.last_purchase_date,
            "first_purchase": customer.first_purchase_date,
            "recent_invoices": [
                {
                    "id": inv.id,
                    "series": inv.series,
                    "number": inv.number,
                    "document_type": inv.document_type,
                    "total": inv.total,
                    "date": inv.created_at,
                    "status": inv.sunat_status
                }
                for inv in invoices
            ]
        }

    async def apply_payment(self, customer_id: int, amount: float, description: str = "Pago recibido") -> bool:
        """Registrar pago del cliente (reduce crédito usado)"""
        result = await self.db.execute(select(Customer).where(Customer.id == customer_id))
        customer = result.scalar_one_or_none()
        
        if not customer:
            return False
        
        customer.credit_used = max(0, customer.credit_used - amount)
        if customer.credit_used == 0:
            customer.is_blocked = False
        
        await self.db.commit()
        return True


# ===== Integración NLP para comandos de clientes =====
async def handle_customer_command(
    text: str,
    user_id: int,
    db: AsyncSession,
    whatsapp_service: WhatsAppService,
    nlp_service: NLPService
):
    """Procesar comandos relacionados a clientes desde WhatsApp"""
    text_lower = text.lower().strip()
    service = CustomerService(db)
    
    # Detectar intención de cliente
    if any(kw in text_lower for kw in ["cliente", "clientes", "deudor", "deudores", "fiado", "crédito"]):
        
        if "deudor" in text_lower or "deuda" in text_lower or "fiado" in text_lower:
            # Listar clientes con deuda
            customers = await service.get_customers_with_debt(user_id)
            
            if not customers:
                await whatsapp_service.send_text_message(
                    user_id, "✅ No hay clientes con deuda pendiente."
                )
                return
            
            msg = "📋 *Clientes con deuda:*\n\n"
            for c in customers:
                available = c.credit_limit - c.credit_used if c.credit_limit > 0 else "Sin límite"
                msg += f"• {c.name} ({c.doc_number})\n"
                msg += f"  💳 Deuda: S/ {c.credit_used:.2f} | Disponible: S/ {available:.2f}\n"
                if c.whatsapp_id:
                    msg += f"  📱 WhatsApp registrado\n"
                msg += "\n"
            
            msg += "Para cobrar: *COBRAR [DNI] [monto]*\nPara recordatorio: *RECORDAR [DNI]*"
            await whatsapp_service.send_text_message(user_id, msg)
        
        elif "frecuente" in text_lower or "top" in text_lower or "mejor" in text_lower:
            # Top clientes
            customers = await service.get_frequent_customers(user_id, 10)
            
            msg = "⭐ *Top Clientes:*\n\n"
            for i, c in enumerate(customers, 1):
                msg += f"{i}. {c.name} - S/ {c.total_purchases:.2f} ({c.total_invoices} compras)\n"
            
            await whatsapp_service.send_text_message(user_id, msg)
        
        elif text_lower.startswith(("cobrar ", "pago ", "abono ")):
            # Cobrar: "cobrar 12345678 100"
            parts = text_lower.split()
            if len(parts) >= 3:
                doc = parts[1]
                try:
                    amount = float(parts[2])
                    
                    result = await db.execute(
                        select(Customer).where(
                            Customer.user_id == user_id,
                            Customer.doc_number == doc
                        )
                    )
                    customer = result.scalar_one_or_none()
                    
                    if customer:
                        await service.apply_payment(customer.id, amount)
                        await whatsapp_service.send_text_message(
                            user_id,
                            f"✅ Pago registrado: {customer.name} abonó S/ {amount:.2f}\n"
                            f"Deuda restante: S/ {customer.credit_used:.2f}"
                        )
                    else:
                        await whatsapp_service.send_text_message(
                            user_id, f"❌ Cliente con DNI {doc} no encontrado"
                        )
                except ValueError:
                    await whatsapp_service.send_text_message(
                        user_id, "Formato: *cobrar [DNI] [monto]*\nEj: cobrar 12345678 150"
                    )
        
        elif text_lower.startswith(("recordar ", "recordatorio ")):
            # Enviar recordatorio: "recordar 12345678"
            parts = text_lower.split()
            if len(parts) >= 2:
                doc = parts[1]
                
                result = await db.execute(
                    select(Customer).where(
                        Customer.user_id == user_id,
                        Customer.doc_number == doc,
                        Customer.credit_used > 0
                    )
                )
                customer = result.scalar_one_or_none()
                
                if customer:
                    await service.send_payment_reminder(customer, whatsapp_service)
                    await whatsapp_service.send_text_message(
                        user_id, f"📤 Recordatorio enviado a {customer.name}"
                    )
                else:
                    await whatsapp_service.send_text_message(
                        user_id, f"❌ Cliente con DNI {doc} no encontrado o sin deuda"
                    )
        
        elif "nuevo cliente" in text_lower or "registrar cliente" in text_lower:
            # Registro rápido: "nuevo cliente Juan 12345678 999888777"
            await whatsapp_service.send_text_message(
                user_id,
                "📝 *Registrar cliente*\n\n"
                "Formato: *cliente [Nombre] [DNI/RUC] [Teléfono] [Email] [Límite crédito] [Días crédito]*\n\n"
                "Ej: cliente Juan Pérez 12345678 999888777 juan@email.com 500 30"
            )


# ===== Auto-crear cliente al facturar =====
async def auto_create_customer_from_invoice(
    user_id: int,
    invoice: Invoice,
    db: AsyncSession
) -> Customer:
    """Crear/actualizar cliente automáticamente al emitir factura"""
    if not invoice.customer_doc:
        return None
    
    service = CustomerService(db)
    
    doc_type = invoice.customer_type  # "1"=DNI, "6"=RUC
    
    customer = await service.get_or_create_customer(
        user_id=user_id,
        doc_type=doc_type,
        doc_number=invoice.customer_doc,
        name=invoice.customer_name,
        address=invoice.customer_address,
        email=invoice.customer_email,
        credit_limit=0,  # Por defecto sin crédito
        credit_days=0
    )
    
    # Vincular factura
    invoice.customer_id = customer.id
    await service.update_customer_from_invoice(customer, invoice)
    
    return customer