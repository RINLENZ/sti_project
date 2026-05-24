"""
Tuteur IA conversationnel — STI Adaptatif
Génère des explications personnalisées via l'API Claude.
Contexte : apprenant africain, lycée camerounais, programme APC.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from ..database import get_db
from ..models.cours import Exercice, UniteApprentissage
from ..models.user import User, TuteurSuivi
from ..models.referentiel import Niveau
from ..dependencies import get_current_user
from ..config import settings

router = APIRouter(prefix="/api/tuteur", tags=["tuteur-ia"])


class MessageItem(BaseModel):
    role:    str   # "user" | "assistant"
    content: str


class ExplicationRequest(BaseModel):
    exercice_id:          UUID
    reponse_donnee:       str
    niveau:               Optional[str]             = "Première"
    filiere:              Optional[str]             = "F6 BIPE"
    conversation_history: Optional[List[MessageItem]] = []


@router.post("/expliquer")
def expliquer_exercice(
    body: ExplicationRequest,
    db:   Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    exercice = db.query(Exercice).filter(Exercice.id == body.exercice_id).first()
    if not exercice:
        raise HTTPException(404, "Exercice introuvable")

    ua = db.query(UniteApprentissage).filter(
        UniteApprentissage.id == exercice.ua_id
    ).first()

    # ── Essaie Claude si crédits disponibles ──────────────────────
    if settings.anthropic_api_key:
        try:
            import anthropic

            system_prompt = f"""Tu es un tuteur pédagogique bienveillant pour un lycéen camerounais.
L'élève est en classe de {body.niveau}, filière {body.filiere}.

EXERCICE : {exercice.titre}
ÉNONCÉ : {exercice.enonce}
OPTIONS : {', '.join(exercice.options or [])}
BONNE RÉPONSE : {exercice.reponse_correcte}
COMPÉTENCE VISÉE : {exercice.competence_evaluee or ''}
CONTEXTE : {ua.titre if ua else ''}

Tu gardes la mémoire des échanges précédents pour adapter tes explications.
Réponds toujours en français simple et direct, sans markdown, en 4-6 phrases maximum."""

            # Construit les messages : historique + nouvelle question
            history = body.conversation_history or []
            messages = [
                {"role": m.role, "content": m.content}
                for m in history[-6:]  # max 3 tours (6 messages)
            ]
            messages.append({
                "role": "user",
                "content": f"J'ai répondu « {body.reponse_donnee} ». Explique-moi pourquoi c'est {'correct' if body.reponse_donnee == exercice.reponse_correcte else 'incorrect'} et aide-moi à comprendre."
            })

            client  = anthropic.Anthropic(api_key=settings.anthropic_api_key)
            message = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=450,
                system=system_prompt,
                messages=messages,
            )
            explication = message.content[0].text.strip()
            return {
                "explication_ia":   explication,
                "exercice_titre":   exercice.titre,
                "reponse_correcte": exercice.reponse_correcte,
                "source":           "claude",
                # Retourne le nouveau message assistant pour que le frontend
                # puisse l'ajouter à son historique local
                "assistant_message": explication,
            }
        except Exception:
            pass  # Fallback vers mode local

    # ── Mode dégradé — explication depuis les données de l'exercice ──
    explication = _explication_locale(exercice, body.reponse_donnee)
    return {
        "explication_ia":    explication,
        "exercice_titre":    exercice.titre,
        "reponse_correcte":  exercice.reponse_correcte,
        "source":            "local",
        "assistant_message": explication,
    }


@router.get("/referentiel")
def get_referentiel_public(db: Session = Depends(get_db)):
    """
    Retourne cycles → niveaux + filières, sans restriction de rôle.
    Utilisé par Profil.jsx (apprenant) et DashboardProf.jsx (enseignant)
    pour alimenter les sélecteurs cascadants Niveau → Filière.
    """
    from ..models.referentiel import Cycle, Ordre, Filiere as FiliereModel

    cycles = db.query(Cycle).filter(Cycle.actif == True).order_by(Cycle.ordre).all()
    result = []
    for cycle in cycles:
        niveaux = (
            db.query(Niveau)
            .filter(Niveau.cycle_id == cycle.id, Niveau.actif == True)
            .order_by(Niveau.ordre)
            .all()
        )
        ordres = db.query(Ordre).filter(Ordre.cycle_id == cycle.id, Ordre.actif == True).all()
        filieres = []
        for ordre in ordres:
            fs = (
                db.query(FiliereModel)
                .filter(FiliereModel.ordre_id == ordre.id, FiliereModel.actif == True)
                .order_by(FiliereModel.ordre)
                .all()
            )
            for f in fs:
                filieres.append({"id": str(f.id), "nom": f.nom, "code": f.code})

        if niveaux or filieres:
            result.append({
                "cycle_id":  str(cycle.id),
                "cycle_nom": cycle.nom,
                "niveaux":   [{"id": str(n.id), "nom": n.nom} for n in niveaux],
                "filieres":  filieres,
            })
    return result


@router.put("/apprenant/{apprenant_id}/niveau")
def update_niveau_apprenant(
    apprenant_id: UUID,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Un enseignant peut modifier le niveau d'un apprenant qu'il suit.
    Vérifie que le lien TuteurSuivi actif existe avant d'autoriser.
    """
    lien = db.query(TuteurSuivi).filter(
        TuteurSuivi.tuteur_id    == current_user.id,
        TuteurSuivi.apprenant_id == apprenant_id,
        TuteurSuivi.actif        == True
    ).first()
    if not lien:
        raise HTTPException(403, "Vous ne suivez pas cet apprenant")

    apprenant = db.query(User).filter(User.id == apprenant_id).first()
    if not apprenant:
        raise HTTPException(404, "Apprenant introuvable")

    niveau_id    = body.get("niveau_id")
    niveau_label = body.get("niveau_label")

    if niveau_id:
        try:
            apprenant.niveau_id = UUID(niveau_id)
        except ValueError:
            raise HTTPException(400, "niveau_id invalide")
    if niveau_label:
        apprenant.niveau_label = niveau_label

    filiere_id    = body.get("filiere_id")
    filiere_label = body.get("filiere_label")
    if filiere_id:
        try:
            apprenant.filiere_id = UUID(filiere_id)
        except ValueError:
            raise HTTPException(400, "filiere_id invalide")
    if filiere_label:
        apprenant.filiere_label = filiere_label

    db.commit()
    db.refresh(apprenant)

    return {
        "message":       f"Niveau de {apprenant.prenom} mis à jour",
        "niveau_label":  apprenant.niveau_label,
        "niveau_id":     str(apprenant.niveau_id)  if apprenant.niveau_id  else None,
        "filiere_label": apprenant.filiere_label,
        "filiere_id":    str(apprenant.filiere_id) if apprenant.filiere_id else None,
    }


def _explication_locale(exercice, reponse_donnee: str) -> str:
    """Génère une explication sans LLM depuis les données de l'exercice."""
    parties = []

    if reponse_donnee:
        parties.append(
            f"Tu as répondu « {reponse_donnee} », "
            f"mais la bonne réponse est « {exercice.reponse_correcte} »."
        )

    if exercice.explication:
        parties.append(exercice.explication)

    if exercice.indice_1:
        parties.append(f"À retenir : {exercice.indice_1}.")

    if exercice.indice_2:
        parties.append(f"De plus : {exercice.indice_2}.")

    parties.append(
        "Ne te décourage pas ! Relis la leçon et réessaie — "
        "chaque erreur est une étape vers la maîtrise. 💪"
    )

    return " ".join(parties)