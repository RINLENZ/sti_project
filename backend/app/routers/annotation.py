"""
Collecte de frames labellisées pour l'entraînement du modèle d'émotion.
Stockage local : backend/data/frames/{etat}/{user_id}_{uuid}.jpg

TARGET    = 1000 frames minimum par état (6 états → 6 000 frames)
CAP       = 1500 frames max par état pour éviter le déséquilibre de classes
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
