from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
import redis as redis_client
import json

from ..database import get_db
from ..models.interaction import Interaction
from ..models.session import LearningSession
from ..services.engagement_service import compute_behavioral_score
from ..config import settings

router = APIRouter(prefix="/api", tags=["interactions"])

# Connexion Redis pour le cache
redis = redis_client.from_url(settings.redis_url, decode_responses=True)


class InteractionEvent(BaseModel):
    session_id: UUID
    user_id:    UUID
    type:       str
    data:       Optional[dict] = {}


@router.post("/interaction")
def log_interaction(event: InteractionEvent, db: Session = Depends(get_db)):
    """Enregistre un événement et retourne le score d'engagement mis à jour."""

    # Vérifie que la session existe
    session = db.query(LearningSession).filter(
        LearningSession.id == event.session_id
    ).first()
    if not session:
        raise HTTPException(404, "Session introuvable")

    # Sauvegarde l'événement en base
    interaction = Interaction(
        session_id=event.session_id,
        user_id=event.user_id,
        type=event.type,
        data=event.data
    )
    db.add(interaction)
    db.commit()

    # Récupère tous les événements de la session depuis Redis
    cache_key = f"session_events:{event.session_id}"
    cached    = redis.get(cache_key)
    events    = json.loads(cached) if cached else []
    events.append({"type": event.type, "data": event.data})

    # Met à jour le cache (expire après 2h)
    redis.setex(cache_key, 7200, json.dumps(events))

    # Calcule le score fusionné (visuel + comportemental)
    result = compute_behavioral_score(events)

    # L'adaptation est déjà calculée dans compute_behavioral_score
    adaptation = result.get("adaptation")

    return {
        "status":           "recorded",
        "behavioral_score": result.get("behavioral_score", result.get("score", 0.5)),
        "visual_score":     result.get("visual_score"),
        "engagement_score": result.get("score", 0.5),
        "engagement_level": result.get("level", "modere"),
        "fusion_info":      result.get("fusion_info", ""),
        "adaptation":       adaptation,
        "stats":            result.get("stats", {}),
    }


@router.get("/session/{session_id}/score")
def get_session_score(session_id: UUID, db: Session = Depends(get_db)):
    """Retourne le score d'engagement courant d'une session."""

    cache_key = f"session_events:{session_id}"
    cached    = redis.get(cache_key)
    events    = json.loads(cached) if cached else []

    if not events:
        # Charge depuis la base si pas en cache
        db_events = db.query(Interaction).filter(
            Interaction.session_id == session_id
        ).all()
        events = [{"type": e.type, "data": e.data} for e in db_events]

    result = compute_behavioral_score(events)

    return {
        "session_id":       str(session_id),
        "behavioral_score": result.get("behavioral_score", result.get("score", 0.5)),
        "visual_score":     result.get("visual_score"),
        "engagement_score": result.get("score", 0.5),
        "engagement_level": result.get("level", "modere"),
        "fusion_info":      result.get("fusion_info", ""),
        "nb_events":        len(events),
        "stats":            result.get("stats", {}),
    }