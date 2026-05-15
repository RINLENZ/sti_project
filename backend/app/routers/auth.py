import json
import secrets
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from ..database import get_db
from ..models.user import User
from ..services.auth_service import (
    authenticate_user, create_access_token, create_refresh_token,
    decode_refresh_token, hash_password, get_user_by_email
)
from ..dependencies import get_current_user
from ..config import settings
import redis as redis_lib

router = APIRouter(prefix="/auth", tags=["authentification"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ── Schemas ────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email:    str
    nom:      str
    prenom:   str
    password: str
    role:     str = "apprenant"
    niveau:   Optional[str] = None
    pays:     Optional[str] = "Cameroun"


class Token(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str
    user_id:       str
    role:          str
    nom:           str
    prenom:        str
    niveau:        Optional[str]
    code_invitation: Optional[str]


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Authentification ───────────────────────────────────────────────

@router.post("/register", status_code=201)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Crée un nouveau compte apprenant ou enseignant."""
    if get_user_by_email(db, user_data.email):
        raise HTTPException(400, "Email déjà utilisé")

    user = User(
        email=user_data.email,
        nom=user_data.nom,
        prenom=user_data.prenom,
        password=hash_password(user_data.password),
        role=user_data.role,
        niveau_label=user_data.niveau,
        pays=user_data.pays,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "Compte créé", "user_id": str(user.id)}


@router.post("/login")
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db:   Session = Depends(get_db)
):
    """Authentifie un utilisateur et retourne un token JWT."""
    user = authenticate_user(db, form.username, form.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect"
        )
    claims = {"sub": str(user.id), "role": user.role}
    token         = create_access_token(claims)
    refresh_token = create_refresh_token(claims)
    return {
        "access_token":        token,
        "refresh_token":       refresh_token,
        "token_type":          "bearer",
        "user_id":             str(user.id),
        "role":                user.role,
        "nom":                 user.nom,
        "prenom":              user.prenom,
        "niveau":              user.niveau_label,
        "niveau_label":        user.niveau_label,
        "niveau_id":           str(user.niveau_id) if user.niveau_id else None,
        "filiere_label":       user.filiere_label,
        "pays":                user.pays,
        "avatar":              user.avatar,
        "code_invitation":     user.code_invitation,
        "etablissement":       user.etablissement,
        "ville":               user.ville,
        "matieres_enseignees": user.matieres_enseignees,
        "niveaux_enseignes":   user.niveaux_enseignes,
        "code_classe":         user.code_classe,
    }


@router.post("/refresh")
def refresh_token(body: RefreshRequest, db: Session = Depends(get_db)):
    """Échange un refresh token valide contre un nouvel access token."""
    payload = decode_refresh_token(body.refresh_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Refresh token invalide ou expiré")

    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user or not user.actif:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable ou inactif")

    claims = {"sub": str(user.id), "role": user.role}
    return {
        "access_token":  create_access_token(claims),
        "refresh_token": create_refresh_token(claims),
        "token_type":    "bearer",
    }


@router.get("/profil/{user_id}")
def get_profil(user_id: str, db: Session = Depends(get_db)):
    """Retourne le profil complet d'un utilisateur."""
    user = db.query(User).filter(User.id == UUID(user_id)).first()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")
    return {
        "id":              str(user.id),
        "email":           user.email,
        "nom":             user.nom,
        "prenom":          user.prenom,
        "role":            user.role,
        "niveau":          user.niveau_label,
        "pays":            user.pays,
        "code_invitation": user.code_invitation,
        "created_at":      str(user.created_at),
        "niveau_id":       str(user.niveau_id) if user.niveau_id else None,
        "avatar":          user.avatar if hasattr(user, "avatar") else None,
        "niveau_label":    user.niveau_label,
        "filiere_label":   user.filiere_label if hasattr(user, "filiere_label") else None,
    }


# ── Relation tuteur / apprenant ────────────────────────────────────

@router.post("/tuteur/lier")
def lier_tuteur(code: str, tuteur_id: str, db: Session = Depends(get_db)):
    """
    Un enseignant entre le code_invitation d'un apprenant
    pour commencer à suivre sa progression.
    """
    from ..models.user import TuteurSuivi

    apprenant = db.query(User).filter(
        User.code_invitation == code.strip().upper(),
        User.role == "apprenant"
    ).first()
    if not apprenant:
        raise HTTPException(404, "Code d'invitation invalide")

    existing = db.query(TuteurSuivi).filter(
        TuteurSuivi.apprenant_id == apprenant.id,
        TuteurSuivi.tuteur_id    == UUID(tuteur_id)
    ).first()
    if existing:
        if not existing.actif:
            existing.actif = True
            db.commit()
        return {
            "message":   "Lien tuteur activé",
            "apprenant": f"{apprenant.prenom} {apprenant.nom}"
        }

    lien = TuteurSuivi(
        apprenant_id=apprenant.id,
        tuteur_id=UUID(tuteur_id)
    )
    db.add(lien)
    db.commit()
    return {
        "message":      "Lien créé avec succès",
        "apprenant":    f"{apprenant.prenom} {apprenant.nom}",
        "apprenant_id": str(apprenant.id)
    }


@router.post("/lier-enseignant")
def lier_par_code_classe(
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Un apprenant entre le code_classe d'un enseignant.
    Crée automatiquement la relation TuteurSuivi.
    """
    from ..models.user import TuteurSuivi

    code_classe = body.get("code_classe", "").upper().strip()
    if not code_classe:
        raise HTTPException(400, "code_classe requis")

    enseignant = db.query(User).filter(
        User.code_classe == code_classe,
        User.role == "enseignant"
    ).first()
    if not enseignant:
        raise HTTPException(404, "Aucun enseignant trouvé avec ce code")

    existing = db.query(TuteurSuivi).filter(
        TuteurSuivi.apprenant_id == current_user.id,
        TuteurSuivi.tuteur_id    == enseignant.id,
    ).first()
    if existing:
        if not existing.actif:
            existing.actif = True
            db.commit()
        return {
            "message":    "Déjà lié à cet enseignant",
            "enseignant": f"{enseignant.prenom} {enseignant.nom}"
        }

    lien = TuteurSuivi(
        apprenant_id=current_user.id,
        tuteur_id=enseignant.id,
        actif=True
    )
    db.add(lien)
    db.commit()

    try:
        from ..services.notification_service import notif_enseignant_lie, notif_apprenant_lie
        enseignant_nom = f"{enseignant.prenom} {enseignant.nom}"
        apprenant_nom  = f"{current_user.prenom} {current_user.nom}"
        notif_enseignant_lie(db, current_user.id, enseignant_nom)
        notif_apprenant_lie(db, enseignant.id, apprenant_nom, current_user.niveau_label)
    except Exception:
        pass

    return {
        "message":    f"Tu es maintenant lié à {enseignant.prenom} {enseignant.nom}",
        "enseignant": f"{enseignant.prenom} {enseignant.nom}",
        "tuteur_id":  str(enseignant.id)
    }


@router.get("/tuteur/{tuteur_id}/apprenants")
def get_apprenants_du_tuteur(tuteur_id: str, db: Session = Depends(get_db)):
    """Retourne tous les apprenants suivis par un tuteur."""
    from ..models.user import TuteurSuivi

    liens = db.query(TuteurSuivi).filter(
        TuteurSuivi.tuteur_id == UUID(tuteur_id),
        TuteurSuivi.actif     == True
    ).all()

    result = []
    for lien in liens:
        apprenant = db.query(User).filter(
            User.id == lien.apprenant_id
        ).first()
        if apprenant:
            result.append({
                "id":     str(apprenant.id),
                "nom":    apprenant.nom,
                "prenom": apprenant.prenom,
                "email":  apprenant.email,
                "niveau": apprenant.niveau_label,
            })
    return result


@router.put("/profil/{user_id}/update")
def update_mon_profil(
    user_id: UUID,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Met à jour le profil d'un utilisateur connecté.
    Accessible à tout rôle pour son propre compte.
    """
    if str(current_user.id) != str(user_id):
        raise HTTPException(403, "Vous ne pouvez modifier que votre propre profil")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")

    champs_autorises = [
        # Identité
        "nom", "prenom",
        # Apprenant
        "niveau_label", "filiere_label", "pays", "niveau",
        "niveau_id", "filiere_id", "avatar",
        # Enseignant
        "etablissement", "ville",
        "matieres_enseignees", "niveaux_enseignes",
        "code_classe",
    ]

    for field, value in body.items():
        if field in champs_autorises:
            # Sérialise les listes en JSON string
            if isinstance(value, list):
                setattr(user, field, json.dumps(value, ensure_ascii=False))
            else:
                setattr(user, field, value)

    db.commit()
    db.refresh(user)

    return {
        "message":             "Profil mis à jour",
        "nom":                 user.nom,
        "prenom":              user.prenom,
        "niveau_label":        user.niveau_label,
        "niveau_id":           str(user.niveau_id)  if user.niveau_id  else None,
        "filiere_label":       user.filiere_label,
        "filiere_id":          str(user.filiere_id) if user.filiere_id else None,
        "pays":                user.pays,
        "avatar":              user.avatar,
        "etablissement":       user.etablissement,
        "ville":               user.ville,
        "code_classe":         user.code_classe,
        "matieres_enseignees": user.matieres_enseignees,
        "niveaux_enseignes":   user.niveaux_enseignes,
    }


# ── Réinitialisation mot de passe ─────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token:        str
    new_password: str


def _send_reset_email(to_email: str, prenom: str, reset_url: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Réinitialisation de votre mot de passe SenSia"
    msg["From"]    = settings.smtp_from or settings.smtp_user
    msg["To"]      = to_email
    html = f"""
    <html><body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1A1207">
      <div style="background:linear-gradient(135deg,#6B3A2A,#C4865A);padding:20px 24px;border-radius:12px 12px 0 0">
        <h1 style="margin:0;color:white;font-size:20px">SenSia — Réinitialisation</h1>
      </div>
      <div style="border:1px solid #E8DDD6;border-top:none;padding:24px;border-radius:0 0 12px 12px">
        <p>Bonjour <strong>{prenom}</strong>,</p>
        <p>Tu as demandé la réinitialisation de ton mot de passe. Clique sur le bouton ci-dessous. Ce lien est valable <strong>1 heure</strong>.</p>
        <a href="{reset_url}" style="display:inline-block;padding:12px 28px;background:#6B3A2A;color:white;text-decoration:none;border-radius:8px;font-weight:700;margin:12px 0">
          Réinitialiser mon mot de passe →
        </a>
        <p style="color:#7C6256;font-size:12px;margin-top:20px">
          Si tu n'as pas demandé cette réinitialisation, ignore ce message. Ton mot de passe ne changera pas.
        </p>
      </div>
    </body></html>
    """
    msg.attach(MIMEText(html, "html"))
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as srv:
        srv.ehlo()
        srv.starttls()
        srv.login(settings.smtp_user, settings.smtp_password)
        srv.sendmail(settings.smtp_from or settings.smtp_user, to_email, msg.as_string())


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Génère un token de réinitialisation et l'envoie par email (si SMTP configuré)."""
    MSG_GENERIQUE = "Si cet email est enregistré, un lien de réinitialisation a été envoyé."
    user = get_user_by_email(db, body.email.strip().lower())
    if not user or not user.actif:
        return {"message": MSG_GENERIQUE}

    token = secrets.token_urlsafe(32)
    try:
        r = redis_lib.from_url(settings.redis_url, decode_responses=True)
        r.setex(f"pwd_reset:{token}", 3600, str(user.id))
    except Exception:
        raise HTTPException(500, "Service temporairement indisponible")

    reset_url = f"{settings.frontend_url}/reset-password?token={token}"

    if settings.smtp_host and settings.smtp_user:
        try:
            _send_reset_email(user.email, user.prenom, reset_url)
        except Exception:
            pass  # ne pas bloquer si l'email échoue

    return {
        "message": MSG_GENERIQUE,
        # Retourné seulement si SMTP non configuré (dev / test)
        "reset_url": reset_url if not (settings.smtp_host and settings.smtp_user) else None,
    }


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Valide le token Redis et met à jour le mot de passe."""
    if len(body.new_password) < 6:
        raise HTTPException(400, "Le mot de passe doit contenir au moins 6 caractères")
    try:
        r = redis_lib.from_url(settings.redis_url, decode_responses=True)
        user_id = r.get(f"pwd_reset:{body.token}")
    except Exception:
        raise HTTPException(500, "Service temporairement indisponible")

    if not user_id:
        raise HTTPException(400, "Lien invalide ou expiré")

    user = db.query(User).filter(User.id == UUID(user_id)).first()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")

    user.password = hash_password(body.new_password)
    db.commit()
    r.delete(f"pwd_reset:{body.token}")
    return {"message": "Mot de passe réinitialisé avec succès"}


@router.delete("/tuteur/delier/{apprenant_id}")
def delier_tuteur(apprenant_id: str, tuteur_id: str,
                  db: Session = Depends(get_db)):
    """Un apprenant peut retirer un tuteur de son suivi."""
    from ..models.user import TuteurSuivi

    lien = db.query(TuteurSuivi).filter(
        TuteurSuivi.apprenant_id == UUID(apprenant_id),
        TuteurSuivi.tuteur_id    == UUID(tuteur_id)
    ).first()
    if not lien:
        raise HTTPException(404, "Lien introuvable")
    lien.actif = False
    db.commit()
    return {"message": "Tuteur retiré du suivi"}