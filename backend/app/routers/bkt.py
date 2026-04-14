from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID
from ..database import get_db
from ..models.cours import BKTMastery, Exercice
from ..models.user import User
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
