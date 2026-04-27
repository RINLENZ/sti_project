"""
Module de fusion multimodale — STI Adaptatif
=============================================
Formule : Engagement_score(t) = α(t)·Facial + β(t)·Audio + γ(t)·Interaction
Avec α(t) + β(t) + γ(t) = 1

Valeurs par défaut (validation empirique, conformes au mémoire) :
    α = 0.40  (facial)
    β = 0.30  (audio  — désactivé en prototype → β=0, renormalisation)
    γ = 0.30  (interaction comportementale)

En l'absence d'audio (β=0) : renormalisation proportionnelle →
    α' = 0.40 / (0.40 + 0.30) = 0.571
    γ' = 0.30 / (0.40 + 0.30) = 0.429

États affectifs académiques (Ekman & Friesen, FACS) :
    engagement_eleve, engagement_faible, confusion,
    frustration, ennui, neutre

Référence : Chapitre 3 du mémoire — Section III-4
"""

# ── Poids par défaut (mémoire Section III-4) ──────────────────────
WEIGHTS_DEFAULT = {
    "alpha": 0.40,   # modalité visuelle (MediaPipe + Action Units)
    "beta":  0.30,   # modalité audio (GRU ONNX — désactivé en prototype)
    "gamma": 0.30,   # modalité comportementale (Random Forest)
}

# ── Seuils d'engagement (5 niveaux conformes au mémoire) ──────────
LEVELS = [
    (0.80, "engagement_eleve"),
    (0.60, "engagement_modere"),
    (0.40, "engagement_faible"),
    (0.20, "ennui"),
    (0.00, "decrochage"),
]

# ── États affectifs académiques (FACS / Ekman & Friesen) ──────────
ETATS_AFFECTIFS = {
    "engagement_eleve":  "Engagement élevé",
    "engagement_faible": "Engagement faible",
    "confusion":         "Confusion",
    "frustration":       "Frustration",
    "ennui":             "Ennui",
    "neutre":            "Neutre",
}


def get_engagement_level(score: float) -> str:
    """Retourne le niveau d'engagement sur 5 niveaux."""
    for threshold, label in LEVELS:
        if score >= threshold:
            return label
    return "decrochage"


def renormaliser_poids(alpha: float, beta: float, gamma: float) -> dict:
    """
    Renormalise les poids quand une modalité est absente.
    Garantit α' + β' + γ' = 1.
    """
    total = alpha + beta + gamma
    if total == 0:
        return {"alpha": 0.5, "beta": 0.0, "gamma": 0.5}
    return {
        "alpha": round(alpha / total, 4),
        "beta":  round(beta  / total, 4),
        "gamma": round(gamma / total, 4),
    }


def compute_behavioral_score(events: list) -> dict:
    """
    Calcule le score d'engagement fusionné depuis les événements.

    Modalités traitées :
    - Visuelle  : événements 'facial_analysis' avec visual_score
    - Audio     : désactivé en prototype (β=0)
    - Comport.  : idle, response, help_requested

    Returns:
        dict avec score, level, behavioral_score, visual_score,
             audio_score, fusion_info, adaptation, stats
    """
    if not events:
        return {
            "score":              0.5,
            "level":              "neutre",
            "behavioral_score":   0.5,
            "visual_score":       None,
            "audio_score":        None,
            "fusion_info":        "aucun événement",
            "adaptation":         None,
            "stats": {
                "nb_idles":      0,
                "nb_responses":  0,
                "nb_correct":    0,
                "nb_help":       0,
                "taux_reussite": None,
            }
        }

    # ── Extraction des scores par modalité ───────────────────────
    score_comportemental = 0.5   # neutre par défaut
    score_visuel_list    = []
    nb_idles             = 0
    nb_responses         = 0
    nb_correct           = 0
    nb_help              = 0
    temps_reponse_total  = 0
    etats_affectifs_list = []

    for event in events:
        t    = event.get("type", "")
        data = event.get("data", {})

        if t == "idle":
            nb_idles += 1
            score_comportemental -= 0.12   # pénalité modérée (base 0.5)

        elif t == "response":
            nb_responses += 1
            correct = data.get("correct", False)
            temps   = data.get("time_seconds", 30)
            temps_reponse_total += temps

            if correct:
                nb_correct += 1
                score_comportemental += 0.08
            else:
                score_comportemental -= 0.06

            # Temps de réponse très long → signal de confusion
            if temps > 120:
                score_comportemental -= 0.08

        elif t == "help_requested":
            nb_help += 1
            level    = data.get("level", 1)
            score_comportemental -= (0.04 * level)

        elif t == "facial_analysis":
            # Score visuel MediaPipe
            visual = data.get("visual_score")
            if visual is not None:
                score_visuel_list.append(float(visual))
            # État affectif détecté côté frontend
            etat = data.get("emotion")
            if etat:
                etats_affectifs_list.append(etat)

        elif t == "audio_analysis":
            # Pénalité score si bruit perturbateur (une seule fois)
            perturb = data.get("bruit_perturb", False)
            if perturb:
                score_comportemental -= 0.06

    # Clamp score comportemental
    score_comportemental = max(0.0, min(1.0, score_comportemental))

    # ── Pondérations dynamiques ───────────────────────────────────
    # Audio désactivé en prototype → β=0, renormalisation α+γ
    alpha_raw = WEIGHTS_DEFAULT["alpha"]
    beta_raw  = 0.0   # audio désactivé
    gamma_raw = WEIGHTS_DEFAULT["gamma"]

    # Si pas de données visuelles → α=0 également
    if not score_visuel_list:
        alpha_raw = 0.0

    poids = renormaliser_poids(alpha_raw, beta_raw, gamma_raw)
    alpha = poids["alpha"]
    gamma = poids["gamma"]

    # ── Fusion selon modalités disponibles ───────────────────────
    if score_visuel_list:
        # Moyenne glissante sur les 5 derniers scores visuels
        recent_visual = score_visuel_list[-5:]
        score_visuel  = round(sum(recent_visual) / len(recent_visual), 3)

        # Score fusionné : α·facial + γ·comportemental (β=0)
        score_fusionne = alpha * score_visuel + gamma * score_comportemental
        fusion_info    = (
            f"α={alpha:.2f}·facial({score_visuel:.2f}) + "
            f"γ={gamma:.2f}·comport.({score_comportemental:.2f}) | "
            f"β=0 (audio désactivé)"
        )
    else:
        # Pas de données visuelles → comportemental seul (γ=1.0)
        score_visuel   = None
        score_fusionne = score_comportemental
        fusion_info    = (
            f"comportemental seul γ=1.0 ({score_comportemental:.2f}) | "
            f"α=0 (caméra inactive), β=0 (audio désactivé)"
        )

    score_fusionne = round(max(0.0, min(1.0, score_fusionne)), 3)

    # ── Niveau d'engagement (5 niveaux) ──────────────────────────
    level = get_engagement_level(score_fusionne)

    # ── État affectif dominant ────────────────────────────────────
    etat_dominant = _etat_affectif_dominant(
        etats_affectifs_list, score_fusionne,
        nb_idles, nb_help, nb_responses, nb_correct
    )

    # ── Adaptation pédagogique ────────────────────────────────────
    adaptation = decide_adaptation(
        score=score_fusionne,
        level=level,
        nb_idles=nb_idles,
        nb_help=nb_help,
        nb_responses=nb_responses,
        nb_correct=nb_correct,
        etat_affectif=etat_dominant,
    )

    return {
        "score":              score_fusionne,
        "level":              level,
        "behavioral_score":   round(score_comportemental, 3),
        "visual_score":       score_visuel,
        "audio_score":        None,   # désactivé en prototype
        "etat_affectif":      etat_dominant,
        "fusion_info":        fusion_info,
        "poids":              {"alpha": alpha, "beta": 0.0, "gamma": gamma},
        "adaptation":         adaptation,
        "stats": {
            "nb_idles":      nb_idles,
            "nb_responses":  nb_responses,
            "nb_correct":    nb_correct,
            "nb_help":       nb_help,
            "taux_reussite": round(nb_correct / nb_responses * 100) if nb_responses > 0 else None,
            "temps_moyen_reponse": round(temps_reponse_total / nb_responses) if nb_responses > 0 else None,
        }
    }


def _etat_affectif_dominant(
    etats_list: list,
    score: float,
    nb_idles: int,
    nb_help: int,
    nb_responses: int,
    nb_correct: int
) -> str:
    """
    Détermine l'état affectif dominant en combinant :
    1. Les états détectés par MediaPipe (landmarks faciaux)
    2. Les signaux comportementaux (règles expertes FACS)

    États académiques (conformes au mémoire) :
    engagement_eleve, engagement_faible, confusion,
    frustration, ennui, neutre
    """
    # Compte les états détectés visuellement
    compteur = {}
    for etat in etats_list:
        # Mapping frontend → labels mémoire (labels directs + legacy)
        mapping = {
            "engagement_eleve":  "engagement_eleve",
            "engagement_modere": "engagement_modere",
            "engagement_faible": "engagement_faible",
            "confusion":         "confusion",
            "frustration":       "frustration",
            "ennui":             "ennui",
            "neutre":            "neutre",
            "absent":            "ennui",
            "joie":              "engagement_eleve",  # legacy
            "surprise":          "confusion",          # legacy
        }
        label = mapping.get(etat, "neutre")
        compteur[label] = compteur.get(label, 0) + 1

    # État visuel dominant
    etat_visuel = max(compteur, key=compteur.get) if compteur else None

    # ── Règles expertes comportementales (priorité sur visuel) ────
    # Ennui : inactivité répétée
    if nb_idles >= 2:
        return "ennui"

    # Frustration : beaucoup d'aide + mauvais taux
    if nb_help >= 3 and nb_responses > 0:
        taux = nb_correct / nb_responses
        if taux < 0.40:
            return "frustration"

    # Confusion : beaucoup d'aide mais taux moyen
    if nb_help >= 2 and nb_responses > 0:
        taux = nb_correct / nb_responses
        if 0.40 <= taux < 0.60:
            return "confusion"

    # Engagement élevé : bon score + peu d'aide
    if score >= 0.70 and nb_help == 0 and nb_responses >= 2:
        taux = nb_correct / nb_responses if nb_responses > 0 else 0
        if taux >= 0.70:
            return "engagement_eleve"

    # Engagement faible : score bas sans autre signal
    if score < 0.40:
        return "engagement_faible"

    # Retourne l'état visuel dominant si disponible
    if etat_visuel:
        return etat_visuel

    return "neutre"


def decide_adaptation(
    score: float,
    level: str,
    nb_idles: int,
    nb_help: int,
    nb_responses: int,
    nb_correct: int,
    etat_affectif: str = "neutre"
) -> dict | None:
    """
    Règles IF-THEN pour l'adaptation pédagogique.
    Prend en compte l'état affectif pour personnaliser le message.
    """
    # Décrochage sévère
    if level == "decrochage" or (level == "ennui" and nb_idles >= 2):
        return {
            "type":     "pause",
            "priority": "haute",
            "message":  "Tu sembles décroché. Fais une courte pause de 5 minutes avant de continuer.",
            "action":   "suggest_break"
        }

    # Frustration détectée
    if etat_affectif == "frustration" or (nb_help >= 3 and nb_responses > 0 and nb_correct / nb_responses < 0.4):
        return {
            "type":     "simplify",
            "priority": "haute",
            "message":  "Ces exercices semblent difficiles. Relis la leçon — le tuteur peut t'aider avec le bouton 💡.",
            "action":   "suggest_review"
        }

    # Confusion détectée
    if etat_affectif == "confusion" or nb_help >= 2:
        return {
            "type":     "clarify",
            "priority": "moyenne",
            "message":  "Tu sembles avoir des difficultés. N'hésite pas à utiliser les indices disponibles.",
            "action":   "suggest_hint"
        }

    # Engagement faible
    if level in ("engagement_faible", "ennui"):
        return {
            "type":     "encouragement",
            "priority": "moyenne",
            "message":  "Ton niveau d'attention est faible. Concentre-toi — tu y es presque !",
            "action":   "encourage"
        }

    # Engagement élevé → proposer un défi
    if level == "engagement_eleve" and nb_responses >= 3:
        taux = nb_correct / nb_responses if nb_responses > 0 else 0
        if taux >= 0.80:
            return {
                "type":     "challenge",
                "priority": "basse",
                "message":  "Excellent travail ! Tu maîtrises bien ce contenu. Prêt pour des exercices plus difficiles ?",
                "action":   "increase_difficulty"
            }

    return None