from ..models.user import User, Inscription

class InscriptionCreate(BaseModel):
    user_id:    UUID
    matiere_id: UUID

class UserUpdate(BaseModel):
    classe:        Optional[str] = None
    niveau:        Optional[str] = None
    etablissement: Optional[str] = None
    actif:         Optional[bool] = None


@router.get("/apprenants")
def get_apprenants(db: Session = Depends(get_db)):
    """Liste tous les apprenants avec leurs inscriptions."""
    apprenants = db.query(User).filter(User.role == "apprenant").all()
    result = []
    for a in apprenants:
        inscriptions = db.query(Inscription).filter(
            Inscription.user_id == a.id
        ).all()
        matiere_ids = [str(i.matiere_id) for i in inscriptions]
        result.append({
            "id":            str(a.id),
            "nom":           a.nom,
            "prenom":        a.prenom,
            "email":         a.email,
            "classe":        a.classe,
            "niveau":        a.niveau,
            "etablissement": a.etablissement,
            "actif":         a.actif,
            "inscriptions":  matiere_ids
        })
    return result


@router.post("/inscription", status_code=201)
def inscrire_apprenant(body: InscriptionCreate,
                       db: Session = Depends(get_db)):
    """Inscrit un apprenant à une matière."""
    # Vérifie que l'inscription n'existe pas déjà
    existing = db.query(Inscription).filter(
        Inscription.user_id    == body.user_id,
        Inscription.matiere_id == body.matiere_id
    ).first()
    if existing:
        if not existing.actif:
            existing.actif = True
            db.commit()
            return {"message": "Inscription réactivée"}
        raise HTTPException(400, "Apprenant déjà inscrit à cette matière")

    inscription = Inscription(
        user_id=body.user_id,
        matiere_id=body.matiere_id
    )
    db.add(inscription)
    db.commit()
    return {"message": "Apprenant inscrit avec succès"}


@router.delete("/inscription/{user_id}/{matiere_id}")
def desinscrire_apprenant(user_id: UUID, matiere_id: UUID,
                          db: Session = Depends(get_db)):
    """Désinscrit un apprenant d'une matière."""
    inscription = db.query(Inscription).filter(
        Inscription.user_id    == user_id,
        Inscription.matiere_id == matiere_id
    ).first()
    if not inscription:
        raise HTTPException(404, "Inscription introuvable")
    inscription.actif = False
    db.commit()
    return {"message": "Apprenant désinscrit"}


@router.put("/apprenant/{user_id}")
def update_apprenant(user_id: UUID, body: UserUpdate,
                     db: Session = Depends(get_db)):
    """Met à jour le profil scolaire d'un apprenant."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")
    for field, value in body.dict(exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    return {"message": "Profil mis à jour"}