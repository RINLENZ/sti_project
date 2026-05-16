from sqlalchemy import Column, String, Integer, Text, Boolean, ForeignKey, JSON, Enum, Float, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from ..database import Base


class Epreuve(Base):
    """
    Épreuve générée par l'IA (ou manuellement) par un enseignant.
    Le contenu est stocké en JSON suivant le format camerounais APC :
    deux parties — Évaluation des Ressources + Évaluation des Compétences.
    """
    __tablename__ = "epreuves"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    enseignant_id  = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    matiere_id     = Column(UUID(as_uuid=True), ForeignKey("matieres.id"), nullable=True)
    niveau_id      = Column(UUID(as_uuid=True), ForeignKey("niveaux.id"), nullable=True)

    titre          = Column(String, nullable=False)
    type_epreuve   = Column(
        Enum("sequence", "examen", "devoir", "tp_note", name="type_epreuve_enum"),
        default="sequence"
    )
    # JSON list of UA IDs used as generation context
    ua_ids         = Column(JSON, nullable=True)
    # Full structured exam content — deux parties, exercices, barème
    contenu        = Column(JSON, nullable=False)

    duree_minutes  = Column(Integer, default=60)
    coefficient    = Column(Integer, default=1)
    annee_scolaire = Column(String, nullable=True)  # "2025-2026"
    classe_label   = Column(String, nullable=True)  # "Tle F6"

    statut         = Column(
        Enum("brouillon", "publie", "archive", name="statut_epreuve_enum"),
        default="brouillon"
    )
    date_ouverture = Column(DateTime(timezone=True), nullable=True)
    date_cloture   = Column(DateTime(timezone=True), nullable=True)

    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), onupdate=func.now())


class EpreuveReponse(Base):
    """
    Réponses soumises par un apprenant pour une épreuve.
    reponses : { "p1_ex1_q1": "réponse texte", "p1_ex2_q1": "A", ... }
    corrections : { "p1_ex1_q1": { "score": 1, "commentaire": "..." }, ... }
    """
    __tablename__ = "epreuve_reponses"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    epreuve_id    = Column(UUID(as_uuid=True), ForeignKey("epreuves.id"), nullable=False)
    apprenant_id  = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    reponses      = Column(JSON, nullable=True)    # answers keyed by question id
    corrections   = Column(JSON, nullable=True)    # per-question scores + feedback
    score_total   = Column(Float, nullable=True)   # /20
    score_p1      = Column(Float, nullable=True)
    score_p2      = Column(Float, nullable=True)

    # Surveillance caméra pendant la composition
    nb_incidents       = Column(Integer, default=0)   # nombre d'absences visage > 3s
    incidents_log      = Column(JSON, nullable=True)  # [{debut, fin, duree_s}, ...]

    statut        = Column(
        Enum("en_cours", "soumis", "corrige", name="statut_reponse_enum"),
        default="en_cours"
    )
    submitted_at  = Column(DateTime(timezone=True), nullable=True)
    corrige_at    = Column(DateTime(timezone=True), nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    # ── Copie papier & dataset ──────────────────────────────────────────────────
    copie_type         = Column(String(20), default="numerique")  # "numerique" | "papier"
    image_copie_url    = Column(Text, nullable=True)               # URL vers la photo de copie
    vision_corrections = Column(JSON, nullable=True)               # Corrections IA première lecture
    dataset_valide     = Column(Boolean, default=False)            # Validé pour entraînement
