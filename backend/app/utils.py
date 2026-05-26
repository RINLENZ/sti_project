from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models.cours import Exercice


def get_kcs(exercice) -> list[str]:
    """
    Retourne la liste ordonnée des KCs d'un exercice.
    kcs[0] = KC principal (utilisé par le BKT classique, Solution B).
    Fallback sur competence_evaluee pour la rétrocompatibilité.
    """
    if exercice.kcs:
        return exercice.kcs
    if exercice.competence_evaluee:
        return [exercice.competence_evaluee]
    return []
