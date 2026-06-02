from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..dependencies import get_current_user, get_optional_user, require_enseignant, require_super_admin
from ..utils import get_kcs
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
import unicodedata
import sqlalchemy as sa
import redis as redis_lib
from ..config import settings

router = APIRouter(prefix="/api/cours", tags=["cours"])


def _normaliser(texte: str) -> str:
    """Normalise un texte pour comparaison tolérante : minuscules, sans accents, sans espaces superflus."""
    t = str(texte).strip().lower()
    t = unicodedata.normalize("NFD", t)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return t


def _comparer_reponse(submitted, expected) -> bool:
    """Compare réponse soumise et attendue avec tolérance (accents, casse, alternatives |)."""
    # Cas listes (multi-trous)
    if isinstance(submitted, list) and isinstance(expected, list):
        return len(submitted) == len(expected) and all(
            _normaliser(u) == _normaliser(c) for u, c in zip(submitted, expected)
        )
    if isinstance(submitted, list) and isinstance(expected, str):
        # reponse_correcte peut être "mot1|mot2" ou une seule valeur
        parts = None
        for sep in ['|', ',', ';']:
            if sep in expected:
                parts = [p.strip() for p in expected.split(sep)]
                break
        if parts and len(parts) == len(submitted):
            return all(_normaliser(u) == _normaliser(c) for u, c in zip(submitted, parts))
        if len(submitted) == 1:
            return _normaliser(submitted[0]) == _normaliser(expected)
        return False
    # Cas simple — vérifie aussi les alternatives séparées par |
    s = _normaliser(submitted)
    alternatives = [_normaliser(a.strip()) for a in str(expected).split('|')]
    return s in alternatives

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
 
    # Load all UAs for this module's familles in one query, then pre-load ex counts
    fam_ids = [fam.id for fam in familles]
    all_uas = db.query(UniteApprentissage).filter(
        UniteApprentissage.famille_id.in_(fam_ids),
        UniteApprentissage.actif == True,
    ).order_by(UniteApprentissage.famille_id, UniteApprentissage.ordre).all()

    ex_counts_raw = db.query(Exercice.ua_id, sa.func.count(Exercice.id)).filter(
        Exercice.ua_id.in_([ua.id for ua in all_uas])
    ).group_by(Exercice.ua_id).all() if all_uas else []
    ex_counts = {str(uid): cnt for uid, cnt in ex_counts_raw}

    uas_by_fam = {}
    for ua in all_uas:
        uas_by_fam.setdefault(str(ua.famille_id), []).append(ua)

    result = []
    for i, famille in enumerate(familles):
        uas = uas_by_fam.get(str(famille.id), [])

        unites_data = []
        for j, ua in enumerate(uas):
            ua_id_str = str(ua.id)

            is_locked = False
            if user_id and ua.prerequis:
                for prereq in (ua.prerequis or []):
                    score = mastery_scores.get(prereq, 0.0)
                    if score < 0.4:
                        is_locked = True
                        break

            nb_ex = ex_counts.get(ua_id_str, 0)
            if ua_id_str in completed_ua_ids:
                statut = "done"
            elif is_locked:
                statut = "locked"
            else:
                statut = "available"

            ua_bkt = None
            if user_id and ua.competences:
                scores = [mastery_scores.get(c, 0.0) for c in ua.competences]
                ua_bkt = round(sum(scores) / len(scores), 3) if scores else 0.0

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
                "bkt_score":          ua_bkt,
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
    # Cache Redis pour le curriculum pur (sans progression utilisateur)
    _cache_key = f"programme:{niveau_id}"
    _r = None
    if not user_id:
        try:
            _r = redis_lib.from_url(settings.redis_url, decode_responses=True)
            _cached = _r.get(_cache_key)
            if _cached:
                return json.loads(_cached)
        except Exception:
            _r = None

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
 
    # Pré-charger le nb d'exercices par UA en une seule requête (évite N+1)
    mod_ids = [mod.id for mat_data in matieres_map.values() for mod in mat_data["modules"]]
    fam_ids_all = [f.id for f in db.query(FamilleSituation.id).filter(FamilleSituation.module_id.in_(mod_ids)).all()]
    ex_counts_raw = db.query(Exercice.ua_id, sa.func.count(Exercice.id)).filter(
        Exercice.ua_id.isnot(None)
    ).group_by(Exercice.ua_id).all()
    ex_counts = {str(ua_id): cnt for ua_id, cnt in ex_counts_raw}

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
                    nb_ex = ex_counts.get(ua_id_str, 0)
 
                    # Prérequis check
                    is_locked = False
                    if user_id and ua.prerequis:
                        for prereq in (ua.prerequis or []):
                            if mastery_scores.get(prereq, 0.0) < 0.4:
                                is_locked = True
                                break
 
                    statut = "done" if ua_id_str in completed_ua_ids else ("locked" if is_locked else "available")

                    # BKT moyen sur les compétences de l'UA
                    ua_bkt = None
                    if user_id and ua.competences:
                        scores = [mastery_scores.get(c, 0.0) for c in ua.competences]
                        ua_bkt = round(sum(scores) / len(scores), 3) if scores else 0.0

                    unites_result.append({
                        "id":            ua_id_str,
                        "titre":         ua.titre,
                        "reference_ue":  ua.reference_ue,
                        "competences":   ua.competences or [],
                        "duree_estimee": ua.duree_estimee,
                        "nb_exercices":  nb_ex,
                        "statut":        statut,
                        "is_locked":     is_locked,
                        "bkt_score":     ua_bkt,
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

    if _r is not None:
        try:
            _r.setex(_cache_key, 300, json.dumps(result))
        except Exception:
            pass

    return result


@router.get("/ua/{ua_id}")
def get_ua_detail(
    ua_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
):
    """Retourne le détail complet d'une UA avec ressources et exercices.
    Le score BKT et les exercices déjà réussis sont inclus si l'utilisateur
    est authentifié (token JWT — aucun query param user_id accepté).
    """
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

    # Score BKT + exercices réussis — depuis le JWT, jamais depuis un query param
    bkt_score = None
    completed_exercise_ids: list[str] = []
    if current_user:
        uid = current_user.id
        competences = ua.competences or []
        if competences:
            bkt_records = db.query(BKTMastery).filter(
                BKTMastery.user_id == uid,
                BKTMastery.competence.in_(competences),
            ).all()
            if bkt_records:
                bkt_score = round(
                    sum(b.p_mastery for b in bkt_records) / len(bkt_records), 3
                )
        ex_ids = [e.id for e in exercices]
        if ex_ids:
            completed_exercise_ids = [
                str(p.exercice_id)
                for p in db.query(ProgressionApprenant).filter(
                    ProgressionApprenant.user_id == uid,
                    ProgressionApprenant.exercice_id.in_(ex_ids),
                    ProgressionApprenant.correct == True,
                ).all()
            ]

    return {
        "id": str(ua.id),
        "titre": ua.titre,
        "reference_ue": ua.reference_ue,
        "competences": ua.competences,
        "situation_probleme": ua.situation_probleme,
        "prerequis": ua.prerequis,
        "duree_estimee": ua.duree_estimee,
        "bkt_score": bkt_score,
        "completed_exercise_ids": completed_exercise_ids,
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
            "kcs": get_kcs(e),
            "primary_kc": get_kcs(e)[0] if get_kcs(e) else None,
            "difficulte": e.difficulte,
            "points": e.points,
            "ordre": e.ordre,
            "groupe": e.groupe,
            "groupe_titre": e.groupe_titre,
            # reponse_correcte NON incluse — envoyée seulement après réponse
        } for e in exercices]
    }


@router.get("/ua/{ua_id}/ressource-aide")
def get_ressource_aide(
    ua_id: UUID,
    competence: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Retourne un extrait de la ressource la plus pertinente pour aider
    un apprenant en difficulté (BKT < 0.4) sur une compétence donnée.
    """
    ressources = (
        db.query(RessourcePedagogique)
        .filter(RessourcePedagogique.ua_id == ua_id)
        .order_by(RessourcePedagogique.ordre)
        .all()
    )
    if not ressources:
        raise HTTPException(404, "Aucune ressource disponible")

    # Si une compétence est précisée, préfère la ressource dont le titre ou les
    # points_clés contiennent un terme commun avec la compétence.
    best = ressources[0]
    if competence:
        comp_words = set(competence.lower().split())
        def relevance(r):
            text = (r.titre + " " + " ".join(r.points_cles or [])).lower()
            return sum(1 for w in comp_words if w in text)
        candidates = sorted(ressources, key=relevance, reverse=True)
        best = candidates[0]

    # Extrait : 600 premiers caractères du contenu textuel
    extrait = (best.contenu or "")[:600]
    if len(best.contenu or "") > 600:
        extrait += "…"

    return {
        "id":         str(best.id),
        "titre":      best.titre,
        "type":       best.type,
        "extrait":    extrait,
        "points_cles": best.points_cles or [],
    }


class ReponseSubmit(BaseModel):
    exercice_id: UUID
    user_id: UUID
    reponse: str
    session_id: Optional[UUID] = None   # session active → jointure directe engagement DKT

@router.post("/exercice/verifier")
def verifier_reponse(body: ReponseSubmit, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if str(current_user.id) != str(body.user_id) and current_user.role not in ("enseignant", "super_admin"):
        raise HTTPException(403, "Accès non autorisé")
    """Vérifie la réponse d'un apprenant et met à jour sa progression."""
    exercice = db.query(Exercice).filter(
        Exercice.id == body.exercice_id
    ).first()
    if not exercice:
        raise HTTPException(404, "Exercice introuvable")

    # ── Réponse libre → soumission en attente de correction enseignant ────────
    if exercice.type == "reponse_libre":
        reponse_text = str(body.reponse).strip()
        if len(reponse_text) < 10:
            raise HTTPException(400, "La réponse est trop courte.")

        prog = db.query(ProgressionApprenant).filter(
            ProgressionApprenant.user_id == body.user_id,
            ProgressionApprenant.exercice_id == body.exercice_id
        ).first()
        if prog:
            prog.tentatives     += 1
            prog.reponse_donnee  = body.reponse
            prog.correct         = None
            prog.statut          = "en_attente_correction"
            prog.score           = 0
            if body.session_id and not prog.session_id:
                prog.session_id  = body.session_id
        else:
            prog = ProgressionApprenant(
                user_id=body.user_id,
                exercice_id=body.exercice_id,
                ua_id=exercice.ua_id,
                session_id=body.session_id,
                reponse_donnee=body.reponse,
                correct=None,
                statut="en_attente_correction",
                score=0,
                tentatives=1,
                date_debut=datetime.utcnow(),
            )
            db.add(prog)
        db.commit()

        return {
            "correct":           None,
            "en_attente":        True,
            "reponse_correcte":  exercice.reponse_correcte,
            "explication":       exercice.explication,
            "points_gagnes":     0,
            "tentatives":        prog.tentatives,
            "bkt":               None,
            "msg":               "Réponse soumise — l'enseignant va l'évaluer et t'attribuer les points."
        }

    # ── Comparaison avec tolérance (accents, casse, alternatives |) ──────────
    try:
        submitted = json.loads(body.reponse)
    except (json.JSONDecodeError, TypeError):
        submitted = body.reponse

    try:
        expected = json.loads(exercice.reponse_correcte)
    except (json.JSONDecodeError, TypeError):
        expected = exercice.reponse_correcte

    correct = _comparer_reponse(submitted, expected)

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
        if body.session_id and not prog.session_id:
            prog.session_id = body.session_id
    else:
        prog = ProgressionApprenant(
            user_id=body.user_id,
            exercice_id=body.exercice_id,
            ua_id=exercice.ua_id,
            session_id=body.session_id,
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
    primary_kc = get_kcs(exercice)[0] if get_kcs(exercice) else None
    if primary_kc:
        # Solution B : BKT classique sur le KC principal uniquement.
        # Les KCs secondaires (kcs[1:]) sont loggés pour le DKT mais ignorés par BKT.
        mastery = db.query(BKTMastery).filter(
            BKTMastery.user_id == body.user_id,
            BKTMastery.competence == primary_kc
        ).first()

        if not mastery:
            mastery = BKTMastery(
                user_id=body.user_id,
                competence=primary_kc,
                ua_id=exercice.ua_id,
                p_mastery=0.1,
                nb_tentatives=0,
                nb_correct=0
            )
            db.add(mastery)

        p_avant = mastery.p_mastery   # capture AVANT la mise à jour pour la détection de seuil
        mastery.p_mastery     = update_knowledge(mastery.p_mastery, correct)
        mastery.nb_tentatives += 1
        if correct:
            mastery.nb_correct += 1
        db.commit()
        interp = interpret_mastery(mastery.p_mastery)
        bkt_result = {
            "competence":  primary_kc,
            "all_kcs":     get_kcs(exercice),
            "p_mastery":   mastery.p_mastery,
            "pourcentage": round(mastery.p_mastery * 100),
            "label":       interp["label"],
            "color":       interp["color"],
            "niveau":      interp["niveau"],
        }

        try:
            from ..services.notification_service import (
                notif_badge, notif_competence_maitrisee, notif_competence_progres
            )
            p_new   = mastery.p_mastery
            p_old   = round(p_avant - (p_new - p_avant), 4)
            pct     = round(p_new * 100)
            pct_old = round(p_old * 100) if p_old >= 0 else 0

            if pct >= 95 and pct_old < 95:
                notif_competence_maitrisee(db, body.user_id, primary_kc)
            elif pct >= 70 and pct_old < 70:
                notif_competence_progres(db, body.user_id, primary_kc, 70)
            elif pct >= 40 and pct_old < 40:
                notif_competence_progres(db, body.user_id, primary_kc, 40)

            BADGE_TENTATIVES = {1: "premier_pas", 10: "studieux", 50: "assidu", 100: "expert"}
            for seuil, badge_id in BADGE_TENTATIVES.items():
                if mastery.nb_tentatives == seuil:
                    notif_badge(db, body.user_id, badge_id)

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
            # Un commit de notification a peut-être mis la transaction PostgreSQL en état
            # ABORTED (contrainte FK, timeout réseau, etc.).
            # Sans rollback ici, toutes les requêtes suivantes échouent silencieusement.
            try:
                db.rollback()
            except Exception:
                pass

    # ── Engagement per-exercice — granularité temporelle pour DKT-E ─────────────
    # Fenêtre = interactions DB entre le dernier event "response" de la session
    # (exercice précédent) et maintenant.
    #
    # Pourquoi DB-only et pas Redis :
    #   Le frontend logue POST /api/interaction type='response' APRÈS verifier_reponse.
    #   → Au moment du calcul, le response courant n'est pas encore en DB. ✓
    #   → Le response de l'exercice précédent y est depuis l'exercice précédent. ✓
    #
    # sleep(0.3) : garde contre la race condition où l'exercice précédent serait
    # soumis très rapidement avant que son response event atteigne la DB.
    if body.session_id:
        try:
            import time as _time, logging as _log
            from datetime import timezone
            from sqlalchemy import text as _text, desc as _desc
            from ..models.interaction import Interaction as _Inter
            from ..models.session import LearningSession as _LS
            from ..services.engagement_service import compute_behavioral_score as _eng

            # Capture prog_id avant tout accès (expire_on_commit peut décharger l'objet)
            _prog_id = str(prog.id)
            _logger  = _log.getLogger(__name__)

            # Garantit une transaction propre quelle que soit l'histoire précédente.
            # PgBouncer transaction-mode : si un commit de notification a levé une
            # IntegrityError, PostgreSQL garde la connexion en état ABORTED jusqu'au ROLLBACK.
            try:
                db.rollback()
                _logger.debug("engagement rollback OK session=%s", str(body.session_id)[:8])
            except Exception as _rb_e:
                _logger.warning("engagement rollback failed : %s", _rb_e)

            # Laisse le response précédent atteindre la DB (délai réseau frontend → DB)
            _time.sleep(0.3)

            # Début de la fenêtre = timestamp du dernier response de CETTE session
            _logger.debug("engagement querying last_response session=%s", str(body.session_id)[:8])
            _last = (
                db.query(_Inter)
                .filter(_Inter.session_id == body.session_id, _Inter.type == 'response')
                .order_by(_desc(_Inter.timestamp))
                .first()
            )

            if _last:
                _win_start = _last.timestamp
            else:
                # Premier exercice : depuis le début de la session
                _s = db.query(_LS).filter(_LS.id == body.session_id).first()
                _win_start = _s.started_at if _s else None

            if _win_start and _prog_id:
                _win_end = datetime.now(timezone.utc)

                _events_db = (
                    db.query(_Inter)
                    .filter(
                        _Inter.session_id == body.session_id,
                        _Inter.timestamp > _win_start,
                    )
                    .order_by(_Inter.timestamp)
                    .all()
                )
                _window = [{"type": e.type, "data": e.data or {}} for e in _events_db]
                _win_sec = round((_win_end - _win_start.replace(tzinfo=timezone.utc)
                                  if _win_start.tzinfo is None
                                  else _win_end - _win_start).total_seconds())
                _logger.info(
                    "engagement window session=%s prog=%s start=%s dur=%ds events=%d",
                    str(body.session_id)[:8], _prog_id[:8],
                    _win_start.isoformat()[:19], _win_sec, len(_window)
                )

                _res = _eng(_window)   # fenêtre vide → valeurs neutres (0.5)
                _logger.debug(
                    "engagement computed session=%s score=%.3f fac=%s aud=%s beh=%s",
                    str(body.session_id)[:8], _res["score"],
                    _res.get("visual_score"), _res.get("audio_score"),
                    _res.get("behavioral_score"),
                )
                # NOTE : pas de ::uuid — SQLAlchemy text() utilise : comme préfixe de binding,
                # ::uuid déclencherait un SyntaxError. UUID string PostgreSQL cast implicitement.
                db.execute(_text("""
                    UPDATE progressions
                    SET engagement_fused      = :fused,
                        engagement_facial     = :facial,
                        engagement_audio      = :audio,
                        engagement_behavioral = :behavioral
                    WHERE id = :prog_id
                """), {
                    "fused":      _res["score"],
                    "facial":     _res.get("visual_score"),
                    "audio":      _res.get("audio_score"),
                    "behavioral": _res.get("behavioral_score"),
                    "prog_id":    _prog_id,
                })
                _logger.debug("engagement UPDATE executed session=%s prog=%s",
                              str(body.session_id)[:8], _prog_id[:8])
                db.commit()
        except Exception as _e:
            import logging as _log2
            _log2.getLogger(__name__).warning(
                "engagement per-exercice non persisté : %s", _e, exc_info=True
            )

    return {
        "correct":          correct,
        "reponse_correcte": exercice.reponse_correcte,
        "explication":      exercice.explication,
        "points_gagnes":    exercice.points if correct else 0,
        "tentatives":       prog.tentatives,
        "bkt":              bkt_result
    }


@router.get("/progression/{user_id}")
def get_progression(user_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if str(current_user.id) != str(user_id) and current_user.role not in ("enseignant", "super_admin"):
        raise HTTPException(403, "Accès non autorisé")
    """Retourne la progression globale d'un apprenant."""
    progressions = db.query(ProgressionApprenant).filter(
        ProgressionApprenant.user_id == user_id
    ).all()

    total_exercices = db.query(Exercice).count()
    termines = [p for p in progressions if p.correct == True]
    score_total = sum((p.score or 0) for p in termines)

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
def creer_session(body: SessionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if str(current_user.id) != str(body.user_id) and current_user.role not in ("enseignant", "super_admin"):
        raise HTTPException(403, "Accès non autorisé")
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
def clore_session(session_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
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
    if str(current_user.id) != str(session.user_id) and current_user.role not in ("enseignant", "super_admin"):
        raise HTTPException(403, "Accès non autorisé")

    # Récupère les événements depuis Redis + nettoie le curseur per-exercice
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

    session.ended_at             = now
    session.score_engagement     = result["score"]                  # fusionné α·facial + β·audio + γ·comport.
    session.score_facial         = result.get("visual_score")       # α — MediaPipe + CNN (None si caméra inactive)
    session.score_audio          = result.get("audio_score")        # β — VAD + bruit ambiant (None si micro inactif)
    session.score_comportemental = result.get("behavioral_score")   # γ — idle/response/help
    session.etat_affectif        = result.get("etat_affectif", "neutre")
    session.nb_interactions      = len(events)
    session.duree_secondes       = duree
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
def dashboard_enseignant(enseignant_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(require_enseignant)):
    if current_user.role == 'enseignant' and current_user.id != enseignant_id:
        raise HTTPException(403, "Accès refusé")
    """
    Retourne une vue globale pour l'enseignant :
    - Liste des apprenants avec leur score d'engagement actuel
    - Statistiques globales de la classe
    - Exercices les plus difficiles
    """
    from ..models.session import LearningSession
    from ..models.user import TuteurSuivi
    import redis as redis_lib
    import json as json_lib

    # Récupère tous les apprenants
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

    # Une seule connexion Redis pour tous les apprenants
    redis_client = None
    try:
        redis_client = redis_lib.from_url(settings.redis_url, decode_responses=True)
    except Exception:
        pass

    # Total exercices une seule fois (pas par apprenant)
    total_exercices = db.query(Exercice).count()

    # Toutes les progressions d'un coup pour tous les apprenants
    all_progressions = db.query(ProgressionApprenant).filter(
        ProgressionApprenant.user_id.in_(apprenant_ids)
    ).all()
    prog_by_user: dict = {}
    for p in all_progressions:
        prog_by_user.setdefault(str(p.user_id), []).append(p)

    # Dernières sessions pour tous les apprenants d'un coup
    from sqlalchemy import func as sa_func
    subq = (
        db.query(
            LearningSession.user_id,
            sa_func.max(LearningSession.started_at).label("last_at")
        )
        .filter(LearningSession.user_id.in_(apprenant_ids))
        .group_by(LearningSession.user_id)
        .subquery()
    )
    last_sessions_rows = (
        db.query(LearningSession)
        .join(subq, (LearningSession.user_id == subq.c.user_id) &
                    (LearningSession.started_at == subq.c.last_at))
        .all()
    )
    last_session_by_user = {str(s.user_id): s for s in last_sessions_rows}

    result = []
    for apprenant in apprenants:
        uid_str = str(apprenant.id)
        derniere_session = last_session_by_user.get(uid_str)

        # Score d'engagement depuis Redis
        score_actuel = 0.5
        niveau = "modere"
        nb_events = 0
        if derniere_session and redis_client:
            try:
                cached = redis_client.get(f"session_events:{derniere_session.id}")
                if cached:
                    events = json_lib.loads(cached)
                    nb_events = len(events)
                    res = compute_behavioral_score(events)
                    score_actuel = res["score"]
                    niveau = res["level"]
            except Exception:
                pass

        progressions = prog_by_user.get(uid_str, [])
        exercices_reussis = sum(1 for p in progressions if p.correct)
        score_total = sum((p.score or 0) for p in progressions if p.correct)

        result.append({
            "user_id":       uid_str,
            "nom":           apprenant.nom,
            "prenom":        apprenant.prenom,
            "email":         apprenant.email,
            "niveau":        apprenant.niveau_label,
            "filiere_label": apprenant.filiere_label,
            "engagement": {
                "score":     score_actuel,
                "niveau":    niveau,
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

    # Exercices les plus difficiles — agrégation en Python sur les progressions déjà chargées
    ex_stats: dict = {}
    for p in all_progressions:
        eid = str(p.exercice_id)
        if eid not in ex_stats:
            ex_stats[eid] = {"total": 0, "echecs": 0}
        ex_stats[eid]["total"] += 1
        if p.correct is False:
            ex_stats[eid]["echecs"] += 1

    # Récupère les titres pour les exercices concernés
    ex_ids_with_data = [p.exercice_id for p in all_progressions if p.exercice_id]
    exercices_map: dict = {}
    if ex_ids_with_data:
        for ex in db.query(Exercice.id, Exercice.titre).filter(Exercice.id.in_(set(ex_ids_with_data))).all():
            exercices_map[str(ex.id)] = ex.titre

    stats_exercices = []
    for eid, s in ex_stats.items():
        if s["total"] > 0:
            stats_exercices.append({
                "titre":            exercices_map.get(eid, eid),
                "total_tentatives": s["total"],
                "echecs":           s["echecs"],
                "taux_echec":       round(s["echecs"] / s["total"] * 100),
            })
    stats_exercices.sort(key=lambda x: x["taux_echec"], reverse=True)
    stats_exercices = stats_exercices[:3]

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
        "exercices_difficiles": stats_exercices
    }

@router.get("/ua/recommandee/{user_id}")
def get_ua_recommandee(user_id: UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """
    Recommande la prochaine UA via logique ZPD (Zone Proximale de Développement) :
    - Exclut les UA déjà maîtrisées (BKT moyen ≥ 0.80)
    - Vérifie que les prérequis sont acquis (BKT ≥ 0.40 par prérequis)
    - Favorise la zone d'apprentissage optimale (BKT entre 0.25 et 0.70)
    - Prioritise les UA en cours (commencées mais non maîtrisées)
    """
    from ..models.cours import BKTMastery

    uas = db.query(UniteApprentissage).filter(
        UniteApprentissage.actif == True
    ).order_by(UniteApprentissage.ordre).all()

    masteries = db.query(BKTMastery).filter(BKTMastery.user_id == user_id).all()
    mastery_map = {m.competence: m.p_mastery for m in masteries}

    def ua_bkt_moyen(ua):
        comps = ua.competences or []
        if not comps:
            return 0.0
        return sum(mastery_map.get(c, 0.0) for c in comps) / len(comps)

    def prereqs_ok(ua):
        prereqs = ua.prerequis or []
        if not prereqs:
            return True
        # Les prérequis sont des noms de compétences ou des ua_ids
        return all(mastery_map.get(p, 0.0) >= 0.40 for p in prereqs)

    def zpd_score(ua, bkt_moy, nb_tent):
        # UA déjà maîtrisée → exclure
        if bkt_moy >= 0.80:
            return None
        # Prérequis non acquis → exclure
        if not prereqs_ok(ua):
            return None
        # En cours (commencée) → priorité haute
        en_cours_bonus = 0.3 if nb_tent > 0 else 0.0
        # Zone optimale : BKT entre 0.25–0.70 → score proche de 1
        zpd = 1.0 - abs(bkt_moy - 0.45) * 2
        return max(0.0, zpd) + en_cours_bonus

    scored = []
    for ua in uas:
        bkt_moy = ua_bkt_moyen(ua)
        nb_tent = db.query(ProgressionApprenant).filter(
            ProgressionApprenant.user_id == user_id,
            ProgressionApprenant.ua_id   == ua.id,
        ).count()
        score = zpd_score(ua, bkt_moy, nb_tent)
        if score is None:
            continue
        scored.append({
            "id":           str(ua.id),
            "ua_id":        str(ua.id),
            "titre":        ua.titre,
            "reference_ue": ua.reference_ue,
            "score_bkt":    round(bkt_moy, 3),
            "nb_tentatives": nb_tent,
            "zpd_score":    round(score, 3),
        })

    scored.sort(key=lambda x: -x["zpd_score"])
    recommandee = scored[0] if scored else None

    return {
        "recommandee": recommandee,
        "toutes":      scored,
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
def create_matiere(body: dict, db: Session = Depends(get_db), _: User = Depends(require_super_admin)):
    mat = Matiere(
        nom=body["nom"],
        code=body.get("code", ""),
        description=body.get("description", ""),
    )
    db.add(mat); db.commit(); db.refresh(mat)
    return {"id": str(mat.id), "nom": mat.nom, "code": mat.code}

@router.put("/matieres/{matiere_id}")
def update_matiere(matiere_id: UUID, body: dict, db: Session = Depends(get_db), _: User = Depends(require_super_admin)):
    mat = db.query(Matiere).filter(Matiere.id == matiere_id).first()
    if not mat: raise HTTPException(404, "Matière introuvable")
    for k in ["nom", "code", "description"]:
        if k in body: setattr(mat, k, body[k])
    db.commit()
    return {"message": "Matière mise à jour"}

@router.delete("/matieres/{matiere_id}")
def delete_matiere(matiere_id: UUID, db: Session = Depends(get_db), _: User = Depends(require_super_admin)):
    mat = db.query(Matiere).filter(Matiere.id == matiere_id).first()
    if not mat: raise HTTPException(404, "Matière introuvable")
    mat.actif = False; db.commit()
    return {"message": "Matière désactivée"}


# ── CRUD Unités d'apprentissage ──────────────────────────────────
# Note: UniteApprentissage n'a pas de colonne "statut" ni "difficulte"
# Ces champs sont ignorés à la sauvegarde

@router.post("/ua")
def create_ua(body: dict, db: Session = Depends(get_db), _: User = Depends(require_super_admin)):
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
def update_ua(ua_id: UUID, body: dict, db: Session = Depends(get_db), _: User = Depends(require_super_admin)):
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
def delete_ua(ua_id: UUID, db: Session = Depends(get_db), _: User = Depends(require_super_admin)):
    ua = db.query(UniteApprentissage).filter(UniteApprentissage.id == ua_id).first()
    if not ua: raise HTTPException(404, "UA introuvable")
    ua.actif = False; db.commit()
    return {"message": "UA désactivée"}


# ── CRUD Exercices ───────────────────────────────────────────────
# Note: Exercice n'a pas de colonne "actif" ni "statut"

@router.get("/exercices")
def list_exercices(db: Session = Depends(get_db), _: User = Depends(require_super_admin)):
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
            "kcs":                get_kcs(ex),
            "primary_kc":         get_kcs(ex)[0] if get_kcs(ex) else None,
            "difficulte":         ex.difficulte,
            "points":             ex.points,
            "groupe":             ex.groupe,
            "groupe_titre":       ex.groupe_titre,
            "statut":             "publié",
            "ua_id":              str(ex.ua_id) if ex.ua_id else None,
        })
    return result

@router.post("/exercices")
def create_exercice(body: dict, db: Session = Depends(get_db), _: User = Depends(require_super_admin)):
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
        kcs=body.get("kcs") or ([body["competence_evaluee"]] if body.get("competence_evaluee") else []),
        difficulte=int(body.get("difficulte", 1)),
        points=int(body.get("points", 10)),
        groupe=int(body["groupe"]) if body.get("groupe") is not None else None,
        groupe_titre=body.get("groupe_titre") or None,
        ua_id=UUID(body["ua_id"]) if body.get("ua_id") else None,
    )
    db.add(ex); db.commit(); db.refresh(ex)
    return {"id": str(ex.id), "titre": ex.titre}

@router.put("/exercices/{exercice_id}")
def update_exercice(exercice_id: UUID, body: dict, db: Session = Depends(get_db), _: User = Depends(require_super_admin)):
    ex = db.query(Exercice).filter(Exercice.id == exercice_id).first()
    if not ex: raise HTTPException(404, "Exercice introuvable")
    for k in ["titre", "type", "enonce", "options", "reponse_correcte",
              "explication", "indice_1", "indice_2", "competence_evaluee",
              "kcs", "difficulte", "points"]:
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
def delete_exercice(exercice_id: UUID, db: Session = Depends(get_db), _: User = Depends(require_super_admin)):
    ex = db.query(Exercice).filter(Exercice.id == exercice_id).first()
    if not ex: raise HTTPException(404, "Exercice introuvable")
    # Exercice n'a pas de colonne actif — on supprime vraiment
    db.delete(ex); db.commit()


@router.get("/sessions/historique/{user_id}")
def get_sessions_historique(user_id: UUID, limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if str(current_user.id) != str(user_id) and current_user.role not in ("enseignant", "super_admin"):
        raise HTTPException(403, "Accès non autorisé")
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


# ── Correction des réponses libres par l'enseignant ───────────────────────────

@router.get("/corrections/en_attente")
def get_reponses_en_attente(
    ua_id: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_enseignant),
):
    """Liste toutes les réponses libres en attente de correction."""
    from ..models.user import User as UserModel
    q = (
        db.query(ProgressionApprenant, Exercice, UserModel)
        .join(Exercice, ProgressionApprenant.exercice_id == Exercice.id)
        .join(UserModel, ProgressionApprenant.user_id == UserModel.id)
        .filter(ProgressionApprenant.statut == "en_attente_correction")
    )
    if ua_id:
        q = q.filter(ProgressionApprenant.ua_id == uuid_module.UUID(ua_id))
    rows = q.order_by(ProgressionApprenant.date_debut.desc()).all()

    return [
        {
            "progression_id":       str(prog.id),
            "apprenant_nom":        f"{u.prenom} {u.nom}",
            "apprenant_id":         str(u.id),
            "exercice_id":          str(ex.id),
            "exercice_titre":       ex.titre,
            "exercice_enonce":      ex.enonce,
            "reponse_modele":       ex.reponse_correcte,
            "reponse_apprenant":    prog.reponse_donnee,
            "points_max":           ex.points,
            "commentaire":          prog.commentaire_enseignant,
            "date_soumission":      prog.date_debut.isoformat() if prog.date_debut else None,
        }
        for prog, ex, u in rows
    ]


class EvaluationBody(BaseModel):
    correct: bool
    points: Optional[int] = None
    commentaire: Optional[str] = None


@router.post("/corrections/{progression_id}/evaluer")
def evaluer_reponse_libre(
    progression_id: UUID,
    body: EvaluationBody,
    db: Session = Depends(get_db),
    _: User = Depends(require_enseignant),
):
    """L'enseignant valide ou invalide une réponse libre et attribue les points."""
    prog = db.query(ProgressionApprenant).filter(
        ProgressionApprenant.id == progression_id
    ).first()
    if not prog:
        raise HTTPException(404, "Progression introuvable")

    exercice = db.query(Exercice).filter(Exercice.id == prog.exercice_id).first()

    prog.correct                = body.correct
    prog.statut                 = "termine" if body.correct else "en_cours"
    prog.score                  = body.points if body.points is not None else (exercice.points if body.correct else 0)
    prog.commentaire_enseignant = body.commentaire
    prog.date_fin               = datetime.utcnow() if body.correct else None
    db.commit()

    # Mise à jour BKT sur KC principal uniquement (Solution B)
    primary_kc_corr = get_kcs(exercice)[0] if exercice and get_kcs(exercice) else None
    if primary_kc_corr:
        from ..services.bkt_service import update_knowledge, interpret_mastery
        mastery = db.query(BKTMastery).filter(
            BKTMastery.user_id == prog.user_id,
            BKTMastery.competence == primary_kc_corr
        ).first()
        if not mastery:
            mastery = BKTMastery(
                user_id=prog.user_id,
                competence=primary_kc_corr,
                ua_id=prog.ua_id,
                p_mastery=0.1, nb_tentatives=0, nb_correct=0
            )
            db.add(mastery)
        mastery.p_mastery     = update_knowledge(mastery.p_mastery, body.correct)
        mastery.nb_tentatives += 1
        if body.correct:
            mastery.nb_correct += 1
        db.commit()

    return {"message": "Évaluation enregistrée", "correct": body.correct, "points": prog.score}
    return {"message": "Exercice supprimé"}


# ── Recherche globale ─────────────────────────────────────────────

@router.get("/recherche")
def recherche_globale(q: str = "", db: Session = Depends(get_db)):
    """Recherche full-text sur matières, UAs et exercices."""
    q = q.strip()
    if len(q) < 2:
        return {"matieres": [], "uas": [], "exercices": []}

    terme = f"%{q.lower()}%"

    matieres = db.query(Matiere).filter(
        Matiere.actif == True,
        sa.func.lower(Matiere.nom).like(terme),
    ).limit(4).all()

    uas = db.query(UniteApprentissage).filter(
        UniteApprentissage.actif == True,
        sa.or_(
            sa.func.lower(UniteApprentissage.titre).like(terme),
            sa.func.lower(UniteApprentissage.reference_ue).like(terme),
        ),
    ).limit(8).all()

    exercices = db.query(Exercice).filter(
        sa.func.lower(Exercice.titre).like(terme),
    ).limit(6).all()

    return {
        "matieres": [
            {"id": str(m.id), "nom": m.nom}
            for m in matieres
        ],
        "uas": [
            {
                "id":           str(u.id),
                "titre":        u.titre,
                "reference_ue": u.reference_ue,
                "famille_id":   str(u.famille_id),
            }
            for u in uas
        ],
        "exercices": [
            {
                "id":     str(e.id),
                "titre":  e.titre,
                "ua_id":  str(e.ua_id),
            }
            for e in exercices
        ],
    }