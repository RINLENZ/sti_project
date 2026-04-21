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


def get_redis():
    """Connexion Redis lazy — ne crashe pas si Redis indisponible."""
    try:
        r = redis_client.from_url(settings.redis_url, decode_responses=True)
        r.ping()
        return r
    except Exception:
        return None


class InteractionEvent(BaseModel):
    session_id: UUID
    user_id:    UUID
    type:       str
    data:       Optional[dict] = {}


@router.post("/interaction")
def log_interaction(event: InteractionEvent, db: Session = Depends(get_db)):
    session = db.query(LearningSession).filter(
        LearningSession.id == event.session_id
    ).first()
    if not session:
        raise HTTPException(404, "Session introuvable")

    interaction = Interaction(
        session_id=event.session_id,
        user_id=event.user_id,
        type=event.type,
        data=event.data
    )
    db.add(interaction)
    db.commit()

    # Redis lazy
    r = get_redis()
    cache_key = f"session_events:{event.session_id}"
    cached = r.get(cache_key) if r else None
    events = json.loads(cached) if cached else []
    events.append({"type": event.type, "data": event.data})
    if r:
        r.setex(cache_key, 7200, json.dumps(events))

    result = compute_behavioral_score(events)
    adaptation = result.get("adaptation")

    return {
        "status":           "recorded",
        "behavioral_score": result.get("behavioral_score", 0.5),
        "visual_score":     result.get("visual_score"),
        "engagement_score": result.get("score", 0.5),
        "engagement_level": result.get("level", "neutre"),
        "etat_affectif":    result.get("etat_affectif", "neutre"),
        "fusion_info":      result.get("fusion_info", ""),
        "adaptation":       adaptation,
        "stats":            result.get("stats", {}),
    }


@router.get("/session/{session_id}/score")
def get_session_score(session_id: UUID, db: Session = Depends(get_db)):
    r = get_redis()
    cache_key = f"session_events:{session_id}"
    cached = r.get(cache_key) if r else None
    events = json.loads(cached) if cached else []

    if not events:
        db_events = db.query(Interaction).filter(
            Interaction.session_id == session_id
        ).all()
        events = [{"type": e.type, "data": e.data} for e in db_events]

    result = compute_behavioral_score(events)

    return {
        "session_id":       str(session_id),
        "behavioral_score": result.get("behavioral_score", 0.5),
        "visual_score":     result.get("visual_score"),
        "engagement_score": result.get("score", 0.5),
        "engagement_level": result.get("level", "neutre"),
        "etat_affectif":    result.get("etat_affectif", "neutre"),
        "fusion_info":      result.get("fusion_info", ""),
        "nb_events":        len(events),
        "stats":            result.get("stats", {}),
    }