"""
Modèle SQLAlchemy pour la table user_stats (gamification).
XP, niveau, streak, badges Adinkra.
"""
import uuid
from datetime import date, datetime, timezone
from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from ..database import Base


def _now():
    return datetime.now(timezone.utc)


class UserStats(Base):
    __tablename__ = "user_stats"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id          = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                              nullable=False, unique=True)
    xp               = Column(Integer, nullable=False, default=0)
    niveau           = Column(Integer, nullable=False, default=1)
    streak_jours     = Column(Integer, nullable=False, default=0)
    derniere_session = Column(Date, nullable=True)
    badges           = Column(JSONB, nullable=False, default=list)
    total_sessions   = Column(Integer, nullable=False, default=0)
    total_exercices  = Column(Integer, nullable=False, default=0)
    total_corrects   = Column(Integer, nullable=False, default=0)
    created_at       = Column(DateTime(timezone=True), default=_now)
    updated_at       = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_stats_user_id"),
    )
