from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from uuid import UUID
from ..database import get_db
from ..models.cours import BKTMastery, Exercice, UniteApprentissage
from ..models.session import LearningSession
from ..models.user import User
from ..dependencies import get_current_user
from ..services.bkt_service import update_knowledge, interpret_mastery, compute_class_bkt

router = APIRouter(prefix="/api/bkt", tags=["BKT"])


@router.get("/apprenant/{user_id}")
def get_mastery_apprenant(user_id: UUID, db: Session = Depends(get_db)):
    masteries = db.query(BKTMastery).filter(
        BKTMastery.user_id == user_id
    ).all()

    result = {}
    for m in masteries:
        interp = interpret_mastery(m.p_mastery)
        result[m.competence] = {
            "p_mastery":     m.p_mastery,
            "pourcentage":   round(m.p_mastery * 100),
            "niveau":        interp["niveau"],
            "label":         interp["label"],
            "color":         interp["color"],
            "nb_tentatives": m.nb_tentatives,
            "nb_correct":    m.nb_correct,
        }

    return {
        "user_id":    str(user_id),
        "competences": result,
        "nb_competences_maitrisees": len([
            v for v in result.values() if v["niveau"] == "maitrise"
        ])
    }


@router.get("/apprenant/{user_id}/stats")
def get_stats_apprenant(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stats agrégées : BKT + sessions pour le profil apprenant."""
    masteries = db.query(BKTMastery).filter(BKTMastery.user_id == user_id).all()
    nb_competences  = len(masteries)
    nb_maitrisees   = sum(1 for m in masteries if m.p_mastery >= 0.8)
    nb_tentatives   = sum(m.nb_tentatives for m in masteries)
    nb_correct      = sum(m.nb_correct    for m in masteries)
    p_moyen         = (sum(m.p_mastery for m in masteries) / nb_competences) if nb_competences else 0

    sessions = db.query(LearningSession).filter(
        LearningSession.user_id == user_id,
        LearningSession.ended_at.isnot(None),
    ).all()
    nb_sessions    = len(sessions)
    duree_totale   = sum(s.duree_secondes or 0 for s in sessions)
    scores_valides = [s.score_final for s in sessions if s.score_final is not None]
    score_moyen    = (sum(scores_valides) / len(scores_valides)) if scores_valides else 0

    return {
        "nb_competences":       nb_competences,
        "nb_maitrisees":        nb_maitrisees,
        "nb_tentatives":        nb_tentatives,
        "nb_correct":           nb_correct,
        "taux_reussite":        round(nb_correct / nb_tentatives * 100) if nb_tentatives else 0,
        "p_mastery_moyen":      round(p_moyen * 100),
        "nb_sessions":          nb_sessions,
        "duree_totale_minutes": round(duree_totale / 60),
        "score_moyen":          round(score_moyen * 100),
    }


@router.get("/apprenant/{user_id}/sessions")
def get_sessions_apprenant(
    user_id: UUID,
    limit: int = Query(10, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dernières sessions d'apprentissage avec titre du cours."""
    sessions = (
        db.query(LearningSession)
        .filter(
            LearningSession.user_id == user_id,
            LearningSession.ended_at.isnot(None),
        )
        .order_by(LearningSession.ended_at.desc())
        .limit(limit)
        .all()
    )

    # Précharge les titres UA en une seule requête
    cours_ids = list({s.cours_id for s in sessions if s.cours_id})
    uas = {
        str(ua.id): ua.titre
        for ua in db.query(UniteApprentissage)
        .filter(UniteApprentissage.id.in_(cours_ids))
        .all()
    } if cours_ids else {}

    return [
        {
            "id":              str(s.id),
            "cours_id":        s.cours_id,
            "cours_titre":     uas.get(s.cours_id, "Cours inconnu"),
            "started_at":      s.started_at.isoformat() if s.started_at else None,
            "ended_at":        s.ended_at.isoformat()   if s.ended_at   else None,
            "duree_secondes":  s.duree_secondes,
            "score_final":     round(s.score_final * 100)     if s.score_final     is not None else None,
            "score_engagement":round(s.score_engagement * 100) if s.score_engagement is not None else None,
            "etat_affectif":   s.etat_affectif,
            "nb_interactions": s.nb_interactions,
        }
        for s in sessions
    ]


@router.get("/classe")
def get_mastery_classe(db: Session = Depends(get_db)):
    apprenants = db.query(User).filter(User.role == "apprenant").all()

    students_data = []
    for apprenant in apprenants:
        masteries = db.query(BKTMastery).filter(
            BKTMastery.user_id == apprenant.id
        ).all()
        if masteries:
            students_data.append({m.competence: m.p_mastery for m in masteries})

    stats = compute_class_bkt(students_data)
    return {
        "nb_apprenants": len(apprenants),
        "competences":   stats
    }
