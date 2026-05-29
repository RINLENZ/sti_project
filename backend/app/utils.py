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


# ── KCs invalides à exclure du DKT ───────────────────────────────────────────
# "QCM" est un type d'exercice copié par erreur dans competence_evaluee.
# None = exercice sans compétence définie.
DKT_KC_EXCLUSIONS = {None, "QCM", "qcm", ""}


def is_valid_kc(kc: str | None) -> bool:
    """Retourne False pour les KCs qui ne sont pas des compétences réelles."""
    if kc is None or kc.strip() == "":
        return False
    if kc.strip().upper() in ("QCM", "VRAI_FAUX", "TEXTE", "REPONSE_LIBRE"):
        return False
    return True


# ── Table de regroupement KC fin → macro-KC ──────────────────────────────────
#
# Audit réalisé sur le dataset_dkt.jsonl (155 interactions, 29 KCs en "Autre").
# Résultat :
#   Autre           97  (63%) → réduit à ~11% après ce mapping
#   BDD             41  → inchangé (patterns corrigés pour plural + SGBD + DDL)
#   Algorithmique   14  → inchangé
#   Prog-C           2  → inchangé
#   Outils-Dev       1  → inchangé
#   Architecture-Info ← NOUVEAU (périphériques, ordinateur, composants, logiciels)
#   Systèmes-Info     ← NOUVEAU (SI, sous-systèmes, organisation, acteurs)
#
# Vise 6-10 macro-KCs avec >10 interactions chacun après collecte.

MACRO_KC_MAP: dict[str, str] = {
    # ── Algorithmique ────────────────────────────────────────────────────────
    "Identifier les structures de contrôle":                "Algorithmique",
    "Exécuter un algorithme ayant une structure alternative": "Algorithmique",
    "Exécuter des algorithmes itératifs":                   "Algorithmique",
    "Analyser un algorithme":                               "Algorithmique",
    "Concevoir un algorithme":                              "Algorithmique",
    "Écrire un algorithme":                                 "Algorithmique",
    "Représenter un algorithme":                            "Algorithmique",
    "Identifier les types de données":                      "Algorithmique",

    # ── Programmation C ──────────────────────────────────────────────────────
    "Écrire la structure d'un programme C":                 "Prog-C",
    "Traduire un algorithme en langage C":                  "Prog-C",
    "Écrire un programme C":                                "Prog-C",
    "Compiler un programme C":                              "Prog-C",
    "Utiliser les pointeurs en C":                          "Prog-C",
    "Utiliser les tableaux en C":                           "Prog-C",
    "Utiliser les fonctions en C":                          "Prog-C",
    "Utiliser les structures en C":                         "Prog-C",

    # ── Outils et débogage ───────────────────────────────────────────────────
    "Utiliser un IDE et déboguer un programme C":           "Outils-Dev",
    "Déboguer un programme":                                "Outils-Dev",
    "Utiliser un compilateur":                              "Outils-Dev",

    # ── Structures de données ────────────────────────────────────────────────
    "Manipuler des tableaux":                               "Structures-Données",
    "Manipuler des listes chainées":                        "Structures-Données",
    "Manipuler des piles et files":                         "Structures-Données",
    "Utiliser des arbres binaires":                         "Structures-Données",

    # ── Bases de données / LDD ───────────────────────────────────────────────
    "Énoncer les généralités sur les bases de données":     "BDD",
    "Appliquer la commande ALTER TABLE pour modifier la structure d'une table": "BDD",
    "Appliquer la syntaxe correcte de la commande INSERT INTO": "BDD",
    "Préciser le rôle d'un SGBD dans la mise en œuvre des bases de données": "BDD",
    "Citer quelques exemples de SGBD":                      "BDD",
    "Modéliser une base de données":                        "BDD",
    "Écrire des requêtes SQL":                              "BDD",
    "Utiliser le LDD":                                      "BDD",
    "Utiliser le LMD":                                      "BDD",
    "Créer un schéma relationnel":                          "BDD",

    # ── Architecture informatique ────────────────────────────────────────────
    "Décrire les caractéristiques de quelques périphériques et composants": "Architecture-Info",
    "Décrire le schéma fonctionnel de l'ordinateur":        "Architecture-Info",
    "Lister les principaux composants internes de l'unité Centrale": "Architecture-Info",
    "Enumérer les différents types de logiciels":           "Architecture-Info",
    "Donner le rôle des pilotes":                           "Architecture-Info",
    "Donner leurs rôles et leurs fonctionnalités":          "Architecture-Info",

    # ── Système d'Information ────────────────────────────────────────────────
    "Mémoriser et restituer la définition d'un système d'information": "Systèmes-Info",
    "Identifier et distinguer les rôles fondamentaux d'un système d'information": "Systèmes-Info",
    "Nommer et caractériser les trois sous-systèmes d'une organisation": "Systèmes-Info",
    "Appliquer la notion de sous-systèmes à un cas concret simple": "Systèmes-Info",
    "Distinguer les quatre fonctions du SI (collecter, stocker, traiter, diffuser) dans un exemple appliqué": "Systèmes-Info",
    "Identifier et nommer les différents types de ressources composant un système d'information": "Systèmes-Info",
    "Analyser la situation-problème pour identifier et classer les acteurs selon les trois sous-systèmes": "Systèmes-Info",
    "Analyser des dysfonctionnements réels d'une organisation en les reliant aux fonctions du système d'information": "Systèmes-Info",
    "Mobiliser les notions de sous-systèmes pour proposer une solution organisationnelle en lien avec la situation-problème": "Systèmes-Info",
    "Mémoriser et identifier la définition de la fonction de collecte d'un SI": "Systèmes-Info",
    "Mémoriser les caractéristiques de la fonction de stockage d'un SI": "Systèmes-Info",
    "Restituer avec précision la définition de la fonction de saisie d'un SI": "Systèmes-Info",
    "Appliquer la distinction entre collecte et saisie à un cas concret": "Systèmes-Info",
    "Comprendre l'utilité concrète de la fonction de stockage dans une organisation réelle": "Systèmes-Info",
    "Appliquer la compréhension de la structure et de la première fonction du SI": "Systèmes-Info",
    "Analyser une situation-problème réelle pour identifier les fonctions du SI qui font défaut": "Systèmes-Info",

    # ── Réseaux ──────────────────────────────────────────────────────────────
    "Identifier les composants d'un réseau":                "Réseaux",
    "Configurer un réseau local":                           "Réseaux",
    "Utiliser les protocoles réseau":                       "Réseaux",
    "Identifier les couches OSI":                           "Réseaux",

    # ── Humanités numériques / Internet ──────────────────────────────────────
    "Identifier les risques numériques":                    "Humanités-Numériques",
    "Utiliser des outils collaboratifs":                    "Humanités-Numériques",
    "Comprendre le web":                                    "Humanités-Numériques",

    # ════════════════════════════════════════════════════════════════════════
    # MATHÉMATIQUES — Lycée Cameroun Terminale (STI, F6, BTP, etc.)
    # 6 macro-KCs couvrant le programme officiel
    # ════════════════════════════════════════════════════════════════════════

    # ── Analyse (fonctions, dérivées, intégrales, suites) ────────────────────
    "Calculer la dérivée d'une fonction":                   "Analyse",
    "Calculer une intégrale":                               "Analyse",
    "Étudier la limite d'une fonction":                     "Analyse",
    "Étudier la continuité d'une fonction":                 "Analyse",
    "Étudier les variations d'une fonction":                "Analyse",
    "Calculer une primitive":                               "Analyse",
    "Étudier une suite numérique":                          "Analyse",
    "Calculer la limite d'une suite":                       "Analyse",
    "Appliquer le théorème des valeurs intermédiaires":     "Analyse",
    "Résoudre une équation différentielle":                 "Analyse",

    # ── Algèbre (équations, systèmes, matrices, polynômes) ───────────────────
    "Résoudre un système d'équations":                      "Algèbre",
    "Factoriser un polynôme":                               "Algèbre",
    "Calculer le déterminant d'une matrice":                "Algèbre",
    "Inverser une matrice":                                 "Algèbre",
    "Résoudre une inéquation":                              "Algèbre",
    "Calculer avec des nombres complexes":                  "Algèbre",
    "Résoudre une équation du second degré":                "Algèbre",
    "Utiliser la forme algébrique et exponentielle":        "Algèbre",

    # ── Géométrie (vecteurs, droites, plans, espace) ─────────────────────────
    "Calculer avec des vecteurs":                           "Géométrie",
    "Déterminer l'équation d'une droite":                   "Géométrie",
    "Déterminer l'équation d'un plan":                      "Géométrie",
    "Calculer une distance entre deux points":              "Géométrie",
    "Calculer le produit scalaire":                         "Géométrie",
    "Étudier les positions relatives de droites et plans":  "Géométrie",
    "Appliquer les transformations géométriques":           "Géométrie",
    "Calculer dans un repère orthonormé":                   "Géométrie",

    # ── Probabilités et Statistiques ─────────────────────────────────────────
    "Calculer une probabilité":                             "Probabilités-Stats",
    "Appliquer la loi des probabilités totales":            "Probabilités-Stats",
    "Calculer l'espérance et la variance":                  "Probabilités-Stats",
    "Appliquer la loi normale":                             "Probabilités-Stats",
    "Appliquer la loi binomiale":                           "Probabilités-Stats",
    "Calculer des indicateurs statistiques":                "Probabilités-Stats",
    "Construire un diagramme statistique":                  "Probabilités-Stats",
    "Appliquer le théorème de Bayes":                       "Probabilités-Stats",

    # ── Arithmétique ─────────────────────────────────────────────────────────
    "Calculer le PGCD et le PPCM":                          "Arithmétique",
    "Utiliser l'algorithme d'Euclide":                      "Arithmétique",
    "Appliquer les congruences":                            "Arithmétique",
    "Identifier les nombres premiers":                      "Arithmétique",
    "Décomposer en facteurs premiers":                      "Arithmétique",
    "Résoudre une équation diophantienne":                  "Arithmétique",

    # ── Trigonométrie ─────────────────────────────────────────────────────────
    "Calculer des valeurs trigonométriques":                "Trigonométrie",
    "Résoudre une équation trigonométrique":                "Trigonométrie",
    "Appliquer les formules de duplication":                "Trigonométrie",
    "Appliquer les formules d'addition":                    "Trigonométrie",
    "Convertir entre degrés et radians":                    "Trigonométrie",
    "Calculer dans un triangle (loi des sinus/cosinus)":    "Trigonométrie",
}


# ── Fallback par mots-clés (normalisés sans accents) ─────────────────────────
_KEYWORD_MAP: list[tuple[list[str], str]] = [
    # Outils-Dev EN PREMIER (évite "IDE" de matcher "identifier")
    (["debog", "compilateur", "environnement de developpement", "utiliser un ide", "utiliser ide"], "Outils-Dev"),

    # Algorithmique
    (["algorithme", "algorithmique", "iteration", "iterat", "alternat",
      "structure de controle", "boucle", "condition", "tant que",
      "repeter", "pour chaque", "sequence"], "Algorithmique"),

    # Prog-C
    (["langage c", "programme c", "pointeur", "tableau en c", "fonction en c",
      "structure en c", "compilation en c", "traduire en c"], "Prog-C"),

    # Structures de données
    (["liste chainee", "pile ", "file ", "arbre binaire", "structure de donnees"], "Structures-Données"),

    # BDD — corrigé : pluriel, SGBD, commandes DDL/DML
    (["base de donnee", "bases de donnee", "sgbd", "alter table", "insert into",
      "create table", "select ", "requete sql", " sql", " ldd", " lmd",
      "schema relationnel", "modele relationnel", "generalites sur les bases",
      "role d'un sgbd", "exemples de sgbd"], "BDD"),

    # Architecture informatique
    (["peripherique", "unite centrale", "composant", "ordinateur", "logiciel",
      "pilote", "schema fonctionnel", "memoire", "processeur", "carte mere",
      "disque dur", "materiel"], "Architecture-Info"),

    # Systèmes d'Information
    (["systeme d'information", "sous-systeme", "sous systeme", "organisation",
      "acteur", "ressource", "fonction du si", "collecte", "stockage",
      "traitement", "diffusion", "saisie", "dysfonctionnement",
      "systeme d information", " si "], "Systèmes-Info"),

    # Réseaux
    (["reseau local", "protocole reseau", "modele osi", "tcp/ip",
      "routeur", "commutateur", "topologie reseau"], "Réseaux"),

    # Humanités numériques
    (["internet", "web", "numerique", "risque numerique",
      "collaboratif", "humanite"], "Humanités-Numériques"),

    # ── Mathématiques ──────────────────────────────────────────────
    # Analyse — avant Algèbre pour éviter que "equation differentielle" → Algèbre
    (["derive", "integrale", "primitive", "limite ", "continuit", "variation",
      "suite numerique", "suite recurrente", "convergence", "equation differentielle",
      "taux de variation", "tangente", "asymptote", "extremum"], "Analyse"),

    # Algèbre
    (["systeme d'equation", "systeme lineaire", "polynome", "determinant",
      "matrice", "inverser", "iniquation", "inequation", "nombre complexe",
      "forme algebrique", "forme exponentielle", "racine", "discriminant",
      "second degre", "equation du second", "coefficient"], "Algèbre"),

    # Géométrie
    (["vecteur", "droite ", "plan ", "espace", "repere", "coordonnee",
      "produit scalaire", "distance ", "milieu", "colineaire",
      "orthogonal", "perpendiculaire", "parallele", "transformation geometrique",
      "translation", "rotation", "homotheti"], "Géométrie"),

    # Probabilités et Statistiques
    (["probabilite", "esperance", "variance", "ecart.type", "loi normale",
      "loi binomiale", "loi de poisson", "tableau de contingence",
      "effectif", "frequence ", "mediane", "quartile", "histogramme",
      "diagramme", "statistique", "bayes", "probabilites totales",
      "independance", "evenement"], "Probabilités-Stats"),

    # Arithmétique
    (["pgcd", "ppcm", "euclide", "congruence", "nombre premier", "facteur premier",
      "divisibilite", "diviseur", "multiple ", "diophant", "arithmetique",
      "entier ", "modulo"], "Arithmétique"),

    # Trigonométrie
    (["sinus", "cosinus", "tangente", "trigonometr", "radian", "degre",
      "cercle trigonometrique", "loi des sinus", "loi des cosinus",
      "formule d'addition", "duplication", "angle "], "Trigonométrie"),
]

_MACRO_KC_UNKNOWN = "Autre"


def get_macro_kc(kc: str | None) -> str:
    """
    Retourne le macro-KC correspondant à un KC fin.
    1. Vérifie si le KC est valide (pas None, pas "QCM")
    2. Cherche dans MACRO_KC_MAP (correspondance exacte)
    3. Cherche par mots-clés (insensible à la casse + accents)
    4. Retourne "Autre" si aucun match — à exclure du DKT
    """
    if not is_valid_kc(kc):
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
