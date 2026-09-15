from __future__ import annotations

import io
import logging
from typing import List, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models import Product, ProductImage

logger = logging.getLogger(__name__)

try:
    import torch
    import clip
    import faiss
    import numpy as np
    ML_AVAILABLE = True
except ImportError:
    torch = None
    clip = None
    faiss = None
    np = None
    ML_AVAILABLE = False
    logger.warning(
        "Torch/CLIP/FAISS no disponibles: reconocimiento por foto desactivado "
        "(instala la pila ML para activarlo)"
    )


class ProductRecognitionService:
    """Reconocimiento de productos por imagen usando CLIP + FAISS"""
    
    def __init__(self, db: AsyncSession = None):
        self.db = db
        self.model = None
        self.preprocess = None
        self.device = "cuda" if ML_AVAILABLE and torch.cuda.is_available() else "cpu"
        self.index = None
        self.product_ids = []  # Mapear índice FAISS -> product_id
        self._initialized = False

    def _load_model(self):
        """Cargar modelo CLIP"""
        if not ML_AVAILABLE:
            raise RuntimeError("Pila ML no disponible")
        if self.model is None:
            logger.info(f"Cargando CLIP: {settings.CLIP_MODEL} en {self.device}")
            self.model, self.preprocess = clip.load(settings.CLIP_MODEL, device=self.device)
            self.model.eval()
            logger.info("CLIP cargado")

    def _get_image_embedding(self, image_bytes: bytes) -> np.ndarray:
        """Obtener embedding CLIP de una imagen"""
        self._load_model()
        
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image_input = self.preprocess(image).unsqueeze(0).to(self.device)
        
        with torch.no_grad():
            image_features = self.model.encode_image(image_input)
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
        
        return image_features.cpu().numpy().astype(np.float32)

    def _get_text_embedding(self, text: str) -> np.ndarray:
        """Obtener embedding CLIP de texto"""
        self._load_model()
        
        text_input = clip.tokenize([text]).to(self.device)
        
        with torch.no_grad():
            text_features = self.model.encode_text(text_input)
            text_features = text_features / text_features.norm(dim=-1, keepdim=True)
        
        return text_features.cpu().numpy().astype(np.float32)

    async def build_index(self, user_id: int):
        """Construir índice FAISS para un usuario"""
        if not ML_AVAILABLE:
            self.index = None
            self.product_ids = []
            return

        self._load_model()
        
        async with AsyncSessionLocal() as db:
            # Obtener todos los productos con embeddings
            result = await db.execute(
                select(Product).where(Product.user_id == user_id, Product.is_active == True)
            )
            products = result.scalars().all()
            
            embeddings = []
            self.product_ids = []
            
            for product in products:
                # Usar embeddings guardados o generar de imágenes
                if product.image_embeddings:
                    for emb in product.image_embeddings:
                        embeddings.append(np.array(emb, dtype=np.float32))
                        self.product_ids.append(product.id)
                elif product.image_urls:
                    # Generar embeddings de las URLs (en producción descargar y procesar)
                    pass
            
            if embeddings:
                embeddings_array = np.vstack(embeddings)
                self.index = faiss.IndexFlatIP(embeddings_array.shape[1])  # Inner Product = Cosine para vectores normalizados
                self.index.add(embeddings_array)
                logger.info(f"Índice FAISS construido: {len(self.product_ids)} embeddings para user {user_id}")
            else:
                self.index = None
                logger.warning(f"No hay embeddings para user {user_id}")

    async def recognize_product(self, image_bytes: bytes, user_id: int) -> Optional[Product]:
        """Reconocer producto desde imagen"""
        if not ML_AVAILABLE:
            logger.info("Reconocimiento por foto desactivado (sin pila ML)")
            return None

        # Construir índice si no existe
        if self.index is None:
            await self.build_index(user_id)
        
        if self.index is None or len(self.product_ids) == 0:
            logger.info(f"No hay índice para user {user_id}")
            return None
        
        # Obtener embedding de la imagen de consulta
        query_embedding = self._get_image_embedding(image_bytes)
        
        # Buscar en FAISS
        k = min(5, len(self.product_ids))
        scores, indices = self.index.search(query_embedding, k)
        
        # Filtrar por threshold
        best_idx = indices[0][0]
        best_score = scores[0][0]
        
        logger.info(f"Mejor match: score={best_score:.4f}, threshold={settings.PRODUCT_SIMILARITY_THRESHOLD}")
        
        if best_score >= settings.PRODUCT_SIMILARITY_THRESHOLD:
            product_id = self.product_ids[best_idx]
            
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(Product).where(Product.id == product_id)
                )
                product = result.scalar_one_or_none()
                return product
        
        return None

    async def register_product_images(
        self, 
        product_id: int, 
        images_bytes: List[bytes],
        ocr_texts: List[str] = None
    ) -> List[np.ndarray]:
        """Registrar imágenes de un producto y generar embeddings"""
        if not ML_AVAILABLE:
            raise RuntimeError("Pila ML no disponible: no se pueden generar embeddings")

        self._load_model()
        
        embeddings = []
        ocr_texts = ocr_texts or [""] * len(images_bytes)
        
        async with AsyncSessionLocal() as db:
            product = await db.get(Product, product_id)
            if not product:
                raise ValueError("Producto no encontrado")
            
            for i, (img_bytes, ocr_text) in enumerate(zip(images_bytes, ocr_texts)):
                # Generar embedding
                embedding = self._get_image_embedding(img_bytes)
                embeddings.append(embedding[0].tolist())
                
                # Guardar en BD (imagen + embedding + OCR)
                product_image = ProductImage(
                    product_id=product_id,
                    url=f"local://product_{product_id}_img_{i}",  # En producción: URL real
                    embedding=embedding[0].tolist(),
                    ocr_text=ocr_text,
                    is_primary=(i == 0)
                )
                db.add(product_image)
            
            # Actualizar producto
            product.image_embeddings = (product.image_embeddings or []) + embeddings
            if ocr_texts:
                product.ocr_text = " | ".join(filter(None, ocr_texts))
            
            await db.commit()
            
            # Reconstruir índice para este usuario
            await self.build_index(product.user_id)
        
        return embeddings

    async def search_by_text(self, query: str, user_id: int, top_k: int = 5) -> List[Tuple[Product, float]]:
        """Buscar productos por texto (descripción)"""
        if not ML_AVAILABLE:
            return []

        if self.index is None:
            await self.build_index(user_id)
        
        if self.index is None:
            return []
        
        text_embedding = self._get_text_embedding(query)
        k = min(top_k, len(self.product_ids))
        scores, indices = self.index.search(text_embedding, k)
        
        results = []
        async with AsyncSessionLocal() as db:
            for score, idx in zip(scores[0], indices[0]):
                if score >= settings.PRODUCT_SIMILARITY_THRESHOLD * 0.9:  # Umbral más bajo para texto
                    product_id = self.product_ids[idx]
                    result = await db.execute(select(Product).where(Product.id == product_id))
                    product = result.scalar_one_or_none()
                    if product:
                        results.append((product, float(score)))
        
        return results


# OCR Service para extraer texto de fotos de etiquetas/códigos de barras
class OCRService:
    def __init__(self):
        self.reader = None

    def _load_reader(self):
        if self.reader is None:
            if not ML_AVAILABLE:
                raise RuntimeError("EasyOCR requiere la pila ML (torch)")
            import easyocr
            logger.info("Cargando EasyOCR...")
            langs = list(settings.OCR_LANGUAGES)
            self.reader = easyocr.Reader(langs, gpu=torch.cuda.is_available())

    async def extract_text(self, image_bytes: bytes) -> str:
        """Extraer texto de imagen"""
        try:
            self._load_reader()
        except RuntimeError as e:
            logger.warning(str(e))
            return ""
        
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp.write(image_bytes)
            tmp_path = tmp.name
        
        try:
            results = self.reader.readtext(tmp_path, detail=0, paragraph=True)
            text = " ".join(results)
            logger.info(f"OCR extraído: {text[:200]}")
            return text
        finally:
            try:
                os.unlink(tmp_path)
            except:
                pass

    async def extract_barcode(self, image_bytes: bytes) -> Optional[str]:
        """Detectar código de barras en imagen"""
        try:
            from pyzbar import pyzbar
            from PIL import Image
            import io
            
            image = Image.open(io.BytesIO(image_bytes))
            decoded = pyzbar.decode(image)
            
            for d in decoded:
                if d.type in ('EAN13', 'EAN8', 'UPCA', 'UPCE', 'CODE128'):
                    return d.data.decode('utf-8')
        except Exception as e:
            logger.warning(f"Error detectando código de barras: {e}")
        
        return None


# Instancias singleton
product_recognition = ProductRecognitionService()
ocr_service = OCRService()