from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user, require_enseignant
from ..models.cours import Matiere, UniteApprentissage, RessourcePedagogique
from ..models.examen import Epreuve, EpreuveReponse
from ..models.referentiel import Niveau
from ..models.user import User
from ..services.exam_service import generer_epreuve
from ..services.correction_service import recorriger_copie, SEMANTIC_TYPES, scorer_question

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


# ── Helpers ───────────────────────────────────────────────────────────────────

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
        raise HTTPException(status_code=502, detail=f"Erreur génération IA : {e}")

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
    Filtre par niveau si l'apprenant en a un. Inclut le statut de soumission.
    """
    query = db.query(Epreuve).filter(Epreuve.statut == "publie")

    if current_user.niveau_id:
        query = query.filter(
            (Epreuve.niveau_id == current_user.niveau_id) | (Epreuve.niveau_id == None)
        )

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

    return [
        {
            "id": str(e.id),
            "titre": e.titre,
            "type_epreuve": e.type_epreuve,
            "statut": e.statut,
            "duree_minutes": e.duree_minutes,
            "coefficient": e.coefficient,
            "classe_label": e.classe_label,
            "annee_scolaire": e.annee_scolaire,
            "created_at": e.created_at.isoformat() if e.created_at else None,
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
    if ep.statut != "publie":
        raise HTTPException(status_code=403, detail="Épreuve non publiée")

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

    return [
        {
            "id": str(r.id),
            "apprenant_id": str(r.apprenant_id),
            "score_total": r.score_total,
            "score_p1": r.score_p1,
            "score_p2": r.score_p2,
            "statut": r.statut,
            "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
            "corrections": r.corrections,
            "nb_incidents": r.nb_incidents,
            "incidents_log": r.incidents_log if is_owner else None,
        }
        for r in reponses
    ]


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
