"""
Module d'analyse d'engagement multimodal — STI Adaptatif
Formule de fusion : S = α·S_visuel + β·S_comportemental
Contexte africain : dégradation gracieuse si modalité absente

Référence : Chapitre 3 du mémoire — Section III-4
"""

# ── Poids de fusion par défaut ──────────────────────────────────────
# α + β = 1.0
# Si une modalité est absente, les poids sont renormalisés automatiquement
FUSION_WEIGHTS = {
    "alpha": 0.55,   # poids modalité visuelle (MediaPipe)
    "beta":  0.45,   # poids modalité comportementale
}

# ── Seuils d'engagement ─────────────────────────────────────────────
THRESHOLDS = {
    "eleve":  0.70,   # score ≥ 0.70 → engagé
    "modere": 0.40,   # score ≥ 0.40 → modéré
    # score < 0.40  → décroché
}


def compute_behavioral_score(events: list) -> dict:
    """
    Calcule le score d'engagement comportemental à partir
    des événements d'interaction enregistrés.

    Événements pris en compte :
    - idle         : inactivité prolongée (pénalité forte)
    - response     : réponse à un exercice (bonus si correct, pénalité si lent)
    - help_requested : demande d'indice (pénalité légère)
    - facial_analysis : score visuel MediaPipe (si disponible)

    Returns:
        dict avec score, level, details, fusion_info
    """
    if not events:
        return {
            "score": 0.5, "level": "modere",
            "behavioral_score": 0.5, "visual_score": None,
            "fusion": "comportemental uniquement (pas d'événements)"
        }

    score_comportemental = 1.0
    score_visuel_list    = []
    nb_idles             = 0
    nb_responses         = 0
    nb_correct           = 0
    nb_help              = 0
    temps_reponse_total  = 0

    for event in events:
        t    = event.get("type", "")
        data = event.get("data", {})

        if t == "idle":
            nb_idles += 1
            score_comportemental -= 0.20  # inactivité = signal fort de décrochage

        elif t == "response":
            nb_responses += 1
            correct = data.get("correct", False)
            temps   = data.get("time_seconds", 30)
            temps_reponse_total += temps

            if correct:
                nb_correct += 1
                score_comportemental += 0.05  # bonus légère pour bonne réponse
            else:
                score_comportemental -= 0.05  # mauvaise réponse = léger signal

            # Pénalité si temps de réponse très long (> 120s)
            if temps > 120:
                score_comportemental -= 0.10

        elif t == "help_requested":
            nb_help += 1
            level = data.get("level", 1)
            score_comportemental -= (0.05 * level)  # plus d'indices = moins d'autonomie

        elif t == "facial_analysis":
            # Score visuel envoyé par MediaPipe
            visual = data.get("visual_score")
            if visual is not None:
                score_visuel_list.append(float(visual))

    # Clamp score comportemental
    score_comportemental = max(0.0, min(1.0, score_comportemental))

    # ── Fusion trimodale ────────────────────────────────────────────
    alpha = FUSION_WEIGHTS["alpha"]
    beta  = FUSION_WEIGHTS["beta"]

    if score_visuel_list:
        # Moyenne glissante sur les 5 derniers scores visuels
        recent_visual = score_visuel_list[-5:]
        score_visuel  = sum(recent_visual) / len(recent_visual)

        # Fusion pondérée : S = α·S_visuel + β·S_comportemental
        score_fusionne = alpha * score_visuel + beta * score_comportemental
        fusion_info    = f"fusion trimodale α={alpha}·visuel({score_visuel:.2f}) + β={beta}·comport.({score_comportemental:.2f})"
    else:
        # Pas de données visuelles → score comportemental seul (renormalisé)
        score_visuel   = None
        score_fusionne = score_comportemental
        fusion_info    = "comportemental uniquement (caméra inactive)"

    score_fusionne = round(max(0.0, min(1.0, score_fusionne)), 3)

    # ── Niveau d'engagement ─────────────────────────────────────────
    if score_fusionne >= THRESHOLDS["eleve"]:
        level = "eleve"
    elif score_fusionne >= THRESHOLDS["modere"]:
        level = "modere"
    else:
        level = "faible"

    # ── Décision d'adaptation pédagogique ───────────────────────────
    adaptation = decide_adaptation(
        score=score_fusionne,
        level=level,
        nb_idles=nb_idles,
        nb_help=nb_help,
        nb_responses=nb_responses,
        nb_correct=nb_correct,
    )

    return {
        "score":               score_fusionne,
        "level":               level,
        "behavioral_score":    round(score_comportemental, 3),
        "visual_score":        round(score_visuel, 3) if score_visuel is not None else None,
        "fusion_info":         fusion_info,
        "adaptation":          adaptation,
        "stats": {
            "nb_idles":     nb_idles,
            "nb_responses": nb_responses,
            "nb_correct":   nb_correct,
            "nb_help":      nb_help,
            "taux_reussite": round(nb_correct / nb_responses * 100) if nb_responses > 0 else None,
        }
    }


def decide_adaptation(score, level, nb_idles, nb_help,
                      nb_responses, nb_correct) -> dict | None:
    """
    Règles expertes IF-THEN pour l'adaptation pédagogique.
    Retourne un message d'adaptation ou None si aucune action requise.
    """
    # Décrochage sévère
    if level == "faible" and nb_idles >= 2:
        return {
            "type":     "pause",
            "priority": "haute",
            "message":  "Tu sembles décroché. Fais une courte pause de 5 minutes avant de continuer.",
            "action":   "suggest_break"
        }

    # Décrochage modéré
    if level == "faible":
        return {
            "type":     "encouragement",
            "priority": "haute",
            "message":  "Ton niveau d'attention est faible. Essaie de te concentrer — tu y es presque !",
            "action":   "encourage"
        }

    # Beaucoup d'indices demandés = difficulté trop élevée
    if nb_help >= 3 and nb_responses > 0:
        taux = nb_correct / nb_responses
        if taux < 0.5:
            return {
                "type":     "simplify",
                "priority": "moyenne",
                "message":  "Ces exercices semblent difficiles. Relis la leçon avant de continuer.",
                "action":   "suggest_review"
            }

    # Excellent engagement + bonne performance → proposer un défi
    if level == "eleve" and nb_responses >= 3 and nb_correct == nb_responses:
        return {
            "type":     "challenge",
            "priority": "basse",
            "message":  "Excellent travail ! Tu maîtrises bien — prêt pour des exercices plus difficiles ?",
            "action":   "increase_difficulty"
        }

    return None