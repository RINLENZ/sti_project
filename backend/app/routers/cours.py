from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.cours import (
    Matiere, Module, FamilleSituation,
    UniteApprentissage, RessourcePedagogique,
    Exercice, ProgressionApprenant
)
from ..models.user import User
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
import uuid as uuid_module
from datetime import datetime

router = APIRouter(prefix="/api/cours", tags=["cours"])


@router.get("/matieres")
def get_matieres(db: Session = Depends(get_db)):
    """Retourne toutes les matières actives avec leurs modules."""
    matieres = db.query(Matiere).filter(Matiere.actif == True).all()
    result = []
    for m in matieres:
        modules = db.query(Module).filter(
            Module.matiere_id == m.id,
            Module.actif == True
        ).order_by(Module.ordre).all()
        result.append({
            "id": str(m.id),
            "nom": m.nom,
            "niveau": m.niveau,
            "description": m.description,
            "modules": [{
                "id": str(mod.id),
                "numero": mod.numero,
                "titre": mod.titre,
                "description": mod.description
            } for mod in modules]
        })
    return result


@router.get("/modules/{module_id}/familles")
def get_familles(module_id: UUID, db: Session = Depends(get_db)):
    """Retourne les familles de situations d'un module."""
    familles = db.query(FamilleSituation).filter(
        FamilleSituation.module_id == module_id
    ).order_by(FamilleSituation.ordre).all()

    result = []
    for f in familles:
        uas = db.query(UniteApprentissage).filter(
            UniteApprentissage.famille_id == f.id,
            UniteApprentissage.actif == True
        ).order_by(UniteApprentissage.ordre).all()
        result.append({
            "id": str(f.id),
            "titre": f.titre,
            "description": f.description,
            "unites": [{
                "id": str(ua.id),
                "titre": ua.titre,
                "reference_ue": ua.reference_ue,
                "competences": ua.competences,
                "duree_estimee": ua.duree_estimee,
                "nb_exercices": db.query(Exercice).filter(
                    Exercice.ua_id == ua.id
                ).count()
            } for ua in uas]
        })
    return result


@router.get("/ua/{ua_id}")
def get_ua_detail(ua_id: UUID, db: Session = Depends(get_db)):
    """Retourne le détail complet d'une UA avec ressources et exercices."""
    ua = db.query(UniteApprentissage).filter(
        UniteApprentissage.id == ua_id
    ).first()
    if not ua:
        raise HTTPException(404, "Unité d'apprentissage introuvable")

    ressources = db.query(RessourcePedagogique).filter(
        RessourcePedagogique.ua_id == ua_id
    ).order_by(RessourcePedagogique.ordre).all()

    exercices = db.query(Exercice).filter(
        Exercice.ua_id == ua_id
    ).order_by(Exercice.ordre).all()

    return {
        "id": str(ua.id),
        "titre": ua.titre,
        "reference_ue": ua.reference_ue,
        "competences": ua.competences,
        "situation_probleme": ua.situation_probleme,
        "prerequis": ua.prerequis,
        "duree_estimee": ua.duree_estimee,
        "ressources": [{
            "id": str(r.id),
            "titre": r.titre,
            "type": r.type,
            "contenu": r.contenu,
            "points_cles": r.points_cles,
            "ordre": r.ordre
        } for r in ressources],
        "exercices": [{
            "id": str(e.id),
            "titre": e.titre,
            "type": e.type,
            "enonce": e.enonce,
            "options": e.options,
            "indice_1": e.indice_1,
            "indice_2": e.indice_2,
            "competence_evaluee": e.competence_evaluee,
            "difficulte": e.difficulte,
            "points": e.points,
            "ordre": e.ordre
            # reponse_correcte NON incluse — envoyée seulement après réponse
        } for e in exercices]
    }


class ReponseSubmit(BaseModel):
    exercice_id: UUID
    user_id: UUID
    reponse: str

@router.post("/exercice/verifier")
def verifier_reponse(body: ReponseSubmit, db: Session = Depends(get_db)):
    """Vérifie la réponse d'un apprenant et met à jour sa progression."""
    exercice = db.query(Exercice).filter(
        Exercice.id == body.exercice_id
    ).first()
    if not exercice:
        raise HTTPException(404, "Exercice introuvable")

    correct = body.reponse.strip().lower() == \
              exercice.reponse_correcte.strip().lower()

    # Enregistre ou met à jour la progression
    prog = db.query(ProgressionApprenant).filter(
        ProgressionApprenant.user_id == body.user_id,
        ProgressionApprenant.exercice_id == body.exercice_id
    ).first()

    if prog:
        prog.tentatives += 1
        prog.reponse_donnee = body.reponse
        prog.correct = correct
        if correct:
            prog.statut = "termine"
            prog.score = exercice.points
            prog.date_fin = datetime.utcnow()
    else:
        prog = ProgressionApprenant(
            user_id=body.user_id,
            exercice_id=body.exercice_id,
            ua_id=exercice.ua_id,
            reponse_donnee=body.reponse,
            correct=correct,
            statut="termine" if correct else "en_cours",
            score=exercice.points if correct else 0,
            tentatives=1,
            date_debut=datetime.utcnow(),
            date_fin=datetime.utcnow() if correct else None
        )
        db.add(prog)

    db.commit()

    return {
        "correct": correct,
        "reponse_correcte": exercice.reponse_correcte,
        "explication": exercice.explication,
        "points_gagnes": exercice.points if correct else 0,
        "tentatives": prog.tentatives
    }


@router.get("/progression/{user_id}")
def get_progression(user_id: UUID, db: Session = Depends(get_db)):
    """Retourne la progression globale d'un apprenant."""
    progressions = db.query(ProgressionApprenant).filter(
        ProgressionApprenant.user_id == user_id
    ).all()

    total_exercices = db.query(Exercice).count()
    termines = [p for p in progressions if p.correct == True]
    score_total = sum(p.score for p in termines)

    return {
        "user_id": str(user_id),
        "total_exercices": total_exercices,
        "exercices_reussis": len(termines),
        "score_total": score_total,
        "pourcentage": round(len(termines) / total_exercices * 100)
                       if total_exercices > 0 else 0,
        "details": [{
            "exercice_id": str(p.exercice_id),
            "correct": p.correct,
            "score": p.score,
            "tentatives": p.tentatives
        } for p in progressions]
    }

class SessionCreate(BaseModel):
    user_id: UUID
    ua_id: str

@router.post("/session/creer")
def creer_session(body: SessionCreate, db: Session = Depends(get_db)):
    """Crée une nouvelle session d'apprentissage."""
    from ..models.session import LearningSession
    session = LearningSession(
        user_id=body.user_id,
        cours_id=body.ua_id
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"session_id": str(session.id)}