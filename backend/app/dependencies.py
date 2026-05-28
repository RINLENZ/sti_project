from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from typing import Optional
from .database import get_db
from .models.user import User
from .config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
# Même schème mais ne lève pas d'erreur si le token est absent
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expiré"
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        if payload.get("type") == "refresh":
            raise credentials_exception
        user_id: str = payload.get("sub")
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.actif:
        raise credentials_exception
    return user

def get_optional_user(
    token: Optional[str] = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Identique à get_current_user mais retourne None au lieu de 401 si non authentifié."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        if payload.get("type") == "refresh":
            return None
        user_id: str = payload.get("sub")
        if not user_id:
            return None
    except JWTError:
        return None
    user = db.query(User).filter(User.id == user_id).first()
    return user if (user and user.actif) else None


def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé au super administrateur"
        )
    return current_user

def require_enseignant(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("enseignant", "super_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux enseignants"
        )
    return current_user