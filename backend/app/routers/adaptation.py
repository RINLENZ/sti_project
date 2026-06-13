"""
adaptation.py — Router FastAPI pour le moteur d'adaptation pédagogique
========================================================================

Endpoints :
  POST /api/adaptation/evaluer
    Entrée : contexte de session (engagement, metrics, DKT preds)
    Sortie : adaptation à déclencher OU null

  POST /api/adaptation/{adaptation_id}/confirmer
    Le frontend confirme que l'adaptation a bien été appliquée.

  GET  /api/adaptation/session/{session_id}
    Historique des adaptations déclenchées dans une session.

  GET  /api/adaptation/stats
    Statistiques globales (pour dashboard / mémoire).
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as SQLSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services import adaptation_service, dkt_service


router = APIRouter(prefix="/api/adaptation", tags=["adaptation"])


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Schémas Pydantic                                                   ║
# ╚════════════════════════════════════════════════════════════════════╝

class EngagementInput(BaseModel):
    """Score d'engagement multimodal et état affectif."""
    fused:      float = Field(0.5, ge=0.0, le=1.0)
    etat:       str   = "neutre"
    facial:     Optional[float] = None
    audio:      Optional[float] = None
    behavioral: Optional[float] = None


class MetricsInput(BaseModel):
    """Signaux temporels accumulés depuis le début de la session."""
    duree_session_sec:                 int   = 0
    nb_responses:                      int   = 0
    nb_correct:                        int   = 0
    nb_idles:                          int   = 0
    nb_help:                           int   = 0
    erreurs_consecutives_macro_kc:     int   = 0
    erreurs_session:                   int   = 0
    reussites_consecutives:            int   = 0
    reussites_consecutives_macro_kc:   int   = 0
    low_engagement_streak:             int   = 0
    temps_reponses_recents:            List[int] = Field(default_factory=list)
    temps_moyen_profil:                float = 30.0
    engagement_recent_5:               List[float] = Field(default_factory=list)


class ExerciceInput(BaseModel):
    """Exercice à venir (pour le déclencheur rappel-avant-difficile)."""
    id:         Optional[str] = None
    difficulte: Optional[int] = None
    macro_kc:   Optional[str] = None


class EvaluerAdaptationRequest(BaseModel):
    session_id:       str
    engagement:       EngagementInput
    metrics:          MetricsInput
    current_macro_kc: Optional[str]         = None
    current_exercise: Optional[ExerciceInput] = None
    inclure_dkt:      bool                   = True  # appeler le DKT pour les preds


class AdaptationResponse(BaseModel):
    id:          Optional[str] = None
    declencheur: Optional[str] = None
    action:      Optional[str] = None
    intensite:   Optional[str] = None
    message:     Optional[str] = None
    params:      Optional[Dict[str, Any]] = None


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Endpoints                                                          ║
# ╚════════════════════════════════════════════════════════════════════╝

@router.post("/evaluer", response_model=AdaptationResponse)
def evaluer_adaptation(
    payload: EvaluerAdaptationRequest,
    db:           SQLSession = Depends(get_db),
    current_user: User       = Depends(get_current_user),
):
    """
    Évalue le contexte de session et retourne au plus UNE adaptation.

    Le frontend doit appeler cet endpoint :
      - À chaque réponse soumise par l'apprenant
      - Périodiquement pendant les exercices longs (toutes les 10s par ex.)

    Si une adaptation est retournée, son ID est inclus pour que le frontend
    puisse confirmer son affichage via /confirmer.
    """
    # ── DKT : récupérer les prédictions de maîtrise (best effort) ────
    dkt_predictions = None
    if payload.inclure_dkt and dkt_service.is_model_available():
        try:
            historique = _build_historique_dkt(db, str(current_user.id))
            dkt_predictions = dkt_service.predict_mastery(historique)
        except Exception:
            # Si le DKT échoue, on continue sans (déclencheurs ne nécessitant
            # pas le DKT restent évaluables).
            dkt_predictions = None

    # ── Appel au moteur d'adaptation ─────────────────────────────────
    decision = adaptation_service.evaluer_adaptation(
        db,
        session_id        = payload.session_id,
        user_id           = str(current_user.id),
        engagement        = payload.engagement.model_dump(),
        dkt_predictions   = dkt_predictions,
        metrics           = payload.metrics.model_dump(),
        current_macro_kc  = payload.current_macro_kc,
        current_exercise  = payload.current_exercise.model_dump() if payload.current_exercise else None,
    )

    if decision is None:
        return AdaptationResponse()  # tous champs None
    return AdaptationResponse(**decision)


@router.post("/{adaptation_id}/confirmer")
def confirmer_application(
    adaptation_id: str,
    db:           SQLSession = Depends(get_db),
    current_user: User       = Depends(get_current_user),
):
    """Le frontend confirme avoir affiché l'adaptation à l'utilisateur."""
    ok = adaptation_service.confirmer_application(db, adaptation_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Adaptation introuvable")
    return {"applique": True}


@router.get("/session/{session_id}")
def historique_session(
    session_id: str,
    db:           SQLSession = Depends(get_db),
    current_user: User       = Depends(get_current_user),
):
    """Liste des adaptations déclenchées dans une session."""
    adps = adaptation_service.adaptations_session(db, session_id)
    return [
        {
            "id":          str(a.id),
            "timestamp":   a.timestamp.isoformat(),
            "declencheur": a.declencheur,
            "action":      a.action,
            "intensite":   a.intensite,
            "applique":    a.applique,
        }
        for a in adps
    ]


@router.get("/stats")
def stats_globales(
    db:           SQLSession = Depends(get_db),
    current_user: User       = Depends(get_current_user),
):
    """
    Statistiques d'adaptation pour le dashboard et le mémoire.
    Si current_user est apprenant, restreint à ses propres données.
    Si enseignant/admin, retourne les stats globales.
    """
    if current_user.role == "apprenant":
        return {
            "par_type": adaptation_service.compter_adaptations_par_type(
                db, user_id=str(current_user.id)
            )
        }
    return {
        "par_type": adaptation_service.compter_adaptations_par_type(db),
    }


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Helper interne                                                     ║
# ╚════════════════════════════════════════════════════════════════════╝

def _build_historique_dkt(db: SQLSession, user_id: str) -> List[Dict[str, Any]]:
    """
    Reconstruit l'historique d'un apprenant au format attendu par dkt_service.
    Mêmes règles que /api/dkt/apprenant/{id}/predictions.
    """
    from app.models.cours import ProgressionApprenant, Exercice
    from app.utils import get_kcs, get_macro_kc, is_valid_kc

    progs = (
        db.query(ProgressionApprenant)
        .filter(
            ProgressionApprenant.user_id == user_id,
            ProgressionApprenant.exercice_id.isnot(None),
        )
        .order_by(ProgressionApprenant.date_fin.asc())
        .all()
    )

    historique = []
    for p in progs:
        exo = db.query(Exercice).filter(Exercice.id == p.exercice_id).first()
        if not exo:
            continue
        primary = next((k for k in (get_kcs(exo) or []) if is_valid_kc(k)), None)
        if not primary:
            continue
        historique.append({
            "macro_kc":   get_macro_kc(primary),
            "correct":    bool(p.correct),
            "engagement": p.engagement_fused,
        })
    return historique
