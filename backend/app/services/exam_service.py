"""
Génération d'épreuves par l'IA (Claude) en suivant le format officiel
camerounais APC : deux parties (Ressources + Compétences).
"""
import json
import re
from typing import Any

import anthropic

from ..config import settings


# ── System prompt — format officiel camerounais ────────────────────────────
_SYSTEM_PROMPT = """
Tu es un enseignant expert qui rédige des épreuves scolaires officielles au Cameroun
en suivant l'Approche Par les Compétences (APC) du MINESEC.

Structure OBLIGATOIRE d'une épreuve :

PARTIE I — ÉVALUATION DES RESSOURCES (sur 10 points)
  Exercices courts testant les connaissances factuelles :
  - Définitions / terminologie
  - Vrai ou Faux (avec justification possible)
  - Complétion de phrases
  - Listage / énumération
  - Questions directes sur le cours

PARTIE II — ÉVALUATION DES COMPÉTENCES (sur 10 points)
  Commence OBLIGATOIREMENT par une situation-problème concrète et contextualisée,
  puis des exercices d'application qui s'y rattachent :
  - Questions de compréhension de la situation
  - Résolution de problèmes (algorithme, SQL, réseau, etc.)
  - Analyse et synthèse
  - Proposition de solution / schéma / code

Règles :
- Total = 20 points (Partie I + Partie II = 10 + 10)
- Chaque question a un barème précis en points
- Le niveau de langue est adapté au secondaire camerounais
- La situation-problème doit être réaliste et ancrée dans le contexte africain
- Les exercices DOIVENT porter uniquement sur les UA fournies dans le contexte
- Réponds UNIQUEMENT avec du JSON valide — pas de texte avant ni après

Format JSON attendu :
{
  "titre": "Épreuve de [Matière] — [Type]",
  "partie1": {
    "titre": "ÉVALUATION DES RESSOURCES",
    "points_total": 10,
    "exercices": [
      {
        "id": "p1_ex1",
        "numero": "Exercice 1",
        "titre": "...",
        "consigne": "...",
        "points": 4,
        "questions": [
          {
            "id": "p1_ex1_q1",
            "enonce": "...",
            "type": "definition|vrai_faux|completion|listage|question_directe|qcm|code",
            "points": 1,
            "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
            "reponse_correcte": "...",
            "explication": "..."
          }
        ]
      }
    ]
  },
  "partie2": {
    "titre": "ÉVALUATION DES COMPÉTENCES",
    "points_total": 10,
    "situation_probleme": "Texte de la situation-problème...",
    "exercices": [
      {
        "id": "p2_ex1",
        "numero": "Exercice 1",
        "titre": "...",
        "consigne": "...",
        "points": 5,
        "questions": [...]
      }
    ]
  }
}
""".strip()


def _build_user_prompt(
    matiere: str,
    niveau: str,
    classe: str,
    type_epreuve: str,
    ua_contents: list[dict],
    duree: int,
    annee: str,
) -> str:
    context_parts = []
    for ua in ua_contents:
        block = f"### UA : {ua['titre']}\n"
        if ua.get("competences"):
            comps = ua["competences"] if isinstance(ua["competences"], list) else [ua["competences"]]
            block += f"Compétences visées : {'; '.join(str(c) for c in comps)}\n"
        if ua.get("situation_probleme"):
            block += f"Situation-problème de référence : {ua['situation_probleme']}\n"
        for r in ua.get("ressources", []):
            block += f"\n**Ressource : {r['titre']}**\n{r['contenu']}\n"
            if r.get("points_cles"):
                pts = r["points_cles"] if isinstance(r["points_cles"], list) else [r["points_cles"]]
                block += f"Points clés : {'; '.join(str(p) for p in pts)}\n"
        context_parts.append(block)

    context_str = "\n\n---\n\n".join(context_parts)

    return f"""
Génère une épreuve de type **{type_epreuve.upper()}** avec les paramètres suivants :
- Matière : {matiere}
- Niveau : {niveau} — Classe : {classe}
- Durée : {duree} minutes
- Année scolaire : {annee}

Contenu des cours à évaluer :
{context_str}

Génère maintenant l'épreuve complète en JSON (format décrit dans le system prompt).
""".strip()


def _extract_json(text: str) -> dict:
    """Extrait le JSON même si Claude ajoute du texte autour."""
    text = text.strip()
    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Extract from markdown code block
    match = re.search(r"```(?:json)?\s*([\s\S]+?)```", text)
    if match:
        return json.loads(match.group(1).strip())
    # Find first { ... }
    start = text.find("{")
    end = text.rfind("}") + 1
    if start >= 0 and end > start:
        return json.loads(text[start:end])
    raise ValueError("Aucun JSON valide trouvé dans la réponse du modèle")


async def generer_epreuve(
    matiere: str,
    niveau: str,
    classe: str,
    type_epreuve: str,
    ua_contents: list[dict],
    duree: int = 60,
    annee: str = "2025-2026",
) -> dict[str, Any]:
    """
    Appelle Claude pour générer une épreuve structurée.
    Retourne le dict JSON de l'épreuve ou lève une exception.
    """
    if not settings.anthropic_api_key:
        raise ValueError("Clé API Anthropic non configurée (ANTHROPIC_API_KEY)")

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    user_prompt = _build_user_prompt(
        matiere=matiere,
        niveau=niveau,
        classe=classe,
        type_epreuve=type_epreuve,
        ua_contents=ua_contents,
        duree=duree,
        annee=annee,
    )

    message = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=4096,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw_text = message.content[0].text
    contenu = _extract_json(raw_text)
    return contenu
