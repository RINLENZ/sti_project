"""
Référentiel éducatif — Système éducatif camerounais
Tout est dynamique : cycles, ordres, filières, niveaux sont
créés et gérés par le super admin sans toucher au code.
"""
from sqlalchemy import Column, String, Integer, Text, Boolean, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy import DateTime
import uuid
from ..database import Base


class Cycle(Base):
    """
    Cycle d'enseignement.
    Ex : Primaire, Collège, Lycée, Supérieur
    Créé et géré par le super admin.
    """
    __tablename__ = "cycles"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom         = Column(String, nullable=False, unique=True)  # "Lycée"
    code        = Column(String, nullable=False, unique=True)  # "LY"
    description = Column(Text, nullable=True)
    ordre       = Column(Integer, default=1)   # ordre d'affichage
    actif       = Column(Boolean, default=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())


class Ordre(Base):
    """
    Ordre d'enseignement au sein d'un cycle.
    Ex : Général, Technique Industriel, Technique Commercial
    """
    __tablename__ = "ordres"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cycle_id    = Column(UUID(as_uuid=True), ForeignKey("cycles.id"), nullable=False)
    nom         = Column(String, nullable=False)    # "Technique Industriel"
    code        = Column(String, nullable=False)    # "TI"
    description = Column(Text, nullable=True)
    ordre       = Column(Integer, default=1)
    actif       = Column(Boolean, default=True)


class Filiere(Base):
    """
    Filière / Série au sein d'un ordre.
    Ex : F6 BIPE, Série C, G2 Comptabilité
    Créée dynamiquement par le super admin.
    """
    __tablename__ = "filieres"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ordre_id    = Column(UUID(as_uuid=True), ForeignKey("ordres.id"), nullable=False)
    nom         = Column(String, nullable=False)     # "F6 BIPE"
    code        = Column(String, nullable=False)     # "F6"
    description = Column(Text, nullable=True)        # "Brevet d'Initiation à la Prog. et à l'Électronique"
    ordre       = Column(Integer, default=1)
    actif       = Column(Boolean, default=True)


class Niveau(Base):
    """
    Niveau / Classe au sein d'un cycle.
    Ex : 6ème, 5ème, 4ème, 3ème, Seconde, Première, Terminale
    Créé dynamiquement par le super admin.
    """
    __tablename__ = "niveaux"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cycle_id    = Column(UUID(as_uuid=True), ForeignKey("cycles.id"), nullable=False)
    nom         = Column(String, nullable=False)    # "Première"
    code        = Column(String, nullable=False)    # "1ERE"
    ordre       = Column(Integer, default=1)        # ordre d'affichage (1=6e, 2=5e...)
    actif       = Column(Boolean, default=True)


class MatiereFiliere(Base):
    """
    Table de liaison Matière ↔ Filière × Niveau.
    Contient le coefficient et le volume horaire.
    Permet à une même matière (ex: Informatique) d'avoir
    des coefficients différents selon la filière et le niveau.
    """
    __tablename__ = "matiere_filieres"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    matiere_id      = Column(UUID(as_uuid=True), ForeignKey("matieres.id"), nullable=False)
    filiere_id      = Column(UUID(as_uuid=True), ForeignKey("filieres.id"), nullable=False)
    niveau_id       = Column(UUID(as_uuid=True), ForeignKey("niveaux.id"), nullable=False)
    coefficient     = Column(Float, default=1.0)      # coeff pour la moyenne générale
    volume_horaire  = Column(Float, nullable=True)    # heures/semaine
    obligatoire     = Column(Boolean, default=True)   # matière obligatoire ou optionnelle
    actif           = Column(Boolean, default=True)