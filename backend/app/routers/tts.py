"""
TTS Neural via Microsoft Edge (gratuit, sans clé API).
Voix disponibles : fr-FR-DeniseNeural, fr-FR-VivienneMultilingualNeural

POST /api/tts/speak  → stream audio/mpeg
GET  /api/tts/voices → liste des voix supportées
"""
import io
import html as html_lib
import edge_tts
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator

router = APIRouter(prefix="/api/tts", tags=["tts"])

VOICES = {
    "denise":   "fr-FR-DeniseNeural",
    "vivienne": "fr-FR-VivienneMultilingualNeural",
}

VOICE_LABELS = {
    "denise":   "Denise — claire et chaleureuse",
    "vivienne": "Vivienne — naturelle et expressive",
}

# Débits calibrés pour la lecture pédagogique (matières scientifiques)
# Légèrement plus lent que la vitesse neutre pour laisser le temps de mémoriser
VOICE_RATES = {
    "denise":   "-15%",   # débit neutre Microsoft = ~175 mots/min → -15% ≈ 148 mots/min
    "vivienne": "-10%",   # Vivienne est déjà plus posée par nature
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


def _ssml_wrap(text: str, voice_id: str, rate: str) -> str:
    """
    Enveloppe le texte en SSML pour forcer la détection fr-FR.
    Nécessaire pour Vivienne (multilingue) qui bascule en espagnol
    sur sin/cos/tan et autres termes identiques entre langues.
    """
    safe = html_lib.escape(text)
    return (
        '<speak version="1.0" '
        'xmlns="http://www.w3.org/2001/10/synthesis" '
        'xmlns:mstts="https://www.w3.org/2001/mstts" '
        f'xml:lang="fr-FR">'
        f'<voice name="{voice_id}">'
        f'<prosody rate="{rate}">'
        f'<lang xml:lang="fr-FR">{safe}</lang>'
        f'</prosody></voice></speak>'
    )


@router.post("/speak")
async def speak(req: TTSRequest):
    """
    Génère l'audio MP3 Neural pour le texte donné.
    Retourne audio/mpeg streamé directement.
    Cache côté client géré par le header Cache-Control.
    """
    voice_id = VOICES[req.voice]
    rate     = VOICE_RATES[req.voice]
    ssml     = _ssml_wrap(req.text, voice_id, rate)
    try:
        communicate = edge_tts.Communicate(ssml, voice_id)
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
