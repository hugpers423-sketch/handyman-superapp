import re
import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ExtractedProduct:
    name: str
    quantity: float = 1.0
    unit: str = "UNIDAD"
    price: float = 0.0
    sku: str = ""
    confidence: float = 0.0


class NLPService:
    """Extraer datos de facturación de lenguaje natural en español peruano"""
    
    def __init__(self):
        # Números en español (para notas de voz)
        self.number_words = {
            'cero': 0, 'un': 1, 'uno': 1, 'una': 1, 'dos': 2, 'tres': 3,
            'cuatro': 4, 'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8,
            'nueve': 9, 'diez': 10, 'once': 11, 'doce': 12, 'trece': 13,
            'catorce': 14, 'quince': 15, 'dieciseis': 16, 'dieciséis': 16,
            'diecisiete': 17, 'dieciocho': 18, 'diecinueve': 19,
            'veinte': 20, 'veintiuno': 21, 'veintiun': 21, 'veintidos': 22,
            'veintidós': 22, 'veintitres': 23, 'veintitrés': 23,
            'veinticuatro': 24, 'veinticinco': 25, 'veintiseis': 26,
            'veintiséis': 26, 'veintisiete': 27, 'veintiocho': 28,
            'veintinueve': 29,
            'treinta': 30, 'cuarenta': 40, 'cincuenta': 50, 'sesenta': 60,
            'setenta': 70, 'ochenta': 80, 'noventa': 90,
            'cien': 100, 'ciento': 100, 'doscientos': 200, 'doscientas': 200,
            'trescientos': 300, 'trescientas': 300, 'cuatrocientos': 400,
            'cuatrocientas': 400, 'quinientos': 500, 'quinientas': 500,
            'seiscientos': 600, 'seiscientas': 600, 'setecientos': 700,
            'setecientas': 700, 'ochocientos': 800, 'ochocientas': 800,
            'novecientos': 900, 'novecientas': 900,
            'mil': 1000, 'millon': 1000000, 'millón': 1000000,
            'millones': 1000000,
        }

        # Patrones para español peruano
        self.price_patterns = [
            r'(?:S/|S\.|PEN|\$)\s*(\d+(?:\.\d{1,2})?)',
            r'(\d+(?:\.\d{1,2})?)\s*(?:soles?|sol|S/|PEN|\$)',
            r'(?:a|por|precio|costo|vale)\s+(\d+(?:\.\d{1,2})?)',
            r'(\d+(?:\.\d{1,2})?)\s*(?:c/u|cada|unitario)',
        ]
        
        self.quantity_patterns = [
            r'(\d+(?:\.\d+)?)\s*(?:unidades?|unid|uds?|pzs?|piezas?|kilos?|kg|metros?|mts?)',
            r'(\d+(?:\.\d+)?)\s+(?:polos?|cajas?|pares?|docenas?|kilos?|kilogramos?|litros?|metros?)',
            r'(?:x|por)\s*(\d+(?:\.\d+)?)',
            r'^(\d+(?:\.\d+)?)\s+',
        ]
        
        self.unit_patterns = [
            (r'\b(?:unid|unidades?|uds?|pzs?|piezas?)\b', 'UNIDAD'),
            (r'\b(?:kilos?|kg)\b', 'KILOGRAMO'),
            (r'\b(?:metros?|mts?)\b', 'METRO'),
            (r'\b(?:litros?|lts?)\b', 'LITRO'),
            (r'\b(?:docenas?|doc)\b', 'DOCENA'),
            (r'\b(?:cajas?|cjs?)\b', 'CAJA'),
            (r'\b(?:pares?)\b', 'PAR'),
        ]
        
        self.dni_pattern = r'\b(\d{8})\b'
        self.ruc_pattern = r'\b(\d{11})\b'
        self.doc_pattern = r'(?:DNI|RUC|documento|doc)[:\s]*(\d{8,11})'
        
        self.intent_keywords = {
            "create_invoice": [
                "factura", "boleta", "venta", "vender", "cobrar", "emitir",
                "generar", "hacer", "sacar", "nota de venta"
            ],
            "register_product": [
                "registrar", "agregar", "nuevo", "crear", "guardar",
                "producto", "articulo", "item", "stock", "inventario"
            ],
            "query_stock": [
                "stock", "inventario", "cuanto", "cuantos", "hay",
                "disponible", "existencia", "productos"
            ],
            # Nuevas intenciones
            "stock_alert": [
                "alerta", "alertas", "stock bajo", "reponer", "reposicion",
                "comprar stock", "pedir stock"
            ],
            "customer_management": [
                "cliente", "clientes", "deudor", "deudores", "fiado", "credito",
                "cobrar", "abono", "pago cliente", "recordar", "recordatorio"
            ],
            "expense_tracking": [
                "gasto", "gastos", "compre", "compré", "pague", "pagué",
                "egreso", "egresos", "utilidad", "ganancia", "rentabilidad",
                "beneficio", "cuanto gane"
            ],
            "payment_qr": [
                "qr pago", "cobrar con qr", "yape", "plin", "cobro qr",
                "generar qr", "codigo qr"
            ],
            "help": [
                "ayuda", "help", "comandos", "que puedo", "como uso"
            ],
            "reports": [
                "reporte", "reportes", "resumen", "balance", "estado cuenta",
                "ventas mes", "compras mes", "diario"
            ],
            "note": [
                "anular", "anulacion", "anulación", "nota de credito", "nota credito",
                "nota de credito", "nota de débito", "nota debito", "devolucion",
                "devolución", "devolver", "bonificacion", "descuento global",
                "nota de debito", "nota debito", "reversar", "reverse", "cancelar comprobante"
            ]
        }

    async def extract_invoice_data(self, text: str) -> Dict[str, Any]:
        """Extraer datos estructurados para facturación"""
        text = self._convert_number_words(text)
        text_lower = text.lower().strip()
        
        # Detectar intención
        intent = self._detect_intent(text_lower)
        
        if intent == "create_invoice":
            return await self._extract_invoice(text, text_lower)
        elif intent == "register_product":
            return await self._extract_product_registration(text, text_lower)
        elif intent == "query_stock":
            return {"intent": "query_stock", "product_name": self._extract_product_name(text)}
        elif intent == "note":
            return self._extract_note(text, text_lower)
        else:
            return {"intent": "unknown", "raw_text": text}

    def _detect_intent(self, text: str) -> str:
        """Detectar intención del mensaje"""
        note_markers = [
            "anular", "anulacion", "anulación",
            "nota de credito", "nota credito", "nota de crédito",
            "nota de debito", "nota debito", "nota de débito", "nota débito",
            "devolucion", "devolución", "devolver", "reversar", "reverse",
        ]
        if any(m in text for m in note_markers):
            return "note"

        scores = {}
        for intent, keywords in self.intent_keywords.items():
            score = sum(1 for kw in keywords if kw in text)
            if score > 0:
                scores[intent] = score
        
        if scores:
            return max(scores, key=scores.get)
        if self._looks_like_product_registration(text):
            return "register_product"
        return "create_invoice"  # Por defecto asumir factura

    def _is_number_word(self, word: str) -> bool:
        return word.strip().lower() in self.number_words

    def _parse_number_run(self, run) -> Optional[int]:
        values = []
        for token in run:
            w = token.strip().lower()
            if not w or w == 'y':
                continue
            v = self.number_words.get(w)
            if v is None:
                return None
            values.append(v)
        if not values:
            return None
        total = 0
        current = 0
        for v in values:
            if v < 1000:
                if current == 0:
                    current = v
                elif current < 1000:
                    current += v
                else:
                    total += current
                    current = v
            elif v == 1000 or v == 1000000 or v > 1000000:
                current = (current or 1) * v
        total += current
        return total

    def _convert_number_words(self, text: str) -> str:
        """Convertir números escritos en palabras a dígitos (notas de voz)"""
        parts = re.split(r'(\s+)', text)
        i = 0
        result = []
        while i < len(parts):
            part = parts[i]
            if not part.strip() or part.isdigit() or not self._is_number_word(part):
                result.append(part)
                i += 1
                continue
            run = [part]
            j = i + 1
            while j < len(parts):
                tok = parts[j]
                if tok.strip() == '':
                    nxt = parts[j + 1] if j + 1 < len(parts) else ''
                    if nxt.strip() and (self._is_number_word(nxt) or nxt.strip().lower() == 'y'):
                        run.append(tok)
                        j += 1
                        continue
                    break
                if self._is_number_word(tok) or tok.strip().lower() == 'y':
                    run.append(tok)
                    j += 1
                else:
                    break
            total = self._parse_number_run(run)
            if total is not None:
                result.append(str(total))
            else:
                result.extend(run)
            i = j
        return ''.join(result)

    def _looks_like_product_registration(self, text: str) -> bool:
        """Heurística: caption de foto con precio + unidades y sin DNI/RUC"""
        text_lower = text.lower()
        price = self._extract_price(text_lower)
        has_units = bool(re.search(
            r'(\d+(?:\.\d+)?)\s*(?:unidades?|unds?|unid|pzs?|piezas?|kilos?|metros?)',
            text_lower
        )) or bool(re.search(r'\b(?:stock|cantidad)\b', text_lower))
        has_doc = bool(re.search(self.dni_pattern, text)) or \
            bool(re.search(self.ruc_pattern, text)) or \
            bool(re.search(self.doc_pattern, text, re.IGNORECASE))
        return price > 0 and has_units and not has_doc

    def _extract_note(self, text: str, text_lower: str) -> Dict[str, Any]:
        """Extraer datos para notas de crédito (07) / débito (08)"""
        is_debit = any(kw in text_lower for kw in [
            "debito", "débito", "debito"
        ])
        note_type = "08" if is_debit else "07"

        # Buscar referencia al comprobante: B001-0002, F001 3, FC01-0001...
        ref_match = re.search(r'\b([A-Za-z]{1,3}\d{2,3})\s*[-_]\s*(\d{1,8})\b', text)
        reference = ""
        if ref_match:
            reference = f"{ref_match.group(1).upper()}-{int(ref_match.group(2)):04d}"

        reason_code = "01"  # Anulación de la operación por defecto
        if "descuento" in text_lower:
            reason_code = "04"
        elif "devolucion" in text_lower or "devolución" in text_lower or "devolver" in text_lower:
            reason_code = "06"
        elif "bonificacion" in text_lower:
            reason_code = "08"
        elif is_debit:
            reason_code = "02" if "interes" in text_lower else "01"

        return {
            "intent": "note",
            "note_type": note_type,
            "reference": reference,
            "use_last": not reference,
            "reason_code": reason_code,
        }

    async def _extract_invoice(self, text: str, text_lower: str) -> Dict[str, Any]:
        """Extraer datos de factura/boleta"""
        # Buscar DNI/RUC del cliente
        customer_doc = self._extract_customer_doc(text)
        customer_name = self._extract_customer_name(text)
        
        # Extraer items (productos)
        items = self._extract_items(text, text_lower)
        
        # Si no hay items pero hay precio, crear item genérico
        if not items:
            price = self._extract_price(text_lower)
            if price > 0:
                items = [{
                    "description": self._extract_product_name(text) or "Producto",
                    "quantity": 1,
                    "unit": "UNIDAD",
                    "unit_price": price,
                    "tax_type": "10",
                }]
        
        return {
            "intent": "create_invoice",
            "customer_doc": customer_doc,
            "customer_name": customer_name,
            "items": items,
            "document_type": "03" if customer_doc and len(customer_doc) == 8 else "01",  # Boleta si DNI, Factura si RUC
        }

    def _extract_customer_doc(self, text: str) -> str:
        """Extraer DNI o RUC del cliente"""
        # Buscar patrón explícito
        match = re.search(self.doc_pattern, text, re.IGNORECASE)
        if match:
            return match.group(1)
        
        # Buscar DNI (8 dígitos) o RUC (11 dígitos) al final o separados
        # Priorizar RUC si hay 11 dígitos
        ruc_match = re.search(self.ruc_pattern, text)
        if ruc_match:
            return ruc_match.group(1)
        
        dni_match = re.search(self.dni_pattern, text)
        if dni_match:
            return dni_match.group(1)
        
        return ""

    def _extract_customer_name(self, text: str) -> str:
        """Extraer nombre del cliente (heurística)"""
        # Buscar patrones como "para Juan", "cliente Maria", "a Pedro"
        patterns = [
            r'(?:para|cliente|a\s+)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)',
            r'(?:nombre|nombre:)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1)
        return ""

    def _extract_items(self, text: str, text_lower: str) -> List[Dict[str, Any]]:
        """Extraer lista de productos con cantidad y precio"""
        items = []
        
        # Dividir por separadores comunes: comas, "y", saltos de línea
        segments = re.split(r'[,\n]|(?:\s+y\s+)', text)
        
        for segment in segments:
            segment = segment.strip()
            if not segment:
                continue
            
            product = self._parse_product_segment(segment, text_lower)
            if product and product.price > 0:
                items.append({
                    "product_id": None,
                    "description": product.name,
                    "quantity": product.quantity,
                    "unit": product.unit,
                    "unit_price": product.price,
                    "tax_type": "10",
                })
        
        return items

    def _parse_product_segment(self, segment: str, full_text: str) -> Optional[ExtractedProduct]:
        """Parsear un segmento de texto para extraer producto"""
        segment_lower = segment.lower()
        
        # Extraer precio
        price = self._extract_price(segment_lower)
        
        # Extraer cantidad
        quantity = self._extract_quantity(segment_lower)
        
        # Extraer unidad
        unit = self._extract_unit(segment_lower)
        
        # Extraer nombre (lo que queda después de quitar precio/cantidad)
        name = self._clean_product_name(segment, price, quantity)
        
        if not name or len(name) < 2:
            return None
        
        return ExtractedProduct(
            name=name,
            quantity=quantity,
            unit=unit,
            price=price,
            confidence=0.8 if price > 0 else 0.3
        )

    def _extract_price(self, text: str) -> float:
        """Extraer precio del texto"""
        for pattern in self.price_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return float(match.group(1))
        return 0.0

    def _extract_quantity(self, text: str) -> float:
        """Extraer cantidad del texto"""
        for pattern in self.quantity_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return float(match.group(1))
        return 1.0

    def _extract_unit(self, text: str) -> str:
        """Extraer unidad de medida"""
        for pattern, unit in self.unit_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return unit
        return "UNIDAD"

    def _extract_product_name(self, text: str) -> str:
        """Extraer nombre del producto limpio"""
        # Quitar precios, cantidades, DNI, RUC, palabras clave
        cleaned = text
        
        # Quitar precios
        for pattern in self.price_patterns:
            cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
        
        # Quitar cantidades con unidades (conserver nombre del producto)
        cleaned = re.sub(self.quantity_patterns[0], '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(
            r'\b\d+(?:\.\d+)?\s+(?=polos?|cajas?|pares?|docenas?|kilos?|kilogramos?|litros?|metros?)',
            '', cleaned, flags=re.IGNORECASE
        )
        for pattern in self.quantity_patterns[2:]:
            cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
        
        # Quitar DNI/RUC
        cleaned = re.sub(self.dni_pattern, '', cleaned)
        cleaned = re.sub(self.ruc_pattern, '', cleaned)
        cleaned = re.sub(self.doc_pattern, '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\b(?:dni|ruc|documento|doc)\b', '', cleaned, flags=re.IGNORECASE)
        
        # Quitar palabras clave de intención
        for keywords in self.intent_keywords.values():
            for kw in keywords:
                cleaned = re.sub(rf'\b{kw}\b', '', cleaned, flags=re.IGNORECASE)
        
        # Limpiar espacios y puntuación
        cleaned = re.sub(r'[,\.\;\:\-\_\+]+', ' ', cleaned)
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        
        return cleaned.title() if cleaned else ""

    def _clean_product_name(self, segment: str, price: float, quantity: float) -> str:
        """Limpiar nombre de producto de un segmento"""
        # Similar a _extract_product_name pero para segmento individual
        return self._extract_product_name(segment)

    async def _extract_product_registration(self, text: str, text_lower: str) -> Dict[str, Any]:
        """Extraer datos para registrar producto"""
        # Buscar patrón: "Nombre, Precio, Stock, Unidad"
        # O desde caption de foto
        
        name = self._extract_product_name(text)
        price = self._extract_price(text_lower)
        
        # Buscar stock/cantidad (número antes o después de la palabra)
        stock_match = re.search(r'(\d+)\s*(?:unidades?|unds?|unid|uds?)', text_lower)
        if not stock_match:
            stock_match = re.search(r'(?:stock|cantidad)\s*[:\-=]?\s*(\d+)', text_lower)
        stock = int(stock_match.group(1)) if stock_match else 0
        
        unit = self._extract_unit(text_lower)
        
        return {
            "intent": "register_product",
            "name": name,
            "price": price,
            "stock": stock,
            "unit": unit,
            "raw_text": text,
        }


# Instancia singleton
nlp_service = NLPService()