from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from uuid import UUID
from typing import Optional

from ..database import get_db
from ..dependencies import get_current_user
from ..models.user import User
from ..models.chat import ChatRoom, ChatMessage
from ..ws_manager import push_to_user

router = APIRouter(prefix="/api/chat", tags=["Chat"])


# ── Schemas ───────────────────────────────────────────────────────

class CreateRoomRequest(BaseModel):
    room_type: str = Field(..., alias="type")   # "direct" | "classe"  (alias évite conflit Pydantic v2)
    nom: Optional[str] = None
    membres: list[str]

    model_config = {"populate_by_name": True}


class SendMessageRequest(BaseModel):
    contenu: str


# ── Helpers ───────────────────────────────────────────────────────

def _unread_count(room_id, current_user_id: str, db: Session) -> int:
    """Compte les messages non lus en filtrant en Python — pas d'opérateur JSONB."""
    msgs = db.query(ChatMessage).filter(ChatMessage.room_id == room_id).all()
    return sum(1 for m in msgs if current_user_id not in (m.lu_par or []))


def _room_to_dict(room: ChatRoom, db: Session, current_user_id: str) -> dict:
    member_ids = room.membres or []
    members_info = []
    for uid in member_ids:
        try:
            u = db.query(User).filter(User.id == UUID(str(uid))).first()
        except Exception:
            continue
        if u:
            members_info.append({"id": str(u.id), "nom": f"{u.prenom} {u.nom}", "role": u.role})

    last = (
        db.query(ChatMessage)
        .filter(ChatMessage.room_id == room.id)
        .order_by(ChatMessage.created_at.desc())
        .first()
    )

    return {
        "id":         str(room.id),
        "type":       room.type,
        "nom":        room.nom,
        "membres":    members_info,
        "created_at": room.created_at.isoformat() if room.created_at else None,
        "last_message": {
            "contenu":    last.contenu,
            "sender_id":  str(last.sender_id),
            "created_at": last.created_at.isoformat() if last.created_at else None,
        } if last else None,
        "unread": _unread_count(room.id, current_user_id, db),
    }


# ── Routes ───────────────────────────────────────────────────────

@router.get("/rooms")
def list_rooms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne les salles de chat de l'utilisateur — filtrage Python (compatible JSON et JSONB)."""
    uid = str(current_user.id)
    all_rooms = db.query(ChatRoom).order_by(ChatRoom.created_at.desc()).all()
    rooms = [r for r in all_rooms if uid in (r.membres or [])]
    return [_room_to_dict(r, db, uid) for r in rooms]


@router.post("/rooms")
def create_room(
    body: CreateRoomRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crée une salle de chat (direct ou classe)."""
    if body.room_type not in ("direct", "classe"):
        raise HTTPException(400, "type doit être 'direct' ou 'classe'")

    membres = list({str(current_user.id)} | {str(m) for m in body.membres})

    # Évite doublons pour les conversations directes — filtrage Python
    if body.room_type == "direct" and len(membres) == 2:
        all_direct = db.query(ChatRoom).filter(ChatRoom.type == "direct").all()
        for r in all_direct:
            m = set(r.membres or [])
            if m == set(membres):
                return _room_to_dict(r, db, str(current_user.id))

    room = ChatRoom(
        type=body.room_type,
        nom=body.nom,
        membres=membres,
        created_by=current_user.id,
    )
    db.add(room)
    db.commit()
    db.refresh(room)

    # Notifie les autres membres via WS
    for uid in membres:
        if uid != str(current_user.id):
            push_to_user(uid, {
                "type": "new_room",
                "room": _room_to_dict(room, db, uid),
            })

    return _room_to_dict(room, db, str(current_user.id))


@router.get("/rooms/{room_id}/messages")
def get_messages(
    room_id: UUID,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Historique des messages (les plus récents en dernier)."""
    room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
    if not room or str(current_user.id) not in (room.membres or []):
        raise HTTPException(404, "Salle introuvable ou accès refusé")

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.room_id == room_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
        .all()
    )
    messages.reverse()

    # Marquer comme lus (filtrage Python)
    user_id_str = str(current_user.id)
    for msg in messages:
        lus = msg.lu_par or []
        if user_id_str not in lus:
            msg.lu_par = lus + [user_id_str]
    db.commit()

    return [
        {
            "id":         str(m.id),
            "contenu":    m.contenu,
            "sender_id":  str(m.sender_id),
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]


@router.post("/rooms/{room_id}/messages")
def send_message(
    room_id: UUID,
    body: SendMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Endpoint REST de secours pour envoyer un message."""
    room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
    if not room or str(current_user.id) not in (room.membres or []):
        raise HTTPException(404, "Salle introuvable ou accès refusé")

    contenu = body.contenu.strip()
    if not contenu or len(contenu) > 4000:
        raise HTTPException(400, "Message vide ou trop long")

    msg = ChatMessage(
        room_id=room_id,
        sender_id=current_user.id,
        contenu=contenu,
        lu_par=[str(current_user.id)],
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    payload = {
        "type": "chat_message",
        "room_id": str(room_id),
        "message": {
            "id":         str(msg.id),
            "contenu":    msg.contenu,
            "sender_id":  str(current_user.id),
            "sender_nom": f"{current_user.prenom} {current_user.nom}",
            "created_at": msg.created_at.isoformat() if msg.created_at else None,
        },
    }
    for uid in (room.membres or []):
        push_to_user(uid, payload)

    return {"id": str(msg.id), "ok": True}


@router.delete("/rooms/{room_id}")
def leave_room(
    room_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Quitter une salle de chat."""
    room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
    if not room or str(current_user.id) not in (room.membres or []):
        raise HTTPException(404, "Salle introuvable")

    room.membres = [m for m in (room.membres or []) if m != str(current_user.id)]
    db.commit()
    return {"ok": True}
