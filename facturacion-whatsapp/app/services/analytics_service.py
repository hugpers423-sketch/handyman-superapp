import logging
import statistics
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy import select, func, and_, extract
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, date, timedelta
from collections import defaultdict

from app.models import Invoice, InvoiceItem, Product, Expense, Customer

logger = logging.getLogger(__name__)


class AnalyticsService:
    """Analytics avanzados: tendencias, pronósticos, KPIs"""
    
    def __init__(self, db: AsyncSession):
        self.db = db

    # ===== KPIs PRINCIPALES =====
    
    async def get_kpis(self, user_id: int, period_days: int = 30) -> Dict[str, Any]:
        """KPIs principales del negocio"""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=period_days)
        
        # Ventas
        sales_result = await self.db.execute(
            select(
                func.sum(Invoice.total).label("total"),
                func.count(Invoice.id).label("count"),
                func.avg(Invoice.total).label("avg_ticket"),
                func.sum(Invoice.subtotal).label("subtotal"),
                func.sum(Invoice.tax_amount).label("igv")
            ).where(
                Invoice.user_id == user_id,
                Invoice.created_at >= start_date,
                Invoice.sunat_status == "accepted"
            )
        )
        sales = sales_result.first()
        
        # Gastos
        exp_result = await self.db.execute(
            select(
                func.sum(Expense.total).label("total"),
                func.count(Expense.id).label("count")
            ).where(
                Expense.user_id == user_id,
                Expense.expense_date >= start_date
            )
        )
        expenses = exp_result.first()
        
        # Productos vendidos
        items_result = await self.db.execute(
            select(
                func.sum(InvoiceItem.quantity).label("total_qty"),
                func.count(InvoiceItem.id.distinct()).label("unique_products")
            ).join(Invoice).where(
                Invoice.user_id == user_id,
                Invoice.created_at >= start_date,
                Invoice.sunat_status == "accepted"
            )
        )
        items = items_result.first()
        
        # Clientes únicos
        customers_result = await self.db.execute(
            select(func.count(Invoice.customer_doc.distinct())).where(
                Invoice.user_id == user_id,
                Invoice.created_at >= start_date,
                Invoice.sunat_status == "accepted",
                Invoice.customer_doc != ""
            )
        )
        unique_customers = customers_result.scalar() or 0
        
        total_sales = float(sales.total or 0)
        total_expenses = float(expenses.total or 0)
        
        return {
            "period_days": period_days,
            "sales": {
                "total": total_sales,
                "count": sales.count or 0,
                "avg_ticket": float(sales.avg_ticket or 0),
                "subtotal": float(sales.subtotal or 0),
                "igv": float(sales.igv or 0),
                "daily_avg": total_sales / period_days if period_days > 0 else 0
            },
            "expenses": {
                "total": total_expenses,
                "count": expenses.count or 0,
                "daily_avg": total_expenses / period_days if period_days > 0 else 0
            },
            "profit": {
                "gross": total_sales - total_expenses,
                "margin": ((total_sales - total_expenses) / total_sales * 100) if total_sales > 0 else 0
            },
            "products": {
                "total_sold": float(items.total_qty or 0),
                "unique_sold": items.unique_products or 0
            },
            "customers": {
                "unique": unique_customers,
                "avg_per_customer": total_sales / unique_customers if unique_customers > 0 else 0
            }
        }

    async def get_kpis_comparison(
        self,
        user_id: int,
        current_days: int = 30,
        previous_days: int = 30
    ) -> Dict[str, Any]:
        """Comparar KPIs período actual vs anterior"""
        now = datetime.now()
        
        current = await self.get_kpis(user_id, current_days)
        
        # Período anterior
        prev_start = now - timedelta(days=current_days + previous_days)
        prev_end = now - timedelta(days=current_days)
        
        prev_sales_result = await self.db.execute(
            select(
                func.sum(Invoice.total).label("total"),
                func.count(Invoice.id).label("count")
            ).where(
                Invoice.user_id == user_id,
                Invoice.created_at >= prev_start,
                Invoice.created_at < prev_end,
                Invoice.sunat_status == "accepted"
            )
        )
        prev_sales = prev_sales_result.first()
        
        prev_exp_result = await self.db.execute(
            select(func.sum(Expense.total)).where(
                Expense.user_id == user_id,
                Expense.expense_date >= prev_start,
                Expense.expense_date < prev_end
            )
        )
        prev_expenses = prev_exp_result.scalar() or 0
        
        prev_total_sales = float(prev_sales.total or 0)
        prev_total_expenses = float(prev_expenses)
        
        def calc_change(current_val: float, previous_val: float) -> Dict[str, Any]:
            if previous_val == 0:
                return {"change": 0, "pct": 0, "trend": "new"}
            change = current_val - previous_val
            pct = (change / previous_val) * 100
            return {
                "change": round(change, 2),
                "pct": round(pct, 1),
                "trend": "up" if change > 0 else "down" if change < 0 else "flat"
            }
        
        return {
            "current": current,
            "previous": {
                "sales": prev_total_sales,
                "expenses": prev_total_expenses,
                "profit": prev_total_sales - prev_total_expenses
            },
            "comparison": {
                "sales": calc_change(current["sales"]["total"], prev_total_sales),
                "expenses": calc_change(current["expenses"]["total"], prev_total_expenses),
                "profit": calc_change(current["profit"]["gross"], prev_total_sales - prev_total_expenses),
                "avg_ticket": calc_change(current["sales"]["avg_ticket"], 
                    prev_total_sales / prev_sales.count if prev_sales.count else 0),
                "daily_sales": calc_change(current["sales"]["daily_avg"], 
                    prev_total_sales / previous_days if previous_days > 0 else 0)
            }
        }

    # ===== TENDENCIAS =====
    
    async def get_daily_sales_trend(
        self,
        user_id: int,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """Ventas diarias de los últimos N días"""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        result = await self.db.execute(
            select(
                func.date(Invoice.created_at).label("day"),
                func.sum(Invoice.total).label("total"),
                func.count(Invoice.id).label("count"),
                func.avg(Invoice.total).label("avg")
            ).where(
                Invoice.user_id == user_id,
                Invoice.created_at >= start_date,
                Invoice.sunat_status == "accepted"
            ).group_by(func.date(Invoice.created_at))
            .order_by(func.date(Invoice.created_at))
        )
        rows = result.all()
        
        # Rellenar días sin ventas
        trend = []
        current = start_date.date()
        end = end_date.date()
        row_dict = {r.day: r for r in rows}
        
        while current <= end:
            row = row_dict.get(current)
            trend.append({
                "date": current.strftime("%Y-%m-%d"),
                "date_fmt": current.strftime("%d/%m"),
                "total": float(row.total) if row else 0,
                "count": row.count if row else 0,
                "avg_ticket": float(row.avg) if row and row.avg else 0
            })
            current += timedelta(days=1)
        
        return trend

    async def get_hourly_sales_pattern(self, user_id: int, days: int = 30) -> List[Dict[str, Any]]:
        """Patrón de ventas por hora del día"""
        start_date = datetime.now() - timedelta(days=days)
        
        result = await self.db.execute(
            select(
                extract('hour', Invoice.created_at).label("hour"),
                func.sum(Invoice.total).label("total"),
                func.count(Invoice.id).label("count")
            ).where(
                Invoice.user_id == user_id,
                Invoice.created_at >= start_date,
                Invoice.sunat_status == "accepted"
            ).group_by(extract('hour', Invoice.created_at))
            .order_by(extract('hour', Invoice.created_at))
        )
        rows = result.all()
        
        pattern = []
        for hour in range(24):
            row = next((r for r in rows if int(r.hour) == hour), None)
            pattern.append({
                "hour": hour,
                "hour_fmt": f"{hour:02d}:00",
                "total": float(row.total) if row else 0,
                "count": row.count if row else 0
            })
        
        return pattern

    async def get_weekly_sales_pattern(self, user_id: int, weeks: int = 12) -> List[Dict[str, Any]]:
        """Patrón de ventas por día de la semana"""
        start_date = datetime.now() - timedelta(weeks=weeks)
        
        result = await self.db.execute(
            select(
                extract('dow', Invoice.created_at).label("dow"),  # 0=Domingo
                func.sum(Invoice.total).label("total"),
                func.count(Invoice.id).label("count"),
                func.avg(Invoice.total).label("avg")
            ).where(
                Invoice.user_id == user_id,
                Invoice.created_at >= start_date,
                Invoice.sunat_status == "accepted"
            ).group_by(extract('dow', Invoice.created_at))
            .order_by(extract('dow', Invoice.created_at))
        )
        rows = result.all()
        
        days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
        pattern = []
        
        for i, day_name in enumerate(days):
            row = next((r for r in rows if int(r.dow) == i), None)
            pattern.append({
                "day": day_name,
                "day_num": i,
                "total": float(row.total) if row else 0,
                "count": row.count if row else 0,
                "avg_ticket": float(row.avg) if row and row.avg else 0
            })
        
        return pattern

    # ===== TOP PRODUCTOS / CLIENTES =====
    
    async def get_top_products(
        self,
        user_id: int,
        limit: int = 10,
        days: int = 30,
        by: str = "quantity"  # quantity, revenue
    ) -> List[Dict[str, Any]]:
        """Top productos vendidos"""
        start_date = datetime.now() - timedelta(days=days)
        
        if by == "revenue":
            order_col = func.sum(InvoiceItem.total).desc()
        else:
            order_col = func.sum(InvoiceItem.quantity).desc()
        
        result = await self.db.execute(
            select(
                InvoiceItem.description,
                func.sum(InvoiceItem.quantity).label("total_qty"),
                func.sum(InvoiceItem.total).label("total_revenue"),
                func.count(InvoiceItem.id).label("times_sold"),
                func.avg(InvoiceItem.unit_price).label("avg_price")
            ).join(Invoice).where(
                Invoice.user_id == user_id,
                Invoice.created_at >= start_date,
                Invoice.sunat_status == "accepted"
            ).group_by(InvoiceItem.description)
            .order_by(order_col)
            .limit(limit)
        )
        rows = result.all()
        
        return [
            {
                "name": row.description,
                "quantity": float(row.total_qty or 0),
                "revenue": float(row.total_revenue or 0),
                "times_sold": row.times_sold or 0,
                "avg_price": float(row.avg_price or 0)
            }
            for row in rows
        ]

    async def get_top_customers(
        self,
        user_id: int,
        limit: int = 10,
        days: int = 90
    ) -> List[Dict[str, Any]]:
        """Top clientes por valor"""
        start_date = datetime.now() - timedelta(days=days)
        
        result = await self.db.execute(
            select(
                Invoice.customer_doc,
                Invoice.customer_name,
                func.sum(Invoice.total).label("total"),
                func.count(Invoice.id).label("count"),
                func.max(Invoice.created_at).label("last_purchase"),
                func.min(Invoice.created_at).label("first_purchase")
            ).where(
                Invoice.user_id == user_id,
                Invoice.created_at >= start_date,
                Invoice.sunat_status == "accepted",
                Invoice.customer_doc != ""
            ).group_by(Invoice.customer_doc, Invoice.customer_name)
            .order_by(func.sum(Invoice.total).desc())
            .limit(limit)
        )
        rows = result.all()
        
        return [
            {
                "doc": row.customer_doc,
                "name": row.customer_name or "Sin nombre",
                "total_spent": float(row.total or 0),
                "purchase_count": row.count or 0,
                "avg_ticket": float(row.total or 0) / row.count if row.count else 0,
                "last_purchase": row.last_purchase.strftime("%d/%m/%Y") if row.last_purchase else None,
                "first_purchase": row.first_purchase.strftime("%d/%m/%Y") if row.first_purchase else None,
                "frequency_days": (row.last_purchase - row.first_purchase).days if row.last_purchase and row.first_purchase else 0
            }
            for row in rows
        ]

    # ===== ANÁLISIS DE STOCK =====
    
    async def get_stock_analysis(self, user_id: int) -> Dict[str, Any]:
        """Análisis completo de inventario"""
        result = await self.db.execute(
            select(Product).where(Product.user_id == user_id, Product.is_active == True)
        )
        products = result.scalars().all()
        
        total_value = sum(p.price * p.stock for p in products)
        total_items = len(products)
        out_of_stock = sum(1 for p in products if p.stock == 0)
        low_stock = sum(1 for p in products if 0 < p.stock <= 5)
        overstock = sum(1 for p in products if p.stock > 100)  # Umbral arbitrario
        
        # Productos sin movimiento (no vendidos en 90 días)
        ninety_days_ago = datetime.now() - timedelta(days=90)
        sold_products_result = await self.db.execute(
            select(InvoiceItem.description.distinct()).join(Invoice).where(
                Invoice.user_id == user_id,
                Invoice.created_at >= ninety_days_ago,
                Invoice.sunat_status == "accepted"
            )
        )
        sold_names = {r[0] for r in sold_products_result.all()}
        no_movement = [p for p in products if p.name not in sold_names]
        
        # Rotación de inventario (ventas / stock promedio)
        turnover = {}
        for p in products:
            if p.stock > 0:
                # Buscar ventas últimos 30 días
                sold_qty_result = await self.db.execute(
                    select(func.sum(InvoiceItem.quantity)).join(Invoice).where(
                        Invoice.user_id == user_id,
                        Invoice.created_at >= datetime.now() - timedelta(days=30),
                        Invoice.sunat_status == "accepted",
                        InvoiceItem.description == p.name
                    )
                )
                sold_qty = sold_qty_result.scalar() or 0
                turnover[p.name] = sold_qty / p.stock if p.stock > 0 else 0
        
        slow_moving = sorted(turnover.items(), key=lambda x: x[1])[:10]
        fast_moving = sorted(turnover.items(), key=lambda x: x[1], reverse=True)[:10]
        
        return {
            "summary": {
                "total_products": total_items,
                "total_value": total_value,
                "out_of_stock": out_of_stock,
                "low_stock": low_stock,
                "overstock": overstock,
                "no_movement_90d": len(no_movement)
            },
            "slow_moving": [{"product": k, "turnover": v} for k, v in slow_moving],
            "fast_moving": [{"product": k, "turnover": v} for k, v in fast_moving],
            "no_movement_products": [p.name for p in no_movement[:20]]
        }

    # ===== PRONÓSTICOS SIMPLES =====
    
    async def forecast_sales(
        self,
        user_id: int,
        forecast_days: int = 7,
        method: str = "moving_average"  # moving_average, linear_trend
    ) -> Dict[str, Any]:
        """Pronóstico simple de ventas"""
        # Obtener histórico de 30-90 días
        history_days = max(30, forecast_days * 3)
        daily_trend = await self.get_daily_sales_trend(user_id, history_days)
        
        totals = [d["total"] for d in daily_trend]
        
        if method == "moving_average":
            # Promedio móvil de 7 días
            window = min(7, len(totals))
            recent_avg = statistics.mean(totals[-window:]) if totals else 0
            forecast = [recent_avg] * forecast_days
            
        elif method == "linear_trend" and len(totals) >= 7:
            # Tendencia lineal simple
            x = list(range(len(totals)))
            y = totals
            
            # Regresión lineal simple
            n = len(x)
            sum_x = sum(x)
            sum_y = sum(y)
            sum_xy = sum(x[i] * y[i] for i in range(n))
            sum_x2 = sum(xi * xi for xi in x)
            
            slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x)
            intercept = (sum_y - slope * sum_x) / n
            
            forecast = [max(0, intercept + slope * (len(totals) + i)) for i in range(forecast_days)]
        else:
            # Fallback: promedio simple
            avg = statistics.mean(totals) if totals else 0
            forecast = [avg] * forecast_days
        
        # Calcular intervalo de confianza simple (±1 desviación estándar)
        std_dev = statistics.stdev(totals) if len(totals) > 1 else 0
        
        return {
            "method": method,
            "forecast_days": forecast_days,
            "historical_days": len(totals),
            "daily_forecast": [
                {
                    "day": i + 1,
                    "date": (datetime.now() + timedelta(days=i + 1)).strftime("%d/%m"),
                    "predicted": round(forecast[i], 2),
                    "lower_bound": round(max(0, forecast[i] - std_dev), 2),
                    "upper_bound": round(forecast[i] + std_dev, 2)
                }
                for i in range(forecast_days)
            ],
            "total_predicted": round(sum(forecast), 2),
            "confidence": "low" if std_dev > statistics.mean(totals) * 0.5 else "medium" if totals else "none"
        }

    async def forecast_stock_out(
        self,
        user_id: int,
        product_name: str = None
    ) -> List[Dict[str, Any]]:
        """Predecir cuándo se agotará el stock"""
        query = select(Product).where(Product.user_id == user_id, Product.is_active == True)
        if product_name:
            query = query.where(Product.name.ilike(f"%{product_name}%"))
        
        result = await self.db.execute(query)
        products = result.scalars().all()
        
        forecasts = []
        for product in products:
            if product.stock <= 0:
                forecasts.append({
                    "product": product.name,
                    "current_stock": product.stock,
                    "status": "AGOTADO",
                    "days_until_stockout": 0,
                    "daily_avg_sales": 0
                })
                continue
            
            # Calcular ventas promedio diarias últimos 30 días
            sold_qty_result = await self.db.execute(
                select(func.sum(InvoiceItem.quantity)).join(Invoice).where(
                    Invoice.user_id == user_id,
                    Invoice.created_at >= datetime.now() - timedelta(days=30),
                    Invoice.sunat_status == "accepted",
                    InvoiceItem.description == product.name
                )
            )
            sold_qty = sold_qty_result.scalar() or 0
            daily_avg = sold_qty / 30 if sold_qty > 0 else 0
            
            if daily_avg > 0:
                days_until = int(product.stock / daily_avg)
                stockout_date = datetime.now() + timedelta(days=days_until)
                status = "CRÍTICO" if days_until <= 7 else "BAJO" if days_until <= 30 else "OK"
            else:
                days_until = None
                stockout_date = None
                status = "SIN VENTAS RECIENTES"
            
            forecasts.append({
                "product": product.name,
                "current_stock": product.stock,
                "unit": product.unit,
                "daily_avg_sales": round(daily_avg, 2),
                "days_until_stockout": days_until,
                "estimated_stockout_date": stockout_date.strftime("%d/%m/%Y") if stockout_date else None,
                "status": status
            })
        
        # Ordenar por días hasta agotamiento
        forecasts.sort(key=lambda x: x["days_until_stockout"] if x["days_until_stockout"] is not None else 999)
        
        return forecasts

    # ===== COHORTES DE CLIENTES =====
    
    async def get_customer_cohorts(self, user_id: int, months: int = 12) -> Dict[str, Any]:
        """Análisis de cohortes de clientes (retención)"""
        # Cohortes por mes de primera compra
        cohorts = defaultdict(lambda: {"customers": set(), "months": defaultdict(int)})
        
        start_date = datetime.now() - timedelta(days=months * 30)
        
        result = await self.db.execute(
            select(
                Invoice.customer_doc,
                func.min(func.date(Invoice.created_at)).label("first_date"),
                func.date(Invoice.created_at).label("purchase_date")
            ).where(
                Invoice.user_id == user_id,
                Invoice.created_at >= start_date,
                Invoice.sunat_status == "accepted",
                Invoice.customer_doc != ""
            ).group_by(Invoice.customer_doc, func.date(Invoice.created_at))
            .order_by(Invoice.customer_doc, func.date(Invoice.created_at))
        )
        rows = result.all()
        
        for row in rows:
            customer_doc = row.customer_doc
            first_month = row.first_date.replace(day=1)
            purchase_month = row.purchase_date.replace(day=1)
            
            cohort_key = first_month.strftime("%Y-%m")
            cohorts[cohort_key]["customers"].add(customer_doc)
            
            month_index = (purchase_month.year - first_month.year) * 12 + (purchase_month.month - first_month.month)
            cohorts[cohort_key]["months"][month_index] += 1
        
        # Formatear para tabla de retención
        retention_table = []
        for cohort_key in sorted(cohorts.keys()):
            cohort = cohorts[cohort_key]
            total_customers = len(cohort["customers"])
            
            row = {"cohort": cohort_key, "customers": total_customers}
            for month_idx in range(min(months, 12)):
                active = cohort["months"].get(month_idx, 0)
                retention_pct = (active / total_customers * 100) if total_customers > 0 else 0
                row[f"M{month_idx}"] = round(retention_pct, 1)
            
            retention_table.append(row)
        
        return {
            "retention_table": retention_table,
            "avg_retention_m1": statistics.mean([r.get("M1", 0) for r in retention_table]) if retention_table else 0,
            "avg_retention_m3": statistics.mean([r.get("M3", 0) for r in retention_table]) if retention_table else 0
        }

    # ===== DASHBOARD DATA =====
    
    async def get_dashboard_data(self, user_id: int) -> Dict[str, Any]:
        """Todos los datos para dashboard analytics"""
        kpis = await self.get_kpis(user_id, 30)
        comparison = await self.get_kpis_comparison(user_id, 30, 30)
        daily_trend = await self.get_daily_sales_trend(user_id, 30)
        hourly = await self.get_hourly_sales_pattern(user_id, 30)
        weekly = await self.get_weekly_sales_pattern(user_id, 12)
        top_products = await self.get_top_products(user_id, 5, 30, "revenue")
        top_customers = await self.get_top_customers(user_id, 5, 90)
        stock = await self.get_stock_analysis(user_id)
        forecast = await self.forecast_sales(user_id, 7)
        anomalies = await detect_anomalies(user_id, self.db)
        
        # Calcular top clientes con porcentaje del total
        total_spent_all = sum(c["total_spent"] for c in top_customers)
        for c in top_customers:
            c["percentage"] = round(c["total_spent"] / total_spent_all * 100, 1) if total_spent_all else 0
        
        return {
            "kpis": kpis,
            "comparison": comparison,
            "daily_trend": daily_trend,
            "hourly_pattern": hourly,
            "weekly_pattern": weekly,
            "top_products": top_products,
            "top_customers": top_customers,
            "stock_analysis": stock,
            "sales_forecast": forecast,
            "anomalies": [a.get("message", str(a)) for a in anomalies],
            "generated_at": datetime.now().isoformat()
        }


# ===== HELPER: Detección de anomalías =====

async def detect_anomalies(user_id: int, db: AsyncSession) -> List[Dict[str, Any]]:
    """Detectar anomalías en ventas/gastos"""
    anomalies = []
    
    # Ventas inusualmente altas/bajas (últimos 7 días vs promedio 30 días)
    recent = await db.execute(
        select(func.date(Invoice.created_at), func.sum(Invoice.total))
        .where(
            Invoice.user_id == user_id,
            Invoice.created_at >= datetime.now() - timedelta(days=7),
            Invoice.sunat_status == "accepted"
        ).group_by(func.date(Invoice.created_at))
    )
    recent_sales = {r[0]: float(r[1]) for r in recent.all()}
    
    avg_30 = await db.execute(
        select(func.date(Invoice.created_at), func.sum(Invoice.total))
        .where(
            Invoice.user_id == user_id,
            Invoice.created_at >= datetime.now() - timedelta(days=30),
            Invoice.sunat_status == "accepted"
        ).group_by(func.date(Invoice.created_at))
    )
    daily_totals = [float(r[1]) for r in avg_30.all()]
    avg_daily = (sum(daily_totals) / len(daily_totals)) if daily_totals else 0
    
    for day, total in recent_sales.items():
        if total > avg_daily * 2:
            anomalies.append({
                "type": "high_sales",
                "date": day.strftime("%d/%m"),
                "value": total,
                "expected": round(avg_daily, 2),
                "message": f"Ventas {total:.0f} vs promedio {avg_daily:.0f} (+{(total/avg_daily-1)*100:.0f}%)"
            })
        elif total < avg_daily * 0.3 and total > 0:
            anomalies.append({
                "type": "low_sales",
                "date": day.strftime("%d/%m"),
                "value": total,
                "expected": round(avg_daily, 2),
                "message": f"Ventas bajas: {total:.0f} vs promedio {avg_daily:.0f}"
            })
    
    # Gastos inusuales
    recent_exp = await db.execute(
        select(func.date(Expense.expense_date), func.sum(Expense.total))
        .where(
            Expense.user_id == user_id,
            Expense.expense_date >= datetime.now() - timedelta(days=7)
        ).group_by(func.date(Expense.expense_date))
    )
    recent_expenses = {r[0]: float(r[1]) for r in recent_exp.all()}
    
    avg_exp_30 = await db.execute(
        select(func.date(Expense.expense_date), func.sum(Expense.total))
        .where(
            Expense.user_id == user_id,
            Expense.expense_date >= datetime.now() - timedelta(days=30)
        ).group_by(func.date(Expense.expense_date))
    )
    exp_daily_totals = [float(r[1]) for r in avg_exp_30.all()]
    avg_daily_exp = (sum(exp_daily_totals) / len(exp_daily_totals)) if exp_daily_totals else 0
    
    for day, total in recent_expenses.items():
        if total > avg_daily_exp * 3:
            anomalies.append({
                "type": "high_expense",
                "date": day.strftime("%d/%m"),
                "value": total,
                "expected": round(avg_daily_exp, 2),
                "message": f"Gasto inusual: {total:.0f} (promedio {avg_daily_exp:.0f})"
            })
    
    return anomalies