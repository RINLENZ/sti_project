from sqlalchemy import Column, String, Boolean, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from ..database import Base

class User(Base):
    __tablename__ = "users"

    id       = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email    = Column(String, unique=True, nullable=False, index=True)
    nom      = Column(String, nullable=False)
    prenom   = Column(String, nullable=False)
    password = Column(String, nullable=False)    # stocké hashé
    role     = Column(Enum("apprenant", "enseignant", name="role_enum"), default="apprenant")
    actif    = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())