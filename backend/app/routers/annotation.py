"""
Collecte de données d'entraînement :
  - Frames labellisées (émotions)  : backend/data/frames/{etat}/{user_id}_{uuid}.jpg
  - Clips audio labellisés (KWS)   : backend/data/audio/{commande}/{user_id}_{uuid}.wav

Frames  : TARGET 1000 / CAP 1500 par état
Audio   : TARGET 100  / CAP 150  par commande
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
TARGET        = 1000   # frames cibles par état
CAP           = 1500   # plafond par état (évite déséquilibre de classes)
ETATS_VALIDES = [
    "engagement_eleve", "engagement_faible",
    "confusion", "frustration", "ennui", "neutre",
]


class FrameSubmit(BaseModel):
    image_base64: str
    etat: str
    session_id: Optional[str] = None


def _count(etat: str) -> int:
    d = os.path.join(FRAMES_DIR, etat)
    if not os.path.exists(d):
        return 0
    return len([f for f in os.listdir(d) if f.endswith(".jpg")])


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

    etat_dir = os.path.join(FRAMES_DIR, body.etat)
    os.makedirs(etat_dir, exist_ok=True)

    frame_id = str(uuid.uuid4())
    filepath = os.path.join(etat_dir, f"{current_user.id}_{frame_id}.jpg")
    with open(filepath, "wb") as f:
        f.write(img_bytes)

    total_etat = existing + 1
    return {
        "frame_id":    frame_id,
        "etat":        body.etat,
        "total_etat":  total_etat,
        "cap":         CAP,
        "progression": round(total_etat / TARGET * 100),
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
    }


@router.delete("/frames/{etat}")
def supprimer_frames_etat(
    etat: str,
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "super_admin":
        raise HTTPException(403, "Super admin requis")
    if etat not in ETATS_VALIDES:
        raise HTTPException(400, "État invalide")

    import shutil
    etat_dir = os.path.join(FRAMES_DIR, etat)
    count = _count(etat)
    if os.path.exists(etat_dir):
        shutil.rmtree(etat_dir)
    return {"message": f"Frames '{etat}' supprimées ({count} fichiers)"}


# ══════════════════════════════════════════════════════════════════
#  SECTION 2 — Collecte audio (Keyword Spotting)
# ══════════════════════════════════════════════════════════════════

AUDIO_DIR      = os.path.join(os.path.dirname(__file__), "../../data/audio")
AUDIO_TARGET   = 100    # clips minimum par commande
AUDIO_CAP      = 150    # plafond par commande
COMMANDES_VALIDES = [
    "aide",          # "Aide"
    "oui",           # "Oui"
    "non",           # "Non"
    "repeter",       # "Répétez" / "Répète"
    "incompris",     # "Je ne comprends pas"
    "lentement",     # "Plus lentement"
    "bruit_silence", # Exemples négatifs (bruit ambiant / silence)
]


def _count_audio(commande: str) -> int:
    d = os.path.join(AUDIO_DIR, commande)
    if not os.path.exists(d):
        return 0
    return len([f for f in os.listdir(d) if f.endswith(".wav")])


class AudioSubmit(BaseModel):
    audio_base64: str           # WAV 16kHz mono encodé en base64
    commande: str               # label de la commande
    duree_ms: Optional[int] = None


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

    cmd_dir = os.path.join(AUDIO_DIR, body.commande)
    os.makedirs(cmd_dir, exist_ok=True)

    sample_id = str(uuid.uuid4())
    filepath  = os.path.join(cmd_dir, f"{current_user.id}_{sample_id}.wav")
    with open(filepath, "wb") as f:
        f.write(audio_bytes)

    total = existing + 1
    return {
        "sample_id":   sample_id,
        "commande":    body.commande,
        "total":       total,
        "cap":         AUDIO_CAP,
        "progression": round(total / AUDIO_TARGET * 100),
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
        "total":                 total,
        "target_par_commande":   AUDIO_TARGET,
        "cap_par_commande":      AUDIO_CAP,
        "par_commande":          par_commande,
        "progression_pct":       {c: round(n / AUDIO_TARGET * 100) for c, n in par_commande.items()},
        "pret_entrainement":     all(n >= AUDIO_TARGET for n in par_commande.values()),
    }


@router.delete("/audio/{commande}")
def supprimer_audio_commande(
    commande: str,
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "super_admin":
        raise HTTPException(403, "Super admin requis")
    if commande not in COMMANDES_VALIDES:
        raise HTTPException(400, "Commande invalide")

    import shutil
    cmd_dir = os.path.join(AUDIO_DIR, commande)
    count = _count_audio(commande)
    if os.path.exists(cmd_dir):
        shutil.rmtree(cmd_dir)
    return {"message": f"Audio '{commande}' supprimés ({count} fichiers)"}
