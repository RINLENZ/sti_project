import json
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from ..database import get_db
from ..models.user import User
from ..services.auth_service import (
    authenticate_user, create_access_token,
    hash_password, get_user_by_email
)
from ..dependencies import get_current_user

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
    access_token: str
    token_type:   str
    user_id:      str
    role:         str
    nom:          str
    prenom:       str
    niveau:       Optional[str]
    code_invitation: Optional[str]


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
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {
        "access_token":        token,
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