import pytest
from app.services.nlp_service import NLPService


@pytest.fixture
def nlp():
    return NLPService()


class TestExtractInvoiceData:
    """Tests para extracción de datos de factura"""

    @pytest.mark.asyncio
    async def test_basic_invoice_with_dni(self, nlp):
        text = "Polo negro talla M, 30 soles, DNI 12345678"
        result = await nlp.extract_invoice_data(text)
        
        assert result["intent"] == "create_invoice"
        assert result["customer_doc"] == "12345678"
        assert len(result["items"]) == 1
        assert result["items"][0]["description"].lower() == "polo negro talla m"
        assert result["items"][0]["unit_price"] == 30.0
        assert result["items"][0]["quantity"] == 1.0

    @pytest.mark.asyncio
    async def test_invoice_with_ruc(self, nlp):
        text = "Laptop HP, 2500 soles, RUC 20123456789"
        result = await nlp.extract_invoice_data(text)
        
        assert result["customer_doc"] == "20123456789"
        assert result["document_type"] == "01"  # Factura para RUC
        assert result["items"][0]["unit_price"] == 2500.0

    @pytest.mark.asyncio
    async def test_multiple_items(self, nlp):
        text = "Polo negro 30 soles, Pantalón jeans 80 soles, DNI 87654321"
        result = await nlp.extract_invoice_data(text)
        
        assert len(result["items"]) == 2
        assert result["items"][0]["unit_price"] == 30.0
        assert result["items"][1]["unit_price"] == 80.0

    @pytest.mark.asyncio
    async def test_with_quantity(self, nlp):
        text = "5 polos a 25 soles cada uno, DNI 11111111"
        result = await nlp.extract_invoice_data(text)
        
        assert result["items"][0]["quantity"] == 5.0
        assert result["items"][0]["unit_price"] == 25.0

    @pytest.mark.asyncio
    async def test_with_unit(self, nlp):
        text = "3 kilos de azúcar a 4 soles el kilo, DNI 22222222"
        result = await nlp.extract_invoice_data(text)
        
        assert result["items"][0]["quantity"] == 3.0
        assert result["items"][0]["unit"] == "KILOGRAMO"
        assert result["items"][0]["unit_price"] == 4.0

    @pytest.mark.asyncio
    async def test_voice_like_text(self, nlp):
        """Simula transcripción de nota de voz"""
        text = "hola quiero facturar dos polos negros talla M a treinta soles cada uno para DNI 12345678"
        result = await nlp.extract_invoice_data(text)
        
        assert result["intent"] == "create_invoice"
        assert result["customer_doc"] == "12345678"
        assert result["items"][0]["quantity"] == 2.0
        assert result["items"][0]["unit_price"] == 30.0

    @pytest.mark.asyncio
    async def test_register_product_intent(self, nlp):
        text = "registrar producto: Polo algodón, 45 soles, 50 unidades"
        result = await nlp.extract_invoice_data(text)
        
        assert result["intent"] == "register_product"
        assert result["name"].lower() == "polo algodón"
        assert result["price"] == 45.0
        assert result["stock"] == 50

    @pytest.mark.asyncio
    async def test_query_stock_intent(self, nlp):
        text = "cuanto stock tengo de polos"
        result = await nlp.extract_invoice_data(text)
        
        assert result["intent"] == "query_stock"
        assert "polo" in result["product_name"].lower()

    @pytest.mark.asyncio
    async def test_price_formats(self, nlp):
        """Diferentes formatos de precio peruanos"""
        test_cases = [
            ("30 soles", 30.0),
            ("S/ 45.50", 45.50),
            ("PEN 100", 100.0),
            ("a 25 soles", 25.0),
            ("precio 150", 150.0),
        ]
        
        for text, expected_price in test_cases:
            result = await nlp.extract_invoice_data(f"{text}, DNI 12345678")
            assert result["items"][0]["unit_price"] == expected_price, f"Failed for: {text}"

    @pytest.mark.asyncio
    async def test_quantity_formats(self, nlp):
        """Diferentes formatos de cantidad"""
        test_cases = [
            ("5 unidades", 5.0, "UNIDAD"),
            ("3 kilos", 3.0, "KILOGRAMO"),
            ("2.5 metros", 2.5, "METRO"),
            ("x 10", 10.0, "UNIDAD"),
            ("1 docena", 1.0, "DOCENA"),
        ]
        
        for text, expected_qty, expected_unit in test_cases:
            result = await nlp.extract_invoice_data(f"Polo {text} a 20 soles, DNI 12345678")
            assert result["items"][0]["quantity"] == expected_qty, f"Qty failed for: {text}"
            assert result["items"][0]["unit"] == expected_unit, f"Unit failed for: {text}"


class TestExtractProductRegistration:
    """Tests para registro de productos"""

    @pytest.mark.asyncio
    async def test_register_from_photo_caption(self, nlp):
        text = "Polo algodón premium, 55 soles, 100 unidades"
        result = await nlp.extract_invoice_data(text)
        
        assert result["intent"] == "register_product"
        assert result["price"] == 55.0
        assert result["stock"] == 100
        assert "algodón" in result["name"].lower()


class TestExtractNote:
    """Tests para notas de crédito/débito"""

    @pytest.mark.asyncio
    async def test_credit_note(self, nlp):
        result = await nlp.extract_invoice_data("nota credito F001-0001")
        assert result["intent"] == "note"
        assert result["note_type"] == "07"
        assert result["reference"] == "F001-0001"

    @pytest.mark.asyncio
    async def test_void_invoice(self, nlp):
        result = await nlp.extract_invoice_data("anular B001-0002")
        assert result["intent"] == "note"
        assert result["note_type"] == "07"
        assert result["reference"] == "B001-0002"
        assert result["reason_code"] == "01"

    @pytest.mark.asyncio
    async def test_debit_note(self, nlp):
        result = await nlp.extract_invoice_data("nota debito B001-0003 por interes")
        assert result["intent"] == "note"
        assert result["note_type"] == "08"
        assert result["reason_code"] == "02"

    @pytest.mark.asyncio
    async def test_credit_note_returns(self, nlp):
        result = await nlp.extract_invoice_data("devolucion de la factura B001-0004")
        assert result["intent"] == "note"
        assert result["note_type"] == "07"
        assert result["reason_code"] == "06"


class TestNumberWords:
    """Tests para conversión de números en español (notas de voz)"""

    @pytest.mark.asyncio
    async def test_words_to_number_price(self, nlp):
        result = await nlp.extract_invoice_data("cincuenta soles, DNI 12345678")
        assert result["items"][0]["unit_price"] == 50.0

    @pytest.mark.asyncio
    async def test_words_to_number_quantity(self, nlp):
        result = await nlp.extract_invoice_data("cuatro polos a veinticinco soles, DNI 12345678")
        assert result["items"][0]["quantity"] == 4.0
        assert result["items"][0]["unit_price"] == 25.0

    @pytest.mark.asyncio
    async def test_composite_number(self, nlp):
        result = await nlp.extract_invoice_data("doscientos treinta soles, DNI 12345678")
        assert result["items"][0]["unit_price"] == 230.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])