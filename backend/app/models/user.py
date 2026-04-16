from sqlalchemy import Column, String, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid, secrets
from ..database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email         = Column(String, unique=True, nullable=False, index=True)
    nom           = Column(String, nullable=False)
    prenom        = Column(String, nullable=False)
    password      = Column(String, nullable=False)
    role          = Column(
        Enum("apprenant", "enseignant", "super_admin", name="role_enum"),
        default="apprenant"
    )
    # Profil scolaire — rempli par l'apprenant à l'inscription
    niveau        = Column(String, nullable=True)  # "Seconde", "Première", "Terminale"
    pays          = Column(String, nullable=True, default="Cameroun")
    # Code unique pour inviter un tuteur
    code_invitation = Column(
        String, unique=True, nullable=True,
        default=lambda: secrets.token_urlsafe(6).upper()
    )
    actif         = Column(Boolean, default=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())


class TuteurSuivi(Base):
    """
    Un apprenant peut inviter un enseignant à suivre sa progression.
    L'enseignant entre le code_invitation de l'apprenant.
    La relation est initiée par l'apprenant, pas par l'enseignant.
    """
    __tablename__ = "tuteur_suivis"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    apprenant_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    tuteur_id    = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    actif        = Column(Boolean, default=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())