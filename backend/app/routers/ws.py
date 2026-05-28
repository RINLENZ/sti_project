import json
import unicodedata
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from ..config import settings
from ..database import SessionLocal
from ..models.user import User
from ..models.chat import ChatRoom, ChatMessage
from ..models.cours import Exercice
from ..models.cours_live import CoursLive, CoursLiveParticipant, CoursLiveQuizReponse
from ..ws_manager import manager, live_manager

router = APIRouter(tags=["WebSocket"])


def _auth_ws(token: str, db: Session) -> User | None:
    """Valide un token JWT depuis un paramètre query WebSocket."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        if payload.get("type") == "refresh":
            return None
        user_id = payload.get("sub")
        if not user_id:
            return None
        user = db.query(User).filter(User.id == user_id, User.actif == True).first()
        return user
    except JWTError:
        return None


# ── Notifications temps réel ──────────────────────────────────────

@router.websocket("/ws/notifications")
async def ws_notifications(
    websocket: WebSocket,
    token: str = Query(...),
):
    db = SessionLocal()
    try:
        user = _auth_ws(token, db)
        if not user:
            await websocket.close(code=4001)
            return

        user_id = str(user.id)
        await manager.connect(user_id, websocket)
        # Confirme connexion
        await websocket.send_json({"type": "connected", "user_id": user_id})

        while True:
            try:
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_text("pong")
            except WebSocketDisconnect:
                break
    finally:
        if user:
            manager.disconnect(str(user.id), websocket)
        db.close()


# ── Chat temps réel ───────────────────────────────────────────────

@router.websocket("/ws/chat/{room_id}")
async def ws_chat(
    websocket: WebSocket,
    room_id: str,
    token: str = Query(...),
):
    db = SessionLocal()
    user = None
    try:
        user = _auth_ws(token, db)
        if not user:
            await websocket.close(code=4001)
            return

        room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
        if not room or str(user.id) not in (room.membres or []):
            await websocket.close(code=4003)
            return

        user_id = str(user.id)
        await manager.connect(user_id, websocket)
        await websocket.send_json({"type": "joined", "room_id": room_id})

        while True:
            try:
                raw = await websocket.receive_text()
            except WebSocketDisconnect:
                break

            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if data.get("type") == "ping":
                await websocket.send_text("pong")
                continue

            if data.get("type") == "typing":
                other_members = [m for m in (room.membres or []) if m != user_id]
                await manager.broadcast_to_users(other_members, {
                    "type":    "typing",
                    "room_id": room_id,
                    "user_id": user_id,
                    "nom":     f"{user.prenom} {user.nom}",
                })
                continue

            contenu = (data.get("contenu") or "").strip()
            if not contenu or len(contenu) > 4000:
                continue

            # Sauvegarde en BD
            msg = ChatMessage(
                room_id=UUID(room_id),
                sender_id=user.id,
                contenu=contenu,
                lu_par=[str(user.id)],
            )
            db.add(msg)
            db.commit()
            db.refresh(msg)

            payload = {
                "type": "chat_message",
                "room_id": room_id,
                "message": {
                    "id":             str(msg.id),
                    "contenu":        msg.contenu,
                    "sender_id":      str(user.id),
                    "sender_nom":     f"{user.prenom} {user.nom}",
                    "created_at":     msg.created_at.isoformat() if msg.created_at else None,
                    # Bug 6 — nouveau message : pas encore lu par quelqu'un d'autre
                    "read_by_others": False,
                },
            }
            # Diffuse à tous les membres de la salle
            await manager.broadcast_to_users(room.membres or [], payload)
    finally:
        if user:
            manager.disconnect(str(user.id), websocket)
        db.close()


# ── Cours en Live ─────────────────────────────────────────────────

def _normalise(t: str) -> str:
    t = str(t).strip().lower()
    t = unicodedata.normalize("NFD", t)
    return "".join(c for c in t if unicodedata.category(c) != "Mn")


def _reponse_ok(submitted: str, expected: str) -> bool:
    alts = [a.strip() for a in expected.split("|")]
    return _normalise(submitted) in [_normalise(a) for a in alts]


@router.websocket("/ws/live/{room_id}")
async def ws_live(
    websocket: WebSocket,
    room_id: str,
    token: str = Query(...),
):
    db = SessionLocal()
    user: User | None = None
    session: CoursLive | None = None
    try:
        user = _auth_ws(token, db)
        if not user:
            await websocket.close(code=4001)
            return

        session = db.query(CoursLive).filter(CoursLive.id == room_id).first()
        if not session or session.statut == "termine":
            await websocket.close(code=4004)
            return

        user_id  = str(user.id)
        room_str = str(session.id)
        is_pilot = (str(session.enseignant_id) == user_id or
                    user.role in ("enseignant", "super_admin"))

        await live_manager.join(room_str, user_id, websocket)

        count = live_manager.count(room_str)
        await live_manager.broadcast(room_str, {
            "type":  "participant_join",
            "count": count,
            "nom":   f"{user.prenom} {user.nom}",
        }, exclude=user_id)

        await websocket.send_json({
            "type":        "connected",
            "role":        "pilot" if is_pilot else "student",
            "session_id":  room_str,
            "statut":      session.statut,
            "slide_index": session.slide_index,
            "quiz_actif":  session.quiz_actif,
            "count":       count,
        })

        while True:
            try:
                raw = await websocket.receive_text()
            except WebSocketDisconnect:
                break

            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = data.get("type")

            if msg_type == "ping":
                await websocket.send_text("pong")
                continue

            # ── Signal d'émotion (élèves uniquement) ───────────────
            if msg_type == "emotion" and not is_pilot:
                valeur = data.get("valeur", "")
                if valeur in ("engaged", "confused", "absent", "bored"):
                    p = (
                        db.query(CoursLiveParticipant)
                        .filter(
                            CoursLiveParticipant.cours_live_id == session.id,
                            CoursLiveParticipant.user_id == user.id,
                            CoursLiveParticipant.left_at == None,
                        )
                        .first()
                    )
                    if p:
                        score_map = {"engaged": 1.0, "confused": 0.5, "bored": 0.25, "absent": 0.0}
                        p.engagement = round(p.engagement * 0.7 + score_map[valeur] * 0.3, 3)
                        db.commit()
                    if session.enseignant_id:
                        await live_manager.send_to(room_str, str(session.enseignant_id), {
                            "type":    "student_emotion",
                            "user_id": user_id,
                            "nom":     f"{user.prenom} {user.nom}",
                            "valeur":  valeur,
                        })
                continue

            # ── Réponse quiz (élèves uniquement) ────────────────────
            if msg_type == "quiz_reponse" and not is_pilot:
                db.refresh(session)
                if not session.quiz_actif or not session.quiz_exercice_id:
                    continue
                reponse = str(data.get("reponse", "")).strip()
                if not reponse:
                    continue

                already = (
                    db.query(CoursLiveQuizReponse)
                    .filter(
                        CoursLiveQuizReponse.cours_live_id == session.id,
                        CoursLiveQuizReponse.exercice_id   == session.quiz_exercice_id,
                        CoursLiveQuizReponse.user_id       == user.id,
                    )
                    .first()
                )
                if already:
                    await websocket.send_json({"type": "quiz_reponse_ack", "correct": already.correct})
                    continue

                ex = db.query(Exercice).filter(Exercice.id == session.quiz_exercice_id).first()
                is_ok = _reponse_ok(reponse, ex.reponse_correcte) if ex else False

                db.add(CoursLiveQuizReponse(
                    cours_live_id=session.id,
                    exercice_id=session.quiz_exercice_id,
                    user_id=user.id,
                    reponse=reponse,
                    correct=is_ok,
                ))
                db.commit()

                await websocket.send_json({"type": "quiz_reponse_ack", "correct": is_ok})

                # Taux de réponses temps réel → pilote
                total_rep = (
                    db.query(CoursLiveQuizReponse)
                    .filter(
                        CoursLiveQuizReponse.cours_live_id == session.id,
                        CoursLiveQuizReponse.exercice_id   == session.quiz_exercice_id,
                    )
                    .count()
                )
                nb_eleves = max(live_manager.count(room_str) - 1, 0)
                if session.enseignant_id:
                    await live_manager.send_to(room_str, str(session.enseignant_id), {
                        "type":         "quiz_progress",
                        "repondu":      total_rep,
                        "total_eleves": nb_eleves,
                    })
                continue

    finally:
        if user:
            rs = str(session.id) if session else room_id
            live_manager.leave(rs, str(user.id))
            count = live_manager.count(rs)
            try:
                await live_manager.broadcast(rs, {
                    "type":  "participant_leave",
                    "count": count,
                    "nom":   f"{user.prenom} {user.nom}",
                })
            except Exception:
                pass
            try:
                db.query(CoursLiveParticipant).filter(
                    CoursLiveParticipant.cours_live_id == room_id,
                    CoursLiveParticipant.user_id == user.id,
                    CoursLiveParticipant.left_at == None,
                ).update({"left_at": datetime.now(timezone.utc)})
                db.commit()
            except Exception:
                pass
        db.close()
