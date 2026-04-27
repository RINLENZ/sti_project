"""
Collecte de frames labellisées pour l'entraînement du modèle d'émotion.
Chaque frame est un JPEG base64 associé à un état affectif confirmé
par l'utilisateur lui-même (annotation self-report).

Structure de stockage :
  backend/data/frames/{etat}/{user_id}_{uuid}.jpg
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

FRAMES_DIR  = os.path.join(os.path.dirname(__file__), "../../data/frames")
TARGET      = 500   # frames cibles par état
ETATS_VALIDES = [
    "engagement_eleve", "engagement_faible",
    "confusion", "frustration", "ennui", "neutre",
]


class FrameSubmit(BaseModel):
    image_base64: str        # JPEG base64 sans préfixe data:
    etat: str                # état affectif labellisé par l'utilisateur
    session_id: Optional[str] = None


@router.post("/frame")
def soumettre_frame(
    body: FrameSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reçoit une frame labellisée et la stocke pour entraînement."""
    if body.etat not in ETATS_VALIDES:
        raise HTTPException(400, f"État invalide. Valeurs acceptées : {ETATS_VALIDES}")

    etat_dir = os.path.join(FRAMES_DIR, body.etat)
    os.makedirs(etat_dir, exist_ok=True)

    # Compter les frames existantes avant d'accepter
    existing = len([f for f in os.listdir(etat_dir) if f.endswith(".jpg")])
    if existing >= TARGET * 2:   # cap à 1000 par état
        raise HTTPException(429, f"Quota atteint pour '{body.etat}' ({existing} frames)")

    try:
        # Nettoie le préfixe data:image/jpeg;base64, si présent
        b64 = body.image_base64.split(",")[-1]
        img_bytes = base64.b64decode(b64)
    except Exception:
        raise HTTPException(400, "Image base64 invalide")

    frame_id = str(uuid.uuid4())
    filename = f"{current_user.id}_{frame_id}.jpg"
    filepath = os.path.join(etat_dir, filename)
    with open(filepath, "wb") as f:
        f.write(img_bytes)

    # Compte après ajout
    total_etat = existing + 1
    return {
        "frame_id":   frame_id,
        "etat":       body.etat,
        "total_etat": total_etat,
        "progression": round(total_etat / TARGET * 100),
    }


@router.get("/stats")
def get_stats(current_user: User = Depends(get_current_user)):
    """Retourne la progression de la collecte par état affectif."""
    par_etat = {}
    total    = 0

    for etat in ETATS_VALIDES:
        etat_dir = os.path.join(FRAMES_DIR, etat)
        count = 0
        if os.path.exists(etat_dir):
            count = len([f for f in os.listdir(etat_dir) if f.endswith(".jpg")])
        par_etat[etat] = count
        total += count

    return {
        "total":            total,
        "target_par_etat":  TARGET,
        "par_etat":         par_etat,
        "progression_pct":  {e: round(n / TARGET * 100) for e, n in par_etat.items()},
        "pret_entrainement": all(n >= 100 for n in par_etat.values()),
    }


@router.delete("/frames/{etat}")
def supprimer_frames_etat(
    etat: str,
    current_user: User = Depends(get_current_user)
):
    """Supprime toutes les frames d'un état (admin uniquement)."""
    if current_user.role != "super_admin":
        raise HTTPException(403, "Super admin requis")
    if etat not in ETATS_VALIDES:
        raise HTTPException(400, "État invalide")

    import shutil
    etat_dir = os.path.join(FRAMES_DIR, etat)
    if os.path.exists(etat_dir):
        shutil.rmtree(etat_dir)
    return {"message": f"Frames '{etat}' supprimées"}
