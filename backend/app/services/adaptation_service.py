"""
adaptation_service.py — Moteur d'adaptation pédagogique multimodale
====================================================================

Orchestre la décision d'une intervention pédagogique en agrégeant TROIS
sources d'information :

  1. ENGAGEMENT MULTIMODAL (engagement_service.py)
     - Score fused (0-1) issu de la fusion facial+audio+behavioral
     - État affectif inféré (frustration, ennui, confusion, etc.)

  2. PRÉDICTION DE MAÎTRISE (dkt_service.py)
     - Pour chaque macro-compétence : P(réussite au prochain exercice)
     - Permet de distinguer "exercice trop facile" vs "exercice trop dur"

  3. SIGNAUX TEMPORELS DE SESSION
     - Durée de session (fatigue cognitive)
     - Temps de réponse anormaux (blocage silencieux)
     - Séries d'erreurs / réussites (besoin de remédiation / de défi)

Les 9 déclencheurs sont évalués dans l'ordre de PRIORITÉ DÉCROISSANTE.
Le premier qui matche déclenche son action, les autres sont ignorés pour
ce cycle (un seul affichage UI à la fois).

Sortie : dict {declencheur, action, intensite, message, params} ou None.

Référence pédagogique : Vygotsky (1978), Pekrun (2006) sur les émotions
académiques, Csikszentmihalyi (1990) sur le flow.
"""
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import statistics

from sqlalchemy.orm import Session

from app.models.adaptation import Adaptation


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Cooldowns — éviter de spammer la même intervention                ║
# ╚════════════════════════════════════════════════════════════════════╝
# Durée minimale (en secondes) entre deux occurrences du même déclencheur
# au sein d'une même session. Évite que l'apprenant soit bombardé.

COOLDOWN_SECONDS = {
    "decrochage_critique":          120,   # 2 min — déclencheur le plus rare
    "frustration_detectee":         180,   # 3 min
    "pause_longue_suggeree":        300,   # 5 min — proposition de pause longue
    "blocage_silencieux":           120,   # 2 min
    "rappel_avant_difficile":       60,    # 1 min — peut se répéter par UA
    "erreurs_consecutives":         90,    # 1.5 min
    "ennui_avec_reussites":         180,
    "encouragement_progression":    120,
    "reconnaissance_positive":      300,   # 5 min — passif, doit rester rare
}


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Fonction principale                                                ║
# ╚════════════════════════════════════════════════════════════════════╝

def evaluer_adaptation(
    db: Session,
    *,
    session_id: str,
    user_id: str,
    engagement: Dict[str, Any],
    dkt_predictions: Optional[Dict[str, float]] = None,
    metrics: Dict[str, Any],
    current_macro_kc: Optional[str] = None,
    current_exercise: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """
    Évalue les 9 déclencheurs et retourne au plus UNE adaptation à appliquer.

    Args:
        db                : session SQLAlchemy (pour cooldown + logging)
        session_id        : UUID de la session courante
        user_id           : UUID de l'apprenant
        engagement        : {"fused": float, "etat": str, "facial": float,
                             "audio": float, "behavioral": float}
        dkt_predictions   : dict {macro_kc: proba} issu de dkt_service (optionnel)
        metrics           : signaux temporels — voir docstring de _build_metrics()
        current_macro_kc  : macro-KC de l'exercice en cours (optionnel)
        current_exercise  : exercice à venir, pour déclencheur "avant difficile"

    Returns:
        dict {declencheur, action, intensite, message, params} ou None.
    """
    # ── Récupération du contexte temporel (cooldowns) ────────────────
    recent_adaptations = _get_recent_adaptations(db, session_id)

    # ── Évaluation des 9 déclencheurs par ordre de PRIORITÉ ──────────
    # On évalue du plus critique au moins critique. Premier match gagne.
    candidates = [
        _check_decrochage_critique,         # #8 — INTENSITÉ HAUTE
        _check_frustration_persistante,     # #1 — INTENSITÉ MOYENNE
        _check_erreurs_consecutives,        # #3 — INTENSITÉ HAUTE (fallback sans LLM)
        _check_blocage_silencieux,          # #6 — INTENSITÉ MOYENNE
        _check_pause_longue,                # #7 — INTENSITÉ MOYENNE
        _check_rappel_avant_difficile,      # #5 — INTENSITÉ MOYENNE
        _check_encouragement_progression,   # #4 — INTENSITÉ BASSE
        _check_ennui_avec_reussites,        # #2 — INTENSITÉ BASSE
        _check_reconnaissance_positive,     # #9 — INTENSITÉ BASSE
    ]

    ctx = {
        "engagement":        engagement,
        "dkt_predictions":   dkt_predictions or {},
        "metrics":           metrics,
        "current_macro_kc":  current_macro_kc,
        "current_exercise":  current_exercise,
        "recent":            recent_adaptations,
    }

    for check_fn in candidates:
        result = check_fn(ctx)
        if result is None:
            continue
        if _is_in_cooldown(result["declencheur"], recent_adaptations):
            continue
        # ── Logging en BDD ────────────────────────────────────────────
        adaptation = Adaptation(
            session_id  = session_id,
            user_id     = user_id,
            declencheur = result["declencheur"],
            action      = result["action"],
            intensite   = result["intensite"],
            signal_data = {
                "engagement":      engagement,
                "metrics":         metrics,
                "current_macro_kc": current_macro_kc,
                "dkt_predictions": dkt_predictions or {},
            },
            applique    = False,
        )
        db.add(adaptation)
        db.commit()
        db.refresh(adaptation)
        result["id"] = str(adaptation.id)
        return result

    return None


def confirmer_application(db: Session, adaptation_id: str) -> bool:
    """
    Le frontend appelle ça pour confirmer qu'une adaptation a bien été
    affichée à l'utilisateur (pour les stats de couverture).
    """
    adp = db.query(Adaptation).filter(Adaptation.id == adaptation_id).first()
    if not adp:
        return False
    adp.applique = True
    db.commit()
    return True


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Les 9 déclencheurs                                                 ║
# ╚════════════════════════════════════════════════════════════════════╝
#
# Chaque fonction reçoit le contexte `ctx` (dict) et retourne soit None
# (pas déclenché) soit un dict {declencheur, action, intensite, message, params}.
# Garder ces fonctions SIMPLES et LISIBLES — c'est le cœur défendable du mémoire.


def _check_decrochage_critique(ctx: dict) -> Optional[dict]:
    """
    Déclencheur #8 — Décrochage critique.

    L'engagement est très bas (fused < 0.25) sur 2 mesures consécutives.
    L'apprenant est sur le point d'abandonner — intervention immédiate.

    Action : modal bloquant avec questionnement direct + reset attention.
    """
    eng = ctx["engagement"]
    fused_recents = ctx["metrics"].get("engagement_recent_5", [])

    if (eng.get("fused", 1.0) < 0.25 and
            len(fused_recents) >= 2 and
            all(f < 0.30 for f in fused_recents[-2:])):
        return {
            "declencheur": "decrochage_critique",
            "action":      "modal_re_engagement",
            "intensite":   "haute",
            "message":     "Ça a l'air difficile en ce moment. Veux-tu en parler ou faire une pause ?",
            "params": {
                "choix": [
                    {"label": "Continuer", "type": "continue"},
                    {"label": "Pause 5 minutes", "type": "pause_short", "duree": 300},
                    {"label": "Arrêter la session", "type": "abandon"},
                ],
                "bloquant": True,
            },
        }
    return None


def _check_frustration_persistante(ctx: dict) -> Optional[dict]:
    """
    Déclencheur #1 — Frustration détectée sur ≥ 2 exercices.

    L'état affectif est "frustration" ET l'engagement est sous 0.40.
    L'apprenant lutte émotionnellement.

    Action : overlay semi-bloquant 30s avec exercice de respiration ou
    micro-anecdote ENSET, pour réguler l'émotion avant de continuer.
    """
    eng = ctx["engagement"]
    metrics = ctx["metrics"]

    is_frustrated = eng.get("etat") == "frustration"
    low_engagement_streak = metrics.get("low_engagement_streak", 0)

    if is_frustrated and eng.get("fused", 1.0) < 0.40 and low_engagement_streak >= 2:
        return {
            "declencheur": "frustration_detectee",
            "action":      "overlay_regulation_emotion",
            "intensite":   "moyenne",
            "message":     "Respire un instant. C'est normal de bloquer parfois — Alisha attend que tu sois prêt.",
            "params": {
                "duree_sec":    30,
                "type":         "respiration",  # frontend choisit l'animation
                "fermable":     True,           # mais après 10s minimum
                "fermable_apres_sec": 10,
            },
        }
    return None


def _check_erreurs_consecutives(ctx: dict) -> Optional[dict]:
    """
    Déclencheur #3 — Erreurs en série sur même macro-KC.

    3 erreurs consécutives sur même macro-KC OU 5 erreurs cumulées dans
    la session.

    Action : remédiation. En attendant l'Étape 4 (LLM contextuel), on
    affiche un modal avec un rappel statique du cours pour ce macro-KC.
    """
    metrics = ctx["metrics"]
    erreurs_macro_kc = metrics.get("erreurs_consecutives_macro_kc", 0)
    erreurs_session  = metrics.get("erreurs_session", 0)

    # Seuils abaissés (R2) : déclenche la remédiation + extrait de cours plus tôt,
    # indépendamment de la caméra (basé uniquement sur les réponses).
    if erreurs_macro_kc >= 2 or erreurs_session >= 3:
        return {
            "declencheur": "erreurs_consecutives",
            "action":      "modal_remediation",
            "intensite":   "haute",
            "message":     "Ça semble difficile. Voici un rappel rapide pour t'aider.",
            "params": {
                "macro_kc":     ctx.get("current_macro_kc"),
                "fermable":     True,
                "lien_cours":   True,
                # NB: en Étape 4, on remplacera ce message statique par un
                # appel au LLM contextualisé (BKT + historique d'erreurs).
            },
        }
    return None


def _check_blocage_silencieux(ctx: dict) -> Optional[dict]:
    """
    Déclencheur #6 — Temps de réponse anormalement long.

    L'apprenant met > 2× son temps moyen sur 2 exercices consécutifs
    sans demander d'aide. Probablement bloqué sans le dire.

    Action : dialog discret "Tu veux que je clarifie quelque chose ?"
    """
    metrics = ctx["metrics"]
    temps = metrics.get("temps_reponses_recents", [])
    moyenne_profil = metrics.get("temps_moyen_profil", 30)

    if len(temps) >= 2 and moyenne_profil > 0:
        derniers = temps[-2:]
        if all(t > 2.0 * moyenne_profil for t in derniers):
            return {
                "declencheur": "blocage_silencieux",
                "action":      "dialog_orientation",
                "intensite":   "moyenne",
                "message":     "Tu sembles réfléchir longuement. Veux-tu un indice ou une clarification ?",
                "params": {
                    "choix": [
                        {"label": "Un indice", "type": "hint"},
                        {"label": "Revoir le cours", "type": "review"},
                        {"label": "Continuer seul", "type": "dismiss"},
                    ],
                    "fermable": True,
                },
            }
    return None


def _check_pause_longue(ctx: dict) -> Optional[dict]:
    """
    Déclencheur #7 — Durée de session > 25 min ET engagement en baisse.

    Prévention de la fatigue cognitive : on suggère une pause longue
    avant que la session ne devienne improductive.
    """
    metrics = ctx["metrics"]
    duree   = metrics.get("duree_session_sec", 0)
    eng_recent = metrics.get("engagement_recent_5", [])

    # Baisse continue = chaque valeur ≤ la précédente sur au moins 4 mesures
    en_baisse = False
    if len(eng_recent) >= 4:
        en_baisse = all(eng_recent[i] <= eng_recent[i-1] + 0.05
                        for i in range(1, min(len(eng_recent), 5)))

    if duree > 25 * 60 and en_baisse:
        return {
            "declencheur": "pause_longue_suggeree",
            "action":      "modal_pause_longue",
            "intensite":   "moyenne",
            "message":     "Tu travailles depuis un bon moment. Une pause de 10 minutes te ferait du bien ?",
            "params": {
                "duree_proposee_min": 10,
                "choix": [
                    {"label": "Oui, pause 10 min", "type": "accept", "duree": 600},
                    {"label": "Encore quelques minutes", "type": "snooze"},
                ],
                "fermable": True,
            },
        }
    return None


def _check_rappel_avant_difficile(ctx: dict) -> Optional[dict]:
    """
    Déclencheur #5 — Avant exercice difficile + maîtrise prédite faible.

    L'exercice suivant a une difficulté 3 (sur 3) et le DKT prédit une
    maîtrise < 0.40 sur son macro-KC. On donne un coup de pouce cognitif
    avant pour éviter l'échec démoralisant.
    """
    exo = ctx.get("current_exercise") or {}
    preds = ctx.get("dkt_predictions") or {}

    difficulte = exo.get("difficulte")
    macro_kc   = exo.get("macro_kc") or ctx.get("current_macro_kc")
    if not macro_kc:
        return None

    p_mastery = preds.get(macro_kc, 0.5)

    # Seuil élargi (R2) : un coup de pouce avant les questions difficiles dès que
    # la maîtrise prédite est moyenne-basse (sans dépendre de la caméra).
    if difficulte == 3 and p_mastery < 0.50:
        return {
            "declencheur": "rappel_avant_difficile",
            "action":      "modal_rappel_cours",
            "intensite":   "moyenne",
            "message":     "Cet exercice est plus exigeant. Voici l'essentiel du cours :",
            "params": {
                "macro_kc":     macro_kc,
                "duree_min_sec": 5,        # affichage minimum 5s
                "fermable":     True,
                "lien_cours":   True,
            },
        }
    return None


def _check_encouragement_progression(ctx: dict) -> Optional[dict]:
    """
    Déclencheur #4 — Maîtrise élevée + 2 réussites consécutives.

    L'apprenant maîtrise ce macro-KC (DKT prédit P > 0.75) et vient de
    réussir 2 exercices d'affilée. On l'encourage et on le bascule
    naturellement vers le macro-KC suivant en ZPD.
    """
    metrics = ctx["metrics"]
    preds = ctx.get("dkt_predictions") or {}
    macro_kc = ctx.get("current_macro_kc")

    if not macro_kc:
        return None

    p_mastery = preds.get(macro_kc, 0.5)
    reussites = metrics.get("reussites_consecutives_macro_kc", 0)

    if p_mastery > 0.75 and reussites >= 2:
        # Trouver le prochain macro-KC en ZPD (proba la plus proche de 0.5)
        prochain_kc = _macro_kc_en_zpd(preds, exclude=macro_kc)

        return {
            "declencheur": "encouragement_progression",
            "action":      "toast_encouragement_transition",
            "intensite":   "basse",
            "message":     f"Excellent ! Tu maîtrises bien {macro_kc}. Si tu veux, on peut explorer {prochain_kc or 'autre chose'}.",
            "params": {
                "duree_sec":      4,
                "macro_kc_actuel": macro_kc,
                "macro_kc_suggere": prochain_kc,
                "fermable":       True,
            },
        }
    return None


def _check_ennui_avec_reussites(ctx: dict) -> Optional[dict]:
    """
    Déclencheur #2 — Ennui malgré les réussites = sous-stimulation.

    État "ennui" + engagement bas + ≥ 3 réussites consécutives :
    l'apprenant trouve les exercices trop faciles. On lui propose un
    challenge bonus (difficulté +1).
    """
    eng = ctx["engagement"]
    metrics = ctx["metrics"]

    is_bored = eng.get("etat") == "ennui"
    low_eng = eng.get("fused", 1.0) < 0.40
    reussites = metrics.get("reussites_consecutives", 0)

    if is_bored and low_eng and reussites >= 3:
        return {
            "declencheur": "ennui_avec_reussites",
            "action":      "badge_challenge_bonus",
            "intensite":   "basse",
            "message":     "Et si on corsait un peu ? Voici un exercice bonus.",
            "params": {
                "macro_kc":        ctx.get("current_macro_kc"),
                "difficulte_cible": 3,
                "fermable":         True,
                "duree_sec":        6,
            },
        }
    return None


def _check_reconnaissance_positive(ctx: dict) -> Optional[dict]:
    """
    Déclencheur #9 — Engagement stable et élevé sur ≥ 5 exercices.

    L'apprenant est dans un bon flow. On le reconnaît discrètement
    (toast 3 secondes) sans interrompre.

    Note : cooldown de 5 min pour éviter d'en abuser.
    """
    metrics = ctx["metrics"]
    eng_recent = metrics.get("engagement_recent_5", [])

    if len(eng_recent) >= 5 and all(e >= 0.70 for e in eng_recent[-5:]):
        return {
            "declencheur": "reconnaissance_positive",
            "action":      "toast_reconnaissance",
            "intensite":   "basse",
            "message":     "Belle concentration aujourd'hui 👍",
            "params": {
                "duree_sec": 3,
                "fermable":  True,
            },
        }
    return None


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Helpers                                                            ║
# ╚════════════════════════════════════════════════════════════════════╝

def _get_recent_adaptations(db: Session, session_id: str) -> List[Adaptation]:
    """
    Récupère toutes les adaptations déclenchées dans cette session,
    pour pouvoir appliquer les cooldowns.
    """
    return (
        db.query(Adaptation)
        .filter(Adaptation.session_id == session_id)
        .order_by(Adaptation.timestamp.desc())
        .limit(50)
        .all()
    )


def _is_in_cooldown(declencheur: str, recent: List[Adaptation]) -> bool:
    """
    Renvoie True si ce déclencheur a été activé récemment dans la session
    et qu'on est encore dans son cooldown.
    """
    cooldown = COOLDOWN_SECONDS.get(declencheur, 60)
    now = datetime.now(timezone.utc)
    for adp in recent:
        if adp.declencheur != declencheur:
            continue
        elapsed = (now - adp.timestamp).total_seconds()
        if elapsed < cooldown:
            return True
        break  # les adaptations sont triées desc, donc dès qu'on dépasse OK
    return False


def _macro_kc_en_zpd(predictions: Dict[str, float], exclude: Optional[str] = None) -> Optional[str]:
    """
    Trouve le macro-KC dont la probabilité prédite est la plus proche de 0.5
    (zone proximale de développement). Exclut éventuellement un macro-KC déjà
    en cours.
    """
    candidates = {k: v for k, v in predictions.items() if k != exclude}
    if not candidates:
        return None
    return min(candidates.items(), key=lambda kv: abs(kv[1] - 0.5))[0]


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Statistiques (pour le dashboard et le mémoire)                    ║
# ╚════════════════════════════════════════════════════════════════════╝

def compter_adaptations_par_type(db: Session, user_id: Optional[str] = None) -> Dict[str, int]:
    """Distribution des adaptations déclenchées par type."""
    from sqlalchemy import func
    q = db.query(Adaptation.declencheur, func.count(Adaptation.id))
    if user_id:
        q = q.filter(Adaptation.user_id == user_id)
    return dict(q.group_by(Adaptation.declencheur).all())


def adaptations_session(db: Session, session_id: str) -> List[Adaptation]:
    """Liste de toutes les adaptations d'une session donnée."""
    return (
        db.query(Adaptation)
        .filter(Adaptation.session_id == session_id)
        .order_by(Adaptation.timestamp.asc())
        .all()
    )
