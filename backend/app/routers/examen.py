from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

import csv
import io
import sqlalchemy as sa
import os
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user, require_enseignant
from ..models.cours import Matiere, UniteApprentissage, RessourcePedagogique
from ..models.examen import Epreuve, EpreuveReponse
from ..models.referentiel import Niveau
from ..models.user import User
from ..services.exam_service import generer_epreuve
from ..services.correction_service import recorriger_copie, SEMANTIC_TYPES, scorer_question, scorer_question_llm

router = APIRouter(prefix="/api/examens", tags=["examens"])


# ── Schémas ──────────────────────────────────────────────────────────────────

class GenererEpreuveRequest(BaseModel):
    matiere_id: UUID
    niveau_id: Optional[UUID] = None
    classe_label: str = ""
    type_epreuve: str = "sequence"       # sequence | examen | devoir | tp_note
    ua_ids: list[UUID]
    duree_minutes: int = 60
    coefficient: int = 1
    annee_scolaire: str = "2025-2026"
    titre: Optional[str] = None


class SoumettreReponsesRequest(BaseModel):
    reponses: dict[str, Any]             # { "p1_ex1_q1": "réponse", ... }
    nb_incidents: int = 0                # incidents de surveillance caméra
    incidents_log: Optional[list] = None # log détaillé des absences


class PublierRequest(BaseModel):
    statut: str  # "publie" | "brouillon" | "archive"


class PlanifierRequest(BaseModel):
    date_ouverture: Optional[datetime] = None
    date_cloture:   Optional[datetime] = None


class CorrectionManuelleBody(BaseModel):
    corrections: dict[str, dict]   # { qid: { "score": float, "commentaire"?: str } }



# ── Helpers ───────────────────────────────────────────────────────────────────

def _effective_statut(e: "Epreuve", now: datetime) -> str:
    """Statut effectif tenant compte du planning automatique."""
    if e.date_ouverture:
        if now < e.date_ouverture:
            return "planifie"
        if e.date_cloture and now > e.date_cloture:
            return "cloture"
        return "publie"
    return e.statut

def _build_ua_contents(ua_ids: list[UUID], db: Session) -> list[dict]:
    """Charge les UA avec leurs ressources pour construire le contexte LLM."""
    contents = []
    for uid in ua_ids:
        ua = db.query(UniteApprentissage).filter(UniteApprentissage.id == uid).first()
        if not ua:
            continue
        ressources = (
            db.query(RessourcePedagogique)
            .filter(RessourcePedagogique.ua_id == uid)
            .order_by(RessourcePedagogique.ordre)
            .all()
        )
        contents.append({
            "titre": ua.titre,
            "competences": ua.competences,
            "situation_probleme": ua.situation_probleme,
            "ressources": [
                {"titre": r.titre, "contenu": r.contenu, "points_cles": r.points_cles}
                for r in ressources
            ],
        })
    return contents


EXACT_TYPES = {"qcm", "vrai_faux", "completion"}

def _auto_correct(contenu: dict, reponses: dict) -> tuple[dict, float, float, float]:
    """
    Correction automatique :
    - Types exacts (QCM, V/F, complétion) : comparaison stricte
    - Types sémantiques (réponse libre, listage, définition, code) : sentence-transformers
    Retourne (corrections_dict, score_total, score_p1, score_p2).
    """
    corrections: dict[str, Any] = {}
    score_p1 = 0.0
    score_p2 = 0.0

    for partie_key in ("partie1", "partie2"):
        partie = contenu.get(partie_key, {})
        partie_pts = 0.0
        for ex in partie.get("exercices", []):
            for q in ex.get("questions", []):
                qid = q.get("id", "")
                if not qid or qid not in reponses:
                    continue
                points  = float(q.get("points", 0))
                type_q  = q.get("type", "")
                correcte = str(q.get("reponse_correcte", "")).strip()
                donnee   = str(reponses[qid]).strip()

                if type_q in EXACT_TYPES:
                    ok = donnee.lower() == correcte.lower()
                    corrections[qid] = {
                        "score": points if ok else 0.0,
                        "max": points, "auto": True, "correct": ok,
                        "methode": "exact",
                        "explication": q.get("explication", ""),
                    }
                    partie_pts += corrections[qid]["score"]

                elif type_q in SEMANTIC_TYPES:
                    corr = scorer_question(
                        type_q=type_q,
                        reponse_donnee=donnee,
                        reponse_correcte=correcte,
                        max_points=points,
                        explication=q.get("explication", ""),
                    )
                    corrections[qid] = corr
                    partie_pts += corr.get("score") or 0.0

                else:
                    corrections[qid] = {
                        "score": None, "max": points, "auto": False,
                        "correct": None, "methode": "manuelle",
                        "explication": "Correction manuelle requise",
                    }

        if partie_key == "partie1":
            score_p1 = partie_pts
        else:
            score_p2 = partie_pts

    score_total = round(score_p1 + score_p2, 2)
    return corrections, score_total, round(score_p1, 2), round(score_p2, 2)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/generer", status_code=201)
async def generer(
    body: GenererEpreuveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_enseignant),
):
    """Génère une épreuve via Claude et la sauvegarde en brouillon."""
    matiere = db.query(Matiere).filter(Matiere.id == body.matiere_id).first()
    if not matiere:
        raise HTTPException(status_code=404, detail="Matière introuvable")

    niveau_label = ""
    if body.niveau_id:
        niv = db.query(Niveau).filter(Niveau.id == body.niveau_id).first()
        niveau_label = niv.nom if niv else ""

    ua_contents = _build_ua_contents(body.ua_ids, db)
    if not ua_contents:
        raise HTTPException(status_code=400, detail="Aucune UA valide fournie")

    try:
        contenu = await generer_epreuve(
            matiere=matiere.nom,
            niveau=niveau_label,
            classe=body.classe_label,
            type_epreuve=body.type_epreuve,
            ua_contents=ua_contents,
            duree=body.duree_minutes,
            annee=body.annee_scolaire,
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback, logging
        logging.error(f"[generer] ERREUR COMPLÈTE:\n{traceback.format_exc()}")
        raise HTTPException(status_code=502, detail=f"Erreur génération IA : {type(e).__name__}: {e}")

    titre = body.titre or contenu.get("titre") or f"Épreuve {matiere.nom} — {body.type_epreuve}"

    epreuve = Epreuve(
        enseignant_id=current_user.id,
        matiere_id=body.matiere_id,
        niveau_id=body.niveau_id,
        titre=titre,
        type_epreuve=body.type_epreuve,
        ua_ids=[str(uid) for uid in body.ua_ids],
        contenu=contenu,
        duree_minutes=body.duree_minutes,
        coefficient=body.coefficient,
        annee_scolaire=body.annee_scolaire,
        classe_label=body.classe_label,
        statut="brouillon",
    )
    db.add(epreuve)
    db.commit()
    db.refresh(epreuve)

    return {
        "id": str(epreuve.id),
        "titre": epreuve.titre,
        "statut": epreuve.statut,
        "contenu": epreuve.contenu,
    }


@router.get("/disponibles")
def epreuves_disponibles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Liste les épreuves publiées accessibles à l'apprenant connecté.
    Inclut les épreuves dans leur fenêtre de planning. Filtre par niveau.
    """
    now = datetime.now(timezone.utc)
    query = db.query(Epreuve).filter(
        sa.or_(
            Epreuve.statut == "publie",
            sa.and_(
                Epreuve.date_ouverture != None,
                Epreuve.date_ouverture <= now,
                sa.or_(Epreuve.date_cloture == None, Epreuve.date_cloture >= now),
            ),
        )
    )

    if current_user.niveau_id:
        query = query.filter(
            (Epreuve.niveau_id == current_user.niveau_id) | (Epreuve.niveau_id == None)
        )
    else:
        # Apprenant sans niveau : seulement les épreuves génériques (pas de niveau requis)
        query = query.filter(Epreuve.niveau_id == None)

    epreuves = query.order_by(Epreuve.created_at.desc()).all()

    # Vérifier les soumissions déjà faites
    epreuve_ids = [e.id for e in epreuves]
    soumissions = (
        db.query(EpreuveReponse)
        .filter(
            EpreuveReponse.apprenant_id == current_user.id,
            EpreuveReponse.epreuve_id.in_(epreuve_ids),
        )
        .all()
    )
    soumis_map = {str(s.epreuve_id): s for s in soumissions}

    return [
        {
            "id": str(e.id),
            "titre": e.titre,
            "type_epreuve": e.type_epreuve,
            "duree_minutes": e.duree_minutes,
            "coefficient": e.coefficient,
            "classe_label": e.classe_label,
            "annee_scolaire": e.annee_scolaire,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "soumis": str(e.id) in soumis_map,
            "score_total": soumis_map[str(e.id)].score_total if str(e.id) in soumis_map else None,
            "reponse_id": str(soumis_map[str(e.id)].id) if str(e.id) in soumis_map else None,
            "nb_incidents": soumis_map[str(e.id)].nb_incidents if str(e.id) in soumis_map else 0,
        }
        for e in epreuves
    ]


@router.get("/")
def lister_epreuves(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_enseignant),
):
    """Liste les épreuves créées par l'enseignant connecté."""
    epreuves = (
        db.query(Epreuve)
        .filter(Epreuve.enseignant_id == current_user.id)
        .order_by(Epreuve.created_at.desc())
        .all()
    )
    from sqlalchemy import func
    epreuve_ids = [e.id for e in epreuves]
    nb_rep_map = {}
    if epreuve_ids:
        counts = (
            db.query(EpreuveReponse.epreuve_id, func.count(EpreuveReponse.id))
            .filter(EpreuveReponse.epreuve_id.in_(epreuve_ids))
            .group_by(EpreuveReponse.epreuve_id)
            .all()
        )
        nb_rep_map = {str(eid): cnt for eid, cnt in counts}

    now = datetime.now(timezone.utc)
    return [
        {
            "id": str(e.id),
            "titre": e.titre,
            "type_epreuve": e.type_epreuve,
            "statut": e.statut,
            "statut_effectif": _effective_statut(e, now),
            "duree_minutes": e.duree_minutes,
            "coefficient": e.coefficient,
            "classe_label": e.classe_label,
            "annee_scolaire": e.annee_scolaire,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "date_ouverture": e.date_ouverture.isoformat() if e.date_ouverture else None,
            "date_cloture":   e.date_cloture.isoformat()   if e.date_cloture   else None,
            "nb_reponses": nb_rep_map.get(str(e.id), 0),
        }
        for e in epreuves
    ]


@router.get("/{epreuve_id}")
def detail_epreuve(
    epreuve_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Détail complet d'une épreuve (enseignant propriétaire ou apprenant si publiée)."""
    ep = db.query(Epreuve).filter(Epreuve.id == epreuve_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Épreuve introuvable")

    is_owner = str(ep.enseignant_id) == str(current_user.id)
    if not is_owner and ep.statut != "publie":
        raise HTTPException(status_code=403, detail="Épreuve non disponible")

    # Pour les apprenants, on masque les réponses correctes
    contenu = ep.contenu
    if current_user.role == "apprenant":
        import copy
        contenu = copy.deepcopy(ep.contenu)
        for partie in ("partie1", "partie2"):
            for ex in contenu.get(partie, {}).get("exercices", []):
                for q in ex.get("questions", []):
                    q.pop("reponse_correcte", None)
                    q.pop("explication", None)

    return {
        "id": str(ep.id),
        "titre": ep.titre,
        "type_epreuve": ep.type_epreuve,
        "statut": ep.statut,
        "duree_minutes": ep.duree_minutes,
        "coefficient": ep.coefficient,
        "classe_label": ep.classe_label,
        "annee_scolaire": ep.annee_scolaire,
        "contenu": contenu,
        "created_at": ep.created_at.isoformat() if ep.created_at else None,
    }


@router.patch("/{epreuve_id}/statut")
def changer_statut(
    epreuve_id: UUID,
    body: PublierRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_enseignant),
):
    """Publie, archive ou remet en brouillon une épreuve."""
    ep = db.query(Epreuve).filter(Epreuve.id == epreuve_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Épreuve introuvable")
    if str(ep.enseignant_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Action non autorisée")
    if body.statut not in ("brouillon", "publie", "archive"):
        raise HTTPException(status_code=422, detail="Statut invalide")

    ep.statut = body.statut
    db.commit()
    return {"id": str(ep.id), "statut": ep.statut}


@router.put("/{epreuve_id}/planifier")
def planifier_epreuve(
    epreuve_id: UUID,
    body: PlanifierRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_enseignant),
):
    """Définit la fenêtre d'ouverture automatique d'une épreuve."""
    ep = db.query(Epreuve).filter(Epreuve.id == epreuve_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Épreuve introuvable")
    if str(ep.enseignant_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Action non autorisée")

    ep.date_ouverture = body.date_ouverture
    ep.date_cloture   = body.date_cloture

    # Si on enlève le planning, revenir au statut manuel
    if body.date_ouverture is None and body.date_cloture is None:
        ep.statut = ep.statut  # inchangé
    else:
        # Si la fenêtre est déjà ouverte, publier immédiatement
        now = datetime.now(timezone.utc)
        if body.date_ouverture and body.date_ouverture <= now:
            ep.statut = "publie"
        else:
            ep.statut = "brouillon"

    db.commit()
    return {
        "id":             str(ep.id),
        "statut":         ep.statut,
        "date_ouverture": ep.date_ouverture.isoformat() if ep.date_ouverture else None,
        "date_cloture":   ep.date_cloture.isoformat()   if ep.date_cloture   else None,
    }


@router.post("/{epreuve_id}/soumettre", status_code=201)
def soumettre_reponses(
    epreuve_id: UUID,
    body: SoumettreReponsesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """L'apprenant soumet ses réponses. Correction auto des questions fermées."""
    ep = db.query(Epreuve).filter(Epreuve.id == epreuve_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Épreuve introuvable")
    now = datetime.now(timezone.utc)
    if _effective_statut(ep, now) != "publie":
        raise HTTPException(status_code=403, detail="Épreuve non accessible")

    # Vérifie que l'apprenant n'a pas déjà soumis
    existing = (
        db.query(EpreuveReponse)
        .filter(
            EpreuveReponse.epreuve_id == epreuve_id,
            EpreuveReponse.apprenant_id == current_user.id,
            EpreuveReponse.statut == "soumis",
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Épreuve déjà soumise")

    corrections, score_total, score_p1, score_p2 = _auto_correct(ep.contenu, body.reponses)

    rep = EpreuveReponse(
        epreuve_id=epreuve_id,
        apprenant_id=current_user.id,
        reponses=body.reponses,
        corrections=corrections,
        score_total=score_total,
        score_p1=score_p1,
        score_p2=score_p2,
        nb_incidents=body.nb_incidents,
        incidents_log=body.incidents_log,
        statut="soumis",
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(rep)
    db.commit()
    db.refresh(rep)

    return {
        "id": str(rep.id),
        "score_total": rep.score_total,
        "score_p1": rep.score_p1,
        "score_p2": rep.score_p2,
        "statut": rep.statut,
        "corrections": corrections,
        "nb_incidents": rep.nb_incidents,
    }


@router.post("/reponses/{reponse_id}/auto-corriger")
def auto_corriger_copie(
    reponse_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_enseignant),
):
    """
    Re-lance la correction sémantique sur une copie (utile si le modèle
    n'était pas disponible au moment de la soumission).
    Réservé à l'enseignant propriétaire de l'épreuve.
    """
    rep = db.query(EpreuveReponse).filter(EpreuveReponse.id == reponse_id).first()
    if not rep:
        raise HTTPException(status_code=404, detail="Copie introuvable")

    ep = db.query(Epreuve).filter(Epreuve.id == rep.epreuve_id).first()
    if not ep or str(ep.enseignant_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Action non autorisée")

    corrections, score_total, score_p1, score_p2 = recorriger_copie(
        contenu_epreuve=ep.contenu,
        reponses=rep.reponses or {},
        corrections_existantes=rep.corrections or {},
        use_llm=True,
    )

    rep.corrections  = corrections
    rep.score_total  = score_total
    rep.score_p1     = score_p1
    rep.score_p2     = score_p2
    if score_total is not None:
        rep.statut   = "corrige"
        rep.corrige_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "id": str(rep.id),
        "score_total": rep.score_total,
        "score_p1": rep.score_p1,
        "score_p2": rep.score_p2,
        "statut": rep.statut,
        "corrections": corrections,
    }


@router.patch("/reponses/{reponse_id}/corriger-manuel")
def corriger_manuel(
    reponse_id: UUID,
    body: CorrectionManuelleBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_enseignant),
):
    """
    L'enseignant attribue manuellement des scores à des questions spécifiques.
    Recalcule automatiquement le score total.
    """
    rep = db.query(EpreuveReponse).filter(EpreuveReponse.id == reponse_id).first()
    if not rep:
        raise HTTPException(status_code=404, detail="Copie introuvable")

    ep = db.query(Epreuve).filter(Epreuve.id == rep.epreuve_id).first()
    if not ep or str(ep.enseignant_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Action non autorisée")

    corrections = dict(rep.corrections or {})

    for qid, data in body.corrections.items():
        score = round(min(float(data.get("max", 9999)), max(0.0, float(data.get("score", 0)))), 2)
        corrections[qid] = {
            **(corrections.get(qid) or {}),
            "score": score,
            "max": data.get("max", corrections.get(qid, {}).get("max", 0)),
            "auto": False,
            "correct": score > 0,
            "methode": "manuelle_enseignant",
            "explication": data.get("commentaire", ""),
        }

    # Recalcul des scores depuis le contenu de l'épreuve
    score_p1 = 0.0
    score_p2 = 0.0
    for partie_key in ("partie1", "partie2"):
        for ex in ep.contenu.get(partie_key, {}).get("exercices", []):
            for q in ex.get("questions", []):
                qid = q.get("id", "")
                s = (corrections.get(qid) or {}).get("score")
                if s is not None:
                    if partie_key == "partie1":
                        score_p1 += float(s)
                    else:
                        score_p2 += float(s)

    rep.corrections = corrections
    rep.score_p1    = round(score_p1, 2)
    rep.score_p2    = round(score_p2, 2)
    rep.score_total = round(score_p1 + score_p2, 2)
    rep.statut      = "corrige"
    rep.corrige_at  = datetime.now(timezone.utc)
    db.commit()

    return {
        "id": str(rep.id),
        "score_total": rep.score_total,
        "score_p1": rep.score_p1,
        "score_p2": rep.score_p2,
        "statut": rep.statut,
        "corrections": corrections,
    }


@router.get("/{epreuve_id}/resultats")
def resultats(
    epreuve_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Résultats d'une épreuve.
    - Enseignant propriétaire : voit tous les apprenants.
    - Apprenant : voit seulement sa propre copie.
    """
    ep = db.query(Epreuve).filter(Epreuve.id == epreuve_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Épreuve introuvable")

    is_owner = str(ep.enseignant_id) == str(current_user.id)

    if is_owner:
        reponses = (
            db.query(EpreuveReponse)
            .filter(EpreuveReponse.epreuve_id == epreuve_id)
            .order_by(EpreuveReponse.submitted_at)
            .all()
        )
    else:
        reponses = (
            db.query(EpreuveReponse)
            .filter(
                EpreuveReponse.epreuve_id == epreuve_id,
                EpreuveReponse.apprenant_id == current_user.id,
            )
            .all()
        )

    # Résoudre les noms des apprenants
    apprenant_ids = [r.apprenant_id for r in reponses]
    apprenants = {}
    if apprenant_ids:
        users = db.query(User).filter(User.id.in_(apprenant_ids)).all()
        apprenants = {str(u.id): u for u in users}

    return [
        {
            "id": str(r.id),
            "apprenant_id": str(r.apprenant_id),
            "apprenant_nom": (
                f"{apprenants[str(r.apprenant_id)].prenom} {apprenants[str(r.apprenant_id)].nom}"
                if str(r.apprenant_id) in apprenants else "Apprenant"
            ),
            "score_total": r.score_total,
            "score_p1": r.score_p1,
            "score_p2": r.score_p2,
            "statut": r.statut,
            "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
            "corrections": r.corrections,
            "reponses": r.reponses,
            "nb_incidents": r.nb_incidents,
            "incidents_log": r.incidents_log if is_owner else None,
            # Copie papier
            "copie_type": r.copie_type or "numerique",
            "image_copie_url": r.image_copie_url if is_owner else None,
            "vision_corrections": r.vision_corrections if is_owner else None,
            "dataset_valide": r.dataset_valide or False,
        }
        for r in reponses
    ]


@router.get("/{epreuve_id}/export")
def export_resultats_csv(
    epreuve_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_enseignant),
):
    """Export CSV des résultats d'une épreuve (enseignant propriétaire uniquement)."""
    ep = db.query(Epreuve).filter(Epreuve.id == epreuve_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Épreuve introuvable")
    if str(ep.enseignant_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Accès refusé")

    reponses = (
        db.query(EpreuveReponse)
        .filter(EpreuveReponse.epreuve_id == epreuve_id)
        .order_by(EpreuveReponse.submitted_at)
        .all()
    )

    apprenant_ids = [r.apprenant_id for r in reponses]
    apprenants = {
        str(u.id): u
        for u in db.query(User).filter(User.id.in_(apprenant_ids)).all()
    }

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Rang", "Nom", "Prénom", "Email", "Score /20", "Partie I /10", "Partie II /10", "Statut", "Date soumission", "Incidents"])

    for i, r in enumerate(reponses, 1):
        u = apprenants.get(str(r.apprenant_id))
        writer.writerow([
            i,
            u.nom    if u else "",
            u.prenom if u else "",
            u.email  if u else str(r.apprenant_id),
            f"{r.score_total:.2f}" if r.score_total is not None else "",
            f"{r.score_p1:.2f}"    if r.score_p1    is not None else "",
            f"{r.score_p2:.2f}"    if r.score_p2    is not None else "",
            r.statut or "",
            r.submitted_at.strftime("%d/%m/%Y %H:%M") if r.submitted_at else "",
            r.nb_incidents or 0,
        ])

    output.seek(0)
    filename = f"{ep.titre.replace(' ', '_')}_resultats.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/apprenant/{apprenant_id}/resultats")
def resultats_apprenant(
    apprenant_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Résultats d'épreuves d'un apprenant spécifique.
    Réservé à l'enseignant propriétaire des épreuves.
    """
    epreuves = db.query(Epreuve).filter(
        Epreuve.enseignant_id == current_user.id
    ).order_by(Epreuve.created_at.desc()).all()

    result = []
    for ep in epreuves:
        rep = (
            db.query(EpreuveReponse)
            .filter(
                EpreuveReponse.epreuve_id == ep.id,
                EpreuveReponse.apprenant_id == apprenant_id,
            )
            .first()
        )
        result.append({
            "epreuve_id":    str(ep.id),
            "titre":         ep.titre,
            "type_epreuve":  ep.type_epreuve,
            "classe_label":  ep.classe_label,
            "statut_ep":     ep.statut,
            "soumis":        rep is not None,
            "score_total":   rep.score_total   if rep else None,
            "score_p1":      rep.score_p1      if rep else None,
            "score_p2":      rep.score_p2      if rep else None,
            "nb_incidents":  rep.nb_incidents  if rep else 0,
            "statut_rep":    rep.statut        if rep else None,
            "submitted_at":  rep.submitted_at.isoformat() if rep and rep.submitted_at else None,
        })
    return result


# ── Copie papier + Dataset ────────────────────────────────────────────────────

@router.post("/{epreuve_id}/soumettre-papier", status_code=201)
async def soumettre_papier(
    epreuve_id: UUID,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """L'apprenant uploade une photo de sa copie manuscrite. Claude Vision la lit et la corrige."""
    ep = db.query(Epreuve).filter(Epreuve.id == epreuve_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Épreuve introuvable")
    now = datetime.now(timezone.utc)
    if _effective_statut(ep, now) != "publie":
        raise HTTPException(status_code=403, detail="Épreuve non accessible")

    existing = (
        db.query(EpreuveReponse)
        .filter(
            EpreuveReponse.epreuve_id == epreuve_id,
            EpreuveReponse.apprenant_id == current_user.id,
            EpreuveReponse.statut == "soumis",
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Épreuve déjà soumise")

    # Sauvegarde l'image
    os.makedirs("static/copies", exist_ok=True)
    ext = os.path.splitext(image.filename or "")[1] or ".jpg"
    filename = f"{epreuve_id}_{current_user.id}{ext}"
    filepath = f"static/copies/{filename}"

    image_bytes = await image.read()
    with open(filepath, "wb") as f:
        f.write(image_bytes)

    # Correction par vision IA
    vision_result = None
    try:
        from ..services.llm_service import corriger_copie_vision
        media_type = image.content_type or "image/jpeg"
        vision_result = corriger_copie_vision(image_bytes, media_type, ep.contenu)
    except Exception as e:
        import logging
        logging.warning(f"[soumettre-papier] Vision correction failed: {e}")

    rep = EpreuveReponse(
        epreuve_id=epreuve_id,
        apprenant_id=current_user.id,
        reponses=vision_result.get("reponses_lues") if vision_result else {},
        corrections=None,
        score_total=vision_result.get("score_total") if vision_result else None,
        score_p1=None,
        score_p2=None,
        nb_incidents=0,
        incidents_log=[],
        copie_type="papier",
        image_copie_url=f"/static/copies/{filename}",
        vision_corrections=vision_result,
        dataset_valide=False,
        statut="soumis",
        submitted_at=now,
    )
    db.add(rep)
    db.commit()
    db.refresh(rep)

    return {
        "id": str(rep.id),
        "copie_type": "papier",
        "image_copie_url": rep.image_copie_url,
        "vision_corrections": vision_result,
        "score_total": rep.score_total,
        "statut": rep.statut,
        "message": "Copie analysée par IA — l'enseignant va valider la correction" if vision_result else "Copie reçue — correction manuelle requise",
    }


@router.patch("/reponses/{reponse_id}/valider-dataset")
def valider_dataset(
    reponse_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_enseignant),
):
    """L'enseignant valide une copie papier pour le dataset d'entraînement."""
    rep = db.query(EpreuveReponse).filter(EpreuveReponse.id == reponse_id).first()
    if not rep:
        raise HTTPException(status_code=404, detail="Copie introuvable")
    ep = db.query(Epreuve).filter(Epreuve.id == rep.epreuve_id).first()
    if not ep or str(ep.enseignant_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Action non autorisée")
    if rep.copie_type != "papier":
        raise HTTPException(status_code=400, detail="Seules les copies papier peuvent être validées pour le dataset")

    rep.dataset_valide = not rep.dataset_valide
    db.commit()
    return {"id": str(rep.id), "dataset_valide": rep.dataset_valide}


@router.get("/dataset/stats")
def dataset_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Statistiques des copies papier pour le dataset."""
    if current_user.role not in ("super_admin", "enseignant"):
        raise HTTPException(status_code=403, detail="Accès refusé")

    total  = db.query(EpreuveReponse).filter(EpreuveReponse.copie_type == "papier").count()
    valide = db.query(EpreuveReponse).filter(
        EpreuveReponse.copie_type == "papier",
        EpreuveReponse.dataset_valide == True,
    ).count()

    return {
        "total_copies_papier": total,
        "total_validees": valide,
        "pct_valide": round(valide / max(total, 1) * 100, 1),
    }


@router.get("/dataset/export")
def dataset_export(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export JSON du dataset validé pour fine-tuning (super_admin uniquement)."""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Accès super admin requis")

    copies = (
        db.query(EpreuveReponse)
        .filter(
            EpreuveReponse.copie_type == "papier",
            EpreuveReponse.dataset_valide == True,
        )
        .all()
    )

    dataset = []
    for rep in copies:
        ep = db.query(Epreuve).filter(Epreuve.id == rep.epreuve_id).first()
        dataset.append({
            "id": str(rep.id),
            "epreuve_titre": ep.titre if ep else None,
            "image_url": rep.image_copie_url,
            "vision_corrections_ia": rep.vision_corrections,
            "corrections_enseignant": rep.corrections,
            "score_total": rep.score_total,
            "submitted_at": rep.submitted_at.isoformat() if rep.submitted_at else None,
        })

    import json as _json
    output = _json.dumps({"dataset": dataset, "total": len(dataset)}, ensure_ascii=False, indent=2)
    return StreamingResponse(
        iter([output]),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="dataset_copies.json"'},
    )


@router.get("/dataset/copies")
def dataset_copies_list(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Liste toutes les copies papier avec leur statut de validation (super_admin)."""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Accès super admin requis")

    copies = (
        db.query(EpreuveReponse)
        .filter(EpreuveReponse.copie_type == "papier")
        .order_by(EpreuveReponse.created_at.desc())
        .all()
    )

    apprenant_ids = [r.apprenant_id for r in copies]
    epreuve_ids   = [r.epreuve_id   for r in copies]

    apprenants = {str(u.id): u for u in db.query(User).filter(User.id.in_(apprenant_ids)).all()} if apprenant_ids else {}
    epreuves   = {str(e.id): e for e in db.query(Epreuve).filter(Epreuve.id.in_(epreuve_ids)).all()} if epreuve_ids else {}

    return [
        {
            "id": str(r.id),
            "apprenant_nom": (
                f"{apprenants[str(r.apprenant_id)].prenom} {apprenants[str(r.apprenant_id)].nom}"
                if str(r.apprenant_id) in apprenants else "—"
            ),
            "epreuve_titre": epreuves[str(r.epreuve_id)].titre if str(r.epreuve_id) in epreuves else "—",
            "image_copie_url": r.image_copie_url,
            "score_total": r.score_total,
            "dataset_valide": r.dataset_valide or False,
            "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
            "has_vision": r.vision_corrections is not None,
            "has_teacher_correction": r.corrections is not None,
        }
        for r in copies
    ]
