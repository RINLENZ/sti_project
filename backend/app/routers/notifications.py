from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from uuid import UUID
from ..database import get_db
from ..models.notification import Notification
from ..dependencies import get_current_user
from ..models.user import User

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("")
def get_notifications(
    limit: int = Query(20, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne les N dernières notifications de l'utilisateur connecté."""
    notifs = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )
    nb_non_lues = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.lu == False)
        .count()
    )
    return {
        "nb_non_lues": nb_non_lues,
        "notifications": [
            {
                "id":         str(n.id),
                "type":       n.type,
                "titre":      n.titre,
                "message":    n.message,
                "lu":         n.lu,
                "created_at": n.created_at.isoformat() if n.created_at else None,
                "meta":       n.meta or {},
            }
            for n in notifs
        ],
    }


@router.put("/{notif_id}/lire")
def marquer_lue(
    notif_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notif = db.query(Notification).filter(
        Notification.id == notif_id,
        Notification.user_id == current_user.id,
    ).first()
    if notif:
        notif.lu = True
        db.commit()
    return {"ok": True}


@router.put("/tout-lire")
def marquer_tout_lu(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.lu == False,
    ).update({"lu": True})
    db.commit()
    return {"ok": True}
