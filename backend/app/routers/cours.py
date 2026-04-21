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
def get_matieres(niveau: str = None, db: Session = Depends(get_db)):
    """
    Retourne toutes les matières.
    Si niveau fourni, filtre par niveau (choisi par l'apprenant).
    Les cours sont universels — visibles par tous.
    """
    query = db.query(Matiere).filter(Matiere.actif == True)
    if niveau:
        query = query.filter(Matiere.description.ilike(f"%{niveau}%"))

    matieres = query.all()
    result = []
    for m in matieres:
        modules = db.query(Module).filter(
            Module.matiere_id == m.id,
            Module.actif      == True
        ).order_by(Module.ordre).all()
        result.append({
            "id":          str(m.id),
            "nom":         m.nom,
            "niveau":      m.description,
            "description": m.description,
            "modules": [{
                "id":          str(mod.id),
                "numero":      mod.numero,
                "titre":       mod.titre,
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

    # ── Mise à jour BKT automatique ──────────────
    from ..models.cours import BKTMastery
    from ..services.bkt_service import update_knowledge, interpret_mastery

    bkt_result = None
    if exercice.competence_evaluee:
        mastery = db.query(BKTMastery).filter(
            BKTMastery.user_id == body.user_id,
            BKTMastery.competence == exercice.competence_evaluee
        ).first()

        if not mastery:
            mastery = BKTMastery(
                user_id=body.user_id,
                competence=exercice.competence_evaluee,
                ua_id=exercice.ua_id,
                p_mastery=0.1,
                nb_tentatives=0,
                nb_correct=0
            )
            db.add(mastery)

        mastery.p_mastery     = update_knowledge(mastery.p_mastery, correct)
        mastery.nb_tentatives += 1
        if correct:
            mastery.nb_correct += 1
        db.commit()

        interp = interpret_mastery(mastery.p_mastery)
        bkt_result = {
            "competence":  exercice.competence_evaluee,
            "p_mastery":   mastery.p_mastery,
            "pourcentage": round(mastery.p_mastery * 100),
            "label":       interp["label"],
            "color":       interp["color"]
        }

    return {
        "correct":          correct,
        "reponse_correcte": exercice.reponse_correcte,
        "explication":      exercice.explication,
        "points_gagnes":    exercice.points if correct else 0,
        "tentatives":       prog.tentatives,
        "bkt":              bkt_result
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

@router.post("/session/clore/{session_id}")
def clore_session(session_id: UUID, db: Session = Depends(get_db)):
    """
    Clôture une session et persiste le score d'engagement final.
    Appelé depuis le frontend quand l'apprenant termine ou quitte.
    """
    import redis as redis_client, json
    from ..models.session import LearningSession
    from ..services.engagement_service import compute_behavioral_score
    from ..config import settings
    from datetime import datetime, timezone

    session = db.query(LearningSession).filter(
        LearningSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(404, "Session introuvable")

    # Récupère les événements depuis Redis
    try:
        redis = redis_client.from_url(settings.redis_url, decode_responses=True)
        cached = redis.get(f"session_events:{session_id}")
        events = json.loads(cached) if cached else []
    except Exception:
        events = []

    # Si pas en cache, charge depuis la base
    if not events:
        from ..models.interaction import Interaction
        db_events = db.query(Interaction).filter(
            Interaction.session_id == session_id
        ).all()
        events = [{"type": e.type, "data": e.data} for e in db_events]

    # Calcule le score final
    result = compute_behavioral_score(events)

    # Met à jour la session
    now = datetime.now(timezone.utc)
    duree = int((now - session.started_at.replace(tzinfo=timezone.utc)).total_seconds()) \
        if session.started_at else None

    session.ended_at       = now
    session.score_engagement = result["score"]
    session.etat_affectif  = result.get("etat_affectif", "neutre")
    session.nb_interactions = len(events)
    session.duree_secondes  = duree
    db.commit()

    return {
        "message":         "Session clôturée",
        "score_engagement": result["score"],
        "level":           result["level"],
        "etat_affectif":   result.get("etat_affectif", "neutre"),
        "duree_secondes":  duree,
        "nb_interactions": len(events),
        "fusion_info":     result.get("fusion_info", ""),
    }

@router.get("/dashboard/enseignant")
def dashboard_enseignant(db: Session = Depends(get_db)):
    """
    Retourne une vue globale pour l'enseignant :
    - Liste des apprenants avec leur score d'engagement actuel
    - Statistiques globales de la classe
    - Exercices les plus difficiles
    """
    from ..models.interaction import Interaction
    from ..models.session import LearningSession
    import json

    # Récupère tous les apprenants
    apprenants = db.query(User).filter(User.role == "apprenant").all()

    result = []
    for apprenant in apprenants:
        # Dernière session de cet apprenant
        derniere_session = db.query(LearningSession).filter(
            LearningSession.user_id == apprenant.id
        ).order_by(LearningSession.started_at.desc()).first()

        # Score d'engagement actuel depuis Redis
        score_actuel = 0.5
        niveau = "modere"
        nb_events = 0

        if derniere_session:
            import redis as redis_lib
            import json as json_lib
            try:
                r = redis_lib.from_url(settings.redis_url, decode_responses=True)
                cache_key = f"session_events:{derniere_session.id}"
                cached = r.get(cache_key)
                if cached:
                    events = json_lib.loads(cached)
                    nb_events = len(events)
                    # Calcule le score depuis les événements
                    from ..models.session import LearningSession
                    res = compute_behavioral_score(events)
                    score_actuel = res["score"]
                    niveau = res["level"]
            except Exception:
                pass

        # Progression de cet apprenant
        progressions = db.query(ProgressionApprenant).filter(
            ProgressionApprenant.user_id == apprenant.id
        ).all()
        exercices_reussis = len([p for p in progressions if p.correct])
        total_exercices   = db.query(Exercice).count()
        score_total       = sum(p.score for p in progressions if p.correct)

        result.append({
            "user_id":    str(apprenant.id),
            "nom":        apprenant.nom,
            "prenom":     apprenant.prenom,
            "email":      apprenant.email,
            "engagement": {
                "score":    score_actuel,
                "niveau":   niveau,
                "nb_events": nb_events,
            },
            "progression": {
                "exercices_reussis": exercices_reussis,
                "total_exercices":   total_exercices,
                "score_total":       score_total,
                "pourcentage":       round(exercices_reussis / total_exercices * 100)
                                     if total_exercices > 0 else 0
            },
            "derniere_session": str(derniere_session.started_at)
                                if derniere_session else None
        })

    # Statistiques globales classe
    tous_scores = [r["engagement"]["score"] for r in result]
    score_moyen = round(sum(tous_scores) / len(tous_scores), 2) if tous_scores else 0
    decrocheurs = [r for r in result if r["engagement"]["score"] < 0.4]

    # Exercices les plus difficiles (plus d'échecs)
    exercices_difficiles = db.query(
        Exercice.titre,
        Exercice.id
    ).all()

    stats_exercices = []
    for ex in exercices_difficiles:
        total_tentatives = db.query(ProgressionApprenant).filter(
            ProgressionApprenant.exercice_id == ex.id
        ).count()
        echecs = db.query(ProgressionApprenant).filter(
            ProgressionApprenant.exercice_id == ex.id,
            ProgressionApprenant.correct == False
        ).count()
        if total_tentatives > 0:
            stats_exercices.append({
                "titre":            ex.titre,
                "total_tentatives": total_tentatives,
                "echecs":           echecs,
                "taux_echec":       round(echecs / total_tentatives * 100)
            })

    stats_exercices.sort(key=lambda x: x["taux_echec"], reverse=True)

    return {
        "apprenants":    result,
        "stats_classe": {
            "nb_apprenants":  len(result),
            "score_moyen":    score_moyen,
            "nb_decrocheurs": len(decrocheurs),
            "niveau_global":  "eleve" if score_moyen >= 0.7
                              else "modere" if score_moyen >= 0.4
                              else "faible"
        },
        "exercices_difficiles": stats_exercices[:3]
    }

@router.get("/ua/recommandee/{user_id}")
def get_ua_recommandee(user_id: UUID, db: Session = Depends(get_db)):
    """
    Recommande la prochaine UA à étudier selon :
    1. Les UA non commencées en priorité
    2. Les UA dont les compétences ont le BKT le plus faible
    3. Respecte l'ordre des UA dans la famille
    """
    from ..models.cours import BKTMastery
    from ..services.bkt_service import interpret_mastery

    # Récupère toutes les UA actives
    uas = db.query(UniteApprentissage).filter(
        UniteApprentissage.actif == True
    ).order_by(UniteApprentissage.ordre).all()

    # Récupère les maîtrises BKT de cet apprenant
    masteries = db.query(BKTMastery).filter(
        BKTMastery.user_id == user_id
    ).all()
    mastery_map = {m.competence: m.p_mastery for m in masteries}

    # Score chaque UA
    scored = []
    for ua in uas:
        competences = ua.competences or []
        if not competences:
            score_bkt = 0.0
        else:
            scores = [mastery_map.get(c, 0.1) for c in competences]
            score_bkt = sum(scores) / len(scores)

        # Vérifie si des exercices ont été faits
        nb_tentatives = db.query(ProgressionApprenant).filter(
            ProgressionApprenant.user_id == user_id,
            ProgressionApprenant.ua_id   == ua.id
        ).count()

        scored.append({
            "ua_id":        str(ua.id),
            "titre":        ua.titre,
            "reference_ue": ua.reference_ue,
            "score_bkt":    round(score_bkt, 3),
            "nb_tentatives": nb_tentatives,
            "priorite":     0 if nb_tentatives == 0 else score_bkt
        })

    # Trie : d'abord les UA non commencées, puis par BKT croissant
    scored.sort(key=lambda x: (1 if x["nb_tentatives"] > 0 else 0, x["score_bkt"]))

    recommandee = scored[0] if scored else None

    return {
        "recommandee": recommandee,
        "toutes":      scored
    }


@router.get("/referentiel/public")
def get_referentiel_public(db: Session = Depends(get_db)):
    """
    Retourne la structure éducative pour l'onboarding apprenant.
    Public — pas d'authentification requise.
    """
    from ..models.referentiel import Cycle, Ordre, Filiere, Niveau
    cycles = db.query(Cycle).filter(Cycle.actif == True).order_by(Cycle.ordre).all()
    result = []
    for cycle in cycles:
        ordres = db.query(Ordre).filter(Ordre.cycle_id == cycle.id, Ordre.actif == True).all()
        niveaux = db.query(Niveau).filter(Niveau.cycle_id == cycle.id, Niveau.actif == True).order_by(Niveau.ordre).all()
        ordres_data = []
        for ordre in ordres:
            filieres = db.query(Filiere).filter(Filiere.ordre_id == ordre.id, Filiere.actif == True).order_by(Filiere.ordre).all()
            ordres_data.append({
                "id": str(ordre.id), "nom": ordre.nom, "code": ordre.code,
                "filieres": [{"id": str(f.id), "nom": f.nom, "code": f.code} for f in filieres]
            })
        result.append({
            "id": str(cycle.id), "nom": cycle.nom, "code": cycle.code,
            "ordres": ordres_data,
            "niveaux": [{"id": str(n.id), "nom": n.nom, "code": n.code} for n in niveaux]
        })
    return result