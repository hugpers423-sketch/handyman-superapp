import openpyxl
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill, numbers
from openpyxl.utils import get_column_letter
import io
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy import select, func, and_, extract
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, date
from calendar import monthrange

from app.models import User, Invoice, InvoiceItem, Expense, Product
from app.core.config import settings
from app.services.whatsapp_service import WhatsAppService

logger = logging.getLogger(__name__)


class SunatReportService:
    """Genera reportes mensuales SUNAT en Excel"""
    
    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate_sales_report(self, user_id: int, year: int, month: int) -> bytes:
        """Generar reporte de ventas (Registro de Ventas e Ingresos - 8.1)"""
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Ventas"
        
        # Estilos
        header_font = Font(bold=True, color="FFFFFF", size=11)
        header_fill = PatternFill(start_color="0284C7", end_color="0284C7", fill_type="solid")
        header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        thin_border = Border(
            left=Side(style="thin"),
            right=Side(style="thin"),
            top=Side(style="thin"),
            bottom=Side(style="thin")
        )
        money_format = '#,##0.00'
        
        # Cabeceras SUNAT 8.1
        headers = [
            "FECHA EMISIÓN", "FECHA VENCIMIENTO", "TIPO COMPROBANTE", "SERIE", "NÚMERO",
            "TIPO DOC CLIENTE", "NUM DOC CLIENTE", "RAZÓN SOCIAL CLIENTE",
            "VALOR FACTURADO EXPORTACIÓN", "BASE IMPONIBLE OP. GRAVADAS",
            "BASE IMPONIBLE OP. INAFECTAS", "BASE IMPONIBLE OP. EXONERADAS",
            "ISC", "IGV", "OTROS TRIBUTOS", "TOTAL COMPROBANTE",
            "CÓDIGO MONEDA", "TIPO CAMBIO", "FECHA EMISIÓN COMP. ORIGEN",
            "TIPO COMP. ORIGEN", "SERIE COMP. ORIGEN", "NÚMERO COMP. ORIGEN",
            "ESTADO", "OBSERVACIONES"
        ]
        
        # Escribir cabeceras
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
            cell.border = thin_border
        
        # Obtener facturas del mes
        start_date = date(year, month, 1)
        end_date = date(year, month, monthrange(year, month)[1])
        
        result = await self.db.execute(
            select(Invoice)
            .where(
                Invoice.user_id == user_id,
                func.date(Invoice.created_at) >= start_date,
                func.date(Invoice.created_at) <= end_date,
                Invoice.sunat_status == "accepted"
            )
            .order_by(Invoice.created_at)
        )
        invoices = result.scalars().all()
        
        # Mapear tipo documento SUNAT
        doc_type_map = {"01": "01", "03": "03", "07": "07", "08": "08"}
        customer_doc_type_map = {"1": "1", "6": "6", "4": "4", "7": "7"}
        
        row_num = 2
        for inv in invoices:
            # Obtener items para calcular bases por tipo de IGV
            items_result = await self.db.execute(
                select(InvoiceItem).where(InvoiceItem.invoice_id == inv.id)
            )
            items = items_result.scalars().all()
            
            gravadas = 0
            inafectas = 0
            exoneradas = 0
            igv_total = 0
            
            for item in items:
                base = item.quantity * item.unit_price * (1 - item.discount / 100)
                if item.tax_type == "10":
                    gravadas += base
                    igv_total += base * (item.tax_rate / 100)
                elif item.tax_type == "30":
                    inafectas += base
                elif item.tax_type == "20":
                    exoneradas += base
            
            row_data = [
                inv.created_at.strftime("%d/%m/%Y"),  # Fecha emisión
                inv.created_at.strftime("%d/%m/%Y"),  # Fecha vencimiento (contado)
                doc_type_map.get(inv.document_type, "03"),  # Tipo comprobante
                inv.series,
                inv.number,
                customer_doc_type_map.get(inv.customer_type, "1"),
                inv.customer_doc,
                inv.customer_name or "CLIENTE VARIOS",
                0,  # Exportación
                round(gravadas, 2),
                round(inafectas, 2),
                round(exoneradas, 2),
                0,  # ISC
                round(igv_total, 2),
                0,  # Otros tributos
                round(inv.total, 2),
                "PEN",  # Moneda
                1.000,  # Tipo cambio
                "", "", "", "",  # Comprobante origen
                "1",  # Estado = 1 (normal)
                ""  # Observaciones
            ]
            
            for col, value in enumerate(row_data, 1):
                cell = ws.cell(row=row_num, column=col, value=value)
                cell.border = thin_border
                cell.alignment = Alignment(horizontal="center", vertical="center")
                if col in [10, 11, 12, 13, 14, 15, 16]:
                    cell.number_format = money_format
            
            row_num += 1
        
        # Ajustar anchos
        for col in range(1, len(headers) + 1):
            ws.column_dimensions[get_column_letter(col)].width = 18
        
        # Guardar en bytes
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output.getvalue()

    async def generate_purchases_report(self, user_id: int, year: int, month: int) -> bytes:
        """Generar reporte de compras (Registro de Compras - 8.2)"""
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Compras"
        
        header_font = Font(bold=True, color="FFFFFF", size=11)
        header_fill = PatternFill(start_color="16A34A", end_color="16A34A", fill_type="solid")
        header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        thin_border = Border(
            left=Side(style="thin"), right=Side(style="thin"),
            top=Side(style="thin"), bottom=Side(style="thin")
        )
        money_format = '#,##0.00'
        
        # Cabeceras SUNAT 8.2
        headers = [
            "FECHA EMISIÓN", "FECHA VENCIMIENTO", "TIPO COMPROBANTE", "SERIE", "NÚMERO",
            "TIPO DOC PROVEEDOR", "RUC PROVEEDOR", "RAZÓN SOCIAL PROVEEDOR",
            "BASE IMPONIBLE OP. GRAVADAS", "BASE IMPONIBLE OP. INAFECTAS",
            "BASE IMPONIBLE OP. EXONERADAS", "ISC", "IGV", "OTROS TRIBUTOS",
            "TOTAL COMPROBANTE", "CÓDIGO MONEDA", "TIPO CAMBIO",
            "FECHA EMISIÓN COMP. ORIGEN", "TIPO COMP. ORIGEN", "SERIE COMP. ORIGEN",
            "NÚMERO COMP. ORIGEN", "CLASIFICACIÓN BIENES/SERVICIOS",
            "INDICADOR BIENES/SERVICIOS", "ESTADO", "OBSERVACIONES"
        ]
        
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
            cell.border = thin_border
        
        start_date = date(year, month, 1)
        end_date = date(year, month, monthrange(year, month)[1])
        
        result = await self.db.execute(
            select(Expense)
            .where(
                Expense.user_id == user_id,
                func.date(Expense.expense_date) >= start_date,
                func.date(Expense.expense_date) <= end_date
            )
            .order_by(Expense.expense_date)
        )
        expenses = result.scalars().all()
        
        row_num = 2
        for exp in expenses:
            # Calcular bases según IGV
            gravadas = exp.subtotal if exp.sunat_status != "exonerated" else 0
            inafectas = 0
            exoneradas = exp.subtotal if exp.sunat_status == "exonerated" else 0
            igv = exp.tax_amount
            
            row_data = [
                exp.expense_date.strftime("%d/%m/%Y"),
                exp.due_date.strftime("%d/%m/%Y") if exp.due_date else exp.expense_date.strftime("%d/%m/%Y"),
                exp.document_type or "01",
                exp.series or "",
                exp.number or 0,
                exp.supplier_type or "6",
                exp.supplier_doc or "",
                exp.supplier_name or "",
                round(gravadas, 2),
                round(inafectas, 2),
                round(exoneradas, 2),
                0,  # ISC
                round(igv, 2),
                0,  # Otros
                round(exp.total, 2),
                "PEN",
                1.000,
                "", "", "", "",
                "1",  # Bienes
                "1",  # Servicios
                "1" if exp.sunat_status == "accepted" else "0",
                ""
            ]
            
            for col, value in enumerate(row_data, 1):
                cell = ws.cell(row=row_num, column=col, value=value)
                cell.border = thin_border
                cell.alignment = Alignment(horizontal="center", vertical="center")
                if col in [9, 10, 11, 12, 13, 14, 15]:
                    cell.number_format = money_format
            
            row_num += 1
        
        for col in range(1, len(headers) + 1):
            ws.column_dimensions[get_column_letter(col)].width = 18
        
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output.getvalue()

    async def generate_diario_report(self, user_id: int, year: int, month: int) -> bytes:
        """Generar libro diario simplificado"""
        wb = openpyxl.Workbook()
        
        # Hoja 1: Asientos de Ventas
        ws1 = wb.active
        ws1.title = "Diario Ventas"
        self._write_diario_sheet(ws1, await self._get_sales_entries(user_id, year, month))
        
        # Hoja 2: Asientos de Compras
        ws2 = wb.create_sheet("Diario Compras")
        self._write_diario_sheet(ws2, await self._get_purchase_entries(user_id, year, month))
        
        # Hoja 3: Resumen
        ws3 = wb.create_sheet("Resumen")
        self._write_resumen_sheet(ws3, user_id, year, month)
        
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output.getvalue()

    def _write_diario_sheet(self, ws, entries: List[Dict]):
        header_font = Font(bold=True, color="FFFFFF", size=10)
        header_fill = PatternFill(start_color="7C3AED", end_color="7C3AED", fill_type="solid")
        thin_border = Border(
            left=Side(style="thin"), right=Side(style="thin"),
            top=Side(style="thin"), bottom=Side(style="thin")
        )
        money_format = '#,##0.00'
        
        headers = ["FECHA", "CUENTA", "GLOSA", "DEBE", "HABER", "DOCUMENTO", "SERIE", "NÚMERO"]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center")
            cell.border = thin_border
        
        for row_num, entry in enumerate(entries, 2):
            for col, key in enumerate(["fecha", "cuenta", "glosa", "debe", "haber", "documento", "serie", "numero"], 1):
                cell = ws.cell(row=row_num, column=col, value=entry.get(key, ""))
                cell.border = thin_border
                if col in [4, 5]:
                    cell.number_format = money_format
                    cell.alignment = Alignment(horizontal="right")
        
        for col in range(1, len(headers) + 1):
            ws.column_dimensions[get_column_letter(col)].width = 20

    def _write_resumen_sheet(self, ws, user_id: int, year: int, month: int):
        # Implementar resumen mensual
        ws.cell(row=1, column=1, value=f"Resumen {month}/{year}")
        ws.cell(row=2, column=1, value="Total Ventas")
        ws.cell(row=3, column=1, value="Total Compras")
        ws.cell(row=4, column=1, value="IGV Ventas")
        ws.cell(row=5, column=1, value="IGV Compras")
        ws.cell(row=6, column=1, value="IGV a Pagar/Recuperar")

    async def _get_sales_entries(self, user_id: int, year: int, month: int) -> List[Dict]:
        start_date = date(year, month, 1)
        end_date = date(year, month, monthrange(year, month)[1])
        
        result = await self.db.execute(
            select(Invoice)
            .where(
                Invoice.user_id == user_id,
                func.date(Invoice.created_at) >= start_date,
                func.date(Invoice.created_at) <= end_date,
                Invoice.sunat_status == "accepted"
            )
        )
        invoices = result.scalars().all()
        
        entries = []
        for inv in invoices:
            fecha = inv.created_at.strftime("%d/%m/%Y")
            doc = f"{inv.series}-{inv.number:08d}"
            
            # Asiento: Ventas
            entries.append({
                "fecha": fecha,
                "cuenta": "70111",  # Venta de mercaderías
                "glosa": f"Venta {doc} - {inv.customer_name or 'CLIENTE VARIOS'}",
                "debe": 0,
                "haber": round(inv.subtotal, 2),
                "documento": inv.document_type_name,
                "serie": inv.series,
                "numero": inv.number
            })
            # IGV
            if inv.tax_amount > 0:
                entries.append({
                    "fecha": fecha,
                    "cuenta": "40111",  # IGV por pagar
                    "glosa": f"IGV {doc}",
                    "debe": 0,
                    "haber": round(inv.tax_amount, 2),
                    "documento": inv.document_type_name,
                    "serie": inv.series,
                    "numero": inv.number
                })
            # Cliente
            entries.append({
                "fecha": fecha,
                "cuenta": "12111" if len(inv.customer_doc) == 8 else "12112",  # Clientes
                "glosa": f"Cuenta por cobrar {doc}",
                "debe": round(inv.total, 2),
                "haber": 0,
                "documento": inv.document_type_name,
                "serie": inv.series,
                "numero": inv.number
            })
        
        return entries

    async def _get_purchase_entries(self, user_id: int, year: int, month: int) -> List[Dict]:
        start_date = date(year, month, 1)
        end_date = date(year, month, monthrange(year, month)[1])
        
        result = await self.db.execute(
            select(Expense)
            .where(
                Expense.user_id == user_id,
                func.date(Expense.expense_date) >= start_date,
                func.date(Expense.expense_date) <= end_date
            )
        )
        expenses = result.scalars().all()
        
        entries = []
        for exp in expenses:
            fecha = exp.expense_date.strftime("%d/%m/%Y")
            doc = f"{exp.series or ''}-{exp.number or 0}"
            
            # Compras
            entries.append({
                "fecha": fecha,
                "cuenta": "60111",  # Compras de mercaderías
                "glosa": f"Compra {doc} - {exp.supplier_name}",
                "debe": round(exp.subtotal, 2),
                "haber": 0,
                "documento": exp.document_type or "01",
                "serie": exp.series or "",
                "numero": exp.number or 0
            })
            # IGV
            if exp.tax_amount > 0:
                entries.append({
                    "fecha": fecha,
                    "cuenta": "40112",  # IGV crédito fiscal
                    "glosa": f"IGV crédito {doc}",
                    "debe": round(exp.tax_amount, 2),
                    "haber": 0,
                    "documento": exp.document_type or "01",
                    "serie": exp.series or "",
                    "numero": exp.number or 0
                })
            # Proveedor
            entries.append({
                "fecha": fecha,
                "cuenta": "42111",  # Proveedores
                "glosa": f"Cuenta por pagar {doc}",
                "debe": 0,
                "haber": round(exp.total, 2),
                "documento": exp.document_type or "01",
                "serie": exp.series or "",
                "numero": exp.number or 0
            })
        
        return entries


async def generate_monthly_reports(user_id: int, year: int = None, month: int = None) -> Dict[str, Any]:
    """Generar todos los reportes del mes (para tarea programada)"""
    from app.core.database import AsyncSessionLocal
    from app.models import SunatReport
    
    if year is None:
        year = datetime.now().year
    if month is None:
        month = datetime.now().month - 1  # Mes anterior
        if month == 0:
            month = 12
            year -= 1
    
    async with AsyncSessionLocal() as db:
        service = SunatReportService(db)
        
        reports = {}
        try:
            # Ventas
            sales_data = await service.generate_sales_report(user_id, year, month)
            reports["ventas"] = sales_data
            
            # Compras
            purchases_data = await service.generate_purchases_report(user_id, year, month)
            reports["compras"] = purchases_data
            
            # Diario
            diario_data = await service.generate_diario_report(user_id, year, month)
            reports["diario"] = diario_data
            
            return {"success": True, "reports": reports, "period": f"{year}-{month:02d}"}
        except Exception as e:
            logger.error(f"Error generando reportes: {e}")
            return {"success": False, "error": str(e)}