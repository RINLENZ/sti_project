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

import sqlalchemy as sa
import re as _re_global

router = APIRouter(prefix="/api/admin", tags=["administration"])


def _repair_and_parse_json(raw: str) -> dict:
    """
    Extrait et répare le JSON produit par un LLM.
    Problèmes gérés :
      - Blocs markdown ```json ... ```
      - Newlines / tabs littéraux non-échappés à l'intérieur des strings
      - Caractères de contrôle parasites
    """
    import json

    # 1. Supprimer les balises markdown
    text = _re_global.sub(r'```(?:json)?\s*', '', raw)
    text = _re_global.sub(r'```', '', text).strip()

    # 2. Isoler le premier objet JSON { ... }
    start = text.find('{')
    end   = text.rfind('}')
    if start != -1 and end != -1 and end > start:
        text = text[start:end + 1]

    # 3. Essai direct
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 4. Réparer les caractères de contrôle non-échappés dans les strings
    result = []
    in_string = False
    i = 0
    while i < len(text):
        c = text[i]
        if c == '\\' and in_string:
            # Séquence d'échappement valide → garder les 2 caractères
            result.append(c)
            if i + 1 < len(text):
                result.append(text[i + 1])
                i += 2
            else:
                i += 1
            continue
        if c == '"':
            in_string = not in_string
            result.append(c)
        elif in_string:
            if c == '\n':
                result.append('\\n')
            elif c == '\r':
                result.append('\\r')
            elif c == '\t':
                result.append('\\t')
            elif ord(c) < 0x20:
                pass  # ignorer les autres caractères de contrôle
            else:
                result.append(c)
        else:
            result.append(c)
        i += 1

    return json.loads(''.join(result))


@router.get("/db-check")
def db_check(db: Session = Depends(get_db)):
    """Diagnostic : colonnes modules + version alembic."""
    try:
        cols = [r[0] for r in db.execute(sa.text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='modules' ORDER BY ordinal_position"
        )).fetchall()]
        alembic_ver = [r[0] for r in db.execute(sa.text(
            "SELECT version_num FROM alembic_version"
        )).fetchall()]
        count = db.query(Module).count()
        return {"columns": cols, "alembic_version": alembic_ver,
                "module_query_ok": True, "nb_modules": count}
    except Exception as e:
        return {"error": str(e)[:300]}


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
        modules = db.query(Module).filter(Module.matiere_id == mat.id, Module.actif == True).all()
        mods = []
        for mod in modules:
            familles = db.query(FamilleSituation).filter(
                FamilleSituation.module_id == mod.id
            ).all()
            fams = []
            for fam in familles:
                uas = db.query(UniteApprentissage).filter(
                    UniteApprentissage.famille_id == fam.id,
                    UniteApprentissage.actif == True
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
            mods.append({
                "id":        str(mod.id),
                "numero":    mod.numero,
                "titre":     mod.titre,
                "niveau_id": str(mod.niveau_id) if mod.niveau_id else None,
                "familles":  fams
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
        "ordre":            e.ordre,
        "groupe":           e.groupe,
        "groupe_titre":     e.groupe_titre,
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


# ── Upload média (image / audio) vers Supabase Storage ───────────

@router.post("/upload-media")
async def upload_media(
    file: UploadFile = File(...),
    _: UserModel = Depends(require_super_admin)
):
    """Upload une image ou un fichier audio vers Supabase Storage (bucket cours-media)."""
    import uuid
    from ..config import settings

    ALLOWED_IMAGE = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"}
    ALLOWED_AUDIO = {"audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg",
                     "audio/mp4", "audio/aac", "audio/x-m4a"}
    all_allowed = ALLOWED_IMAGE | ALLOWED_AUDIO

    if file.content_type not in all_allowed:
        raise HTTPException(400, f"Type non autorisé : {file.content_type}. "
                                 "Acceptés : images (jpg/png/webp/gif) et audio (mp3/wav/ogg/aac)")

    import base64

    content = await file.read()
    MAX_B64  = 3 * 1024 * 1024   # 3 Mo max pour base64
    MAX_SB   = 10 * 1024 * 1024  # 10 Mo max pour Supabase
    folder   = "images" if file.content_type in ALLOWED_IMAGE else "audio"

    # ── Fallback base64 si Supabase non configuré ──────────────────
    if not settings.supabase_url or not settings.supabase_service_key:
        if len(content) > MAX_B64:
            raise HTTPException(413, "Fichier trop volumineux pour le mode sans Supabase (max 3 Mo). "
                                     "Configurez SUPABASE_URL et SUPABASE_SERVICE_KEY pour aller jusqu'à 10 Mo.")
        b64 = base64.b64encode(content).decode()
        data_url = f"data:{file.content_type};base64,{b64}"
        return {"url": data_url, "media_type": folder}

    if len(content) > MAX_SB:
        raise HTTPException(413, "Fichier trop volumineux (max 10 Mo)")

    from supabase import create_client
    supabase = create_client(settings.supabase_url, settings.supabase_service_key)

    ext  = (file.filename or "file").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "bin"
    path = f"{folder}/{uuid.uuid4()}.{ext}"

    try:
        supabase.storage.from_("cours-media").upload(
            path=path,
            file=content,
            file_options={"content-type": file.content_type, "upsert": "false"},
        )
        public_url = supabase.storage.from_("cours-media").get_public_url(path)
        return {"url": public_url, "media_type": folder}
    except Exception as e:
        # Fallback base64 si Supabase échoue (bucket inexistant, etc.)
        if len(content) <= MAX_B64:
            b64 = base64.b64encode(content).decode()
            return {"url": f"data:{file.content_type};base64,{b64}", "media_type": folder}
        raise HTTPException(500, f"Erreur Supabase Storage : {str(e)}")


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
                    "text": """Tu es un expert en ingénierie pédagogique APC (Approche Par Compétences) du MINESEC Cameroun.
Analyse cette fiche de préparation et génère un cours complet et structuré selon les normes APC.

━━━ STRUCTURE APC ATTENDUE ━━━

1. UNITÉ D'APPRENTISSAGE
   • titre          : Intitulé précis de la leçon (tel que dans la fiche)
   • reference_ue   : Référence officielle (UE 01, Chapitre 3…)
   • competences    : 2-4 compétences APC ("Être capable de…", "Savoir identifier…", "Maîtriser…")
   • situation_probleme : OBLIGATOIRE — Situation CONCRÈTE et RÉALISTE ancrée dans le quotidien camerounais/africain.
       ✓ BON : "Le lycée technique de Bafoussam veut informatiser sa cantine. Le proviseur charge un élève de Tle D de concevoir la base de données pour gérer les repas et les paiements des élèves…"
       ✗ MAUVAIS : "Dans un contexte professionnel, il est important de maîtriser ce concept…"
   • prerequis      : Notions déjà vues
   • duree_estimee  : Durée en minutes

2. CONTENU DE LA LEÇON (contenu_lecon — Markdown structuré)
   ## Mise en situation
   [Lien avec la situation-problème, question déclencheuse pour motiver l'élève]

   ## I. [Première notion principale]
   [Cours clair avec définitions encadrées, exemples concrets du Cameroun/Afrique]

   ### Exemple appliqué
   [Exemple pratique avec noms, lieux, situations du Cameroun ou d'Afrique]

   ## II. [Deuxième notion]
   …

   ## Synthèse
   [Tableau récapitulatif ou résumé structuré des notions essentielles]

3. POINTS CLÉS : 4-6 points essentiels à retenir (phrases courtes, percutantes)

4. EXERCICES — 9 exercices répartis en 3 groupes pédagogiques :

   GROUPE 1 — "Évaluation des ressources"  (groupe=1, difficulte=1, points=5)
   → 3 exercices : 1 QCM + 1 vrai_faux + 1 texte_trou
   → Testent la mémorisation et la compréhension directe du cours

   GROUPE 2 — "Application et compréhension"  (groupe=2, difficulte=2, points=10)
   → 3 exercices : 2 QCM + 1 texte_trou
   → Nécessitent d'appliquer les notions sur des cas simples

   GROUPE 3 — "Résolution de problèmes"  (groupe=3, difficulte=3, points=15)
   → 3 exercices : 1 QCM + 2 reponse_libre
   → Exigent analyse et résolution en lien DIRECT avec la situation-problème

━━━ RÈGLES IMPÉRATIVES ━━━
• La situation-problème DOIT être contextualisée au Cameroun ou en Afrique
• Les exemples du cours DOIVENT utiliser des noms, lieux, situations africains
• vrai_faux  → options = ["Vrai", "Faux"]
• texte_trou → l'énoncé contient un ou plusieurs ___ ; options = liste de 4-8 mots couvrant tous les blancs ;
              si 1 seul ___ : reponse_correcte = "mot exact" ;
              si 2+ blancs  : reponse_correcte = JSON array dans l'ordre ["mot1", "mot2"]
• reponse_libre → options = null ; reponse_correcte = modèle de réponse complet (2-4 phrases)
• Les exercices du groupe 3 DOIVENT se référer à la situation-problème de l'UA
• Réponds UNIQUEMENT avec un JSON valide — aucun texte avant ni après

━━━ FORMAT JSON (strict) ━━━
{
  "titre": "…",
  "reference_ue": "…",
  "competences": ["Être capable de…", "Savoir…"],
  "situation_probleme": "Situation concrète et contextualisée au Cameroun…",
  "prerequis": ["…"],
  "duree_estimee": 55,
  "contenu_lecon": "## Mise en situation\\n…",
  "points_cles": ["…", "…", "…", "…"],
  "exercices": [
    {
      "titre": "…",
      "type": "qcm|vrai_faux|texte_trou|reponse_libre",
      "enonce": "…",
      "options": ["A. …", "B. …", "C. …", "D. …"],
      "reponse_correcte": "texte exact de la bonne réponse",
      "explication": "Explication pédagogique citant le cours",
      "indice_1": "Indice vague",
      "indice_2": "Indice plus précis",
      "competence_evaluee": "…",
      "difficulte": 1,
      "points": 5,
      "groupe": 1,
      "groupe_titre": "Évaluation des ressources"
    }
  ]
}"""
                }
            ]
        }]
    )

    try:
        extracted = _repair_and_parse_json(message.content[0].text)
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
        type_val = ex_data.get("type", "qcm")
        opts = ex_data.get("options")
        if type_val in ("qcm", "vrai_faux", "texte_trou") and isinstance(opts, list):
            options_val = opts
        else:
            options_val = None
        ex = Exercice(
            ua_id=ua.id,
            titre=ex_data.get("titre", f"Exercice {i+1}"),
            type=type_val,
            enonce=ex_data.get("enonce", ""),
            options=options_val,
            reponse_correcte=ex_data.get("reponse_correcte", ""),
            explication=ex_data.get("explication"),
            indice_1=ex_data.get("indice_1"),
            indice_2=ex_data.get("indice_2"),
            competence_evaluee=ex_data.get("competence_evaluee"),
            difficulte=ex_data.get("difficulte", 1),
            points=ex_data.get("points", 5),
            groupe=ex_data.get("groupe"),
            groupe_titre=ex_data.get("groupe_titre"),
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
        niveau_id   = UUID(body["niveau_id"]) if body.get("niveau_id") else None,
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
    Génère N exercices pour une UA via Claude (Anthropic).
    Contexte complet : leçon, niveau, compétences, filière, difficuté.
    body: { "nb": 3, "type": "qcm", "difficulte": 1 }
    """
    import anthropic, json as _json, os, re as _re

    ua = db.query(UniteApprentissage).filter(UniteApprentissage.id == ua_id).first()
    if not ua: raise HTTPException(404, "UA introuvable")

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(500, "ANTHROPIC_API_KEY non configurée dans le .env")

    nb         = max(1, min(int(body.get("nb", 3)), 10))
    type_ex    = body.get("type", "qcm")
    difficulte = int(body.get("difficulte", 1))

    # ── Récupération du contexte complet ──────────────────────────
    # Remonte la hiérarchie UA → Famille → Module → Niveau → Matière
    famille = db.query(FamilleSituation).filter(FamilleSituation.id == ua.famille_id).first()
    module  = db.query(Module).filter(Module.id == famille.module_id).first() if famille else None
    niveau  = db.query(Niveau).filter(Niveau.id == module.niveau_id).first() if module and module.niveau_id else None
    matiere = db.query(Matiere).filter(Matiere.id == module.matiere_id).first() if module else None

    # Contenu des leçons de la UA (texte brut extrait du JSON bloc)
    ressources = db.query(RessourcePedagogique).filter(
        RessourcePedagogique.ua_id == ua.id,
        RessourcePedagogique.type.in_(["lecon", "resume", "tp"])
    ).order_by(RessourcePedagogique.ordre).all()

    def extract_text(contenu_raw: str) -> str:
        """Extrait le texte brut depuis un contenu JSON-bloc ou Markdown."""
        try:
            blocs = _json.loads(contenu_raw)
            if isinstance(blocs, list):
                parts = []
                for b in blocs:
                    if b.get("type") in ("texte", "titre"):
                        parts.append(b.get("valeur", ""))
                    elif b.get("type") == "liste":
                        parts.extend(b.get("items", []))
                    elif b.get("type") == "alerte":
                        parts.append(b.get("valeur", ""))
                return "\n".join(p for p in parts if p)
        except Exception:
            pass
        return contenu_raw or ""

    lecons_text = []
    for r in ressources:
        txt = extract_text(r.contenu).strip()
        if txt:
            lecons_text.append(f"[{r.titre}]\n{txt}")
    contenu_cours = "\n\n".join(lecons_text)

    # Points clés de toutes les leçons
    tous_points = []
    for r in ressources:
        tous_points.extend(r.points_cles or [])

    # Exercices déjà existants (pour ne pas dupliquer)
    ex_existants = db.query(Exercice).filter(Exercice.ua_id == ua.id).all()
    enonces_existants = [e.enonce[:80] for e in ex_existants]

    # ── Labels selon difficulté ────────────────────────────────────
    diff_cfg = {
        1: {
            "label":   "facile (niveau débutant)",
            "conseil": "Questions directes sur les définitions et faits du cours. L'apprenant doit retrouver une information explicitement présente dans la leçon.",
            "points":  5,
        },
        2: {
            "label":   "intermédiaire",
            "conseil": "Questions de compréhension et d'application. L'apprenant doit reformuler, classer ou appliquer un concept vu en cours.",
            "points":  10,
        },
        3: {
            "label":   "difficile (niveau avancé)",
            "conseil": "Questions d'analyse, de synthèse ou de résolution de problème. L'apprenant doit raisonner au-delà du cours.",
            "points":  15,
        },
    }.get(difficulte, {"label": "intermédiaire", "conseil": "", "points": 10})

    # ── Instructions spécifiques par type d'exercice ──────────────
    type_instructions = {
        "qcm": (
            'Chaque exercice doit avoir 4 options (A, B, C, D), une seule bonne réponse. '
            '"options" = liste de 4 chaînes. "reponse_correcte" = texte exact de la bonne option.'
        ),
        "vrai_faux": (
            'Chaque exercice est une affirmation à évaluer. '
            '"options" = ["Vrai", "Faux"]. "reponse_correcte" = "Vrai" ou "Faux".'
        ),
        "texte_trou": (
            'L\'énoncé contient un ou plusieurs blancs notés ___ . '
            '"options" = liste de 4-8 mots possibles couvrant tous les blancs. '
            'Si 1 seul ___ : "reponse_correcte" = "le mot exact". '
            'Si 2+ blancs  : "reponse_correcte" = JSON array dans l\'ordre des blancs, ex: \'["mot1", "mot2"]\'.'
        ),
        "reponse_libre": (
            '"options" = null. "reponse_correcte" = réponse modèle complète et concise (1-3 phrases).'
        ),
    }.get(type_ex, '"options" = null, "reponse_correcte" = réponse attendue.')

    competences_str  = "\n".join(f"  • {c}" for c in (ua.competences or []))
    points_cles_str  = "\n".join(f"  • {p}" for p in tous_points) if tous_points else ""
    non_dupliquer    = "\n".join(f"  - {e}" for e in enonces_existants[:10]) if enonces_existants else "  (aucun)"

    groupe_titre_str = {
        1: "Évaluation des ressources",
        2: "Application et compréhension",
        3: "Résolution de problèmes",
    }.get(difficulte, "Application et compréhension")

    prompt = f"""Tu es un enseignant expert en APC (Approche Par Compétences) au Cameroun.
Tu crées des exercices pédagogiques RIGOUREUSEMENT fondés sur le contenu d'un cours réel,
ancrés dans le contexte camerounais et africain.

━━━ CONTEXTE PROGRAMME ━━━
Matière      : {matiere.nom if matiere else "Informatique"}
Niveau/Classe: {niveau.nom if niveau else "Non précisé"} ({niveau.code if niveau else ""})
Module       : {module.titre if module else ""}
Famille      : {famille.titre if famille else ""}
UA           : {ua.titre} ({ua.reference_ue or ""})
Durée UA     : {ua.duree_estimee} min

━━━ CONTENU DU COURS ━━━
{contenu_cours if contenu_cours else "(Aucune leçon — génère à partir des compétences et de la situation-problème)"}

━━━ POINTS CLÉS ━━━
{points_cles_str if points_cles_str else "  (non renseignés)"}

━━━ COMPÉTENCES VISÉES ━━━
{competences_str if competences_str else "  • Maîtriser les concepts fondamentaux de la UA"}

━━━ SITUATION-PROBLÈME ━━━
{ua.situation_probleme or "(non renseignée)"}

━━━ CONSIGNES DE GÉNÉRATION ━━━
Type d'exercice demandé : {type_ex}
Niveau de difficulté    : {diff_cfg["label"]}
Conseil pédagogique     : {diff_cfg["conseil"]}
Points par exercice     : {diff_cfg["points"]}
Nombre à créer          : {nb}
Groupe pédagogique      : {groupe_titre_str}

Instructions pour le type "{type_ex}" :
{type_instructions}

━━━ RÈGLES IMPÉRATIVES ━━━
1. Chaque exercice doit être DIRECTEMENT tiré du contenu du cours ci-dessus.
2. N'invente rien qui ne soit pas dans le cours ou les compétences.
3. Utilise des exemples, noms ou contextes camerounais/africains dans les énoncés.
4. Adapte le vocabulaire au niveau {niveau.nom if niveau else "scolaire"}.
5. Si la difficulté est 3, relie au moins un exercice à la situation-problème.
6. N'utilise PAS ces énoncés déjà existants (anti-doublons) :
{non_dupliquer}
7. Réponds UNIQUEMENT avec un JSON valide — aucun texte ni markdown autour.

━━━ FORMAT JSON (strict) ━━━
{{
  "exercices": [
    {{
      "titre": "Titre court et précis",
      "enonce": "Énoncé clair, ancré dans le contexte africain si possible",
      "options": ["A. …", "B. …", "C. …", "D. …"],
      "reponse_correcte": "Texte exact de la bonne réponse",
      "explication": "Explication pédagogique qui cite le cours",
      "indice_1": "Indice vague pour débloquer l'élève",
      "indice_2": "Indice plus précis",
      "competence_evaluee": "Compétence exacte parmi celles listées",
      "points": {diff_cfg["points"]}
    }}
  ]
}}"""

    client = anthropic.Anthropic(api_key=api_key)
    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
    except anthropic.APIError as e:
        raise HTTPException(500, f"Erreur API Claude : {str(e)}")

    try:
        data = _repair_and_parse_json(message.content[0].text)
    except Exception:
        raise HTTPException(500, f"Réponse IA invalide — relancez ({message.content[0].text[:80]}…)")

    # Sauvegarde les exercices générés en base
    created = []
    for ex_data in data.get("exercices", []):
        opts = ex_data.get("options")
        if type_ex in ("qcm", "vrai_faux", "texte_trou") and isinstance(opts, list):
            options_val = opts
        else:
            options_val = None

        ex = Exercice(
            ua_id              = ua.id,
            titre              = ex_data.get("titre", "Exercice"),
            type               = type_ex,
            enonce             = ex_data.get("enonce", ""),
            options            = options_val,
            reponse_correcte   = ex_data.get("reponse_correcte", ""),
            explication        = ex_data.get("explication", ""),
            indice_1           = ex_data.get("indice_1", ""),
            indice_2           = ex_data.get("indice_2", ""),
            competence_evaluee = ex_data.get("competence_evaluee", ""),
            difficulte         = difficulte,
            points             = int(ex_data.get("points") or diff_cfg["points"]),
            groupe             = difficulte,
            groupe_titre       = groupe_titre_str,
            ordre              = len(ex_existants) + len(created) + 1,
        )
        db.add(ex)
        created.append(ex_data.get("titre"))

    db.commit()
    return {
        "message": f"{len(created)} exercice(s) générés et sauvegardés",
        "exercices_crees": created,
        "ua_id": str(ua_id),
        "contexte_utilise": {
            "niveau": niveau.nom if niveau else None,
            "module": module.titre if module else None,
            "nb_lecons": len(ressources),
            "contenu_cours_chars": len(contenu_cours),
        }
    }