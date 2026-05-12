from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.cours import (
    Matiere, Module, FamilleSituation,
    UniteApprentissage, RessourcePedagogique,
    Exercice, ProgressionApprenant, BKTMastery
)
from ..models.user import User
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
import uuid as uuid_module
from datetime import datetime
import json

router = APIRouter(prefix="/api/cours", tags=["cours"])


@router.get("/matieres")
def get_matieres(
    niveau_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Retourne les matières avec leurs modules.
    Si niveau_id est fourni, filtre les modules par niveau.
    Utilisé par Dashboard.jsx et Sidebar.jsx
    """
    matieres = db.query(Matiere).filter(Matiere.actif == True).all()
    result = []
 
    for mat in matieres:
        # Filtrage des modules par niveau si spécifié
        query = db.query(Module).filter(
            Module.matiere_id == mat.id,
            Module.actif == True
        )
        if niveau_id:
            try:
                nid = UUID(niveau_id)
                # Modules du niveau OU modules sans niveau (génériques)
                query = query.filter(
                    (Module.niveau_id == nid) | (Module.niveau_id == None)
                )
            except (ValueError, AttributeError):
                pass  # niveau_id invalide → pas de filtre
 
        modules = query.order_by(Module.ordre, Module.numero).all()
 
        modules_data = []
        for mod in modules:
            modules_data.append({
                "id":        str(mod.id),
                "numero":    mod.numero,
                "titre":     mod.titre,
                "niveau_id": str(mod.niveau_id) if mod.niveau_id else None,
            })
 
        result.append({
            "id":      str(mat.id),
            "nom":     mat.nom,
            "code":    mat.code,
            "modules": modules_data,
        })
 
    return result


@router.get("/modules/{module_id}/familles")
def get_familles_par_module(
    module_id: UUID,
    user_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Retourne les familles + UA d'un module.
    Si user_id fourni, calcule le statut de chaque UA (terminé/en cours/verrouillé).
    Applique la logique de prérequis.
    """
    familles = db.query(FamilleSituation).filter(
        FamilleSituation.module_id == module_id
    ).order_by(FamilleSituation.ordre).all()
 
    # Récupère les UAs déjà faites par l'apprenant (si user_id fourni)
    completed_ua_ids = set()
    mastery_scores = {}
    if user_id:
        try:
            uid = UUID(user_id)
            progressions = db.query(ProgressionApprenant).filter(
                ProgressionApprenant.user_id == uid,
                ProgressionApprenant.correct == True
            ).all()
            completed_ua_ids = {str(p.ua_id) for p in progressions}
 
            # Scores BKT par UA (si disponible)
            bkt_records = db.query(BKTMastery).filter(
                BKTMastery.user_id == uid
            ).all()
            mastery_scores = {str(b.competence): b.p_mastery for b in bkt_records}
        except (ValueError, AttributeError):
            pass
 
    result = []
    for i, famille in enumerate(familles):
        uas = db.query(UniteApprentissage).filter(
            UniteApprentissage.famille_id == famille.id,
            UniteApprentissage.actif == True
        ).order_by(UniteApprentissage.ordre).all()
 
        unites_data = []
        for j, ua in enumerate(uas):
            ua_id_str = str(ua.id)
 
            # ── Logique de prérequis ──────────────────────────────
            # UA verrouillée si ses prérequis ne sont pas maîtrisés
            is_locked = False
            if user_id and ua.prerequis:
                # prerequis = liste de titres de compétences
                for prereq in (ua.prerequis or []):
                    score = mastery_scores.get(prereq, 0.0)
                    if score < 0.4:  # seuil BKT minimum
                        is_locked = True
                        break
 
            # Calcul du statut
            nb_ex = db.query(Exercice).filter(Exercice.ua_id == ua.id).count()
            if ua_id_str in completed_ua_ids:
                statut = "done"
            elif is_locked:
                statut = "locked"
            else:
                statut = "available"
 
            unites_data.append({
                "id":                 ua_id_str,
                "titre":              ua.titre,
                "reference_ue":       ua.reference_ue,
                "situation_probleme": ua.situation_probleme,
                "competences":        ua.competences or [],
                "prerequis":          ua.prerequis or [],
                "duree_estimee":      ua.duree_estimee,
                "nb_exercices":       nb_ex,
                "statut":             statut,
                "is_locked":          is_locked,
            })
 
        result.append({
            "id":     str(famille.id),
            "titre":  famille.titre,
            "unites": unites_data,
        })
 
    return result


@router.get("/programme/{niveau_id}")
def get_programme_par_niveau(
    niveau_id: UUID,
    user_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Point d'entrée principal du Dashboard.
    Retourne Matières → Modules (filtrés par niveau) → Familles → UAs
    avec statuts de progression si user_id fourni.
    """
    # Modules de ce niveau (ou génériques)
    modules = db.query(Module).filter(
        Module.actif == True,
        (Module.niveau_id == niveau_id) | (Module.niveau_id == None)
    ).order_by(Module.ordre, Module.numero).all()
 
    if not modules:
        return []
 
    # Grouper par matière
    matieres_map = {}
    for mod in modules:
        mat = db.query(Matiere).filter(Matiere.id == mod.matiere_id).first()
        if not mat or not mat.actif:
            continue
        mat_id = str(mat.id)
        if mat_id not in matieres_map:
            matieres_map[mat_id] = {"id": mat_id, "nom": mat.nom, "code": mat.code, "modules": []}
        matieres_map[mat_id]["modules"].append(mod)
 
    # Récupère progression si user_id
    completed_ua_ids = set()
    mastery_scores = {}
    if user_id:
        try:
            uid = UUID(user_id)
            progressions = db.query(ProgressionApprenant).filter(
                ProgressionApprenant.user_id == uid,
                ProgressionApprenant.correct == True
            ).all()
            completed_ua_ids = {str(p.ua_id) for p in progressions}
            bkt_records = db.query(BKTMastery).filter(BKTMastery.user_id == uid).all()
            mastery_scores = {str(b.competence): b.p_mastery for b in bkt_records}
        except (ValueError, AttributeError):
            pass
 
    result = []
    for mat_id, mat_data in matieres_map.items():
        modules_result = []
        for mod in mat_data["modules"]:
            familles = db.query(FamilleSituation).filter(
                FamilleSituation.module_id == mod.id
            ).order_by(FamilleSituation.ordre).all()
 
            familles_result = []
            for fam in familles:
                uas = db.query(UniteApprentissage).filter(
                    UniteApprentissage.famille_id == fam.id,
                    UniteApprentissage.actif == True
                ).order_by(UniteApprentissage.ordre).all()
 
                unites_result = []
                for ua in uas:
                    ua_id_str = str(ua.id)
                    nb_ex = db.query(Exercice).filter(Exercice.ua_id == ua.id).count()
 
                    # Prérequis check
                    is_locked = False
                    if user_id and ua.prerequis:
                        for prereq in (ua.prerequis or []):
                            if mastery_scores.get(prereq, 0.0) < 0.4:
                                is_locked = True
                                break
 
                    statut = "done" if ua_id_str in completed_ua_ids else ("locked" if is_locked else "available")
 
                    unites_result.append({
                        "id":            ua_id_str,
                        "titre":         ua.titre,
                        "reference_ue":  ua.reference_ue,
                        "competences":   ua.competences or [],
                        "duree_estimee": ua.duree_estimee,
                        "nb_exercices":  nb_ex,
                        "statut":        statut,
                        "is_locked":     is_locked,
                    })
 
                familles_result.append({
                    "id":     str(fam.id),
                    "titre":  fam.titre,
                    "unites": unites_result,
                })
 
            modules_result.append({
                "id":       str(mod.id),
                "numero":   mod.numero,
                "titre":    mod.titre,
                "familles": familles_result,
            })
 
        result.append({
            "id":      mat_data["id"],
            "nom":     mat_data["nom"],
            "modules": modules_result,
        })
 
    return result


@router.get("/ua/{ua_id}")
def get_ua_detail(ua_id: UUID, db: Session = Depends(get_db), user_id: Optional[str] = None):
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

    # Score BKT moyen sur les compétences de l'UA (pour recommandation de niveau)
    bkt_score = None
    if user_id:
        try:
            uid = UUID(user_id)
            competences = ua.competences or []
            if competences:
                bkt_records = db.query(BKTMastery).filter(
                    BKTMastery.user_id == uid,
                    BKTMastery.competence.in_(competences)
                ).all()
                bkt_score = round(sum(b.p_mastery for b in bkt_records) / len(bkt_records), 3) if bkt_records else 0.1
        except Exception:
            pass

    return {
        "id": str(ua.id),
        "titre": ua.titre,
        "reference_ue": ua.reference_ue,
        "competences": ua.competences,
        "situation_probleme": ua.situation_probleme,
        "prerequis": ua.prerequis,
        "duree_estimee": ua.duree_estimee,
        "bkt_score": bkt_score,
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
            "ordre": e.ordre,
            "groupe": e.groupe,
            "groupe_titre": e.groupe_titre,
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

    try:
        submitted = json.loads(body.reponse)
    except (json.JSONDecodeError, TypeError):
        submitted = body.reponse

    try:
        expected = json.loads(exercice.reponse_correcte)
    except (json.JSONDecodeError, TypeError):
        expected = exercice.reponse_correcte

    if isinstance(submitted, list) and isinstance(expected, list):
        correct = (len(submitted) == len(expected) and all(
            str(u).strip().lower() == str(c).strip().lower()
            for u, c in zip(submitted, expected)
        ))
    elif isinstance(submitted, list) and isinstance(expected, str):
        # Réponses soumises sous forme JSON array, reponse_correcte est une chaîne
        # Essayer de découper par séparateur courant
        parts = None
        for sep in ['|', ',', ';']:
            if sep in expected:
                parts = [p.strip() for p in expected.split(sep)]
                break
        if parts and len(parts) == len(submitted):
            correct = all(
                str(u).strip().lower() == str(c).strip().lower()
                for u, c in zip(submitted, parts)
            )
        elif len(submitted) == 1:
            correct = str(submitted[0]).strip().lower() == expected.strip().lower()
        else:
            correct = False
    else:
        correct = str(submitted).strip().lower() == str(expected).strip().lower()

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

        p_avant = mastery.p_mastery  # valeur avant mise à jour (déjà écrasée — on lit après commit)
        interp = interpret_mastery(mastery.p_mastery)
        bkt_result = {
            "competence":  exercice.competence_evaluee,
            "p_mastery":   mastery.p_mastery,
            "pourcentage": round(mastery.p_mastery * 100),
            "label":       interp["label"],
            "color":       interp["color"]
        }

        # ── Notifications BKT ──────────────────────────────────────
        try:
            from ..services.notification_service import (
                notif_badge, notif_competence_maitrisee, notif_competence_progres
            )
            p_new  = mastery.p_mastery
            p_old  = round(p_avant - (p_new - p_avant), 4)   # approximation avant update
            pct    = round(p_new * 100)
            pct_old = round(p_old * 100) if p_old >= 0 else 0

            # Paliers de maîtrise (notif une seule fois par franchissement)
            if pct >= 95 and pct_old < 95:
                notif_competence_maitrisee(db, body.user_id, exercice.competence_evaluee)
            elif pct >= 70 and pct_old < 70:
                notif_competence_progres(db, body.user_id, exercice.competence_evaluee, 70)
            elif pct >= 40 and pct_old < 40:
                notif_competence_progres(db, body.user_id, exercice.competence_evaluee, 40)

            # Badges basés sur nb_tentatives
            BADGE_TENTATIVES = {1: "premier_pas", 10: "studieux", 50: "assidu", 100: "expert"}
            for seuil, badge_id in BADGE_TENTATIVES.items():
                if mastery.nb_tentatives == seuil:
                    notif_badge(db, body.user_id, badge_id)

            # Badges basés sur nb_maitrisees (toutes compétences confondues)
            from ..models.cours import BKTMastery as _BKT
            nb_maitrisees = db.query(_BKT).filter(
                _BKT.user_id == body.user_id,
                _BKT.p_mastery >= 0.8
            ).count()
            BADGE_MAITRISE = {1: "premiere_maitrise", 5: "multi_maitre"}
            for seuil, badge_id in BADGE_MAITRISE.items():
                if nb_maitrisees == seuil:
                    notif_badge(db, body.user_id, badge_id)
        except Exception:
            pass  # les notifications ne doivent jamais bloquer la réponse

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

    session.ended_at        = now
    session.score_engagement = result["score"]
    session.etat_affectif   = result.get("etat_affectif", "neutre")
    session.nb_interactions  = len(events)
    session.duree_secondes   = duree
    db.commit()

    # ── Notifications post-session ─────────────────────────────────
    try:
        from ..services.notification_service import (
            notif_session_terminee, notif_apprenant_session, notif_apprenant_decrocheur,
            notif_badge
        )
        from ..models.cours import BKTMastery, UniteApprentissage
        from ..models.user import TuteurSuivi

        # Récupère le titre du cours
        ua = db.query(UniteApprentissage).filter(
            UniteApprentissage.id == session.cours_id
        ).first()
        cours_titre = ua.titre if ua else "Cours"

        # Score final exercices
        score_pct = round((session.score_final or 0) * 100)
        duree_min = round((duree or 0) / 60)

        # Notif résumé pour l'apprenant
        notif_session_terminee(db, session.user_id, cours_titre, score_pct, duree_min)

        # Badges sessions
        from ..models.session import LearningSession as LS
        nb_sessions = db.query(LS).filter(
            LS.user_id == session.user_id,
            LS.ended_at.isnot(None)
        ).count()
        BADGE_SESSIONS = {5: "regulier", 20: "perseverant"}
        for seuil, badge_id in BADGE_SESSIONS.items():
            if nb_sessions == seuil:
                notif_badge(db, session.user_id, badge_id)

        # Notifs pour les enseignants qui suivent cet apprenant
        liens = db.query(TuteurSuivi).filter(
            TuteurSuivi.apprenant_id == session.user_id,
            TuteurSuivi.actif == True
        ).all()
        for lien in liens:
            notif_apprenant_session(db, lien.tuteur_id, "", cours_titre, score_pct)
            engagement_pct = round((result["score"] or 0) * 100)
            if engagement_pct < 30:
                apprenant = db.query(User).filter(User.id == session.user_id).first()
                nom = f"{apprenant.prenom} {apprenant.nom}" if apprenant else "Un apprenant"
                notif_apprenant_decrocheur(db, lien.tuteur_id, nom, engagement_pct)
    except Exception:
        pass

    return {
        "message":          "Session clôturée",
        "score_engagement": result["score"],
        "level":            result["level"],
        "etat_affectif":    result.get("etat_affectif", "neutre"),
        "duree_secondes":   duree,
        "nb_interactions":  len(events),
        "fusion_info":      result.get("fusion_info", ""),
    }

@router.get("/dashboard/enseignant")
def dashboard_enseignant(enseignant_id: UUID, db: Session = Depends(get_db)):
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
    from ..models.user import TuteurSuivi
    liens = db.query(TuteurSuivi).filter(
        TuteurSuivi.tuteur_id == enseignant_id,
        TuteurSuivi.actif     == True
    ).all()
    apprenant_ids = [l.apprenant_id for l in liens]
    if not apprenant_ids:
        return {
            "apprenants": [],
            "stats_classe": {"nb_apprenants":0,"score_moyen":0,"nb_decrocheurs":0,"niveau_global":"aucun"},
            "exercices_difficiles": []
        }
    apprenants = db.query(User).filter(
        User.id.in_(apprenant_ids),
        User.role == "apprenant"
    ).all()

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
            "user_id":      str(apprenant.id),
            "nom":          apprenant.nom,
            "prenom":       apprenant.prenom,
            "email":        apprenant.email,
            "niveau":       apprenant.niveau_label,
            "filiere_label": apprenant.filiere_label,
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


# ════════════════════════════════════════════════════════════════
# AJOUTE CES ENDPOINTS À LA FIN DE cours.py
# Les imports Matiere, UniteApprentissage, Exercice, FamilleSituation
# sont déjà présents en haut de cours.py
# ════════════════════════════════════════════════════════════════

# ── CRUD Matières ────────────────────────────────────────────────

@router.post("/matieres")
def create_matiere(body: dict, db: Session = Depends(get_db)):
    mat = Matiere(
        nom=body["nom"],
        code=body.get("code", ""),
        description=body.get("description", ""),
    )
    db.add(mat); db.commit(); db.refresh(mat)
    return {"id": str(mat.id), "nom": mat.nom, "code": mat.code}

@router.put("/matieres/{matiere_id}")
def update_matiere(matiere_id: UUID, body: dict, db: Session = Depends(get_db)):
    mat = db.query(Matiere).filter(Matiere.id == matiere_id).first()
    if not mat: raise HTTPException(404, "Matière introuvable")
    for k in ["nom", "code", "description"]:
        if k in body: setattr(mat, k, body[k])
    db.commit()
    return {"message": "Matière mise à jour"}

@router.delete("/matieres/{matiere_id}")
def delete_matiere(matiere_id: UUID, db: Session = Depends(get_db)):
    mat = db.query(Matiere).filter(Matiere.id == matiere_id).first()
    if not mat: raise HTTPException(404, "Matière introuvable")
    mat.actif = False; db.commit()
    return {"message": "Matière désactivée"}


# ── CRUD Unités d'apprentissage ──────────────────────────────────
# Note: UniteApprentissage n'a pas de colonne "statut" ni "difficulte"
# Ces champs sont ignorés à la sauvegarde

@router.post("/ua")
def create_ua(body: dict, db: Session = Depends(get_db)):
    ua = UniteApprentissage(
        titre=body["titre"],
        reference_ue=body.get("reference_ue", ""),
        situation_probleme=body.get("situation_probleme", ""),
        duree_estimee=int(body.get("duree_estimee", 60)),
        competences=body.get("competences", []),
        prerequis=body.get("prerequis", []),
        famille_id=UUID(body["famille_id"]) if body.get("famille_id") else None,
    )
    db.add(ua); db.commit(); db.refresh(ua)
    return {"id": str(ua.id), "titre": ua.titre}

@router.put("/ua/{ua_id}")
def update_ua(ua_id: UUID, body: dict, db: Session = Depends(get_db)):
    ua = db.query(UniteApprentissage).filter(UniteApprentissage.id == ua_id).first()
    if not ua: raise HTTPException(404, "UA introuvable")
    for k in ["titre", "reference_ue", "description", "situation_probleme",
              "duree_estimee", "competences", "prerequis"]:
        if k in body: setattr(ua, k, body[k])
    if "famille_id" in body and body["famille_id"]:
        ua.famille_id = UUID(body["famille_id"])
    db.commit()
    return {"message": "UA mise à jour"}

@router.delete("/ua/{ua_id}")
def delete_ua(ua_id: UUID, db: Session = Depends(get_db)):
    ua = db.query(UniteApprentissage).filter(UniteApprentissage.id == ua_id).first()
    if not ua: raise HTTPException(404, "UA introuvable")
    ua.actif = False; db.commit()
    return {"message": "UA désactivée"}


# ── CRUD Exercices ───────────────────────────────────────────────
# Note: Exercice n'a pas de colonne "actif" ni "statut"

@router.get("/exercices")
def list_exercices(db: Session = Depends(get_db)):
    """Liste tous les exercices pour AdminCours."""
    exercices = db.query(Exercice).all()
    result = []
    for ex in exercices:
        result.append({
            "id":                 str(ex.id),
            "titre":              ex.titre,
            "type":               ex.type,
            "enonce":             ex.enonce,
            "options":            ex.options or [],
            "reponse_correcte":   ex.reponse_correcte,
            "explication":        ex.explication,
            "indice_1":           ex.indice_1,
            "indice_2":           ex.indice_2,
            "competence_evaluee": ex.competence_evaluee,
            "difficulte":         ex.difficulte,
            "points":             ex.points,
            "groupe":             ex.groupe,
            "groupe_titre":       ex.groupe_titre,
            "statut":             "publié",
            "ua_id":              str(ex.ua_id) if ex.ua_id else None,
        })
    return result

@router.post("/exercices")
def create_exercice(body: dict, db: Session = Depends(get_db)):
    ex = Exercice(
        titre=body.get("titre", ""),
        type=body.get("type", "qcm"),
        enonce=body["enonce"],
        options=body.get("options"),
        reponse_correcte=body.get("reponse_correcte", ""),
        explication=body.get("explication", ""),
        indice_1=body.get("indice_1", ""),
        indice_2=body.get("indice_2", ""),
        competence_evaluee=body.get("competence_evaluee", ""),
        difficulte=int(body.get("difficulte", 1)),
        points=int(body.get("points", 10)),
        groupe=int(body["groupe"]) if body.get("groupe") is not None else None,
        groupe_titre=body.get("groupe_titre") or None,
        ua_id=UUID(body["ua_id"]) if body.get("ua_id") else None,
    )
    db.add(ex); db.commit(); db.refresh(ex)
    return {"id": str(ex.id), "titre": ex.titre}

@router.put("/exercices/{exercice_id}")
def update_exercice(exercice_id: UUID, body: dict, db: Session = Depends(get_db)):
    ex = db.query(Exercice).filter(Exercice.id == exercice_id).first()
    if not ex: raise HTTPException(404, "Exercice introuvable")
    for k in ["titre", "type", "enonce", "options", "reponse_correcte",
              "explication", "indice_1", "indice_2", "competence_evaluee",
              "difficulte", "points"]:
        if k in body: setattr(ex, k, body[k])
    if "groupe" in body:
        ex.groupe = int(body["groupe"]) if body["groupe"] is not None else None
    if "groupe_titre" in body:
        ex.groupe_titre = body["groupe_titre"] or None
    if "ua_id" in body and body["ua_id"]:
        ex.ua_id = UUID(body["ua_id"])
    db.commit()
    return {"message": "Exercice mis à jour"}

@router.delete("/exercices/{exercice_id}")
def delete_exercice(exercice_id: UUID, db: Session = Depends(get_db)):
    ex = db.query(Exercice).filter(Exercice.id == exercice_id).first()
    if not ex: raise HTTPException(404, "Exercice introuvable")
    # Exercice n'a pas de colonne actif — on supprime vraiment
    db.delete(ex); db.commit()


@router.get("/sessions/historique/{user_id}")
def get_sessions_historique(user_id: UUID, limit: int = 20, db: Session = Depends(get_db)):
    """
    Retourne l'historique des sessions d'apprentissage d'un apprenant,
    utilisé pour tracer la courbe d'engagement dans le dashboard enseignant.
    """
    from ..models.session import LearningSession
    sessions = (
        db.query(LearningSession)
        .filter(
            LearningSession.user_id == user_id,
            LearningSession.ended_at.isnot(None),
        )
        .order_by(LearningSession.started_at.asc())
        .limit(limit)
        .all()
    )
    return [
        {
            "date":             s.started_at.strftime("%d/%m") if s.started_at else "",
            "engagement":       round((s.score_engagement or 0) * 100),
            "score_exercices":  round((s.score_final or 0) * 100),
            "duree_min":        round((s.duree_secondes or 0) / 60, 1),
            "etat":             s.etat_affectif or "neutre",
        }
        for s in sessions
    ]
    return {"message": "Exercice supprimé"}