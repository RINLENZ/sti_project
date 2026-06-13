"""
tuteur_service.py — Tuteur IA contextuel pour Alisha
======================================================

Génère des explications pédagogiques personnalisées en agrégeant :

  1. CONTEXTE DE L'APPRENANT
     - Niveau scolaire, filière, prénom
     - Maîtrise BKT sur les KCs de l'exercice (granularité fine)
     - Prédiction DKT sur le macro-KC (granularité large)
     - État émotionnel courant (engagement multimodal)

  2. CONTEXTE DE LA SESSION
     - Historique des 5 dernières réponses (correct/incorrect)
     - Durée de session (fatigue)
     - Mémoire conversationnelle (6 derniers messages tuteur)

  3. CONTEXTE PÉDAGOGIQUE
     - Énoncé, options, bonne réponse de l'exercice
     - Compétences visées (KCs)
     - Indices déjà fournis

  4. SÉLECTION DYNAMIQUE DU REGISTRE TONAL
     6 registres distincts choisis automatiquement selon le contexte :
       • explicateur_patient : erreur sur concept de base
       • rappel_concret      : erreur sur application pratique
       • mini_resume         : maîtrise BKT < 0.3 (renforcement structuré)
       • encouragement       : engagement bas + frustration
       • defi_socratique     : maîtrise > 0.7 mais erreur (question retournée)
       • blague_pedagogique  : session > 20 min OU 3+ erreurs (détente)

  5. ANTI-RÉPÉTITION
     Garde un cache des 3 dernières explications par (user_id, exercice_id).
     Si la nouvelle explication a > 75% de mots communs avec une précédente,
     on régénère avec une instruction "Varie l'angle d'approche".

Référence : Mémoire Chapitre 4 — Section "Tuteur conversationnel contextuel"
"""
import os
import re
import time
import hashlib
from typing import Optional, List, Dict, Any
from collections import deque

from sqlalchemy.orm import Session as SQLSession
from sqlalchemy import desc

from app.services.llm_service import call_llm
from app.models.cours import Exercice, BKTMastery, ProgressionApprenant
from app.models.user import User
from app.models.session import LearningSession
from app.utils import get_kcs, get_macro_kc, is_valid_kc


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Cache anti-répétition (en mémoire process)                        ║
# ╚════════════════════════════════════════════════════════════════════╝
# Limité à ~1000 entrées pour éviter une fuite mémoire en prod.
# Chaque entrée : (user_id, exercice_id) → deque[3 derniers checksums]

_explication_cache: Dict[str, deque] = {}
_CACHE_MAX_KEYS = 1000


def _cache_key(user_id: str, exercice_id: str) -> str:
    return f"{user_id}:{exercice_id}"


def _signature_explication(texte: str) -> set:
    """Bag-of-words simplifié pour comparer les explications."""
    mots = re.findall(r"\b[a-zà-ÿ]{4,}\b", texte.lower())
    # On garde les mots non-triviaux (>=4 caractères)
    stopwords = {"dans", "pour", "avec", "donc", "alors", "cela", "cette",
                 "comme", "mais", "plus", "tout", "fait", "être", "avoir",
                 "tu", "te", "ton", "ta", "tes", "vous", "votre", "nous",
                 "que", "qui", "quoi", "quand", "comment", "pourquoi"}
    return {m for m in mots if m not in stopwords}


def _similarite_jaccard(s1: set, s2: set) -> float:
    if not s1 or not s2:
        return 0.0
    return len(s1 & s2) / len(s1 | s2)


def _est_trop_similaire(nouveau: str, user_id: str, exercice_id: str) -> bool:
    """True si l'explication est > 75% similaire à une explication récente."""
    key = _cache_key(user_id, exercice_id)
    historique = _explication_cache.get(key, deque(maxlen=3))
    sig_nouveau = _signature_explication(nouveau)
    for sig_ancien in historique:
        if _similarite_jaccard(sig_nouveau, sig_ancien) > 0.75:
            return True
    return False


def _enregistrer_explication(texte: str, user_id: str, exercice_id: str):
    """Ajoute l'explication au cache pour comparaisons futures."""
    if len(_explication_cache) > _CACHE_MAX_KEYS:
        # FIFO simple — on supprime 10% des plus anciennes
        for k in list(_explication_cache.keys())[: _CACHE_MAX_KEYS // 10]:
            _explication_cache.pop(k, None)

    key = _cache_key(user_id, exercice_id)
    if key not in _explication_cache:
        _explication_cache[key] = deque(maxlen=3)
    _explication_cache[key].append(_signature_explication(texte))


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Récupération du contexte apprenant (BKT + DKT + engagement)        ║
# ╚════════════════════════════════════════════════════════════════════╝

def _construire_contexte_apprenant(
    db: SQLSession,
    user: User,
    exercice: Exercice,
) -> Dict[str, Any]:
    """
    Agrège le contexte pédagogique et émotionnel de l'apprenant pour
    nourrir le prompt LLM.
    """
    contexte = {
        "prenom":       user.prenom or "Élève",
        "niveau":       getattr(user, "niveau_label", None) or "Première",
        "filiere":      getattr(user, "filiere_label", None) or "F6 BIPE",
    }

    # ── Maîtrise BKT sur les KCs de l'exercice ───────────────────────
    kcs_exo = [k for k in (get_kcs(exercice) or []) if is_valid_kc(k)]
    bkt_rows = (
        db.query(BKTMastery)
        .filter(BKTMastery.user_id == user.id, BKTMastery.competence.in_(kcs_exo))
        .all()
    )
    bkt_par_kc = {b.competence: b.p_mastery for b in bkt_rows}
    contexte["bkt_par_kc"] = bkt_par_kc
    contexte["bkt_moyenne_exo"] = (
        sum(bkt_par_kc.values()) / max(len(bkt_par_kc), 1) if bkt_par_kc else 0.5
    )

    # ── Prédiction DKT sur le macro-KC (best effort) ─────────────────
    primary_kc = kcs_exo[0] if kcs_exo else None
    macro_kc = get_macro_kc(primary_kc) if primary_kc else None
    contexte["macro_kc"] = macro_kc

    if macro_kc:
        try:
            from app.services import dkt_service
            if dkt_service.is_model_available():
                # Reconstruire l'historique court pour la prédiction
                hist = _historique_dkt(db, str(user.id), limit=20)
                if hist:
                    preds = dkt_service.predict_mastery(hist)
                    contexte["dkt_mastery_macro"] = preds.get(macro_kc, 0.5)
        except Exception:
            pass

    # ── Historique récent de session (3 dernières interactions) ──────
    derniere_session = (
        db.query(LearningSession)
        .filter(LearningSession.user_id == user.id)
        .order_by(desc(LearningSession.started_at))
        .first()
    )
    if derniere_session:
        derniers_exos = (
            db.query(ProgressionApprenant)
            .filter(
                ProgressionApprenant.user_id == user.id,
                ProgressionApprenant.session_id == derniere_session.id,
            )
            .order_by(desc(ProgressionApprenant.date_fin))
            .limit(5)
            .all()
        )
        contexte["historique_recent"] = [
            {"correct": bool(p.correct), "engagement": p.engagement_fused}
            for p in reversed(derniers_exos)  # ordre chrono
        ]
        # État affectif moyen sur la session
        if derniere_session.score_engagement is not None:
            contexte["engagement_session"] = float(derniere_session.score_engagement)
        contexte["etat_affectif"] = getattr(derniere_session, "etat_affectif", "neutre")
        contexte["duree_session_min"] = (derniere_session.duree_secondes or 0) // 60
    else:
        contexte["historique_recent"] = []
        contexte["engagement_session"] = 0.5
        contexte["etat_affectif"] = "neutre"
        contexte["duree_session_min"] = 0

    return contexte


def _historique_dkt(db: SQLSession, user_id: str, limit: int = 20) -> List[Dict]:
    """Reconstruit un historique court pour le DKT."""
    progs = (
        db.query(ProgressionApprenant)
        .filter(
            ProgressionApprenant.user_id == user_id,
            ProgressionApprenant.exercice_id.isnot(None),
        )
        .order_by(desc(ProgressionApprenant.date_fin))
        .limit(limit)
        .all()
    )
    historique = []
    for p in reversed(progs):  # ordre chrono
        exo = db.query(Exercice).filter(Exercice.id == p.exercice_id).first()
        if not exo:
            continue
        primary = next((k for k in (get_kcs(exo) or []) if is_valid_kc(k)), None)
        if not primary:
            continue
        historique.append({
            "macro_kc":   get_macro_kc(primary),
            "correct":    bool(p.correct),
            "engagement": p.engagement_fused,
        })
    return historique


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Sélection du registre tonal selon le contexte                      ║
# ╚════════════════════════════════════════════════════════════════════╝

def _choisir_registre_tonal(contexte: Dict[str, Any], correct: bool) -> str:
    """
    Choisit le registre adapté à la situation. 6 registres disponibles.
    Logique d'arbitrage par ordre de priorité.
    """
    eng = contexte.get("engagement_session", 0.5)
    etat = contexte.get("etat_affectif", "neutre")
    bkt = contexte.get("bkt_moyenne_exo", 0.5)
    dkt = contexte.get("dkt_mastery_macro", 0.5)
    duree_min = contexte.get("duree_session_min", 0)
    hist = contexte.get("historique_recent", [])
    erreurs_recentes = sum(1 for h in hist if not h.get("correct"))

    # Priorité 1 — détresse émotionnelle
    if etat == "frustration" or eng < 0.40:
        return "encouragement"

    # Priorité 2 — fatigue ou erreurs en série
    if duree_min > 20 or erreurs_recentes >= 3:
        return "blague_pedagogique"

    # Priorité 3 — incompréhension structurelle (BKT faible)
    if bkt < 0.30:
        return "mini_resume"

    # Priorité 4 — maîtrise élevée mais erreur surprenante
    if not correct and (bkt > 0.70 or dkt > 0.70):
        return "defi_socratique"

    # Priorité 5 — application pratique
    # Heuristique : si l'exercice a > 1 indice, c'est un exercice d'application
    if len(contexte.get("indices", [])) > 0:
        return "rappel_concret"

    # Défaut — explicateur patient
    return "explicateur_patient"


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Templates de prompts par registre                                  ║
# ╚════════════════════════════════════════════════════════════════════╝

REGISTRES_INSTRUCTIONS = {
    "explicateur_patient": (
        "Adopte un ton calme et structuré. Reprends le concept à zéro, en 3-4 phrases. "
        "Pas de markdown. Termine par une question simple pour vérifier la compréhension."
    ),
    "rappel_concret": (
        "Ancre l'explication dans un exemple concret tiré de la vie au Cameroun "
        "(marché, transport, école, agriculture). 3-4 phrases. Pas de jargon abstrait."
    ),
    "mini_resume": (
        "Donne une mini-leçon en 3 points numérotés (1) ... 2) ... 3) ...) très brefs. "
        "C'est l'essentiel à retenir pour rattraper le retard sur ce concept."
    ),
    "encouragement": (
        "Adopte un ton chaleureux et rassurant. Reconnais la difficulté avant d'expliquer. "
        "L'apprenant est fatigué/frustré. 3-4 phrases bienveillantes. Sans condescendance."
    ),
    "defi_socratique": (
        "Au lieu d'expliquer directement, retourne une question qui guide vers la réponse. "
        "L'apprenant maîtrise le concept en général — il a juste raté un détail. "
        "Sois respectueux de son niveau. 2-3 phrases."
    ),
    "blague_pedagogique": (
        "Détends l'atmosphère avec une métaphore drôle ou une mini-anecdote camerounaise, "
        "puis donne l'explication. Garde le ton léger. 4-5 phrases. La blague doit être douce, "
        "jamais aux dépens de l'apprenant."
    ),
}


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Construction du prompt système contextualisé                       ║
# ╚════════════════════════════════════════════════════════════════════╝

def _construire_system_prompt(
    contexte: Dict[str, Any],
    exercice: Exercice,
    registre: str,
    correct: bool,
) -> str:
    """Compose le prompt système avec tout le contexte agrégé."""
    instruction_registre = REGISTRES_INSTRUCTIONS.get(
        registre, REGISTRES_INSTRUCTIONS["explicateur_patient"]
    )

    # Format BKT en pourcentage compréhensible
    bkt_str = ""
    if contexte.get("bkt_par_kc"):
        bkt_lines = [
            f"  - {kc} : maîtrise estimée {int(p * 100)}%"
            for kc, p in list(contexte["bkt_par_kc"].items())[:3]
        ]
        bkt_str = "\n".join(bkt_lines)

    dkt_str = ""
    if contexte.get("dkt_mastery_macro") is not None and contexte.get("macro_kc"):
        dkt_str = (
            f"Prédiction DKT sur la macro-compétence "
            f"{contexte['macro_kc']} : {int(contexte['dkt_mastery_macro'] * 100)}%"
        )

    hist_str = ""
    if contexte.get("historique_recent"):
        succes = sum(1 for h in contexte["historique_recent"] if h.get("correct"))
        total = len(contexte["historique_recent"])
        hist_str = f"Sur ses {total} dernières réponses : {succes} correctes."

    return f"""Tu es Alisha, tutrice pédagogique bienveillante pour un lycéen camerounais en programme APC.

PROFIL DE L'APPRENANT
- Prénom : {contexte['prenom']}
- Niveau : {contexte['niveau']}, filière {contexte['filiere']}
- État émotionnel détecté : {contexte.get('etat_affectif', 'neutre')}
- Engagement courant : {int(contexte.get('engagement_session', 0.5) * 100)}%
- Temps depuis le début de la session : {contexte.get('duree_session_min', 0)} minutes

MAÎTRISE DES COMPÉTENCES (modèle BKT)
{bkt_str or "  - pas encore d'historique sur ces compétences"}
{dkt_str}
{hist_str}

EXERCICE EN COURS
- Titre : {exercice.titre}
- Énoncé : {exercice.enonce}
- Réponse correcte : {exercice.reponse_correcte}
- Compétences visées : {', '.join(get_kcs(exercice) or [])[:200]}

CONSIGNE DE STYLE (registre : {registre})
{instruction_registre}

RÈGLES ABSOLUES
- Réponds en français simple, sans markdown, sans liste à puces sauf si le registre l'exige.
- Maximum 5 phrases.
- Pas de "j'espère que cela t'aide" en fin de réponse — sois direct.
- Tutoie l'apprenant, utilise son prénom au moins une fois si naturel.
- Ne révèle JAMAIS que tu es un LLM ou que tu suis un script. Tu es Alisha."""


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Fonction principale exposée au router                              ║
# ╚════════════════════════════════════════════════════════════════════╝

def expliquer(
    db: SQLSession,
    user: User,
    exercice: Exercice,
    reponse_donnee: str,
    conversation_history: Optional[List[Dict]] = None,
) -> Dict[str, Any]:
    """
    Génère une explication pédagogique contextualisée.

    Returns:
        dict {
            "explication_ia": str,          # le texte généré
            "source":         str,          # backend LLM utilisé (groq/mistral/claude)
            "registre":       str,          # registre tonal sélectionné
            "exercice_titre": str,
            "reponse_correcte": str,
            "assistant_message": str,       # alias pour compatibilité frontend
        }
    """
    # ── 1. Construire le contexte ────────────────────────────────────
    contexte = _construire_contexte_apprenant(db, user, exercice)
    contexte["indices"] = [
        x for x in [exercice.indice_1, exercice.indice_2]
        if x and x.strip()
    ]
    correct = (reponse_donnee or "").strip() == (exercice.reponse_correcte or "").strip()

    # ── 2. Choisir le registre tonal ─────────────────────────────────
    registre = _choisir_registre_tonal(contexte, correct)

    # ── 3. Construire le prompt système ──────────────────────────────
    system_prompt = _construire_system_prompt(contexte, exercice, registre, correct)

    # ── 4. Construire l'historique conversationnel ───────────────────
    history = conversation_history or []
    messages = []
    for m in history[-6:]:  # max 3 tours
        role = m.get("role") or "user"
        content = m.get("content") or ""
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    # Construit la question de l'apprenant
    question_apprenant = (
        f"J'ai répondu « {reponse_donnee} ». "
        f"Explique-moi pourquoi c'est {'correct' if correct else 'incorrect'} "
        "et aide-moi à comprendre."
    )
    messages.append({"role": "user", "content": question_apprenant})

    # ── 5. Construire le prompt final (concaténation des messages) ──
    # call_llm utilise un prompt unique + system_prompt
    prompt_final = "\n\n".join(
        f"[{m['role'].upper()}]\n{m['content']}"
        for m in messages
    )

    # ── 6. Appel LLM avec fallback en cascade (max 2 tentatives) ─────
    explication = None
    source = None

    for tentative in range(2):
        try:
            instruction_extra = ""
            if tentative > 0:
                # Si on régénère pour cause de répétition, on précise
                instruction_extra = (
                    "\n\nIMPORTANT : Cette explication doit être DIFFÉRENTE des précédentes. "
                    "Change l'angle d'approche, utilise d'autres exemples, varie la formulation."
                )

            explication, source = call_llm(
                prompt=prompt_final + instruction_extra,
                max_tokens=500,
                system=system_prompt,
            )

            # ── Vérification anti-répétition ─────────────────────────
            if not _est_trop_similaire(explication, str(user.id), str(exercice.id)):
                break
            # Sinon on retente avec instruction de variation
        except Exception as e:
            if tentative == 1:  # dernier essai → fallback local
                explication = _explication_locale(exercice, reponse_donnee)
                source = "local"
                break
            continue

    if explication is None:
        explication = _explication_locale(exercice, reponse_donnee)
        source = "local"

    # ── 7. Enregistrer dans le cache anti-répétition ─────────────────
    if source != "local":
        _enregistrer_explication(explication, str(user.id), str(exercice.id))

    return {
        "explication_ia":    explication.strip(),
        "source":            source,
        "registre":          registre,
        "exercice_titre":    exercice.titre,
        "reponse_correcte":  exercice.reponse_correcte,
        "assistant_message": explication.strip(),
    }


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Fallback local — aucune LLM disponible                            ║
# ╚════════════════════════════════════════════════════════════════════╝

def _explication_locale(exercice: Exercice, reponse_donnee: str) -> str:
    """Génère une explication minimaliste depuis les données de l'exercice."""
    parties = []
    correct = (reponse_donnee or "").strip() == (exercice.reponse_correcte or "").strip()

    if not correct and reponse_donnee:
        parties.append(
            f"Tu as répondu « {reponse_donnee} », "
            f"la bonne réponse était « {exercice.reponse_correcte} »."
        )
    elif correct:
        parties.append(
            f"Bonne réponse ! « {exercice.reponse_correcte} » est bien la solution attendue."
        )

    if exercice.explication:
        parties.append(exercice.explication)

    if not correct:
        if exercice.indice_1:
            parties.append(f"Repère utile : {exercice.indice_1}.")
        if exercice.indice_2:
            parties.append(f"Autre piste : {exercice.indice_2}.")
        parties.append("Relis la leçon et tu y arriveras au prochain essai.")

    return " ".join(parties)
