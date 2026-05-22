from sqlalchemy import Column, String, Integer, Boolean, Float, ForeignKey, Enum, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from ..database import Base


class CoursLive(Base):
    __tablename__ = "cours_live"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ua_id            = Column(UUID(as_uuid=True), ForeignKey("unites_apprentissage.id"), nullable=False)
    enseignant_id    = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    mode             = Column(
        Enum("enseignant", "avatar", name="live_mode_enum"),
        default="enseignant",
        nullable=False,
    )
    code             = Column(String(8), unique=True, nullable=False)
    statut           = Column(
        Enum("attente", "actif", "pause", "termine", name="live_statut_enum"),
        default="attente",
        nullable=False,
    )
    slide_index      = Column(Integer, default=0, nullable=False)
    quiz_actif       = Column(Boolean, default=False, nullable=False)
    quiz_exercice_id = Column(UUID(as_uuid=True), ForeignKey("exercices.id"), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    started_at       = Column(DateTime(timezone=True), nullable=True)
    ended_at         = Column(DateTime(timezone=True), nullable=True)


class CoursLiveParticipant(Base):
    __tablename__ = "cours_live_participants"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cours_live_id = Column(UUID(as_uuid=True), ForeignKey("cours_live.id"), nullable=False)
    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    joined_at     = Column(DateTime(timezone=True), server_default=func.now())
    left_at       = Column(DateTime(timezone=True), nullable=True)
    engagement    = Column(Float, default=1.0)


class CoursLiveQuizReponse(Base):
    """Stocke les réponses des élèves à un quiz live pour afficher les stats."""
    __tablename__ = "cours_live_quiz_reponses"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cours_live_id    = Column(UUID(as_uuid=True), ForeignKey("cours_live.id"), nullable=False)
    exercice_id      = Column(UUID(as_uuid=True), ForeignKey("exercices.id"), nullable=False)
    user_id          = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reponse          = Column(String, nullable=False)
    correct          = Column(Boolean, nullable=False)
    repondu_at       = Column(DateTime(timezone=True), server_default=func.now())
