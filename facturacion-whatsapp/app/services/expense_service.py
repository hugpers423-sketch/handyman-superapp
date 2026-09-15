import logging
from typing import List, Optional, Dict, Any
from sqlalchemy import select, func, and_, or_, extract
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, date, timedelta

from app.models import Expense, User, Invoice
from app.services.whatsapp_service import WhatsAppService
from app.services.nlp_service import NLPService

logger = logging.getLogger(__name__)


class ExpenseService:
    """Control de gastos/egresos para cálculo de utilidad"""
    
    # Categorías SUNAT comunes
    EXPENSE_CATEGORIES = {
        "alquiler": "Alquiler local/oficina",
        "servicios": "Servicios básicos (luz, agua, internet)",
        "transporte": "Transporte y fletes",
        "marketing": "Publicidad y marketing",
        "suministros": "Suministros y materiales",
        "mantenimiento": "Mantenimiento y reparaciones",
        "planilla": "Planilla y beneficios",
        "impuestos": "Impuestos y tasas",
        "bancarios": "Comisiones bancarias",
        "otros": "Otros gastos"
    }
    
    DOCUMENT_TYPES = {
        "01": "Factura",
        "03": "Boleta",
        "07": "Nota de Crédito",
        "08": "Nota de Débito",
        "12": "Ticket/Tiquete",
        "99": "Sin comprobante"
    }

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_expense(
        self,
        user_id: int,
        category: str,
        description: str,
        amount: float,
        expense_date: datetime = None,
        **kwargs
    ) -> Expense:
        """Registrar gasto simple"""
        expense = Expense(
            user_id=user_id,
            category=category,
            description=description,
            total=amount,
            subtotal=amount / 1.18,  # Asumir IGV 18%
            tax_amount=amount * 0.18 / 1.18,
            expense_date=expense_date or datetime.utcnow(),
            **kwargs
        )
        self.db.add(expense)
        await self.db.commit()
        await self.db.refresh(expense)
        return expense

    async def create_expense_from_invoice(
        self,
        user_id: int,
        supplier_doc: str,
        supplier_name: str,
        document_type: str,
        series: str,
        number: int,
        amount: float,
        category: str = "otros",
        description: str = "",
        expense_date: datetime = None,
        payment_method: str = "EFECTIVO"
    ) -> Expense:
        """Registrar gasto desde comprobante de proveedor"""
        
        # Calcular IGV
        tax_rate = 0.18
        subtotal = amount / (1 + tax_rate)
        tax_amount = amount - subtotal
        
        expense = Expense(
            user_id=user_id,
            expense_type="compra",
            category=category,
            supplier_type="6" if len(supplier_doc) == 11 else "1",
            supplier_doc=supplier_doc,
            supplier_name=supplier_name,
            document_type=document_type,
            series=series,
            number=number,
            subtotal=round(subtotal, 2),
            tax_amount=round(tax_amount, 2),
            total=amount,
            description=description,
            expense_date=expense_date or datetime.utcnow(),
            payment_method=payment_method,
            sunat_status="registered"
        )
        self.db.add(expense)
        await self.db.commit()
        await self.db.refresh(expense)
        return expense

    async def get_expenses(
        self,
        user_id: int,
        start_date: date = None,
        end_date: date = None,
        category: str = None,
        limit: int = 100
    ) -> List[Expense]:
        """Obtener gastos con filtros"""
        query = select(Expense).where(Expense.user_id == user_id)
        
        if start_date:
            query = query.where(func.date(Expense.expense_date) >= start_date)
        if end_date:
            query = query.where(func.date(Expense.expense_date) <= end_date)
        if category:
            query = query.where(Expense.category == category)
        
        query = query.order_by(Expense.expense_date.desc()).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_monthly_summary(self, user_id: int, year: int, month: int) -> Dict[str, Any]:
        """Resumen mensual de gastos por categoría"""
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month + 1, 1) - timedelta(days=1)
        
        # Total por categoría
        result = await self.db.execute(
            select(
                Expense.category,
                func.sum(Expense.total).label("total"),
                func.count(Expense.id).label("count")
            )
            .where(
                Expense.user_id == user_id,
                func.date(Expense.expense_date) >= start_date,
                func.date(Expense.expense_date) <= end_date
            )
            .group_by(Expense.category)
        )
        by_category = result.all()
        
        # Total general
        total_result = await self.db.execute(
            select(func.sum(Expense.total), func.count(Expense.id))
            .where(
                Expense.user_id == user_id,
                func.date(Expense.expense_date) >= start_date,
                func.date(Expense.expense_date) <= end_date
            )
        )
        total, count = total_result.first()
        
        # Gastos por método de pago
        payment_result = await self.db.execute(
            select(
                Expense.payment_method,
                func.sum(Expense.total).label("total")
            )
            .where(
                Expense.user_id == user_id,
                func.date(Expense.expense_date) >= start_date,
                func.date(Expense.expense_date) <= end_date
            )
            .group_by(Expense.payment_method)
        )
        by_payment = payment_result.all()
        
        return {
            "period": f"{year}-{month:02d}",
            "total_expenses": float(total or 0),
            "expense_count": count or 0,
            "by_category": [
                {"category": cat, "total": float(tot or 0), "count": cnt}
                for cat, tot, cnt in by_category
            ],
            "by_payment_method": [
                {"method": met, "total": float(tot or 0)}
                for met, tot in by_payment
            ]
        }

    async def get_profit_report(
        self,
        user_id: int,
        year: int,
        month: int
    ) -> Dict[str, Any]:
        """Reporte de utilidad: Ventas - Gastos = Utilidad"""
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month + 1, 1) - timedelta(days=1)
        
        # Ventas del mes (facturas aceptadas)
        sales_result = await self.db.execute(
            select(
                func.sum(Invoice.total).label("total_sales"),
                func.sum(Invoice.subtotal).label("subtotal_sales"),
                func.sum(Invoice.tax_amount).label("igv_sales"),
                func.count(Invoice.id).label("sales_count")
            )
            .where(
                Invoice.user_id == user_id,
                func.date(Invoice.created_at) >= start_date,
                func.date(Invoice.created_at) <= end_date,
                Invoice.sunat_status == "accepted"
            )
        )
        sales = sales_result.first()
        
        # Gastos del mes
        expense_result = await self.db.execute(
            select(
                func.sum(Expense.total).label("total_expenses"),
                func.sum(Expense.subtotal).label("subtotal_expenses"),
                func.sum(Expense.tax_amount).label("igv_expenses"),
                func.count(Expense.id).label("expense_count")
            )
            .where(
                Expense.user_id == user_id,
                func.date(Expense.expense_date) >= start_date,
                func.date(Expense.expense_date) <= end_date
            )
        )
        expenses = expense_result.first()
        
        total_sales = float(sales.total_sales or 0)
        total_expenses = float(expenses.total_expenses or 0)
        gross_profit = total_sales - total_expenses
        margin = (gross_profit / total_sales * 100) if total_sales > 0 else 0
        
        # IGV neto a pagar
        igv_sales = float(sales.igv_sales or 0)
        igv_expenses = float(expenses.igv_expenses or 0)
        igv_net = igv_sales - igv_expenses
        
        return {
            "period": f"{year}-{month:02d}",
            "sales": {
                "total": total_sales,
                "subtotal": float(sales.subtotal_sales or 0),
                "igv": igv_sales,
                "count": sales.sales_count or 0
            },
            "expenses": {
                "total": total_expenses,
                "subtotal": float(expenses.subtotal_expenses or 0),
                "igv": igv_expenses,
                "count": expenses.expense_count or 0
            },
            "profit": {
                "gross_profit": gross_profit,
                "margin_percent": round(margin, 2),
                "igv_net_to_pay": max(0, igv_net),
                "igv_credit": igv_expenses
            }
        }

    async def get_yearly_profit_trend(self, user_id: int, year: int) -> List[Dict]:
        """Tendencia de utilidad mensual del año"""
        trend = []
        for month in range(1, 13):
            report = await self.get_profit_report(user_id, year, month)
            trend.append({
                "month": month,
                "sales": report["sales"]["total"],
                "expenses": report["expenses"]["total"],
                "profit": report["profit"]["gross_profit"],
                "margin": report["profit"]["margin_percent"]
            })
        return trend


# ===== Integración NLP para comandos de gastos =====
EXPENSE_COMMANDS = {
    "gasto": "add_expense",
    "gastos": "list_expenses",
    "compré": "add_expense",
    "compre": "add_expense",
    "pagué": "add_expense",
    "pague": "add_expense",
    "egreso": "add_expense",
    "egresos": "list_expenses",
    "utilidad": "show_profit",
    "ganancia": "show_profit",
    "rentabilidad": "show_profit",
}

async def handle_expense_command(
    text: str,
    user_id: int,
    db: AsyncSession,
    whatsapp_service: WhatsAppService,
    nlp_service: NLPService
):
    """Procesar comandos de gastos desde WhatsApp"""
    text_lower = text.lower().strip()
    service = ExpenseService(db)
    
    if any(kw in text_lower for kw in ["gasto", "compré", "compre", "pagué", "pague", "egreso"]):
        # Registro rápido: "gasto alquiler 1500" o "compre mercadería 500 soles"
        
        # Extraer categoría y monto
        import re
        # Patrones: "gasto [categoría] [monto]" o "[categoría] [monto]"
        patterns = [
            r'(?:gasto|compré|compre|pagué|pague|egreso)\s+(\w+)\s+(\d+(?:\.\d+)?)',
            r'(\w+)\s+(\d+(?:\.\d+)?)\s*soles?',
        ]
        
        category = "otros"
        amount = 0
        
        for pattern in patterns:
            match = re.search(pattern, text_lower)
            if match:
                if len(match.groups()) >= 2:
                    category = match.group(1)
                    amount = float(match.group(2))
                    break
        
        # Mapear categoría
        category = EXPENSE_CATEGORIES.get(category, "otros")
        
        if amount > 0:
            # Descripción del resto del texto
            desc = text.replace(match.group(0), "").strip() if match else text
            
            expense = await service.create_expense(
                user_id=user_id,
                category=category,
                description=desc or f"Gasto en {category}",
                amount=amount
            )
            
            await whatsapp_service.send_text_message(
                user_id,
                f"💸 *Gasto registrado*\n"
                f"📂 {service.EXPENSE_CATEGORIES.get(category, category)}\n"
                f"💰 S/ {amount:.2f}\n"
                f"📝 {desc or 'Sin descripción'}"
            )
        else:
            await whatsapp_service.send_text_message(
                user_id,
                "💸 *Registrar gasto*\n\n"
                "Formato: *gasto [categoría] [monto] [descripción]*\n\n"
                "Categorías: alquiler, servicios, transporte, marketing, "
                "suministros, mantenimiento, planilla, impuestos, bancarios, otros\n\n"
                "Ejemplos:\n"
                "• gasto alquiler 1500 local principal\n"
                "• compré mercadería 500 polvos\n"
                "• pagué servicios 280 luz agua internet"
            )
    
    elif "gastos" in text_lower or "egresos" in text_lower:
        # Listar gastos del mes
        now = datetime.now()
        expenses = await service.get_expenses(
            user_id=user_id,
            start_date=date(now.year, now.month, 1),
            limit=20
        )
        
        if not expenses:
            await whatsapp_service.send_text_message(user_id, "📭 No hay gastos registrados este mes.")
            return
        
        msg = f"💸 *Gastos de {now.strftime('%B %Y')}:*\n\n"
        total = 0
        by_cat = {}
        
        for exp in expenses:
            total += exp.total
            cat = exp.category
            if cat not in by_cat:
                by_cat[cat] = {"total": 0, "count": 0}
            by_cat[cat]["total"] += exp.total
            by_cat[cat]["count"] += 1
        
        for cat, data in sorted(by_cat.items(), key=lambda x: x[1]["total"], reverse=True):
            name = service.EXPENSE_CATEGORIES.get(cat, cat)
            msg += f"📂 {name}: S/ {data['total']:.2f} ({data['count']} items)\n"
        
        msg += f"\n💰 *Total: S/ {total:.2f}*"
        await whatsapp_service.send_text_message(user_id, msg)
    
    elif any(kw in text_lower for kw in ["utilidad", "ganancia", "rentabilidad", "beneficio"]):
        # Mostrar utilidad del mes
        now = datetime.now()
        report = await service.get_profit_report(user_id, now.year, now.month)
        
        p = report["profit"]
        s = report["sales"]
        e = report["expenses"]
        
        emoji = "📈" if p["gross_profit"] >= 0 else "📉"
        
        msg = (
            f"{emoji} *Utilidad {now.strftime('%B %Y')}*\n\n"
            f"💰 Ventas: S/ {s['total']:.2f} ({s['count']} facturas)\n"
            f"💸 Gastos: S/ {e['total']:.2f} ({e['count']} items)\n"
            f"{'─' * 25}\n"
            f"{emoji} *Utilidad: S/ {p['gross_profit']:.2f}*\n"
            f"📊 Margen: {p['margin_percent']:.1f}%\n\n"
            f"🧾 IGV Ventas: S/ {s['igv']:.2f}\n"
            f"📥 IGV Compras: S/ {e['igv']:.2f}\n"
            f"⚖️ IGV Neto: S/ {p['igv_net_to_pay']:.2f}"
        )
        
        await whatsapp_service.send_text_message(user_id, msg)


# ===== Tarea programada: Reporte mensual automático =====
"""
@celery_app.task
def send_monthly_profit_report():
    '''Enviar reporte de utilidad el día 1 de cada mes a las 8 AM'''
    import asyncio
    from app.core.database import AsyncSessionLocal
    from app.models import User
    from app.services.whatsapp_service import WhatsAppService
    from datetime import datetime
    
    async def _send():
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.is_active == True))
            users = result.scalars().all()
            
            whatsapp = WhatsAppService()
            service = ExpenseService(db)
            
            # Mes anterior
            today = datetime.now()
            if today.month == 1:
                year, month = today.year - 1, 12
            else:
                year, month = today.year, today.month - 1
            
            for user in users:
                report = await service.get_profit_report(user.id, year, month)
                p = report["profit"]
                s = report["sales"]
                e = report["expenses"]
                
                msg = (
                    f"📊 *Reporte Mensual {month:02d}/{year}*\n\n"
                    f"💰 Ventas: S/ {s['total']:.2f}\n"
                    f"💸 Gastos: S/ {e['total']:.2f}\n"
                    f"{'─' * 20}\n"
                    f"{'📈' if p['gross_profit'] >= 0 else '📉'} Utilidad: S/ {p['gross_profit']:.2f}\n"
                    f"📊 Margen: {p['margin_percent']:.1f}%\n\n"
                    f"Ver detalle en dashboard: /dashboard/"
                )
                
                await whatsapp_service.send_text_message(user.whatsapp_id, msg)
    
    asyncio.run(_send())
"""