"""
Cours en Live — API HTTP + WebSocket.

HTTP (REST):
  POST /live/creer               — Enseignant crée une session
  GET  /live/{code}              — Infos session par code (public pour rejoindre)
  POST /live/{id}/rejoindre      — Apprenant rejoint (enregistre participant)
  GET  /live/{id}/contenu        — Slides + exercices de la UA
  POST /live/{id}/demarrer       — Pilote démarre la session (statut attente → actif)
  POST /live/{id}/avancer        — Pilote passe au slide suivant
  POST /live/{id}/reculer        — Pilote revient au slide précédent
  POST /live/{id}/quiz/start     — Pilote active un quiz
  POST /live/{id}/quiz/end       — Pilote clôt le quiz (diffuse les stats)
  POST /live/{id}/pause          — Pilote met en pause
  POST /live/{id}/reprendre      — Pilote reprend
  POST /live/{id}/terminer       — Pilote termine la session
  GET  /live/{id}/participants   — Liste des participants connectés

WebSocket:
  /ws/live/{room_id}?token=...   — Connexion temps réel (voir ws.py)
"""
import secrets
import unicodedata
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user, require_enseignant
from ..models.cours import (
    UniteApprentissage, RessourcePedagogique, Exercice,
)
from ..models.cours_live import CoursLive, CoursLiveParticipant, CoursLiveQuizReponse
from ..models.user import User
from ..ws_manager import live_manager

router = APIRouter(prefix="/api/live", tags=["cours-live"])


# ── Helpers ───────────────────────────────────────────────────────

def _gen_code() -> str:
    return secrets.token_urlsafe(4).upper()[:6]


def _get_session(session_id: str, db: Session) -> CoursLive:
    s = db.query(CoursLive).filter(CoursLive.id == session_id).first()
    if not s:
        raise HTTPException(404, "Session introuvable")
    return s


def _require_pilot(session: CoursLive, user: User):
    if str(session.enseignant_id) != str(user.id) and user.role not in ("enseignant", "super_admin"):
        raise HTTPException(403, "Réservé au pilote de la session")


def _serialise_ressource(r: RessourcePedagogique) -> dict:
    return {
        "id":          str(r.id),
        "titre":       r.titre,
        "type":        r.type,
        "contenu":     r.contenu,
        "points_cles": r.points_cles,
        "ordre":       r.ordre,
    }


def _serialise_exercice(e: Exercice) -> dict:
    return {
        "id":               str(e.id),
        "titre":            e.titre,
        "type":             e.type,
        "enonce":           e.enonce,
        "options":          e.options,
        "reponse_correcte": e.reponse_correcte,
        "explication":      e.explication,
        "difficulte":       e.difficulte,
        "points":           e.points,
        "ordre":            e.ordre,
    }


async def _broadcast_slide(session: CoursLive, db: Session):
    ressources = (
        db.query(RessourcePedagogique)
        .filter(RessourcePedagogique.ua_id == session.ua_id)
        .order_by(RessourcePedagogique.ordre)
        .all()
    )
    total = len(ressources)
    idx   = max(0, min(session.slide_index, total - 1))
    r     = ressources[idx] if ressources else None
    await live_manager.broadcast(str(session.id), {
        "type":      "slide_change",
        "index":     idx,
        "total":     total,
        "ressource": _serialise_ressource(r) if r else None,
    })


# ── Schémas ───────────────────────────────────────────────────────

class CreerSessionBody(BaseModel):
    ua_id: str
    mode:  str = "enseignant"   # "enseignant" | "avatar"


class QuizStartBody(BaseModel):
    exercice_id: str


# ── Endpoints ─────────────────────────────────────────────────────

@router.get("/uas")
def list_uas(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_enseignant),
):
    """Liste toutes les UA actives avec au moins une ressource pédagogique."""
    uas = (
        db.query(UniteApprentissage)
        .filter(UniteApprentissage.actif == True)
        .order_by(UniteApprentissage.ordre)
        .all()
    )
    result = []
    for ua in uas:
        nb = db.query(RessourcePedagogique).filter(RessourcePedagogique.ua_id == ua.id).count()
        if nb > 0:
            result.append({"id": str(ua.id), "titre": ua.titre, "nb_ressources": nb})
    return result


@router.post("/creer")
async def creer_session(
    body: CreerSessionBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_enseignant),
):
    ua = db.query(UniteApprentissage).filter(UniteApprentissage.id == body.ua_id).first()
    if not ua:
        raise HTTPException(404, "UA introuvable")

    if body.mode not in ("enseignant", "avatar"):
        raise HTTPException(400, "mode doit être 'enseignant' ou 'avatar'")

    # Génère un code unique
    for _ in range(10):
        code = _gen_code()
        if not db.query(CoursLive).filter(CoursLive.code == code, CoursLive.statut != "termine").first():
            break

    session = CoursLive(
        ua_id=UUID(body.ua_id),
        enseignant_id=current_user.id,
        mode=body.mode,
        code=code,
        statut="attente",
        slide_index=0,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "id":   str(session.id),
        "code": session.code,
        "mode": session.mode,
        "ua":   {"id": str(ua.id), "titre": ua.titre},
    }


@router.get("/{code}")
def get_session_by_code(
    code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(CoursLive).filter(CoursLive.code == code.upper()).first()
    if not session or session.statut == "termine":
        raise HTTPException(404, "Session introuvable ou terminée")

    ua = db.query(UniteApprentissage).filter(UniteApprentissage.id == session.ua_id).first()
    pilote = db.query(User).filter(User.id == session.enseignant_id).first()

    return {
        "id":      str(session.id),
        "code":    session.code,
        "statut":  session.statut,
        "mode":    session.mode,
        "ua":      {"id": str(ua.id), "titre": ua.titre} if ua else None,
        "pilote":  f"{pilote.prenom} {pilote.nom}" if pilote else "Alisha",
        "participants": live_manager.count(str(session.id)),
    }


@router.post("/{session_id}/rejoindre")
async def rejoindre_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_session(session_id, db)
    if session.statut == "termine":
        raise HTTPException(400, "Session terminée")

    existing = (
        db.query(CoursLiveParticipant)
        .filter(
            CoursLiveParticipant.cours_live_id == session.id,
            CoursLiveParticipant.user_id == current_user.id,
            CoursLiveParticipant.left_at == None,
        )
        .first()
    )
    if not existing:
        p = CoursLiveParticipant(cours_live_id=session.id, user_id=current_user.id)
        db.add(p)
        db.commit()

    return {"ok": True, "statut": session.statut, "slide_index": session.slide_index}


@router.get("/{session_id}/contenu")
def get_contenu(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_session(session_id, db)

    ressources = (
        db.query(RessourcePedagogique)
        .filter(RessourcePedagogique.ua_id == session.ua_id)
        .order_by(RessourcePedagogique.ordre)
        .all()
    )
    exercices = (
        db.query(Exercice)
        .filter(Exercice.ua_id == session.ua_id)
        .order_by(Exercice.ordre)
        .all()
    )
    return {
        "slide_index": session.slide_index,
        "ressources":  [_serialise_ressource(r) for r in ressources],
        "exercices":   [_serialise_exercice(e) for e in exercices],
    }


@router.post("/{session_id}/demarrer")
async def demarrer_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_session(session_id, db)
    _require_pilot(session, current_user)
    if session.statut != "attente":
        raise HTTPException(400, "Session déjà démarrée")

    session.statut     = "actif"
    session.started_at = datetime.now(timezone.utc)
    db.commit()

    await live_manager.broadcast(str(session.id), {"type": "session_started"})
    await _broadcast_slide(session, db)
    return {"ok": True}


@router.post("/{session_id}/avancer")
async def avancer_slide(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_session(session_id, db)
    _require_pilot(session, current_user)
    if session.statut not in ("actif", "pause"):
        raise HTTPException(400, "Session non active")

    ressources = (
        db.query(RessourcePedagogique)
        .filter(RessourcePedagogique.ua_id == session.ua_id)
        .count()
    )
    if session.slide_index < ressources - 1:
        session.slide_index += 1
        db.commit()

    await _broadcast_slide(session, db)
    return {"ok": True, "slide_index": session.slide_index}


@router.post("/{session_id}/reculer")
async def reculer_slide(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_session(session_id, db)
    _require_pilot(session, current_user)
    if session.statut not in ("actif", "pause"):
        raise HTTPException(400, "Session non active")

    if session.slide_index > 0:
        session.slide_index -= 1
        db.commit()

    await _broadcast_slide(session, db)
    return {"ok": True, "slide_index": session.slide_index}


@router.post("/{session_id}/quiz/start")
async def demarrer_quiz(
    session_id: str,
    body: QuizStartBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_session(session_id, db)
    _require_pilot(session, current_user)
    if session.statut != "actif":
        raise HTTPException(400, "Session non active")

    ex = db.query(Exercice).filter(Exercice.id == body.exercice_id).first()
    if not ex:
        raise HTTPException(404, "Exercice introuvable")

    session.quiz_actif       = True
    session.quiz_exercice_id = ex.id
    db.commit()

    await live_manager.broadcast(str(session.id), {
        "type":     "quiz_start",
        "exercice": _serialise_exercice(ex),
    })
    return {"ok": True}


@router.post("/{session_id}/quiz/end")
async def clore_quiz(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_session(session_id, db)
    _require_pilot(session, current_user)
    if not session.quiz_actif:
        raise HTTPException(400, "Aucun quiz actif")

    # Stats
    reponses = (
        db.query(CoursLiveQuizReponse)
        .filter(
            CoursLiveQuizReponse.cours_live_id == session.id,
            CoursLiveQuizReponse.exercice_id == session.quiz_exercice_id,
        )
        .all()
    )
    total   = len(reponses)
    correct = sum(1 for r in reponses if r.correct)

    session.quiz_actif       = False
    session.quiz_exercice_id = None
    db.commit()

    ex = db.query(Exercice).filter(Exercice.id == session.quiz_exercice_id).first() if session.quiz_exercice_id else None

    await live_manager.broadcast(str(session.id), {
        "type":    "quiz_end",
        "stats":   {
            "total":    total,
            "correct":  correct,
            "pct":      round(correct / total * 100) if total else 0,
        },
        "explication": ex.explication if ex else None,
    })
    return {"ok": True, "total": total, "correct": correct}


@router.post("/{session_id}/pause")
async def pause_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_session(session_id, db)
    _require_pilot(session, current_user)
    if session.statut != "actif":
        raise HTTPException(400, "Session non active")

    session.statut = "pause"
    db.commit()
    await live_manager.broadcast(str(session.id), {"type": "session_paused"})
    return {"ok": True}


@router.post("/{session_id}/reprendre")
async def reprendre_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_session(session_id, db)
    _require_pilot(session, current_user)
    if session.statut != "pause":
        raise HTTPException(400, "Session non en pause")

    session.statut = "actif"
    db.commit()
    await live_manager.broadcast(str(session.id), {"type": "session_resumed"})
    return {"ok": True}


@router.post("/{session_id}/terminer")
async def terminer_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_session(session_id, db)
    _require_pilot(session, current_user)
    if session.statut == "termine":
        raise HTTPException(400, "Déjà terminée")

    session.statut   = "termine"
    session.ended_at = datetime.now(timezone.utc)
    db.commit()

    # Marque tous les participants comme partis
    db.query(CoursLiveParticipant).filter(
        CoursLiveParticipant.cours_live_id == session.id,
        CoursLiveParticipant.left_at == None,
    ).update({"left_at": datetime.now(timezone.utc)})
    db.commit()

    await live_manager.broadcast(str(session.id), {"type": "session_ended"})
    return {"ok": True}


@router.get("/{session_id}/participants")
def get_participants(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_session(session_id, db)
    connected = live_manager.user_ids(str(session.id))

    users = db.query(User).filter(User.id.in_(connected)).all()
    return {
        "count": len(connected),
        "participants": [
            {"id": str(u.id), "nom": f"{u.prenom} {u.nom}", "avatar": u.avatar}
            for u in users
        ],
    }
