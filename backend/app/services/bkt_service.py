"""
Bayesian Knowledge Tracing — Corbett & Anderson (1994)
Estime P(maîtrise) pour chaque compétence APC après chaque interaction.

4 paramètres du modèle BKT :
- P_init  : probabilité initiale de maîtrise avant toute interaction
- P_learn : probabilité d'apprendre à chaque opportunité
- P_slip  : probabilité de faire une erreur malgré la maîtrise
- P_guess : probabilité de répondre correctement sans maîtrise
"""

# Paramètres par défaut — calibrés sur la littérature (Corbett & Anderson, 1994)
DEFAULT_PARAMS = {
    "P_init":  0.1,   # faible connaissance initiale supposée
    "P_learn": 0.2,   # 20% de chance d'apprendre à chaque tentative
    "P_slip":  0.1,   # 10% d'erreur même si maîtrisé
    "P_guess": 0.2,   # 20% de chance de deviner sans maîtrise
}

def update_knowledge(p_mastery: float, correct: bool,
                     params: dict = None) -> float:
    """
    Met à jour P(maîtrise) après une réponse.
    Applique la formule de Bayes du BKT.

    Args:
        p_mastery : probabilité actuelle de maîtrise (0.0 à 1.0)
        correct   : True si la réponse est correcte
        params    : paramètres BKT (utilise DEFAULT_PARAMS si None)

    Returns:
        Nouvelle probabilité de maîtrise mise à jour
    """
    if params is None:
        params = DEFAULT_PARAMS

    P_init  = params["P_init"]
    P_learn = params["P_learn"]
    P_slip  = params["P_slip"]
    P_guess = params["P_guess"]

    # Étape 1 — Mise à jour bayésienne selon la réponse observée
    if correct:
        # P(maîtrise | réponse correcte)
        numerateur   = p_mastery * (1 - P_slip)
        denominateur = p_mastery * (1 - P_slip) + (1 - p_mastery) * P_guess
    else:
        # P(maîtrise | réponse incorrecte)
        numerateur   = p_mastery * P_slip
        denominateur = p_mastery * P_slip + (1 - p_mastery) * (1 - P_guess)

    # Évite la division par zéro
    if denominateur == 0:
        p_mastery_given_obs = p_mastery
    else:
        p_mastery_given_obs = numerateur / denominateur

    # Étape 2 — Mise à jour par apprentissage (opportunité d'apprendre)
    p_mastery_new = p_mastery_given_obs + (1 - p_mastery_given_obs) * P_learn

    # Clamp entre 0.01 et 0.99
    return round(max(0.01, min(0.99, p_mastery_new)), 4)


def interpret_mastery(p_mastery: float) -> dict:
    """
    Interprète le niveau de maîtrise pour l'affichage.
    Seuil de maîtrise : 0.95 (standard BKT — Corbett & Anderson)
    """
    if p_mastery >= 0.95:
        return {"niveau": "maitrise",   "label": "Maîtrisé",     "color": "#16a34a"}
    elif p_mastery >= 0.70:
        return {"niveau": "avance",     "label": "En bonne voie","color": "#2563eb"}
    elif p_mastery >= 0.40:
        return {"niveau": "progresse",  "label": "En progrès",   "color": "#d97706"}
    else:
        return {"niveau": "debutant",   "label": "À renforcer",  "color": "#dc2626"}


def compute_class_bkt(students_data: list) -> dict:
    """
    Calcule les statistiques BKT globales pour une classe.

    Args:
        students_data : liste de dicts {competence, p_mastery}

    Returns:
        Statistiques agrégées par compétence
    """
    if not students_data:
        return {}

    # Regroupe par compétence
    competences = {}
    for student in students_data:
        for comp, p in student.items():
            if comp not in competences:
                competences[comp] = []
            competences[comp].append(p)

    # Calcule la moyenne et le taux de maîtrise par compétence
    result = {}
    for comp, values in competences.items():
        avg = sum(values) / len(values)
        taux_maitrise = len([v for v in values if v >= 0.95]) / len(values)
        result[comp] = {
            "moyenne":       round(avg, 3),
            "taux_maitrise": round(taux_maitrise * 100),
            "nb_eleves":     len(values),
            "interpretation": interpret_mastery(avg)
        }

    return result