from ..dependencies import require_super_admin
from ..models.user import User as UserModel
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from ..database import get_db
from ..models.user import User
from ..models.cours import Matiere, Module, FamilleSituation, UniteApprentissage, Exercice, RessourcePedagogique
from ..models.referentiel import Cycle, Ordre, Filiere, Niveau
from sqlalchemy.orm import joinedload
import sqlalchemy as sa

router = APIRouter(prefix="/api/admin", tags=["administration"])


@router.get("/db-check")
def db_check(db: Session = Depends(get_db)):
    """Diagnostic : vérifie les colonnes de la table modules."""
    result = db.execute(sa.text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='modules' ORDER BY ordinal_position"
    )).fetchall()
    cols = [r[0] for r in result]
    # Test requête Module
    try:
        count = db.query(Module).count()
        module_ok = True
    except Exception as e:
        count = 0
        module_ok = str(e)
    return {"columns": cols, "module_query_ok": module_ok, "nb_modules": count}


# ── Schemas ────────────────────────────────────────────────────────

class UserUpdate(BaseModel):
    niveau:        Optional[str] = None
    pays:          Optional[str] = None
    actif:         Optional[bool] = None

class UACreate(BaseModel):
    famille_id:        UUID
    titre:             str
    reference_ue:      Optional[str] = None
    competences:       Optional[list] = []
    situation_probleme: Optional[str] = None
    prerequis:         Optional[list] = []
    duree_estimee:     Optional[int] = 60
    ordre:             Optional[int] = 1

class UAUpdate(BaseModel):
    titre:             Optional[str] = None
    reference_ue:      Optional[str] = None
    competences:       Optional[list] = None
    situation_probleme: Optional[str] = None
    prerequis:         Optional[list] = None
    duree_estimee:     Optional[int] = None
    actif:             Optional[bool] = None

class ExerciceCreate(BaseModel):
    ua_id:              UUID
    titre:              str
    type:               str
    enonce:             str
    options:            Optional[list] = None
    reponse_correcte:   str
    explication:        Optional[str] = None
    indice_1:           Optional[str] = None
    indice_2:           Optional[str] = None
    competence_evaluee: Optional[str] = None
    difficulte:         Optional[int] = 1
    points:             Optional[int] = 10
    ordre:              Optional[int] = 1

class ExerciceUpdate(BaseModel):
    titre:              Optional[str] = None
    enonce:             Optional[str] = None
    options:            Optional[list] = None
    reponse_correcte:   Optional[str] = None
    explication:        Optional[str] = None
    indice_1:           Optional[str] = None
    indice_2:           Optional[str] = None
    competence_evaluee: Optional[str] = None
    difficulte:         Optional[int] = None
    points:             Optional[int] = None

class RessourceCreate(BaseModel):
    ua_id:      UUID
    titre:      str
    type:       str = "lecon"
    contenu:    str
    points_cles: Optional[list] = []
    ordre:      Optional[int] = 1

class FamilleCreate(BaseModel):
    module_id:   UUID
    titre:       str
    description: Optional[str] = None
    ordre:       Optional[int] = 1


class FiliereCreate(BaseModel):       
    ordre_id:    UUID
    nom:         str
    code:        str
    description: Optional[str] = None
    ordre:       Optional[int] = 1
class NiveauCreate(BaseModel):
    cycle_id: UUID
    nom:      str
    code:     str
    ordre:    Optional[int] = 1


# ── Gestion des apprenants ─────────────────────────────────────────

@router.get("/apprenants")
def get_apprenants(db: Session = Depends(get_db)):
    """Liste tous les apprenants."""
    apprenants = db.query(User).filter(User.role == "apprenant").all()
    result = []
    for a in apprenants:
        result.append({
            "id":     str(a.id),
            "nom":    a.nom,
            "prenom": a.prenom,
            "email":  a.email,
            "niveau": a.niveau_label,
            "pays":   a.pays,
            "actif":  a.actif,
        })
    return result


@router.put("/apprenant/{user_id}")
def update_apprenant(user_id: UUID, body: UserUpdate,
                     db: Session = Depends(get_db),
    _: UserModel = Depends(require_super_admin)):
    """Met à jour le profil d'un apprenant (niveau, pays)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    return {"message": "Profil mis à jour"}


# ── Structure pédagogique complète ────────────────────────────────

@router.get("/structure")
def get_structure_complete(db: Session = Depends(get_db),
    _: UserModel = Depends(require_super_admin)):
    """Retourne toute la structure pédagogique pour l'interface admin."""
    matieres = db.query(Matiere).filter(Matiere.actif == True).all()
    result = []
    for mat in matieres:
        modules = db.query(Module).filter(Module.matiere_id == mat.id).all()
        mods = []
        for mod in modules:
            familles = db.query(FamilleSituation).filter(
                FamilleSituation.module_id == mod.id
            ).all()
            fams = []
            for fam in familles:
                uas = db.query(UniteApprentissage).filter(
                    UniteApprentissage.famille_id == fam.id
                ).order_by(UniteApprentissage.ordre).all()
                ua_list = []
                for ua in uas:
                    nb_ex  = db.query(Exercice).filter(Exercice.ua_id == ua.id).count()
                    nb_res = db.query(RessourcePedagogique).filter(
                        RessourcePedagogique.ua_id == ua.id
                    ).count()
                    ua_list.append({
                        "id":               str(ua.id),
                        "titre":            ua.titre,
                        "reference_ue":     ua.reference_ue,
                        "competences":      ua.competences or [],
                        "situation_probleme": ua.situation_probleme,
                        "prerequis":        ua.prerequis or [],
                        "duree_estimee":    ua.duree_estimee,
                        "ordre":            ua.ordre,
                        "actif":            ua.actif,
                        "nb_exercices":     nb_ex,
                        "nb_ressources":    nb_res
                    })
                fams.append({
                    "id":      str(fam.id),
                    "titre":   fam.titre,
                    "description": fam.description,
                    "unites":  ua_list
                })
            filiere = db.query(Filiere).filter(Filiere.id == mod.filiere_id).first() if mod.filiere_id else None
            mods.append({
                "id":          str(mod.id),
                "numero":      mod.numero,
                "titre":       mod.titre,
                "niveau_id":   str(mod.niveau_id)  if mod.niveau_id  else None,
                "filiere_id":  str(mod.filiere_id) if mod.filiere_id else None,
                "filiere_nom": filiere.nom          if filiere        else None,
                "familles":    fams
            })
        result.append({
            "id":      str(mat.id),
            "nom":     mat.nom,
            "niveau":  None,  # champ supprimé — voir référentiel
            "modules": mods
        })
    return result


# ── CRUD Famille de situations ────────────────────────────────────

@router.post("/famille", status_code=201)
def create_famille(body: FamilleCreate, db: Session = Depends(get_db),
    _: UserModel = Depends(require_super_admin)):
    famille = FamilleSituation(**body.model_dump())
    db.add(famille)
    db.commit()
    db.refresh(famille)
    return {"id": str(famille.id), "titre": famille.titre}


# ── CRUD Unités d'Apprentissage ───────────────────────────────────

@router.post("/ua", status_code=201)
def create_ua(body: UACreate, db: Session = Depends(get_db),
    _: UserModel = Depends(require_super_admin)):
    ua = UniteApprentissage(**body.model_dump())
    db.add(ua)
    db.commit()
    db.refresh(ua)
    return {"id": str(ua.id), "titre": ua.titre, "message": "UA créée"}

@router.put("/ua/{ua_id}")
def update_ua(ua_id: UUID, body: UAUpdate, db: Session = Depends(get_db),
    _: UserModel = Depends(require_super_admin)):
    ua = db.query(UniteApprentissage).filter(
        UniteApprentissage.id == ua_id
    ).first()
    if not ua:
        raise HTTPException(404, "UA introuvable")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(ua, field, value)
    db.commit()
    return {"message": "UA mise à jour"}

@router.delete("/ua/{ua_id}")
def delete_ua(ua_id: UUID, db: Session = Depends(get_db),
    _: UserModel = Depends(require_super_admin)):
    ua = db.query(UniteApprentissage).filter(
        UniteApprentissage.id == ua_id
    ).first()
    if not ua:
        raise HTTPException(404, "UA introuvable")
    ua.actif = False
    db.commit()
    return {"message": "UA désactivée"}


# ── CRUD Exercices ────────────────────────────────────────────────

@router.get("/ua/{ua_id}/exercices")
def get_exercices(ua_id: UUID, db: Session = Depends(get_db),
    _: UserModel = Depends(require_super_admin)):
    exercices = db.query(Exercice).filter(
        Exercice.ua_id == ua_id
    ).order_by(Exercice.ordre).all()
    return [{
        "id":               str(e.id),
        "titre":            e.titre,
        "type":             e.type,
        "enonce":           e.enonce,
        "options":          e.options,
        "reponse_correcte": e.reponse_correcte,
        "explication":      e.explication,
        "indice_1":         e.indice_1,
        "indice_2":         e.indice_2,
        "competence_evaluee": e.competence_evaluee,
        "difficulte":       e.difficulte,
        "points":           e.points,
        "ordre":            e.ordre
    } for e in exercices]

@router.post("/exercice", status_code=201)
def create_exercice(body: ExerciceCreate, db: Session = Depends(get_db),
    _: UserModel = Depends(require_super_admin)):
    ex = Exercice(**body.model_dump())
    db.add(ex)
    db.commit()
    db.refresh(ex)
    return {"id": str(ex.id), "titre": ex.titre, "message": "Exercice créé"}

@router.put("/exercice/{exercice_id}")
def update_exercice(exercice_id: UUID, body: ExerciceUpdate,
                    db: Session = Depends(get_db),
    _: UserModel = Depends(require_super_admin)):
    ex = db.query(Exercice).filter(Exercice.id == exercice_id).first()
    if not ex:
        raise HTTPException(404, "Exercice introuvable")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(ex, field, value)
    db.commit()
    return {"message": "Exercice mis à jour"}

@router.delete("/exercice/{exercice_id}")
def delete_exercice(exercice_id: UUID, db: Session = Depends(get_db),
    _: UserModel = Depends(require_super_admin)):
    ex = db.query(Exercice).filter(Exercice.id == exercice_id).first()
    if not ex:
        raise HTTPException(404, "Exercice introuvable")
    db.delete(ex)
    db.commit()
    return {"message": "Exercice supprimé"}


# ── CRUD Ressources pédagogiques ──────────────────────────────────

@router.post("/ressource", status_code=201)
def create_ressource(body: RessourceCreate, db: Session = Depends(get_db),
    _: UserModel = Depends(require_super_admin)):
    res = RessourcePedagogique(**body.model_dump())
    db.add(res)
    db.commit()
    db.refresh(res)
    return {"id": str(res.id), "titre": res.titre, "message": "Ressource créée"}

@router.put("/ressource/{ressource_id}")
def update_ressource(ressource_id: UUID, body: RessourceCreate,
                     db: Session = Depends(get_db),
    _: UserModel = Depends(require_super_admin)):
    res = db.query(RessourcePedagogique).filter(
        RessourcePedagogique.id == ressource_id
    ).first()
    if not res:
        raise HTTPException(404, "Ressource introuvable")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(res, field, value)
    db.commit()
    return {"message": "Ressource mise à jour"}

@router.delete("/ressource/{ressource_id}")
def delete_ressource(ressource_id: UUID, db: Session = Depends(get_db),
    _: UserModel = Depends(require_super_admin)):
    res = db.query(RessourcePedagogique).filter(
        RessourcePedagogique.id == ressource_id
    ).first()
    if not res:
        raise HTTPException(404, "Ressource introuvable")
    db.delete(res)
    db.commit()
    return {"message": "Ressource supprimée"}









@router.get("/referentiel")
def get_referentiel(db: Session = Depends(get_db),
                    _: UserModel = Depends(require_super_admin)):
    """Retourne toute la structure éducative — cycles, ordres, filières, niveaux."""
    cycles = db.query(Cycle).filter(Cycle.actif == True).order_by(Cycle.ordre).all()
    result = []
    for cycle in cycles:
        ordres = db.query(Ordre).filter(Ordre.cycle_id == cycle.id, Ordre.actif == True).all()
        niveaux = db.query(Niveau).filter(Niveau.cycle_id == cycle.id, Niveau.actif == True).order_by(Niveau.ordre).all()
        ordres_data = []
        for ordre in ordres:
            filieres = db.query(Filiere).filter(Filiere.ordre_id == ordre.id, Filiere.actif == True).order_by(Filiere.ordre).all()
            ordres_data.append({
                "id": str(ordre.id), "nom": ordre.nom, "code": ordre.code,
                "filieres": [{"id": str(f.id), "nom": f.nom, "code": f.code, "description": f.description} for f in filieres]
            })
        result.append({
            "id": str(cycle.id), "nom": cycle.nom, "code": cycle.code,
            "ordres": ordres_data,
            "niveaux": [{"id": str(n.id), "nom": n.nom, "code": n.code, "ordre": n.ordre} for n in niveaux]
        })
    return result


@router.post("/filiere", status_code=201)
def create_filiere(body: FiliereCreate, db: Session = Depends(get_db),
                   _: UserModel = Depends(require_super_admin)):
    """Crée une nouvelle filière — accessible uniquement au super admin."""
    filiere = Filiere(**body.model_dump())
    db.add(filiere); db.commit(); db.refresh(filiere)
    return {"id": str(filiere.id), "nom": filiere.nom, "message": "Filière créée"}


@router.delete("/filiere/{filiere_id}")
def delete_filiere(filiere_id: UUID, db: Session = Depends(get_db),
                   _: UserModel = Depends(require_super_admin)):
    """Désactive une filière."""
    f = db.query(Filiere).filter(Filiere.id == filiere_id).first()
    if not f: raise HTTPException(404, "Filière introuvable")
    f.actif = False; db.commit()
    return {"message": "Filière désactivée"}


@router.post("/niveau", status_code=201)
def create_niveau(body: NiveauCreate, db: Session = Depends(get_db),
                  _: UserModel = Depends(require_super_admin)):
    """Crée un nouveau niveau — accessible uniquement au super admin."""
    niveau = Niveau(**body.model_dump())
    db.add(niveau); db.commit(); db.refresh(niveau)
    return {"id": str(niveau.id), "nom": niveau.nom, "message": "Niveau créé"}


# ── Import PDF via IA ─────────────────────────────────────────────

@router.post("/import/pdf")
async def import_from_pdf(
    famille_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_super_admin)
):
    """Importe une fiche de préparation PDF via l'API Claude."""
    import anthropic, base64, json, os

    if not file.filename.endswith('.pdf'):
        raise HTTPException(400, "Seuls les fichiers PDF sont acceptés")

    pdf_bytes = await file.read()
    pdf_b64   = base64.standard_b64encode(pdf_bytes).decode("utf-8")

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(500, "ANTHROPIC_API_KEY non configurée dans le .env")

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "document",
                    "source": {
                        "type":       "base64",
                        "media_type": "application/pdf",
                        "data":       pdf_b64
                    }
                },
                {
                    "type": "text",
                    "text": """Analyse cette fiche de préparation et extrais le contenu.
Retourne UNIQUEMENT un JSON valide :
{
  "titre": "titre de la leçon",
  "reference_ue": "UE XX",
  "competences": ["compétence 1", "compétence 2"],
  "situation_probleme": "texte",
  "prerequis": ["prérequis 1"],
  "duree_estimee": 60,
  "contenu_lecon": "contenu Markdown complet",
  "points_cles": ["point 1", "point 2"],
  "exercices": [
    {
      "titre": "titre",
      "type": "qcm",
      "enonce": "énoncé",
      "options": ["A", "B", "C", "D"],
      "reponse_correcte": "A",
      "explication": "explication",
      "indice_1": "indice 1",
      "indice_2": "indice 2",
      "competence_evaluee": "compétence",
      "difficulte": 1,
      "points": 10
    }
  ]
}"""
                }
            ]
        }]
    )

    try:
        content = message.content[0].text
        content = content.replace("```json", "").replace("```", "").strip()
        extracted = json.loads(content)
    except Exception as e:
        raise HTTPException(500, f"Erreur d'extraction : {str(e)}")

    ua = UniteApprentissage(
        famille_id=UUID(famille_id),
        titre=extracted.get("titre", "Nouvelle UA"),
        reference_ue=extracted.get("reference_ue"),
        competences=extracted.get("competences", []),
        situation_probleme=extracted.get("situation_probleme"),
        prerequis=extracted.get("prerequis", []),
        duree_estimee=extracted.get("duree_estimee", 60),
        ordre=1
    )
    db.add(ua)
    db.flush()

    if extracted.get("contenu_lecon"):
        ressource = RessourcePedagogique(
            ua_id=ua.id,
            titre=f"Leçon — {ua.titre}",
            type="lecon",
            contenu=extracted["contenu_lecon"],
            points_cles=extracted.get("points_cles", []),
            ordre=1
        )
        db.add(ressource)

    exercices_crees = 0
    for i, ex_data in enumerate(extracted.get("exercices", [])):
        ex = Exercice(
            ua_id=ua.id,
            titre=ex_data.get("titre", f"Exercice {i+1}"),
            type=ex_data.get("type", "qcm"),
            enonce=ex_data.get("enonce", ""),
            options=ex_data.get("options"),
            reponse_correcte=ex_data.get("reponse_correcte", ""),
            explication=ex_data.get("explication"),
            indice_1=ex_data.get("indice_1"),
            indice_2=ex_data.get("indice_2"),
            competence_evaluee=ex_data.get("competence_evaluee"),
            difficulte=ex_data.get("difficulte", 1),
            points=ex_data.get("points", 10),
            ordre=i + 1
        )
        db.add(ex)
        exercices_crees += 1

    db.commit()
    return {
        "message":           "Import réussi",
        "ua_id":             str(ua.id),
        "titre":             ua.titre,
        "nb_exercices_crees": exercices_crees,
        "competences":       ua.competences
    }


# ── Cycles ──────────────────────────────────────────────────────

@router.post("/referentiel/cycles")
def create_cycle(body: dict, db: Session = Depends(get_db)):
    cycle = Cycle(nom=body["nom"], code=body["code"])
    db.add(cycle); db.commit(); db.refresh(cycle)
    return {"id": str(cycle.id), "nom": cycle.nom, "code": cycle.code}

@router.put("/referentiel/cycles/{cycle_id}")
def update_cycle(cycle_id: UUID, body: dict, db: Session = Depends(get_db)):
    cycle = db.query(Cycle).filter(Cycle.id == cycle_id).first()
    if not cycle: raise HTTPException(404, "Cycle introuvable")
    for k in ["nom", "code", "description"]:
        if k in body: setattr(cycle, k, body[k])
    db.commit()
    return {"message": "Cycle mis à jour"}

@router.delete("/referentiel/cycles/{cycle_id}")
def delete_cycle(cycle_id: UUID, db: Session = Depends(get_db)):
    cycle = db.query(Cycle).filter(Cycle.id == cycle_id).first()
    if not cycle: raise HTTPException(404, "Cycle introuvable")
    cycle.actif = False; db.commit()
    return {"message": "Cycle désactivé"}

# ── Ordres ──────────────────────────────────────────────────────

@router.post("/referentiel/ordres")
def create_ordre(body: dict, db: Session = Depends(get_db)):
    ordre = Ordre(
        nom=body["nom"], code=body["code"],
        cycle_id=UUID(body["cycle_id"])
    )
    db.add(ordre); db.commit(); db.refresh(ordre)
    return {"id": str(ordre.id), "nom": ordre.nom, "code": ordre.code}

@router.put("/referentiel/ordres/{ordre_id}")
def update_ordre(ordre_id: UUID, body: dict, db: Session = Depends(get_db)):
    ordre = db.query(Ordre).filter(Ordre.id == ordre_id).first()
    if not ordre: raise HTTPException(404, "Ordre introuvable")
    for k in ["nom", "code", "description"]:
        if k in body: setattr(ordre, k, body[k])
    db.commit()
    return {"message": "Ordre mis à jour"}

@router.delete("/referentiel/ordres/{ordre_id}")
def delete_ordre(ordre_id: UUID, db: Session = Depends(get_db)):
    ordre = db.query(Ordre).filter(Ordre.id == ordre_id).first()
    if not ordre: raise HTTPException(404, "Ordre introuvable")
    ordre.actif = False; db.commit()
    return {"message": "Ordre désactivé"}

# ── Filières ─────────────────────────────────────────────────────

@router.post("/referentiel/filieres")
def create_filiere(body: dict, db: Session = Depends(get_db)):
    filiere = Filiere(
        nom=body["nom"], code=body["code"],
        description=body.get("description", ""),
        ordre_id=UUID(body["ordre_id"])
    )
    db.add(filiere); db.commit(); db.refresh(filiere)
    return {"id": str(filiere.id), "nom": filiere.nom, "code": filiere.code}

@router.put("/referentiel/filieres/{filiere_id}")
def update_filiere(filiere_id: UUID, body: dict, db: Session = Depends(get_db)):
    filiere = db.query(Filiere).filter(Filiere.id == filiere_id).first()
    if not filiere: raise HTTPException(404, "Filière introuvable")
    for k in ["nom", "code", "description"]:
        if k in body: setattr(filiere, k, body[k])
    db.commit()
    return {"message": "Filière mise à jour"}

@router.delete("/referentiel/filieres/{filiere_id}")
def delete_filiere(filiere_id: UUID, db: Session = Depends(get_db)):
    filiere = db.query(Filiere).filter(Filiere.id == filiere_id).first()
    if not filiere: raise HTTPException(404, "Filière introuvable")
    filiere.actif = False; db.commit()
    return {"message": "Filière désactivée"}

# ── Niveaux ──────────────────────────────────────────────────────

@router.post("/referentiel/niveaux")
def create_niveau(body: dict, db: Session = Depends(get_db)):
    niveau = Niveau(
        nom=body["nom"], code=body["code"],
        cycle_id=UUID(body["cycle_id"])
    )
    db.add(niveau); db.commit(); db.refresh(niveau)
    return {"id": str(niveau.id), "nom": niveau.nom, "code": niveau.code}

@router.put("/referentiel/niveaux/{niveau_id}")
def update_niveau(niveau_id: UUID, body: dict, db: Session = Depends(get_db)):
    niveau = db.query(Niveau).filter(Niveau.id == niveau_id).first()
    if not niveau: raise HTTPException(404, "Niveau introuvable")
    for k in ["nom", "code"]:
        if k in body: setattr(niveau, k, body[k])
    db.commit()
    return {"message": "Niveau mis à jour"}

@router.delete("/referentiel/niveaux/{niveau_id}")
def delete_niveau(niveau_id: UUID, db: Session = Depends(get_db)):
    niveau = db.query(Niveau).filter(Niveau.id == niveau_id).first()
    if not niveau: raise HTTPException(404, "Niveau introuvable")
    niveau.actif = False; db.commit()
    return {"message": "Niveau désactivé"}


# ── CRUD Modules ─────────────────────────────────────────────────
@router.post("/modules")
def create_module(body: dict, db: Session = Depends(get_db),
    _: UserModel = Depends(require_super_admin)):
    mod = Module(
        matiere_id  = UUID(body["matiere_id"]),
        niveau_id   = UUID(body["niveau_id"])  if body.get("niveau_id")  else None,
        filiere_id  = UUID(body["filiere_id"]) if body.get("filiere_id") else None,
        numero      = int(body.get("numero", 1)),
        titre       = body["titre"],
        description = body.get("description", ""),
        ordre       = int(body.get("ordre", 1)),
    )
    db.add(mod); db.commit(); db.refresh(mod)
    return {"id": str(mod.id), "titre": mod.titre, "numero": mod.numero}

@router.put("/modules/{module_id}")
def update_module(module_id: UUID, body: dict, db: Session = Depends(get_db),
    _: UserModel = Depends(require_super_admin)):
    mod = db.query(Module).filter(Module.id == module_id).first()
    if not mod: raise HTTPException(404, "Module introuvable")
    for k in ["titre", "description", "numero", "ordre"]:
        if k in body: setattr(mod, k, body[k])
    if "niveau_id" in body:
        mod.niveau_id = UUID(body["niveau_id"]) if body["niveau_id"] else None
    if "filiere_id" in body:
        mod.filiere_id = UUID(body["filiere_id"]) if body["filiere_id"] else None
    if body.get("matiere_id"):
        mod.matiere_id = UUID(body["matiere_id"])
    db.commit()
    return {"message": "Module mis à jour"}

@router.delete("/modules/{module_id}")
def delete_module(module_id: UUID, db: Session = Depends(get_db),
    _: UserModel = Depends(require_super_admin)):
    mod = db.query(Module).filter(Module.id == module_id).first()
    if not mod: raise HTTPException(404, "Module introuvable")
    mod.actif = False; db.commit()
    return {"message": "Module désactivé"}


# ── CRUD Familles ─────────────────────────────────────────────────
@router.post("/familles")
def create_famille_admin(body: dict, db: Session = Depends(get_db),
    _: UserModel = Depends(require_super_admin)):
    fam = FamilleSituation(
        module_id = UUID(body["module_id"]),
        titre     = body["titre"],
        ordre     = int(body.get("ordre", 1)),
        description = body.get("description", ""),
    )
    db.add(fam); db.commit(); db.refresh(fam)
    return {"id": str(fam.id), "titre": fam.titre}

@router.put("/familles/{famille_id}")
def update_famille_admin(famille_id: UUID, body: dict, db: Session = Depends(get_db),
    _: UserModel = Depends(require_super_admin)):
    fam = db.query(FamilleSituation).filter(FamilleSituation.id == famille_id).first()
    if not fam: raise HTTPException(404, "Famille introuvable")
    for k in ["titre", "ordre", "description"]:
        if k in body: setattr(fam, k, body[k])
    if body.get("module_id"):
        fam.module_id = UUID(body["module_id"])
    db.commit()
    return {"message": "Famille mise à jour"}

@router.delete("/familles/{famille_id}")
def delete_famille_admin(famille_id: UUID, db: Session = Depends(get_db),
    _: UserModel = Depends(require_super_admin)):
    fam = db.query(FamilleSituation).filter(FamilleSituation.id == famille_id).first()
    if not fam: raise HTTPException(404, "Famille introuvable")
    db.delete(fam); db.commit()
    return {"message": "Famille supprimée"}


# ── Génération IA d'exercices ─────────────────────────────────────
@router.post("/generer-exercices/{ua_id}")
async def generer_exercices_ia(
    ua_id: UUID,
    body: dict,
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_super_admin)
):
    """
    Génère N exercices pour une UA via Claude Haiku (Anthropic).
    body: { "nb": 3, "type": "qcm", "difficulte": 1 }
    """
    import anthropic, json as _json, os

    ua = db.query(UniteApprentissage).filter(UniteApprentissage.id == ua_id).first()
    if not ua: raise HTTPException(404, "UA introuvable")

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(500, "ANTHROPIC_API_KEY non configurée dans le .env")

    nb         = int(body.get("nb", 3))
    type_ex    = body.get("type", "qcm")
    difficulte = int(body.get("difficulte", 1))
    diff_label = {1: "facile", 2: "intermédiaire", 3: "difficile"}.get(difficulte, "facile")

    competences_str = "\n".join(f"- {c}" for c in (ua.competences or []))

    prompt = f"""Tu es un enseignant camerounais expert en informatique.
Génère exactement {nb} exercice(s) de type {type_ex} de niveau {diff_label}
pour l'unité d'apprentissage : "{ua.titre}".

Contexte : {ua.situation_probleme or "Apprentissage des bases de l'informatique"}
Compétences visées :
{competences_str or "- Maîtriser les concepts fondamentaux"}

Réponds UNIQUEMENT avec un JSON valide, sans texte avant ou après,
sans balises markdown. Format exact :
{{
  "exercices": [
    {{
      "titre": "Titre court",
      "enonce": "Question complète et claire",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "reponse_correcte": "Option A",
      "explication": "Pourquoi c'est la bonne réponse",
      "indice_1": "Premier indice",
      "indice_2": "Deuxième indice plus précis",
      "competence_evaluee": "Compétence exacte évaluée",
      "points": 10
    }}
  ]
}}"""

    client = anthropic.Anthropic(api_key=api_key)
    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
    except anthropic.APIError as e:
        raise HTTPException(500, f"Erreur API Claude : {str(e)}")

    import re as _re
    content = message.content[0].text.strip()
    # Supprime les balises de code markdown (```json ... ``` ou ``` ... ```)
    content = _re.sub(r'^```[a-zA-Z]*\n?', '', content)
    content = _re.sub(r'\n?```\s*$', '', content)
    content = content.strip()

    try:
        data = _json.loads(content)
    except Exception:
        raise HTTPException(500, f"Réponse IA invalide — relancez ({content[:60]}…)")

    # Sauvegarde les exercices générés en base
    created = []
    for ex_data in data.get("exercices", []):
        ex = Exercice(
            ua_id              = ua.id,
            titre              = ex_data.get("titre", "Exercice"),
            type               = type_ex,
            enonce             = ex_data.get("enonce", ""),
            options            = ex_data.get("options") if type_ex == "qcm" else None,
            reponse_correcte   = ex_data.get("reponse_correcte", ""),
            explication        = ex_data.get("explication", ""),
            indice_1           = ex_data.get("indice_1", ""),
            indice_2           = ex_data.get("indice_2", ""),
            competence_evaluee = ex_data.get("competence_evaluee", ""),
            difficulte         = difficulte,
            points             = int(ex_data.get("points", 10)),
            ordre              = len(created) + 1,
        )
        db.add(ex)
        created.append(ex_data.get("titre"))

    db.commit()
    return {
        "message": f"{len(created)} exercice(s) générés et sauvegardés",
        "exercices_crees": created,
        "ua_id": str(ua_id),
    }