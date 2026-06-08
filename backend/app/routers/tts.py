"""
TTS Neural via Microsoft Edge (gratuit, sans clé API).
Voix disponibles : fr-FR-DeniseNeural, fr-FR-HenriNeural

POST /api/tts/speak  → stream audio/mpeg
GET  /api/tts/voices → liste des voix supportées

Note : VivienneMultilingualNeural a été remplacée par HenriNeural.
       La voix multilingue détectait automatiquement l'espagnol dans
       les contenus mathématiques (sin, cos, tan…) et basculait de langue.
       HenriNeural est monolingualement française — ce problème n'existe pas.
"""
import io
import edge_tts
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator

router = APIRouter(prefix="/api/tts", tags=["tts"])

VOICES = {
    "denise":   "fr-FR-DeniseNeural",
    "vivienne": "fr-FR-HenriNeural",      # clé conservée pour compatibilité localStorage
}

VOICE_LABELS = {
    "denise":   "Denise — claire et chaleureuse",
    "vivienne": "Henri — naturel et expressif",
}

# Débits calibrés pour la lecture pédagogique (matières scientifiques)
VOICE_RATES = {
    "denise":   "-15%",   # ~148 mots/min (neutre Microsoft ~175 mots/min)
    "vivienne": "-12%",   # Henri parle légèrement plus vite
}


class TTSRequest(BaseModel):
    text: str
    voice: str = "denise"

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Texte vide")
        if len(v) > 2000:
            raise ValueError("Texte trop long (max 2000 caractères)")
        return v

    @field_validator("voice")
    @classmethod
    def voice_allowed(cls, v: str) -> str:
        if v not in VOICES:
            return "denise"
        return v


@router.post("/speak")
async def speak(req: TTSRequest):
    """
    Génère l'audio MP3 Neural pour le texte donné.
    Retourne audio/mpeg streamé directement.
    Cache côté client géré par le header Cache-Control.
    """
    voice_id = VOICES[req.voice]
    rate     = VOICE_RATES[req.voice]
    try:
        communicate = edge_tts.Communicate(req.text, voice_id, rate=rate)
        buf = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                buf.write(chunk["data"])
        audio_size = buf.tell()
        if audio_size == 0:
            raise HTTPException(502, "Edge TTS n'a retourné aucun audio")
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="audio/mpeg",
            headers={
                "Cache-Control": "public, max-age=86400",
                "Content-Length": str(audio_size),
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Edge TTS indisponible : {exc}") from exc


@router.get("/voices")
def list_voices():
    """Retourne les voix disponibles avec leurs labels."""
    return [
        {"id": k, "label": VOICE_LABELS[k], "voice_id": v}
        for k, v in VOICES.items()
    ]
