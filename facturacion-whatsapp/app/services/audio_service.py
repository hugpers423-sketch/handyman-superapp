import logging
import tempfile
import os
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

try:
    import whisper
    import torch
    WHISPER_AVAILABLE = True
except ImportError:
    whisper = None
    torch = None
    WHISPER_AVAILABLE = False
    logger.warning(
        "Whisper/Torch no disponibles: transcripción de audio desactivada "
        "(instala la pila ML para activarla)"
    )


class AudioService:
    def __init__(self):
        self.model = None
        self.device = settings.WHISPER_DEVICE
        self.model_name = settings.WHISPER_MODEL

    def _load_model(self):
        """Cargar modelo Whisper de forma lazy"""
        if self.model is None:
            logger.info(f"Cargando modelo Whisper: {self.model_name} en {self.device}")
            self.model = whisper.load_model(self.model_name, device=self.device)
            logger.info("Modelo Whisper cargado")

    async def transcribe(self, audio_bytes: bytes, language: str = "es") -> str:
        """Transcribir audio a texto"""
        if not WHISPER_AVAILABLE:
            logger.info("Whisper no instalado, transcripción omitida")
            return ""

        self._load_model()
        
        # Guardar audio temporalmente
        with tempfile.NamedTemporaryFile(suffix=".ogg", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        
        try:
            # Whisper espera archivos de audio, convertir si es necesario
            result = self.model.transcribe(
                tmp_path,
                language=language,
                fp16=torch.cuda.is_available() and self.device == "cuda",
                initial_prompt="Transcripción de comandos de facturación en español peruano: productos, precios, DNI, RUC, cantidades."
            )
            
            text = result.get("text", "").strip()
            logger.info(f"Transcripción: {text}")
            return text
            
        finally:
            # Limpiar archivo temporal
            try:
                os.unlink(tmp_path)
            except:
                pass

    async def transcribe_from_url(self, audio_url: str, whatsapp_service) -> str:
        """Descargar y transcribir desde URL"""
        audio_bytes = await whatsapp_service.download_media(audio_url)
        return await self.transcribe(audio_bytes)


# Alternativa: Usar faster-whisper (más rápido, menos memoria)
class FasterWhisperService:
    def __init__(self):
        self.model = None
        self.model_name = settings.WHISPER_MODEL
        self.device = settings.WHISPER_DEVICE

    def _load_model(self):
        if self.model is None:
            from faster_whisper import WhisperModel
            compute_type = "float16" if self.device == "cuda" else "int8"
            logger.info(f"Cargando faster-whisper: {self.model_name} ({compute_type})")
            self.model = WhisperModel(self.model_name, device=self.device, compute_type=compute_type)

    async def transcribe(self, audio_bytes: bytes, language: str = "es") -> str:
        self._load_model()
        
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(suffix=".ogg", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        
        try:
            segments, info = self.model.transcribe(
                tmp_path,
                language=language,
                beam_size=5,
                initial_prompt="Comandos de facturación en español peruano: productos, precios, DNI, RUC."
            )
            
            text = " ".join([seg.text for seg in segments]).strip()
            logger.info(f"Transcripción (faster-whisper): {text}")
            return text
            
        finally:
            try:
                os.unlink(tmp_path)
            except:
                pass