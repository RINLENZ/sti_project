"""
Router DKT — Deep Knowledge Tracing
====================================
Endpoints d'inférence DKT pour prédire la maîtrise par macro-compétence
et recommander les exercices optimaux selon la Zone Proximale de Développement.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID

from ..database import get_db
from ..models.cours import Exercice, ProgressionApprenant
from ..models.user import User
from ..dependencies import get_current_user
from ..services import dkt_service
from ..utils import get_kcs, get_macro_kc, is_valid_kc

router = APIRouter(prefix="/api/dkt", tags=["DKT"])


# ── Helpers internes ──────────────────────────────────────────────────

def _macro_kc_pour_exercice(exo) -> str:
    """Retourne le macro-KC d'un exercice (premier KC valide, ou 'Inconnu')."""
    kcs = get_kcs(exo)
    valides = [kc for kc in kcs if is_valid_kc(kc)]
    return get_macro_kc(valides[0]) if valides else "Inconnu"


def _construire_historique(user_id: UUID, db: Session) -> list:
    """
    Construit l'historique DKT d'un apprenant depuis la table progressions.
    Triée chronologiquement (date_fin ASC) — les progressions sans date_fin
    (non terminées) sont exclues.
    """
    progs = (
        db.query(ProgressionApprenant)
        .filter(
            ProgressionApprenant.user_id == user_id,
            ProgressionApprenant.exercice_id.isnot(None),
            ProgressionApprenant.correct.isnot(None),
            ProgressionApprenant.date_fin.isnot(None),
        )
        .order_by(ProgressionApprenant.date_fin.asc())
        .all()
    )

    # Précharge tous les exercices en une seule requête (évite le N+1)
    exo_ids = list({p.exercice_id for p in progs})
    exos_map = (
        {e.id: e for e in db.query(Exercice).filter(Exercice.id.in_(exo_ids)).all()}
        if exo_ids else {}
    )

    historique = []
    for prog in progs:
        exo = exos_map.get(prog.exercice_id)
        if not exo:
            continue
        historique.append({
            "macro_kc":   _macro_kc_pour_exercice(exo),
            "correct":    bool(prog.correct),
            "engagement": prog.engagement_fused,
        })

    return historique


def _formater_exercice(exo, zpd: float = None, proba: float = None, macro: str = None) -> dict:
    """Sérialise un exercice pour la réponse de l'endpoint prochain-exercice."""
    return {
        "id":            str(exo.id),
        "enonce":        (exo.enonce or "")[:120],
        "difficulte":    exo.difficulte,
        "macro_kc":      macro or _macro_kc_pour_exercice(exo),
        "proba_predite": round(proba, 4) if proba is not None else None,
        "zpd_score":     round(zpd, 4)   if zpd   is not None else None,
    }


# ── Endpoints ─────────────────────────────────────────────────────────

@router.get("/health")
def dkt_health():
    """Métadonnées du modèle DKT — pas d'authentification requise."""
    return dkt_service.get_model_info()


@router.get("/apprenant/{user_id}/predictions")
def get_predictions(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Prédit P(maîtrise au prochain exercice) pour chacune des macro-compétences,
    à partir de tout l'historique de l'apprenant.
    Retourne predictions=null si le modèle n'est pas disponible (torch absent).
    """
    if str(current_user.id) != str(user_id):
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    historique = _construire_historique(user_id, db)

    if not dkt_service.is_model_available():
        return {
            "predictions":    None,
            "n_interactions": len(historique),
            "source":         "modele_indisponible",
        }

    predictions = dkt_service.predict_mastery(historique)
    return {
        "predictions":    predictions,
        "n_interactions": len(historique),
        "source":         "dkt",
    }


@router.get("/apprenant/{user_id}/prochain-exercice")
def get_prochain_exercice(
    user_id: UUID,
    ua_id: UUID = Query(..., description="ID de l'unité d'apprentissage cible"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retourne les 5 meilleurs exercices ZPD pour l'apprenant dans une UA donnée.
    Exclut les exercices déjà réussis. Fallback sur tri par difficulté si le
    modèle DKT n'est pas disponible.
    """
    if str(current_user.id) != str(user_id):
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    # Exercices déjà réussis par cet apprenant dans cette UA
    exos_reussis = {
        p.exercice_id
        for p in db.query(ProgressionApprenant).filter(
            ProgressionApprenant.user_id == user_id,
            ProgressionApprenant.ua_id == ua_id,
            ProgressionApprenant.correct == True,   # noqa: E712
            ProgressionApprenant.exercice_id.isnot(None),
        ).all()
    }

    # Exercices disponibles (non encore réussis)
    q = db.query(Exercice).filter(Exercice.ua_id == ua_id)
    if exos_reussis:
        q = q.filter(Exercice.id.notin_(exos_reussis))
    exercices = q.order_by(Exercice.ordre.asc()).all()

    if not exercices:
        return {"prochain_exercice": None, "alternatives": [], "source": "aucun_disponible"}

    # ── Fallback si le modèle DKT n'est pas encore entraîné ─────────────
    if not dkt_service.is_model_available():
        tries = sorted(exercices, key=lambda e: (e.difficulte or 1, e.ordre or 0))
        return {
            "prochain_exercice": _formater_exercice(tries[0]),
            "alternatives":      [_formater_exercice(e) for e in tries[1:5]],
            "source":            "fallback_difficulte",
        }

    # ── Prédictions DKT + tri ZPD ────────────────────────────────────────
    historique  = _construire_historique(user_id, db)
    predictions = dkt_service.predict_mastery(historique)

    ranked = dkt_service.rank_exercices_zpd(
        exercices       = exercices,
        predictions     = predictions,
        get_macro_kc_fn = _macro_kc_pour_exercice,
    )

    return {
        "prochain_exercice": _formater_exercice(*ranked[0]),
        "alternatives":      [_formater_exercice(*t) for t in ranked[1:5]],
        "source":            "dkt_zpd",
    }
