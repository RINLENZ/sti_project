"""
Collecte de frames labellisées pour l'entraînement du modèle d'émotion.
Stockage : bucket Supabase Storage "emotion-frames/{etat}/{user_id}_{uuid}.jpg"
"""
import base64, uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from supabase import create_client, Client
from ..config import settings
from ..database import get_db
from ..dependencies import get_current_user
from ..models.user import User

router = APIRouter(prefix="/api/annotation", tags=["annotation"])

BUCKET        = "emotion-frames"
TARGET        = 500
ETATS_VALIDES = [
    "engagement_eleve", "engagement_faible",
    "confusion", "frustration", "ennui", "neutre",
]


def get_supabase() -> Client:
    if not settings.supabase_url or not settings.supabase_service_key:
        raise HTTPException(503, "Supabase Storage non configuré (SUPABASE_URL / SUPABASE_SERVICE_KEY manquants)")
    return create_client(settings.supabase_url, settings.supabase_service_key)


class FrameSubmit(BaseModel):
    image_base64: str
    etat: str
    session_id: Optional[str] = None


@router.post("/frame")
def soumettre_frame(
    body: FrameSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.etat not in ETATS_VALIDES:
        raise HTTPException(400, f"État invalide. Valeurs acceptées : {ETATS_VALIDES}")

    sb = get_supabase()

    # Compter les frames existantes
    try:
        existing = sb.storage.from_(BUCKET).list(body.etat)
        count = len([f for f in existing if f.get("name", "").endswith(".jpg")])
    except Exception:
        count = 0

    if count >= TARGET * 2:
        raise HTTPException(429, f"Quota atteint pour '{body.etat}' ({count} frames)")

    try:
        b64 = body.image_base64.split(",")[-1]
        img_bytes = base64.b64decode(b64)
    except Exception:
        raise HTTPException(400, "Image base64 invalide")

    frame_id = str(uuid.uuid4())
    path = f"{body.etat}/{current_user.id}_{frame_id}.jpg"

    try:
        sb.storage.from_(BUCKET).upload(
            path, img_bytes,
            {"content-type": "image/jpeg", "upsert": "false"},
        )
    except Exception as e:
        raise HTTPException(500, f"Erreur upload Supabase : {e}")

    total_etat = count + 1
    return {
        "frame_id":    frame_id,
        "etat":        body.etat,
        "total_etat":  total_etat,
        "progression": round(total_etat / TARGET * 100),
    }


@router.get("/stats")
def get_stats(current_user: User = Depends(get_current_user)):
    sb = get_supabase()
    par_etat = {}
    total = 0

    for etat in ETATS_VALIDES:
        try:
            files = sb.storage.from_(BUCKET).list(etat)
            count = len([f for f in files if f.get("name", "").endswith(".jpg")])
        except Exception:
            count = 0
        par_etat[etat] = count
        total += count

    return {
        "total":             total,
        "target_par_etat":   TARGET,
        "par_etat":          par_etat,
        "progression_pct":   {e: round(n / TARGET * 100) for e, n in par_etat.items()},
        "pret_entrainement": all(n >= 100 for n in par_etat.values()),
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

    sb = get_supabase()
    try:
        files = sb.storage.from_(BUCKET).list(etat)
        paths = [f"{etat}/{f['name']}" for f in files if f.get("name")]
        if paths:
            sb.storage.from_(BUCKET).remove(paths)
    except Exception as e:
        raise HTTPException(500, f"Erreur suppression : {e}")

    return {"message": f"Frames '{etat}' supprimées ({len(paths)} fichiers)"}
