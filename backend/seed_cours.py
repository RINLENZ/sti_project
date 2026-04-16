"""
Seed pédagogique APC — Programme Informatique Lycée Cameroun
Structure : Matière → Module → Famille de situations → UA → Ressources + Exercices
Lance avec : python seed_cours.py
"""
import sys, os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
os.environ["DATABASE_URL"] = os.environ.get(
    "DATABASE_URL_LOCAL",
    "postgresql://sti_user:sti_pass_2024@localhost:5432/sti_db"
)
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, Base, engine
from app.models.user import User, TuteurSuivi
from app.models.cours import (
    Matiere, Module, FamilleSituation,
    UniteApprentissage, RessourcePedagogique,
    Exercice, ProgressionApprenant
)
Base.metadata.create_all(bind=engine)
db = SessionLocal()

# Nettoyage dans le bon ordre (contraintes FK)
db.query(ProgressionApprenant).delete()
db.query(Exercice).delete()
db.query(RessourcePedagogique).delete()
db.query(UniteApprentissage).delete()
db.query(FamilleSituation).delete()
db.query(Module).delete()
db.query(Matiere).delete()
db.commit()

# ══════════════════════════════════════════════
# NIVEAU 1 — MATIÈRE
# ══════════════════════════════════════════════
matiere = Matiere(
    nom="Informatique",
    niveau="Première (1ère F6 BIPE & F4 BTP)",
    description="Lycée Classique et Moderne d'Ebolowa — Effectif : 50 élèves"
)
db.add(matiere)
db.flush()

# ══════════════════════════════════════════════
# NIVEAU 2 — MODULE
# ══════════════════════════════════════════════
module2 = Module(
    matiere_id=matiere.id,
    numero=2,
    titre="Réseaux, Internet, Humanités Numériques, Algorithmique et Programmation C",
    description="Module du programme officiel couvrant la programmation "
                "structurée et les algorithmes de base",
    ordre=2
)
db.add(module2)
db.flush()

# ══════════════════════════════════════════════
# NIVEAU 3 — FAMILLE DE SITUATIONS
# ══════════════════════════════════════════════
famille_prog = FamilleSituation(
    module_id=module2.id,
    titre="Programmation en C",
    description="Situations de vie liées à la résolution de problèmes "
                "concrets par l'écriture de programmes en langage C",
    ordre=1
)
db.add(famille_prog)
db.flush()

# ══════════════════════════════════════════════
# NIVEAU 4 — UNITÉS D'APPRENTISSAGE
# ══════════════════════════════════════════════

# ── UA 1 : Structures de contrôle (UE 15 & 16) ──
ua_structures = UniteApprentissage(
    famille_id=famille_prog.id,
    titre="Les instructions de base — Structures de contrôle",
    reference_ue="UE 15 & 16",
    competences=[
        "Identifier les structures de contrôle",
        "Exécuter un algorithme ayant une structure alternative",
        "Exécuter des algorithmes itératifs"
    ],
    situation_probleme=(
        "Marie, vendeuse dans une boutique de téléphonie à Ebolowa, "
        "doit appliquer différentes remises selon le montant d'achat :\n"
        "- Moins de 50 000 FCFA : aucune remise\n"
        "- Entre 50 000 et 100 000 FCFA : remise de 5%\n"
        "- Plus de 100 000 FCFA : remise de 10%\n"
        "De plus, elle doit compter les clients et afficher le total des ventes.\n\n"
        "Questions :\n"
        "1. Comment Marie peut-elle décider quelle remise appliquer ?\n"
        "2. Comment compter automatiquement le nombre de clients ?\n"
        "3. Comment répéter l'opération sans réécrire le même code ?"
    ),
    prerequis=[
        "Notions sur les éléments d'un algorithme",
        "Variables et types de données",
        "Instructions d'entrée/sortie",
        "Organigrammes",
        "Exécution simple d'un algorithme"
    ],
    duree_estimee=60,
    ordre=1
)
db.add(ua_structures)
db.flush()

# ── UA 2 : Structure d'un programme C (UE 19) ──
ua_prog_c = UniteApprentissage(
    famille_id=famille_prog.id,
    titre="Structure d'un algorithme simple en langage C",
    reference_ue="UE 19",
    competences=[
        "Citer quelques exemples de langages de programmation",
        "Utiliser un IDE (Code::Blocks, Dev-C++)",
        "Écrire la structure d'un programme C",
        "Traduire un algorithme en langage C"
    ],
    situation_probleme=(
        "Tu dois créer un programme C pour aider un élève à vérifier "
        "si ses notes lui permettent de passer en classe supérieure. "
        "Le programme doit lire les notes, calculer la moyenne "
        "et afficher la décision (Admis / Redoublant)."
    ),
    prerequis=[
        "Algorithmique de base",
        "Structures de contrôle en pseudocode",
        "Notion de variable et de type"
    ],
    duree_estimee=60,
    ordre=2
)
db.add(ua_prog_c)
db.flush()

# ══════════════════════════════════════════════
# RESSOURCES PÉDAGOGIQUES ET EXERCICES
# ══════════════════════════════════════════════

# Exercice 1
ex1 = Exercice(
    ua_id=ua_structures.id,
    titre="Comprendre SI...SINON",
    type="qcm",
    enonce="Dans une structure SI...ALORS...SINON, que se passe-t-il si la condition est FAUSSE ?",
    options=[
        "Les instructions du bloc ALORS sont exécutées",
        "Les instructions du bloc SINON sont exécutées",
        "Le programme s'arrête",
        "Les deux blocs sont exécutés en même temps"
    ],
    reponse_correcte="Les instructions du bloc SINON sont exécutées",
    explication="Dans SI...ALORS...SINON : condition vraie → bloc ALORS. Condition fausse → bloc SINON.",
    indice_1="Rappelle-toi : ALORS correspond au cas où la condition est vraie",
    indice_2="SINON correspond au cas contraire",
    competence_evaluee="Identifier les structures de contrôle",
    difficulte=1,
    points=10,
    ordre=1
)
db.add(ex1)

# Exercice 2
ex2 = Exercice(
    ua_id=ua_structures.id,
    titre="Algorithme de parité",
    type="qcm",
    enonce="Si n = 7 et n MOD 2 = 0, affiche PAIR sinon IMPAIR. Que s'affiche ?",
    options=["PAIR", "IMPAIR", "0", "1"],
    reponse_correcte="IMPAIR",
    explication="7 MOD 2 = 1, donc condition fausse → IMPAIR",
    indice_1="7 ÷ 2 = 3, reste 1",
    indice_2="Donc 7 MOD 2 = 1 ≠ 0",
    competence_evaluee="Exécuter un algorithme ayant une structure alternative",
    difficulte=1,
    points=10,
    ordre=2
)
db.add(ex2)

# Exercice 3
ex3 = Exercice(
    ua_id=ua_structures.id,
    titre="Remise de Marie",
    type="qcm",
    enonce="Achat de 75 000 FCFA. Remise : <50000=0%, <100000=5%, sinon=10%. Montant de la remise ?",
    options=["0 FCFA", "3 750 FCFA", "7 500 FCFA", "5 000 FCFA"],
    reponse_correcte="3 750 FCFA",
    explication="75 000 × 0,05 = 3 750 FCFA",
    indice_1="75 000 est entre 50 000 et 100 000",
    indice_2="Donc remise de 5%",
    competence_evaluee="Exécuter un algorithme ayant une structure alternative",
    difficulte=2,
    points=15,
    ordre=3
)
db.add(ex3)

# Exercice 4 - Boucle POUR
ex4 = Exercice(
    ua_id=ua_structures.id,
    titre="Boucle POUR",
    type="qcm",
    enonce="Pour i De 1 À 5 : Écrire('Bonjour'). Combien de fois ?",
    options=["4 fois", "5 fois", "6 fois", "1 fois"],
    reponse_correcte="5 fois",
    explication="i prend les valeurs 1,2,3,4,5 → 5 itérations",
    indice_1="Compte de 1 à 5",
    indice_2="5 valeurs donc 5 affichages",
    competence_evaluee="Exécuter des algorithmes itératifs",
    difficulte=1,
    points=10,
    ordre=4
)
db.add(ex4)

# Exercice 5 - Différence boucles
ex5 = Exercice(
    ua_id=ua_structures.id,
    titre="Différence TANT QUE / RÉPÉTER",
    type="qcm",
    enonce="Quelle est la principale différence entre TANT QUE et RÉPÉTER...JUSQU'À ?",
    options=[
        "TANT QUE est plus rapide",
        "Avec RÉPÉTER, les instructions s'exécutent au moins une fois",
        "TANT QUE ne peut pas utiliser de compteur",
        "Il n'y a aucune différence"
    ],
    reponse_correcte="Avec RÉPÉTER, les instructions s'exécutent au moins une fois",
    explication="TANT QUE teste AVANT → 0 itération possible. RÉPÉTER teste APRÈS → 1 itération minimum.",
    indice_1="Où est placée la condition ?",
    indice_2="Avant = TANT QUE, Après = RÉPÉTER",
    competence_evaluee="Exécuter des algorithmes itératifs",
    difficulte=2,
    points=10,
    ordre=5
)
db.add(ex5)

# Exercice 6 - Programme C
ex6 = Exercice(
    ua_id=ua_prog_c.id,
    titre="Structure d'un programme C",
    type="qcm",
    enonce="Quel élément est OBLIGATOIRE dans tout programme C ?",
    options=[
        "#include <math.h>",
        "int main() { return 0; }",
        "void afficher() {}",
        "#define MAX 100"
    ],
    reponse_correcte="int main() { return 0; }",
    explication="main() est le point d'entrée obligatoire du programme",
    indice_1="Où le programme commence-t-il ?",
    indice_2="C'est la fonction main()",
    competence_evaluee="Écrire la structure d'un programme C",
    difficulte=1,
    points=10,
    ordre=1
)
db.add(ex6)

# Exercice 7 - Traduction algorithme → C
ex7 = Exercice(
    ua_id=ua_prog_c.id,
    titre="Traduction en C",
    type="qcm",
    enonce="Traduire en C : Si (age >= 18) Alors Écrire('Majeur') Sinon Écrire('Mineur')",
    options=[
        "if age >= 18 then printf('Majeur') else printf('Mineur')",
        "if (age >= 18) { printf(\"Majeur\"); } else { printf(\"Mineur\"); }",
        "SI (age >= 18) { printf(\"Majeur\"); } SINON { printf(\"Mineur\"); }",
        "if (age => 18) printf(\"Majeur\"); else printf(\"Mineur\");"
    ],
    reponse_correcte='if (age >= 18) { printf("Majeur"); } else { printf("Mineur"); }',
    explication="if pour SI, else pour SINON, condition entre (), blocs entre {}",
    indice_1="SI devient if, SINON devient else",
    indice_2="printf() pour écrire",
    competence_evaluee="Traduire un algorithme en langage C",
    difficulte=2,
    points=15,
    ordre=2
)
db.add(ex7)

# Exercice 8 - Débogage
ex8 = Exercice(
    ua_id=ua_prog_c.id,
    titre="Débogage - Erreur classique",
    type="qcm",
    enonce="Que manque-t-il ?\nfor (i=1; i<=3; i++)\n    printf('Bonjour\\n');\n    printf('Fin\\n');",
    options=[
        "La variable i n'est pas initialisée",
        "Les accolades {} après le for",
        "printf a des guillemets incorrects",
        "i++ devrait être i=i+1"
    ],
    reponse_correcte="Les accolades {} après le for",
    explication="Sans accolades, seule la première ligne est dans la boucle",
    indice_1="En C, sans accolades, une seule instruction suit le for",
    indice_2="Ajouter { } pour inclure plusieurs instructions",
    competence_evaluee="Utiliser un IDE et déboguer un programme C",
    difficulte=3,
    points=20,
    ordre=3
)
db.add(ex8)

db.commit()

# Résumé
print("\n✓ Contenu pédagogique APC inséré avec succès")
print(f"\n  Matière  : {matiere.nom} — {matiere.niveau}")
print(f"  Module   : Module {module2.numero} — {module2.titre[:50]}...")
print(f"  Famille  : {famille_prog.titre}")
print(f"\n  Unités d'Apprentissage : 2")
print(f"  Exercices               : {db.query(Exercice).count()}")
print(f"  Compétences APC couvertes : 7")

db.close()