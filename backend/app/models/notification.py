from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from ..database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type       = Column(String, nullable=False)   # badge_debloque | competence_maitrisee | competence_progres | enseignant_lie | apprenant_lie | apprenant_session | apprenant_decrocheur
    titre      = Column(String, nullable=False)
    message    = Column(String, nullable=False)
    lu         = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    meta       = Column(JSON, default={})         # données contextuelles (badge_id, score, etc.)
