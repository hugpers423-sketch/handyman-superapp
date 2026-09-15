from fastapi import APIRouter, Request, Depends, HTTPException, Form, Query
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import select, func, desc, extract
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta, date
from typing import Optional
import io

from app.core.database import get_db
from app.core.config import settings
from app.models import User, Product, Invoice, InvoiceItem, Conversation, Customer, Expense
from app.services.analytics_service import AnalyticsService
from app.services.export_service import ExportService
from app.services.customer_service import CustomerService
from app.services.expense_service import ExpenseService
from app.services.team_service import TeamService
from app.services.whatsapp_template_service import WhatsAppTemplateService
from app.services.invoice_service import InvoiceService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
templates = Jinja2Templates(directory="app/templates")


class CompatTemplates(Jinja2Templates):
    """Compatible con la firma vieja TemplateResponse(nombre, contexto)."""

    def TemplateResponse(self, *args, **kwargs):
        if args and isinstance(args[0], str):
            name, context = args[0], args[1]
            request = context.get("request")
            return super().TemplateResponse(request, name, context, **kwargs)
        return super().TemplateResponse(*args, **kwargs)


templates = CompatTemplates(directory="app/templates")


# ===== AUTH SIMPLE (para demo) =====
async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    """Obtener usuario desde session (simplificado para demo)"""
    # En producción: JWT, OAuth, etc.
    user_id = request.session.get("user_id")
    if not user_id:
        # Para demo: primer usuario activo
        result = await db.execute(select(User).where(User.is_active == True).limit(1))
        user = result.scalar_one_or_none()
        if user:
            request.session["user_id"] = user.id
            return user
    if user_id:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
    raise HTTPException(status_code=401, detail="No autenticado")


# ===== PÁGINAS =====

@router.get("/", response_class=HTMLResponse)
async def dashboard_home(request: Request, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Dashboard principal con métricas"""
    # Métricas del mes actual
    start_of_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Total facturas
    result = await db.execute(
        select(func.count(Invoice.id))
        .where(Invoice.user_id == user.id, Invoice.created_at >= start_of_month)
    )
    total_invoices = result.scalar() or 0
    
    # Total ventas
    result = await db.execute(
        select(func.sum(Invoice.total))
        .where(Invoice.user_id == user.id, Invoice.created_at >= start_of_month, Invoice.sunat_status == "accepted")
    )
    total_sales = result.scalar() or 0
    
    # Facturas pendientes
    result = await db.execute(
        select(func.count(Invoice.id))
        .where(Invoice.user_id == user.id, Invoice.sunat_status == "pending")
    )
    pending_invoices = result.scalar() or 0
    
    # Productos con stock bajo
    result = await db.execute(
        select(func.count(Product.id))
        .where(Product.user_id == user.id, Product.is_active == True, Product.stock <= 5)
    )
    low_stock = result.scalar() or 0
    
    # Últimas 5 facturas
    result = await db.execute(
        select(Invoice)
        .where(Invoice.user_id == user.id)
        .order_by(desc(Invoice.created_at))
        .limit(5)
    )
    recent_invoices = result.scalars().all()
    
    # Últimos 5 productos
    result = await db.execute(
        select(Product)
        .where(Product.user_id == user.id, Product.is_active == True)
        .order_by(desc(Product.created_at))
        .limit(5)
    )
    recent_products = result.scalars().all()
    
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "user": user,
        "total_invoices": total_invoices,
        "total_sales": total_sales,
        "pending_invoices": pending_invoices,
        "low_stock": low_stock,
        "recent_invoices": recent_invoices,
        "recent_products": recent_products,
    })


@router.get("/products", response_class=HTMLResponse)
async def products_list(
    request: Request, 
    user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db),
    search: str = "",
    page: int = 1,
    per_page: int = 20
):
    """Lista de productos con búsqueda y paginación"""
    query = select(Product).where(Product.user_id == user.id, Product.is_active == True)
    
    if search:
        query = query.where(Product.name.ilike(f"%{search}%"))
    
    # Total para paginación
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0
    
    # Paginación
    query = query.order_by(desc(Product.created_at)).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    products = result.scalars().all()
    
    total_pages = (total + per_page - 1) // per_page
    
    return templates.TemplateResponse("products.html", {
        "request": request,
        "user": user,
        "products": products,
        "search": search,
        "page": page,
        "total_pages": total_pages,
        "total": total,
    })


@router.get("/products/new", response_class=HTMLResponse)
async def product_new_form(request: Request, user: User = Depends(get_current_user)):
    """Formulario nuevo producto"""
    return templates.TemplateResponse("product_form.html", {
        "request": request,
        "user": user,
        "product": None,
    })


@router.post("/products/new")
async def product_create(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    name: str = Form(...),
    description: str = Form(""),
    price: float = Form(...),
    stock: int = Form(0),
    unit: str = Form("UNIDAD"),
    sku: str = Form(""),
    barcode: str = Form(""),
    category: str = Form(""),
    brand: str = Form(""),
    tax_type: str = Form("10"),
    tax_rate: float = Form(18.0),
):
    """Crear producto"""
    product = Product(
        user_id=user.id,
        name=name,
        description=description,
        price=price,
        stock=stock,
        unit=unit,
        sku=sku,
        barcode=barcode,
        category=category,
        brand=brand,
        tax_type=tax_type,
        tax_rate=tax_rate,
    )
    db.add(product)
    await db.commit()
    return RedirectResponse(url="/dashboard/products", status_code=303)


@router.get("/products/{product_id}/edit", response_class=HTMLResponse)
async def product_edit_form(
    product_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Formulario editar producto"""
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.user_id == user.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    return templates.TemplateResponse("product_form.html", {
        "request": request,
        "user": user,
        "product": product,
    })


@router.post("/products/{product_id}/edit")
async def product_update(
    product_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    name: str = Form(...),
    description: str = Form(""),
    price: float = Form(...),
    stock: int = Form(0),
    unit: str = Form("UNIDAD"),
    sku: str = Form(""),
    barcode: str = Form(""),
    category: str = Form(""),
    brand: str = Form(""),
    tax_type: str = Form("10"),
    tax_rate: float = Form(18.0),
    is_active: bool = Form(True),
):
    """Actualizar producto"""
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.user_id == user.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    product.name = name
    product.description = description
    product.price = price
    product.stock = stock
    product.unit = unit
    product.sku = sku
    product.barcode = barcode
    product.category = category
    product.brand = brand
    product.tax_type = tax_type
    product.tax_rate = tax_rate
    product.is_active = is_active
    
    await db.commit()
    return RedirectResponse(url="/dashboard/products", status_code=303)


@router.post("/products/{product_id}/delete")
async def product_delete(
    product_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Eliminar producto (soft delete)"""
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.user_id == user.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    product.is_active = False
    await db.commit()
    return RedirectResponse(url="/dashboard/products", status_code=303)


@router.get("/invoices", response_class=HTMLResponse)
async def invoices_list(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    status: str = "",
    page: int = 1,
    per_page: int = 20
):
    """Lista de facturas"""
    query = select(Invoice).where(Invoice.user_id == user.id)
    
    if status:
        query = query.where(Invoice.sunat_status == status)
    
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0
    
    query = query.order_by(desc(Invoice.created_at)).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    invoices = result.scalars().all()
    
    total_pages = (total + per_page - 1) // per_page
    
    return templates.TemplateResponse("invoices.html", {
        "request": request,
        "user": user,
        "invoices": invoices,
        "status": status,
        "page": page,
        "total_pages": total_pages,
        "total": total,
    })


@router.get("/invoices/{invoice_id}", response_class=HTMLResponse)
async def invoice_detail(
    invoice_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Detalle de factura"""
    result = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.user_id == user.id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    
    # Obtener items
    result = await db.execute(
        select(InvoiceItem).where(InvoiceItem.invoice_id == invoice_id)
    )
    items = result.scalars().all()
    
    return templates.TemplateResponse("invoice_detail.html", {
        "request": request,
        "user": user,
        "invoice": invoice,
        "items": items,
    })


@router.post("/invoices/{invoice_id}/void")
async def invoice_void(
    invoice_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Emitir nota de crédito y anular el comprobante"""
    result = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.user_id == user.id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    service = InvoiceService(db)
    outcome = await service.void_invoice(invoice_id, reason="Anulación de la operación")

    if not outcome.get("success"):
        raise HTTPException(status_code=400, detail=outcome.get("error"))

    return RedirectResponse(
        url=f"/dashboard/invoices/{invoice_id}", status_code=303
    )


@router.get("/settings", response_class=HTMLResponse)
async def settings_page(request: Request, user: User = Depends(get_current_user)):
    """Configuración de cuenta"""
    return templates.TemplateResponse("settings.html", {
        "request": request,
        "user": user,
    })


@router.post("/settings")
async def settings_update(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    business_name: str = Form(""),
    ruc: str = Form(""),
    address: str = Form(""),
    district: str = Form(""),
    province: str = Form(""),
    department: str = Form(""),
    phone: str = Form(""),
    email: str = Form(""),
    nubefact_token: str = Form(""),
    nubefact_ruc: str = Form(""),
    nubefact_user: str = Form(""),
    nubefact_password: str = Form(""),
):
    """Actualizar configuración"""
    user.business_name = business_name
    user.ruc = ruc
    user.address = address
    user.district = district
    user.province = province
    user.department = department
    user.phone = phone
    user.email = email
    user.nubefact_token = nubefact_token
    user.nubefact_ruc = nubefact_ruc
    user.nubefact_user = nubefact_user
    user.nubefact_password = nubefact_password
    
    await db.commit()
    return RedirectResponse(url="/dashboard/settings?saved=1", status_code=303)


# ===== API PARA GRÁFICOS (HTMX) =====

@router.get("/api/sales-chart")
async def sales_chart_data(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    days: int = 30
):
    """Datos para gráfico de ventas (últimos N días)"""
    start_date = datetime.now() - timedelta(days=days)
    
    result = await db.execute(
        select(
            func.date(Invoice.created_at).label("date"),
            func.sum(Invoice.total).label("total"),
            func.count(Invoice.id).label("count")
        )
        .where(
            Invoice.user_id == user.id,
            Invoice.created_at >= start_date,
            Invoice.sunat_status == "accepted"
        )
        .group_by(func.date(Invoice.created_at))
        .order_by(func.date(Invoice.created_at))
    )
    rows = result.all()
    
    labels = []
    totals = []
    counts = []
    
    for row in rows:
        labels.append(row.date.strftime("%d/%m"))
        totals.append(float(row.total or 0))
        counts.append(row.count or 0)
    
    return {
        "labels": labels,
        "totals": totals,
        "counts": counts,
    }


@router.get("/api/top-products")
async def top_products(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 10
):
    """Productos más vendidos"""
    result = await db.execute(
        select(
            InvoiceItem.description,
            func.sum(InvoiceItem.quantity).label("total_qty"),
            func.sum(InvoiceItem.total).label("total_amount")
        )
        .join(Invoice, InvoiceItem.invoice_id == Invoice.id)
        .where(
            Invoice.user_id == user.id,
            Invoice.sunat_status == "accepted"
        )
        .group_by(InvoiceItem.description)
        .order_by(desc(func.sum(InvoiceItem.quantity)))
        .limit(limit)
    )
    rows = result.all()
    
    return {
        "products": [
            {"name": r.description, "quantity": float(r.total_qty or 0), "amount": float(r.total_amount or 0)}
            for r in rows
        ]
    }


# ===== NUEVOS ENDPOINTS: ANALYTICS =====

@router.get("/api/analytics/dashboard")
async def analytics_dashboard(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Datos completos para dashboard analytics"""
    service = AnalyticsService(db)
    return await service.get_dashboard_data(user.id)


@router.get("/api/analytics/kpis")
async def analytics_kpis(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    days: int = 30
):
    """KPIs principales"""
    service = AnalyticsService(db)
    return await service.get_kpis(user.id, days)


@router.get("/api/analytics/kpis/comparison")
async def analytics_kpis_comparison(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    current_days: int = 30,
    previous_days: int = 30
):
    """Comparación KPIs período actual vs anterior"""
    service = AnalyticsService(db)
    return await service.get_kpis_comparison(user.id, current_days, previous_days)


@router.get("/api/analytics/trend/daily")
async def analytics_daily_trend(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    days: int = 30
):
    """Tendencia diaria de ventas"""
    service = AnalyticsService(db)
    return await service.get_daily_sales_trend(user.id, days)


@router.get("/api/analytics/trend/hourly")
async def analytics_hourly_pattern(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    days: int = 30
):
    """Patrón de ventas por hora"""
    service = AnalyticsService(db)
    return await service.get_hourly_sales_pattern(user.id, days)


@router.get("/api/analytics/trend/weekly")
async def analytics_weekly_pattern(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    weeks: int = 12
):
    """Patrón de ventas por día de la semana"""
    service = AnalyticsService(db)
    return await service.get_weekly_sales_pattern(user.id, weeks)


@router.get("/api/analytics/top/products")
async def analytics_top_products(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 10,
    days: int = 30,
    by: str = "revenue"
):
    """Top productos"""
    service = AnalyticsService(db)
    return await service.get_top_products(user.id, limit, days, by)


@router.get("/api/analytics/top/customers")
async def analytics_top_customers(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 10,
    days: int = 90
):
    """Top clientes"""
    service = AnalyticsService(db)
    return await service.get_top_customers(user.id, limit, days)


@router.get("/api/analytics/stock")
async def analytics_stock(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Análisis de inventario"""
    service = AnalyticsService(db)
    return await service.get_stock_analysis(user.id)


@router.get("/api/analytics/forecast/sales")
async def analytics_forecast_sales(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    days: int = 7,
    method: str = "moving_average"
):
    """Pronóstico de ventas"""
    service = AnalyticsService(db)
    return await service.forecast_sales(user.id, days, method)


@router.get("/api/analytics/forecast/stockout")
async def analytics_forecast_stockout(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    product_name: str = None
):
    """Pronóstico de agotamiento de stock"""
    service = AnalyticsService(db)
    return await service.forecast_stock_out(user.id, product_name)


@router.get("/api/analytics/cohorts")
async def analytics_cohorts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    months: int = 12
):
    """Análisis de cohortes (retención clientes)"""
    service = AnalyticsService(db)
    return await service.get_customer_cohorts(user.id, months)


# ===== EXPORT ENDPOINTS =====

@router.get("/export/invoices.xlsx")
async def export_invoices_excel(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    start_date: str = None,
    end_date: str = None,
    status: str = None
):
    """Exportar facturas a Excel"""
    service = ExportService(db)
    
    sd = datetime.strptime(start_date, "%Y-%m-%d").date() if start_date else None
    ed = datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else None
    
    excel_bytes = await service.export_invoices_excel(user.id, sd, ed, status)
    
    filename = f"facturas_{datetime.now().strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/products.xlsx")
async def export_products_excel(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Exportar productos a Excel"""
    service = ExportService(db)
    excel_bytes = await service.export_products_excel(user.id)
    
    filename = f"productos_{datetime.now().strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/customers.xlsx")
async def export_customers_excel(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Exportar clientes a Excel"""
    service = ExportService(db)
    excel_bytes = await service.export_customers_excel(user.id)
    
    filename = f"clientes_{datetime.now().strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/expenses.xlsx")
async def export_expenses_excel(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    year: int = None,
    month: int = None
):
    """Exportar gastos a Excel"""
    service = ExportService(db)
    year = year or datetime.now().year
    month = month or datetime.now().month
    excel_bytes = await service.export_expenses_excel(user.id, year, month)
    
    filename = f"gastos_{year}{month:02d}.xlsx"
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/full_backup.xlsx")
async def export_full_backup(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Backup completo en Excel"""
    service = ExportService(db)
    excel_bytes = await service.export_full_backup_excel(user.id)
    
    filename = f"backup_completo_{datetime.now().strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ===== CUSTOMERS ENDPOINTS =====

@router.get("/customers", response_class=HTMLResponse)
async def customers_list(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    search: str = "",
    page: int = 1,
    per_page: int = 20
):
    """Lista de clientes"""
    service = CustomerService(db)
    
    if search:
        customers = await service.search_customers(user.id, search, per_page * page)
        customers = customers[(page-1)*per_page:page*per_page]
        total = len(await service.search_customers(user.id, search, 1000))
    else:
        result = await db.execute(
            select(Customer)
            .where(Customer.user_id == user.id, Customer.is_active == True)
            .order_by(desc(Customer.created_at))
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
        customers = result.scalars().all()
        total_result = await db.execute(
            select(func.count(Customer.id)).where(Customer.user_id == user.id, Customer.is_active == True)
        )
        total = total_result.scalar() or 0
    
    total_pages = (total + per_page - 1) // per_page
    
    return templates.TemplateResponse("customers.html", {
        "request": request,
        "user": user,
        "customers": customers,
        "search": search,
        "page": page,
        "total_pages": total_pages,
        "total": total,
    })


@router.get("/customers/{customer_id}", response_class=HTMLResponse)
async def customer_detail(
    customer_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Detalle de cliente"""
    service = CustomerService(db)
    summary = await service.get_customer_summary(customer_id)
    
    if not summary:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    return templates.TemplateResponse("customer_detail.html", {
        "request": request,
        "user": user,
        "customer": summary,
    })


@router.get("/api/customers/search")
async def api_customers_search(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    q: str = ""
):
    """Buscar clientes para autocomplete"""
    service = CustomerService(db)
    customers = await service.search_customers(user.id, q, 20)
    
    return [
        {
            "id": c.id,
            "name": c.name,
            "doc": c.doc_number,
            "doc_type": c.doc_type,
            "phone": c.phone,
            "credit_available": c.credit_limit - c.credit_used if c.credit_limit > 0 else 0,
            "is_blocked": c.is_blocked
        }
        for c in customers
    ]


@router.post("/api/customers/{customer_id}/payment")
async def api_customer_payment(
    customer_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    amount: float = Form(...),
    description: str = Form("Pago recibido")
):
    """Registrar pago de cliente"""
    service = CustomerService(db)
    success = await service.apply_payment(customer_id, amount, description)
    
    return {"success": success}


@router.post("/api/customers/create")
async def api_customer_create(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    name: str = Form(...),
    doc_type: str = Form("1"),
    doc_number: str = Form(...),
    phone: str = Form(""),
    email: str = Form(""),
    credit_limit: float = Form(0),
    credit_days: int = Form(0)
):
    """Crear cliente desde el dashboard"""
    from app.models import Customer as CustomerModel
    customer = CustomerModel(
        user_id=user.id,
        doc_type=doc_type,
        doc_number=doc_number,
        name=name,
        phone=phone or None,
        email=email or None,
        credit_limit=credit_limit,
        credit_days=credit_days
    )
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    return {"success": True, "id": customer.id}


@router.post("/api/customers/{customer_id}/update")
async def api_customer_update(
    customer_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    name: str = Form(...),
    phone: str = Form(""),
    email: str = Form(""),
    credit_limit: float = Form(0),
    credit_days: int = Form(0)
):
    """Actualizar crédito/datos de cliente"""
    result = await db.execute(
        select(Customer).where(
            Customer.id == customer_id,
            Customer.user_id == user.id
        )
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    customer.name = name
    customer.phone = phone or customer.phone
    customer.email = email or customer.email
    customer.credit_limit = credit_limit
    customer.credit_days = credit_days
    if credit_limit > 0:
        customer.is_blocked = customer.credit_used > credit_limit
    
    await db.commit()
    return {"success": True}


# ===== EXPENSES ENDPOINTS =====

@router.get("/expenses", response_class=HTMLResponse)
async def expenses_list(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    page: int = 1,
    per_page: int = 20
):
    """Lista de gastos"""
    service = ExpenseService(db)
    now = datetime.now()
    start_date = date(now.year, now.month, 1)
    
    expenses = await service.get_expenses(user.id, start_date, limit=per_page * page)
    expenses = expenses[(page-1)*per_page:page*per_page]
    
    summary = await service.get_monthly_summary(user.id, now.year, now.month)
    profit = await service.get_profit_report(user.id, now.year, now.month)
    
    return templates.TemplateResponse("expenses.html", {
        "request": request,
        "user": user,
        "expenses": expenses,
        "summary": summary,
        "profit": profit,
        "now": now,
    })


@router.post("/expenses/new")
async def expense_create(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    category: str = Form(...),
    description: str = Form(""),
    amount: float = Form(...),
    expense_date: str = Form(None),
    supplier_name: str = Form(""),
    supplier_doc: str = Form(""),
    document_type: str = Form("01"),
    series: str = Form(""),
    number: int = Form(0),
    payment_method: str = Form("EFECTIVO")
):
    """Crear gasto"""
    service = ExpenseService(db)
    edate = datetime.strptime(expense_date, "%Y-%m-%d") if expense_date else datetime.now()
    
    await service.create_expense(
        user_id=user.id,
        category=category,
        description=description,
        amount=amount,
        expense_date=edate,
        supplier_name=supplier_name,
        supplier_doc=supplier_doc,
        document_type=document_type,
        series=series,
        number=number,
        payment_method=payment_method
    )
    
    return RedirectResponse(url="/dashboard/expenses", status_code=303)


@router.get("/api/expenses/summary")
async def api_expenses_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    year: int = None,
    month: int = None
):
    """Resumen mensual de gastos"""
    service = ExpenseService(db)
    year = year or datetime.now().year
    month = month or datetime.now().month
    return await service.get_monthly_summary(user.id, year, month)


@router.get("/api/expenses/profit")
async def api_profit_report(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    year: int = None,
    month: int = None
):
    """Reporte de utilidad"""
    service = ExpenseService(db)
    year = year or datetime.now().year
    month = month or datetime.now().month
    return await service.get_profit_report(user.id, year, month)


# ===== TEAM ENDPOINTS =====

@router.get("/team", response_class=HTMLResponse)
async def team_page(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Gestión de equipo"""
    service = TeamService(db)
    members = await service.get_team_members(user.id)
    
    return templates.TemplateResponse("team.html", {
        "request": request,
        "user": user,
        "members": members,
        "roles": TeamService.ROLES,
        "is_admin": True,
    })


@router.post("/team/invite")
async def team_invite(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    whatsapp_id: str = Form(...),
    name: str = Form(...),
    role: str = Form("seller"),
    email: str = Form("")
):
    """Invitar miembro al equipo"""
    service = TeamService(db)
    try:
        member = await service.invite_member(user.id, whatsapp_id, name, role, email)
        return RedirectResponse(url="/dashboard/team?invited=1", status_code=303)
    except ValueError as e:
        return RedirectResponse(url=f"/dashboard/team?error={e}", status_code=303)


@router.post("/team/{member_id}/role")
async def team_update_role(
    member_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    role: str = Form(...)
):
    """Cambiar rol de miembro"""
    service = TeamService(db)
    await service.update_member_role(user.id, member_id, role)
    return RedirectResponse(url="/dashboard/team", status_code=303)


@router.post("/team/{member_id}/remove")
async def team_remove(
    member_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Eliminar miembro"""
    service = TeamService(db)
    await service.remove_member(user.id, member_id)
    return RedirectResponse(url="/dashboard/team", status_code=303)


# ===== WHATSAPP TEMPLATES ENDPOINTS =====

@router.get("/templates", response_class=HTMLResponse)
async def templates_page(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Plantillas WhatsApp"""
    service = WhatsAppTemplateService(db)
    templates_list = await service.list_templates(user.id)
    
    return templates.TemplateResponse("whatsapp_templates.html", {
        "request": request,
        "user": user,
        "templates": templates_list,
    })


@router.post("/templates/create")
async def template_create(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    name: str = Form(...),
    category: str = Form("utility"),
    body_text: str = Form(...),
    header_text: str = Form(""),
    footer_text: str = Form(""),
    buttons_json: str = Form("[]")
):
    """Crear plantilla personalizada"""
    import json
    service = WhatsAppTemplateService(db)
    buttons = json.loads(buttons_json) if buttons_json else []
    
    await service.create_custom_template(
        user_id=user.id,
        name=name,
        category=category,
        body_text=body_text,
        header_text=header_text or None,
        footer_text=footer_text or None,
        buttons=buttons
    )
    
    return RedirectResponse(url="/dashboard/templates", status_code=303)


@router.post("/api/templates/send")
async def template_send(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    template_id: int = Form(...),
    to: str = Form(...)
):
    """Enviar plantilla a un número WhatsApp"""
    from app.models import WhatsAppTemplate
    from app.services.whatsapp_service import WhatsAppService
    
    result = await db.execute(
        select(WhatsAppTemplate).where(
            WhatsAppTemplate.id == template_id,
            WhatsAppTemplate.user_id == user.id,
            WhatsAppTemplate.is_active == True
        )
    )
    template = result.scalar_one_or_none()
    
    if not template:
        return {"success": False, "message": "Plantilla no encontrada"}
    
    service = WhatsAppTemplateService(db)
    ok = await service.send_template_message(
        whatsapp_id=to,
        user_id=user.id,
        template_name=template.name,
        variables={},  # En producción: reemplazar {{1}}, {{2}} con datos reales
        whatsapp_service=WhatsAppService()
    )
    
    return {"success": ok, "message": "Plantilla enviada" if ok else "Error al enviar"}


# ===== PÁGINAS ADICIONALES =====

@router.get("/analytics", response_class=HTMLResponse)
async def analytics_page(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Página de analytics avanzados"""
    service = AnalyticsService(db)
    data = await service.get_dashboard_data(user.id)
    
    return templates.TemplateResponse("analytics.html", {
        "request": request,
        "user": user,
        "data": data,
    })


# ===== HEALTH CHECK PARA MONITOREO =====
@router.get("/health/detailed")
async def health_detailed(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Health check detallado para monitoreo"""
    from sqlalchemy import text
    
    # Test DB
    db_ok = True
    try:
        await db.execute(text("SELECT 1"))
    except:
        db_ok = False
    
    # Test Redis
    redis_ok = True
    try:
        from app.core.config import settings
        import redis
        r = redis.from_url(settings.REDIS_URL)
        r.ping()
    except:
        redis_ok = False
    
    return {
        "status": "healthy" if db_ok and redis_ok else "degraded",
        "database": "ok" if db_ok else "error",
        "redis": "ok" if redis_ok else "error",
        "timestamp": datetime.now().isoformat()
    }