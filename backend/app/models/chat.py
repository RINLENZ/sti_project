from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from ..database import Base


class ChatRoom(Base):
    __tablename__ = "chat_rooms"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type       = Column(String, nullable=False)      # "direct" | "classe"
    nom        = Column(String)
    membres    = Column(JSONB, default=[])            # list of str(user_id) — JSONB pour @> filter
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id    = Column(UUID(as_uuid=True), ForeignKey("chat_rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id  = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    contenu    = Column(Text, nullable=False)
    lu_par     = Column(JSONB, default=[])            # list of str(user_id) — JSONB pour @> filter
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
