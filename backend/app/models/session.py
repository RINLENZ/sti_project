from sqlalchemy import Column, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from ..database import Base

class LearningSession(Base):
    __tablename__ = "learning_sessions"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id      = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    cours_id     = Column(String, nullable=False)
    started_at   = Column(DateTime(timezone=True), server_default=func.now())
    ended_at     = Column(DateTime(timezone=True), nullable=True)
    score_final  = Column(Float, nullable=True)   # score engagement moyen

class EngagementAnalysis(Base):
    __tablename__ = "engagement_analyses"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id   = Column(UUID(as_uuid=True), ForeignKey("learning_sessions.id"))
    timestamp    = Column(DateTime(timezone=True), server_default=func.now())
    facial_score = Column(Float, nullable=True)
    audio_score  = Column(Float, nullable=True)
    interaction_score = Column(Float, nullable=True)
    engagement_score  = Column(Float, nullable=False)
    action_triggered  = Column(String, nullable=True)  # ex: "pause_active"
    raw_data     = Column(JSON, nullable=True)          # landmarks bruts