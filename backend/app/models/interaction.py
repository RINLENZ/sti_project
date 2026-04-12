from sqlalchemy import Column, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from ..database import Base

class Interaction(Base):
    __tablename__ = "interactions"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id  = Column(UUID(as_uuid=True), ForeignKey("learning_sessions.id"), nullable=False)
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    timestamp   = Column(DateTime(timezone=True), server_default=func.now())
    type        = Column(String, nullable=False)  # "click", "response", "idle", "navigation"
    data        = Column(JSON, nullable=True)      # données brutes de l'événement
    score       = Column(Float, nullable=True)     # score comportemental calculé