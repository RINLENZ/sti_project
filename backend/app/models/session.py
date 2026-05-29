from sqlalchemy import Column, String, Float, DateTime, ForeignKey, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from ..database import Base

class LearningSession(Base):
    __tablename__ = "learning_sessions"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id          = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    cours_id         = Column(String, nullable=False)
    started_at       = Column(DateTime(timezone=True), server_default=func.now())
    ended_at         = Column(DateTime(timezone=True), nullable=True)
    score_final           = Column(Float, nullable=True)   # score exercices
    score_engagement      = Column(Float, nullable=True)   # fusionné : α·facial + β·audio + γ·comport.
    score_facial          = Column(Float, nullable=True)   # α — visuel (MediaPipe + CNN)
    score_audio           = Column(Float, nullable=True)   # β — audio (VAD + bruit ambiant)
    score_comportemental  = Column(Float, nullable=True)   # γ — comportemental (idle/response/help)
    etat_affectif         = Column(String, nullable=True)  # état dominant session
    nb_interactions       = Column(Integer, default=0)     # nombre d'événements
    duree_secondes        = Column(Integer, nullable=True) # durée session


class EngagementAnalysis(Base):
    __tablename__ = "engagement_analyses"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id        = Column(UUID(as_uuid=True), ForeignKey("learning_sessions.id"))
    timestamp         = Column(DateTime(timezone=True), server_default=func.now())
    facial_score      = Column(Float, nullable=True)
    audio_score       = Column(Float, nullable=True)
    interaction_score = Column(Float, nullable=True)
    engagement_score  = Column(Float, nullable=False)
    etat_affectif     = Column(String, nullable=True)   # état affectif FACS
    action_triggered  = Column(String, nullable=True)
    raw_data          = Column(JSON, nullable=True)