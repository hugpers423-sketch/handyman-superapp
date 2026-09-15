import httpx
import json
import base64
import logging
from typing import Dict, Any, Optional, List
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from decimal import Decimal

from app.core.config import settings
from app.models import User, Invoice, InvoiceItem, Product

logger = logging.getLogger(__name__)


class InvoiceService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.client = httpx.AsyncClient(timeout=60.0)

    async def create_invoice(self, user_id: int, data: Dict[str, Any]) -> Invoice:
        """Crear factura/boleta en base de datos"""
        user = await self.db.get(User, user_id)
        if not user:
            raise ValueError("Usuario no encontrado")
        
        # Obtener siguiente número de serie
        series = data.get("series", "B001")  # Por defecto boleta
        doc_type = data.get("document_type", "03")  # 03=Boleta, 01=Factura
        
        # Buscar último número usado
        result = await self.db.execute(
            select(func.max(Invoice.number))
            .where(Invoice.user_id == user_id, Invoice.series == series)
        )
        last_number = result.scalar() or 0
        next_number = last_number + 1
        
        # Calcular totales
        items_data = data.get("items", [])
        subtotal = 0
        tax_amount = 0
        
        for item in items_data:
            qty = item.get("quantity", 1)
            price = item.get("unit_price", 0)
            discount = item.get("discount", 0)
            tax_rate = item.get("tax_rate", 18.0)
            tax_type = item.get("tax_type", "10")
            
            item_subtotal = qty * price * (1 - discount / 100)
            item_tax = item_subtotal * (tax_rate / 100) if tax_type == "10" else 0
            
            subtotal += item_subtotal
            tax_amount += item_tax
        
        total = subtotal + tax_amount
        
        # Crear factura
        invoice = Invoice(
            user_id=user_id,
            conversation_id=data.get("conversation_id"),
            series=series,
            number=next_number,
            document_type=doc_type,
            document_type_name="Factura" if doc_type == "01" else "Boleta",
            customer_type="1" if len(data.get("customer_doc", "")) == 8 else "6",
            customer_doc=data.get("customer_doc", ""),
            customer_name=data.get("customer_name", ""),
            customer_address=data.get("customer_address", user.address or ""),
            customer_email=data.get("customer_email", ""),
            subtotal=round(subtotal, 2),
            tax_amount=round(tax_amount, 2),
            total=round(total, 2),
            status="draft",
        )
        
        self.db.add(invoice)
        await self.db.flush()  # Para obtener ID
        
        # Crear items
        for item_data in items_data:
            item = InvoiceItem(
                invoice_id=invoice.id,
                product_id=item_data.get("product_id"),
                description=item_data.get("description", ""),
                quantity=item_data.get("quantity", 1),
                unit=item_data.get("unit", "UNIDAD"),
                unit_price=item_data.get("unit_price", 0),
                discount=item_data.get("discount", 0),
                tax_type=item_data.get("tax_type", "10"),
                tax_rate=item_data.get("tax_rate", 18.0),
                total=round(
                    item_data.get("quantity", 1) * item_data.get("unit_price", 0) * 
                    (1 - item_data.get("discount", 0) / 100) *
                    (1 + item_data.get("tax_rate", 18.0) / 100 if item_data.get("tax_type") == "10" else 1),
                    2
                ),
                manual_product_name=item_data.get("description") if not item_data.get("product_id") else None,
            )
            self.db.add(item)
            
            # Actualizar stock si hay product_id
            if item_data.get("product_id"):
                product = await self.db.get(Product, item_data["product_id"])
                if product and product.stock >= item_data.get("quantity", 1):
                    product.stock -= int(item_data.get("quantity", 1))
        
        await self.db.commit()
        await self.db.refresh(invoice)
        
        return invoice

    async def create_credit_note(
        self, user_id: int, original_invoice_id: int,
        reason_code: str = "01", items: Optional[List[Dict[str, Any]]] = None
    ) -> Invoice:
        """Crear nota de crédito (07) sobre una factura o boleta"""
        return await self.create_note(
            user_id, original_invoice_id, note_type="07",
            reason_code=reason_code, items=items
        )

    async def create_debit_note(
        self, user_id: int, original_invoice_id: int,
        reason_code: str = "01", items: Optional[List[Dict[str, Any]]] = None
    ) -> Invoice:
        """Crear nota de débito (08) sobre una factura o boleta"""
        return await self.create_note(
            user_id, original_invoice_id, note_type="08",
            reason_code=reason_code, items=items
        )

    async def create_note(
        self, user_id: int, original_invoice_id: int,
        note_type: str = "07", reason_code: str = "01",
        items: Optional[List[Dict[str, Any]]] = None
    ) -> Invoice:
        """Crear nota de crédito/débito sobre un comprobante emitido"""
        if note_type not in ("07", "08"):
            raise ValueError("Tipo de nota inválido (use 07=crédito, 08=débito)")

        original = await self.db.get(Invoice, original_invoice_id)
        if not original:
            raise ValueError("Comprobante original no encontrado")
        if original.user_id != user_id:
            raise ValueError("El comprobante original no pertenece al usuario")
        if original.document_type not in ("01", "03"):
            raise ValueError("Solo se emiten notas sobre facturas (01) o boletas (03)")
        if original.status not in ("sent", "accepted"):
            raise ValueError("El comprobante original aún no está registrado en SUNAT")

        # Serie: misma que el comprobante original (requisito SUNAT)
        result = await self.db.execute(
            select(func.max(Invoice.number))
            .where(Invoice.user_id == user_id, Invoice.series == original.series)
        )
        next_number = (result.scalar() or 0) + 1

        # Items de la nota (por defecto replica los del original)
        items_data = []
        if items:
            items_data = items
        else:
            result = await self.db.execute(
                select(InvoiceItem).where(InvoiceItem.invoice_id == original.id)
            )
            for it in result.scalars().all():
                items_data.append({
                    "product_id": it.product_id,
                    "description": it.description,
                    "quantity": it.quantity,
                    "unit": it.unit,
                    "unit_price": it.unit_price,
                    "discount": it.discount,
                    "tax_type": it.tax_type,
                    "tax_rate": it.tax_rate,
                })

        # NC usa valores negativos; ND positivos
        sign = -1 if note_type == "07" else 1

        subtotal = 0.0
        tax_amount = 0.0
        for item_data in items_data:
            qty = item_data.get("quantity", 1)
            price = item_data.get("unit_price", 0)
            discount = item_data.get("discount", 0)
            tax_rate = item_data.get("tax_rate", 18.0)
            tax_type = item_data.get("tax_type", "10")

            item_subtotal = qty * price * (1 - discount / 100)
            item_tax = item_subtotal * (tax_rate / 100) if tax_type == "10" else 0

            subtotal += item_subtotal
            tax_amount += item_tax

        total = subtotal + tax_amount

        note = Invoice(
            user_id=user_id,
            conversation_id=original.conversation_id,
            customer_id=original.customer_id,
            series=original.series,
            number=next_number,
            document_type=note_type,
            document_type_name="Nota de Crédito" if note_type == "07" else "Nota de Débito",
            related_invoice_id=original.id,
            credit_note_reason=str(reason_code),
            customer_type=original.customer_type,
            customer_doc=original.customer_doc,
            customer_name=original.customer_name,
            customer_address=original.customer_address,
            customer_email=original.customer_email,
            subtotal=round(subtotal * sign, 2),
            tax_amount=round(tax_amount * sign, 2),
            total=round(total * sign, 2),
            status="draft",
        )

        self.db.add(note)
        await self.db.flush()

        for item_data in items_data:
            qty = item_data.get("quantity", 1)
            price = item_data.get("unit_price", 0)
            discount = item_data.get("discount", 0)
            tax_type = item_data.get("tax_type", "10")
            tax_rate = item_data.get("tax_rate", 18.0)

            item_total = qty * price * (1 - discount / 100)
            if tax_type == "10":
                item_total *= (1 + tax_rate / 100)

            item = InvoiceItem(
                invoice_id=note.id,
                product_id=item_data.get("product_id"),
                description=item_data.get("description", ""),
                quantity=qty,
                unit=item_data.get("unit", "UNIDAD"),
                unit_price=round(price * sign, 4),
                discount=item_data.get("discount", 0),
                tax_type=tax_type,
                tax_rate=tax_rate,
                total=round(item_total * sign, 2),
                manual_product_name=item_data.get("description") if not item_data.get("product_id") else None,
            )
            self.db.add(item)

        await self.db.commit()
        await self.db.refresh(note)
        return note

    async def send_to_sunat(self, invoice_id: int) -> Dict[str, Any]:
        """Enviar factura a SUNAT vía Nubefact"""
        invoice = await self.db.get(Invoice, invoice_id)
        if not invoice:
            return {"success": False, "error": "Factura no encontrada"}
        
        user = await self.db.get(User, invoice.user_id)
        if not user:
            return {"success": False, "error": "Usuario no encontrado"}
        
        # Obtener items
        result = await self.db.execute(
            select(InvoiceItem).where(InvoiceItem.invoice_id == invoice_id)
        )
        items = result.scalars().all()

        # Comprobante referenciado (para notas de crédito/débito)
        original = None
        if invoice.related_invoice_id:
            original = await self.db.get(Invoice, invoice.related_invoice_id)

        # Preparar payload para Nubefact
        payload = self._build_nubefact_payload(invoice, items, user, original)
        
        try:
            # Enviar a Nubefact
            headers = {
                "Authorization": f"Bearer {user.nubefact_token or settings.NUBEFACT_TOKEN}",
                "Content-Type": "application/json",
            }
            
            url = f"{settings.NUBEFACT_API_URL}/facturacion"
            response = await self.client.post(url, json=payload, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                
                # Actualizar factura con respuesta SUNAT
                invoice.sunat_cdr = result.get("sunat_cdr")
                invoice.sunat_status = "accepted" if result.get("sunat_responsecode") == "0" else "rejected"
                invoice.sunat_response = result
                invoice.sunat_hash = result.get("hash_cpe")
                invoice.pdf_url = result.get("enlace_del_pdf")
                invoice.xml_url = result.get("enlace_del_xml")
                invoice.qr_code_url = result.get("enlace_del_qr")
                invoice.status = "sent"
                invoice.sent_at = datetime.utcnow()
                
                await self.db.commit()
                
                return {
                    "success": invoice.sunat_status == "accepted",
                    "pdf_url": invoice.pdf_url,
                    "xml_url": invoice.xml_url,
                    "qr_url": invoice.qr_code_url,
                    "sunat_response": result,
                    "error": None if invoice.sunat_status == "accepted" else result.get("sunat_description"),
                }
            else:
                error_msg = f"Error Nubefact: {response.status_code} - {response.text}"
                logger.error(error_msg)
                return {"success": False, "error": error_msg}
                
        except Exception as e:
            logger.error(f"Error enviando a SUNAT: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    def _build_nubefact_payload(
        self, invoice: Invoice, items: List[InvoiceItem],
        user: User, original: Optional[Invoice] = None
    ) -> Dict[str, Any]:
        """Construir payload para Nubefact API"""
        # Mapear tipo de documento
        doc_type_map = {"01": "01", "03": "03", "07": "07", "08": "08"}
        
        payload = {
            "operacion": "generar_comprobante",
            "tipo_de_comprobante": doc_type_map.get(invoice.document_type, "03"),
            "serie": invoice.series,
            "numero": invoice.number,
            "sunat_transaction": 1,
            "cliente_tipo_de_documento": invoice.customer_type,
            "cliente_numero_de_documento": invoice.customer_doc,
            "cliente_denominacion": invoice.customer_name or "CLIENTE VARIOS",
            "cliente_direccion": invoice.customer_address or "-",
            "cliente_email": invoice.customer_email or "",
            "fecha_de_emision": datetime.utcnow().strftime("%d-%m-%Y"),
            "fecha_de_vencimiento": datetime.utcnow().strftime("%d-%m-%Y"),
            "moneda": 1,  # 1=PEN, 2=USD
            "tipo_de_cambio": 3.80,  # Referencial
            "porcentaje_de_igv": 18.00,
            "descuento_global": 0,
            "total_descuento": 0,
            "total_anticipo": 0,
            "total_gravada": round(invoice.subtotal, 2),
            "total_inafecta": 0,
            "total_exonerada": 0,
            "total_igv": round(invoice.tax_amount, 2),
            "total_gratuita": 0,
            "total": round(invoice.total, 2),
            "percepcion_tipo": "",
            "percepcion_base_imponible": 0,
            "total_percepcion": 0,
            "total_impuestos": round(invoice.tax_amount, 2),
            "enviar_automaticamente_a_la_sunat": True,
            "enviar_automaticamente_al_cliente": True,
            "codigo_unico": "",
            "condiciones_de_pago": "CONTADO",
            "medio_de_pago": "EFECTIVO",
            "items": [],
        }

        # Campos específicos de notas de crédito/débito
        if invoice.document_type in ("07", "08") and original:
            payload["documento_que_se_modifica_tipo"] = original.document_type
            payload["documento_que_se_modifica_serie"] = original.series
            payload["documento_que_se_modifica_numero"] = str(original.number)
            if invoice.document_type == "07":
                payload["tipo_de_nota_de_credito"] = invoice.credit_note_reason or "01"
            else:
                payload["tipo_de_nota_de_debito"] = invoice.credit_note_reason or "01"
        
        for item in items:
            tax_type = item.tax_type
            tax_rate = item.tax_rate
            
            # Calcular valores del item
            qty = item.quantity
            price = item.unit_price
            discount = item.discount
            
            valor_unitario = price * (1 - discount / 100)
            precio_unitario = valor_unitario * (1 + tax_rate / 100) if tax_type == "10" else valor_unitario
            subtotal_item = qty * valor_unitario
            igv_item = subtotal_item * (tax_rate / 100) if tax_type == "10" else 0
            total_item = subtotal_item + igv_item
            
            payload["items"].append({
                "unidad_de_medida": self._map_unit(item.unit),
                "codigo": item.product_id or item.manual_product_sku or "P001",
                "descripcion": item.description,
                "cantidad": qty,
                "valor_unitario": round(valor_unitario, 4),
                "precio_unitario": round(precio_unitario, 4),
                "subtotal": round(subtotal_item, 2),
                "tipo_de_igv": 1 if tax_type == "10" else 2 if tax_type == "20" else 3,
                "igv": round(igv_item, 2),
                "total": round(total_item, 2),
                "anticipo_regularizacion": False,
                "codigo_producto_sunat": "10101010",  # Genérico
            })
        
        # Agregar datos de la empresa (emisor)
        payload.update({
            "emisor_ruc": user.nubefact_ruc or settings.NUBEFACT_RUC,
            "emisor_razon_social": user.business_name or user.name,
            "emisor_nombre_comercial": user.business_name or user.name,
            "emisor_direccion": user.address or "-",
            "emisor_ubigeo": "150101",  # Lima por defecto
            "emisor_departamento": user.department or "LIMA",
            "emisor_provincia": user.province or "LIMA",
            "emisor_distrito": user.district or "LIMA",
        })
        
        return payload

    def _map_unit(self, unit: str) -> str:
        """Mapear unidad a código SUNAT"""
        unit_map = {
            "UNIDAD": "NIU",
            "KILOGRAMO": "KGM",
            "KILO": "KGM",
            "METRO": "MTR",
            "LITRO": "LTR",
            "DOCENA": "DZN",
            "CAJA": "BX",
            "PAR": "PR",
        }
        return unit_map.get(unit.upper(), "NIU")

    async def get_invoice(self, invoice_id: int) -> Optional[Invoice]:
        """Obtener factura con items"""
        result = await self.db.execute(
            select(Invoice).where(Invoice.id == invoice_id)
        )
        return result.scalar_one_or_none()

    async def get_user_invoices(self, user_id: int, limit: int = 20) -> List[Invoice]:
        """Obtener facturas de un usuario"""
        result = await self.db.execute(
            select(Invoice)
            .where(Invoice.user_id == user_id)
            .order_by(Invoice.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()

    async def void_invoice(self, invoice_id: int, reason: str) -> Dict[str, Any]:
        """Anular factura emitiendo nota de crédito"""
        invoice = await self.db.get(Invoice, invoice_id)
        if not invoice:
            return {"success": False, "error": "Factura no encontrada"}

        if invoice.document_type in ("07", "08"):
            return {"success": False, "error": "No se pueden anular notas con otra nota"}

        if invoice.status == "cancelled":
            return {"success": False, "error": "Factura ya anulada"}

        if invoice.status not in ("sent", "accepted"):
            return {"success": False, "error": "La factura aún no está registrada en SUNAT"}

        try:
            note = await self.create_credit_note(
                user_id=invoice.user_id,
                original_invoice_id=invoice.id,
                reason_code="01",  # Anulación de la operación
            )
        except ValueError as e:
            return {"success": False, "error": str(e)}

        invoice.status = "cancelled"
        await self.db.commit()

        return {
            "success": True,
            "message": f"Nota de crédito {note.series}-{note.number} emitida",
            "credit_note_id": note.id,
        }

    async def close(self):
        await self.client.aclose()