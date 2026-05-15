import json
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from ..config import settings
from ..database import SessionLocal
from ..models.user import User
from ..models.chat import ChatRoom, ChatMessage
from ..ws_manager import manager

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
                    "id":          str(msg.id),
                    "contenu":     msg.contenu,
                    "sender_id":   str(user.id),
                    "sender_nom":  f"{user.prenom} {user.nom}",
                    "created_at":  msg.created_at.isoformat() if msg.created_at else None,
                },
            }
            # Diffuse à tous les membres de la salle
            await manager.broadcast_to_users(room.membres or [], payload)
    finally:
        if user:
            manager.disconnect(str(user.id), websocket)
        db.close()
