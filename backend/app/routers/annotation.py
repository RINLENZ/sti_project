"""
Collecte de données d'entraînement :
  - Frames labellisées (émotions)  : Supabase training-data/frames/{etat}/ (ou local en dev)
  - Clips audio labellisés (KWS)   : Supabase training-data/audio/{commande}/ (ou local en dev)

Frames  : TARGET 2000 / CAP 3000 par état
Audio   : TARGET 300  / CAP 500  par commande
"""
import base64, os, uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from ..database import get_db
from ..dependencies import get_current_user
from ..models.user import User

router = APIRouter(prefix="/api/annotation", tags=["annotation"])

FRAMES_DIR    = os.path.join(os.path.dirname(__file__), "../../data/frames")
AUDIO_DIR     = os.path.join(os.path.dirname(__file__), "../../data/audio")
TARGET        = 2000
CAP           = 3000
AUDIO_TARGET  = 300
AUDIO_CAP     = 500
BUCKET        = "training-data"

ETATS_VALIDES = [
    "engagement_eleve", "engagement_faible",
    "confusion", "frustration", "ennui", "neutre",
]
COMMANDES_VALIDES = [
    "aide", "oui", "non", "repeter",
    "incompris", "lentement", "bruit_silence",
]


# ── Helpers Supabase vs local ─────────────────────────────────────

def _use_supabase() -> bool:
    from ..config import settings
    return bool(settings.supabase_url and settings.supabase_service_key)

def _sb():
    from supabase import create_client
    from ..config import settings
    return create_client(settings.supabase_url, settings.supabase_service_key)

def _count(etat: str) -> int:
    if _use_supabase():
        try:
            files = _sb().storage.from_(BUCKET).list(f"frames/{etat}")
            return len([f for f in (files or []) if (f.get("name") or "").endswith(".jpg")])
        except Exception:
            return 0
    d = os.path.join(FRAMES_DIR, etat)
    if not os.path.exists(d):
        return 0
    return len([f for f in os.listdir(d) if f.endswith(".jpg")])

def _count_audio(commande: str) -> int:
    if _use_supabase():
        try:
            files = _sb().storage.from_(BUCKET).list(f"audio/{commande}")
            return len([f for f in (files or []) if (f.get("name") or "").endswith(".wav")])
        except Exception:
            return 0
    d = os.path.join(AUDIO_DIR, commande)
    if not os.path.exists(d):
        return 0
    return len([f for f in os.listdir(d) if f.endswith(".wav")])


# ── Modèles Pydantic ──────────────────────────────────────────────

class FrameSubmit(BaseModel):
    image_base64: str
    etat: str
    session_id: Optional[str] = None

class AudioSubmit(BaseModel):
    audio_base64: str
    commande: str
    duree_ms: Optional[int] = None


# ══════════════════════════════════════════════════════════════════
#  SECTION 1 — Collecte frames (émotions)
# ══════════════════════════════════════════════════════════════════

@router.post("/frame")
def soumettre_frame(
    body: FrameSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.etat not in ETATS_VALIDES:
        raise HTTPException(400, f"État invalide. Valeurs acceptées : {ETATS_VALIDES}")

    existing = _count(body.etat)
    if existing >= CAP:
        raise HTTPException(429, f"Quota atteint pour '{body.etat}' ({existing}/{CAP} frames)")

    try:
        b64 = body.image_base64.split(",")[-1]
        img_bytes = base64.b64decode(b64)
    except Exception:
        raise HTTPException(400, "Image base64 invalide")

    frame_id = str(uuid.uuid4())

    if _use_supabase():
        try:
            path = f"frames/{body.etat}/{current_user.id}_{frame_id}.jpg"
            _sb().storage.from_(BUCKET).upload(
                path, img_bytes, {"content-type": "image/jpeg", "upsert": "false"}
            )
        except Exception as e:
            raise HTTPException(500, f"Erreur Supabase Storage : {e}")
    else:
        etat_dir = os.path.join(FRAMES_DIR, body.etat)
        os.makedirs(etat_dir, exist_ok=True)
        with open(os.path.join(etat_dir, f"{current_user.id}_{frame_id}.jpg"), "wb") as f:
            f.write(img_bytes)

    total_etat = existing + 1
    return {
        "frame_id":    frame_id,
        "etat":        body.etat,
        "total_etat":  total_etat,
        "cap":         CAP,
        "progression": round(total_etat / TARGET * 100),
        "storage":     "supabase" if _use_supabase() else "local",
    }


@router.get("/stats")
def get_stats(current_user: User = Depends(get_current_user)):
    par_etat = {}
    total = 0
    for etat in ETATS_VALIDES:
        n = _count(etat)
        par_etat[etat] = n
        total += n
    return {
        "total":             total,
        "target_par_etat":   TARGET,
        "cap_par_etat":      CAP,
        "par_etat":          par_etat,
        "progression_pct":   {e: round(n / TARGET * 100) for e, n in par_etat.items()},
        "pret_entrainement": all(n >= TARGET for n in par_etat.values()),
        "storage":           "supabase" if _use_supabase() else "local",
    }


@router.delete("/frames/{etat}")
def supprimer_frames_etat(etat: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "super_admin":
        raise HTTPException(403, "Super admin requis")
    if etat not in ETATS_VALIDES:
        raise HTTPException(400, "État invalide")

    count = _count(etat)
    if _use_supabase():
        try:
            files = _sb().storage.from_(BUCKET).list(f"frames/{etat}")
            names = [f["name"] for f in (files or []) if f.get("name")]
            if names:
                _sb().storage.from_(BUCKET).remove([f"frames/{etat}/{n}" for n in names])
        except Exception as e:
            raise HTTPException(500, f"Erreur Supabase : {e}")
    else:
        import shutil
        etat_dir = os.path.join(FRAMES_DIR, etat)
        if os.path.exists(etat_dir):
            shutil.rmtree(etat_dir)

    return {"message": f"Frames '{etat}' supprimées ({count} fichiers)"}


# ══════════════════════════════════════════════════════════════════
#  SECTION 2 — Collecte audio (Keyword Spotting)
# ══════════════════════════════════════════════════════════════════

@router.post("/audio")
def soumettre_audio(
    body: AudioSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.commande not in COMMANDES_VALIDES:
        raise HTTPException(400, f"Commande invalide. Valeurs : {COMMANDES_VALIDES}")

    existing = _count_audio(body.commande)
    if existing >= AUDIO_CAP:
        raise HTTPException(429, f"Quota atteint pour '{body.commande}' ({existing}/{AUDIO_CAP})")

    try:
        b64 = body.audio_base64.split(",")[-1]
        audio_bytes = base64.b64decode(b64)
    except Exception:
        raise HTTPException(400, "Audio base64 invalide")

    sample_id = str(uuid.uuid4())

    if _use_supabase():
        try:
            path = f"audio/{body.commande}/{current_user.id}_{sample_id}.wav"
            _sb().storage.from_(BUCKET).upload(
                path, audio_bytes, {"content-type": "audio/wav", "upsert": "false"}
            )
        except Exception as e:
            raise HTTPException(500, f"Erreur Supabase Storage : {e}")
    else:
        cmd_dir = os.path.join(AUDIO_DIR, body.commande)
        os.makedirs(cmd_dir, exist_ok=True)
        with open(os.path.join(cmd_dir, f"{current_user.id}_{sample_id}.wav"), "wb") as f:
            f.write(audio_bytes)

    total = existing + 1
    return {
        "sample_id":   sample_id,
        "commande":    body.commande,
        "total":       total,
        "cap":         AUDIO_CAP,
        "progression": round(total / AUDIO_TARGET * 100),
        "storage":     "supabase" if _use_supabase() else "local",
    }


@router.get("/audio/stats")
def get_audio_stats(current_user: User = Depends(get_current_user)):
    par_commande = {}
    total = 0
    for cmd in COMMANDES_VALIDES:
        n = _count_audio(cmd)
        par_commande[cmd] = n
        total += n
    return {
        "total":               total,
        "target_par_commande": AUDIO_TARGET,
        "cap_par_commande":    AUDIO_CAP,
        "par_commande":        par_commande,
        "progression_pct":     {c: round(n / AUDIO_TARGET * 100) for c, n in par_commande.items()},
        "pret_entrainement":   all(n >= AUDIO_TARGET for n in par_commande.values()),
        "storage":             "supabase" if _use_supabase() else "local",
    }


@router.delete("/audio/{commande}")
def supprimer_audio_commande(commande: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "super_admin":
        raise HTTPException(403, "Super admin requis")
    if commande not in COMMANDES_VALIDES:
        raise HTTPException(400, "Commande invalide")

    count = _count_audio(commande)
    if _use_supabase():
        try:
            files = _sb().storage.from_(BUCKET).list(f"audio/{commande}")
            names = [f["name"] for f in (files or []) if f.get("name")]
            if names:
                _sb().storage.from_(BUCKET).remove([f"audio/{commande}/{n}" for n in names])
        except Exception as e:
            raise HTTPException(500, f"Erreur Supabase : {e}")
    else:
        import shutil
        cmd_dir = os.path.join(AUDIO_DIR, commande)
        if os.path.exists(cmd_dir):
            shutil.rmtree(cmd_dir)

    return {"message": f"Audio '{commande}' supprimés ({count} fichiers)"}


# ── Stats combinées (pour la page /contribuer) ────────────────────

@router.get("/global-stats")
def get_global_stats(current_user: User = Depends(get_current_user)):
    """Stats agrégées émotions + audio pour la page de contribution."""
    par_etat = {e: _count(e) for e in ETATS_VALIDES}
    par_audio = {c: _count_audio(c) for c in COMMANDES_VALIDES}

    total_frames = sum(par_etat.values())
    total_audio  = sum(par_audio.values())

    return {
        "emotions": {
            "total":           total_frames,
            "target_total":    TARGET * len(ETATS_VALIDES),
            "par_etat":        par_etat,
            "progression_pct": {e: round(n / TARGET * 100) for e, n in par_etat.items()},
        },
        "audio": {
            "total":           total_audio,
            "target_total":    AUDIO_TARGET * len(COMMANDES_VALIDES),
            "par_commande":    par_audio,
            "progression_pct": {c: round(n / AUDIO_TARGET * 100) for c, n in par_audio.items()},
        },
        "storage": "supabase" if _use_supabase() else "local",
    }
