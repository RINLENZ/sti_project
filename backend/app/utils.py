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


# ── Table de regroupement KC fin → macro-KC ──────────────────────────────────
#
# Objectif : 8-15 macro-KCs pour l'entraînement DKT (les 44 KCs fins restent
# dans l'affichage BKT apprenant mais le DKT s'entraîne sur les macro-KCs).
#
# Structure : { "KC fin exact" : "macro-KC" }
# Les KCs non listés ici tombent dans le fallback keyword-based.

MACRO_KC_MAP: dict[str, str] = {
    # ── Algorithmique ────────────────────────────────────────────────────────
    "Identifier les structures de contrôle":               "Algorithmique",
    "Exécuter un algorithme ayant une structure alternative": "Algorithmique",
    "Exécuter des algorithmes itératifs":                  "Algorithmique",
    "Analyser un algorithme":                              "Algorithmique",
    "Concevoir un algorithme":                             "Algorithmique",
    "Écrire un algorithme":                                "Algorithmique",
    "Représenter un algorithme":                           "Algorithmique",
    "Identifier les types de données":                     "Algorithmique",

    # ── Programmation C ──────────────────────────────────────────────────────
    "Écrire la structure d'un programme C":                "Prog-C",
    "Traduire un algorithme en langage C":                 "Prog-C",
    "Écrire un programme C":                               "Prog-C",
    "Compiler un programme C":                             "Prog-C",
    "Utiliser les pointeurs en C":                         "Prog-C",
    "Utiliser les tableaux en C":                          "Prog-C",
    "Utiliser les fonctions en C":                         "Prog-C",
    "Utiliser les structures en C":                        "Prog-C",

    # ── Outils et débogage ───────────────────────────────────────────────────
    "Utiliser un IDE et déboguer un programme C":          "Outils-Dev",
    "Déboguer un programme":                               "Outils-Dev",
    "Utiliser un compilateur":                             "Outils-Dev",
    "Utiliser un environnement de développement":          "Outils-Dev",

    # ── Structures de données ────────────────────────────────────────────────
    "Manipuler des tableaux":                              "Structures-Données",
    "Manipuler des listes chainées":                       "Structures-Données",
    "Manipuler des piles et files":                        "Structures-Données",
    "Utiliser des arbres binaires":                        "Structures-Données",

    # ── Bases de données / LDD ───────────────────────────────────────────────
    "Modéliser une base de données":                       "BDD",
    "Écrire des requêtes SQL":                             "BDD",
    "Utiliser le LDD":                                     "BDD",
    "Utiliser le LMD":                                     "BDD",
    "Créer un schéma relationnel":                         "BDD",

    # ── Réseaux ──────────────────────────────────────────────────────────────
    "Identifier les composants d'un réseau":               "Réseaux",
    "Configurer un réseau local":                          "Réseaux",
    "Utiliser les protocoles réseau":                      "Réseaux",
    "Identifier les couches OSI":                          "Réseaux",

    # ── Humanités numériques / Internet ──────────────────────────────────────
    "Identifier les risques numériques":                   "Humanités-Numériques",
    "Utiliser des outils collaboratifs":                   "Humanités-Numériques",
    "Comprendre le web":                                   "Humanités-Numériques",
}


# ── Inférence par mots-clés (fallback pour les KCs non listés) ───────────────

_KEYWORD_MAP: list[tuple[list[str], str]] = [
    # patterns (substrings en minuscule normalisé)   macro-KC
    # Outils-Dev en premier pour éviter que "compilateur" soit rattrapé par Prog-C
    (["debog", "compilateur", "environnement de developpement", "utiliser un ide", "utiliser ide"], "Outils-Dev"),
    (["algorithme", "algorithmique", "iteration", "iterat", "alternat", "structure de controle", "boucle", "condition", "tant que", "repeter", "pour chaque"], "Algorithmique"),
    (["langage c", "programme c", "pointeur", "tableau en c", "fonction en c", "structure en c", "compilation en c", "traduire en c"], "Prog-C"),
    (["liste chainee", "pile ", "file ", "arbre binaire", "structure de donnees"], "Structures-Données"),
    (["base de donnees", "schema relationnel", "requete sql", " sql", " ldd", " lmd", "modele relationnel"], "BDD"),
    (["reseau local", "protocole reseau", "modele osi", "tcp/ip", "routeur", "commutateur", "topologie reseau"], "Réseaux"),
    (["internet", "web", "numerique", "risque numerique", "collaboratif", "humanite"], "Humanités-Numériques"),
]

_MACRO_KC_UNKNOWN = "Autre"


def get_macro_kc(kc: str | None) -> str:
    """
    Retourne le macro-KC correspondant à un KC fin.
    1. Cherche dans MACRO_KC_MAP (exact, case-sensitive).
    2. Cherche par mots-clés (case-insensitive, accent-insensitive).
    3. Retourne "Autre" si aucun match.
    """
    if not kc:
        return _MACRO_KC_UNKNOWN

    # 1. Correspondance exacte
    if kc in MACRO_KC_MAP:
        return MACRO_KC_MAP[kc]

    # 2. Correspondance par mots-clés (insensible à la casse et aux accents)
    import unicodedata
    def _norm(s: str) -> str:
        s = s.lower()
        s = unicodedata.normalize("NFD", s)
        return "".join(c for c in s if unicodedata.category(c) != "Mn")

    kc_norm = _norm(kc)
    for keywords, macro in _KEYWORD_MAP:
        if any(_norm(kw) in kc_norm for kw in keywords):
            return macro

    return _MACRO_KC_UNKNOWN
