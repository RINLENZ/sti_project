"""
adaptation.py — Modèle SQLAlchemy de l'historique des adaptations pédagogiques
=============================================================================

Chaque ligne représente UNE intervention déclenchée pendant une session
d'apprentissage : Alisha a détecté un signal (frustration, décrochage,
maîtrise élevée, etc.) et a déclenché une action concrète (pause, challenge,
encouragement, etc.).

Ce log sert à :
  1. Analyser a posteriori l'efficacité des règles d'adaptation
  2. Alimenter les statistiques du dashboard enseignant
  3. Fournir des données pour le chapitre 4 du mémoire
  4. Permettre, à terme, l'entraînement d'un modèle d'adaptation supervisé

Référence : Mémoire Section IV — Adaptation multimodale appliquée
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base


class Adaptation(Base):
    """
    Trace d'une intervention pédagogique déclenchée par le moteur d'adaptation.

    Colonnes clés :
      - declencheur : nom du signal qui a déclenché l'intervention
                      (ex: "frustration_detectee", "decrochage_critique")
      - action      : nom du composant UI à afficher côté frontend
                      (ex: "pause_overlay", "encouragement_toast")
      - intensite   : "haute" (modal bloquant), "moyenne" (overlay/dialog),
                      "basse" (toast discret)
      - signal_data : snapshot JSON des signaux qui ont déclenché l'action
                      (engagement, DKT, métriques session)
      - applique    : false par défaut, le frontend peut confirmer en PUT
                      quand l'utilisateur a vraiment vu/utilisé l'intervention
    """
    __tablename__ = "adaptations"

    id          = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id  = Column(PG_UUID(as_uuid=True), ForeignKey("learning_sessions.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    user_id     = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    timestamp   = Column(DateTime(timezone=True),
                         default=lambda: datetime.now(timezone.utc),
                         nullable=False, index=True)

    declencheur = Column(String(64),  nullable=False, index=True)
    action      = Column(String(64),  nullable=False)
    intensite   = Column(String(16),  nullable=False)  # haute / moyenne / basse

    # Snapshot du contexte au moment du déclenchement
    # (engagement_fused, etat_affectif, dkt_predictions, metrics_session...)
    signal_data = Column(JSONB,       nullable=True)

    # Confirmation côté frontend que l'intervention a effectivement été vue
    applique    = Column(Boolean,     default=False, nullable=False)

    # Relations (optionnelles, utiles pour les jointures côté backend)
    session = relationship("LearningSession", backref="adaptations")
    user    = relationship("User",            backref="adaptations")

    def __repr__(self):
        return (
            f"<Adaptation {self.declencheur}→{self.action} "
            f"({self.intensite}) user={str(self.user_id)[:8]} t={self.timestamp}>"
        )
