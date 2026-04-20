"""
Seed pédagogique APC — Programme Informatique Lycée Cameroun
Structure : Matière → Module → Famille de situations → UA → Ressources + Exercices
Lance avec : python seed_cours.py (depuis ~/sti_project/backend)

Note : Matiere n'a plus les champs cycle/ordre/filiere/niveau —
       ces informations sont dans le référentiel (table matiere_filieres).
       La description suffit pour identifier le contexte.
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
from app.models.cours import (
    Matiere, Module, FamilleSituation,
    UniteApprentissage, RessourcePedagogique,
    Exercice, ProgressionApprenant, BKTMastery
)

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# Nettoyage dans le bon ordre (contraintes FK)
db.query(BKTMastery).delete()
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
# Matiere n'a que : nom, code, description, actif
# Le lien filière/niveau/coeff est dans MatiereFiliere (référentiel)
# ══════════════════════════════════════════════
matiere = Matiere(
    nom="Informatique",
    code="INFO",
    description=(
        "Informatique — Première F6 BIPE & F4 BTP\n"
        "Lycée Classique et Moderne d'Ebolowa\n"
        "Ordre : Technique Industriel · Effectif : ~50 élèves"
    ),
    actif=True
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
    description=(
        "Module du programme officiel couvrant la programmation "
        "structurée et les algorithmes de base"
    ),
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
    description=(
        "Situations de vie liées à la résolution de problèmes "
        "concrets par l'écriture de programmes en langage C"
    ),
    ordre=1
)
db.add(famille_prog)
db.flush()

# ══════════════════════════════════════════════
# NIVEAU 4 — UNITÉS D'APPRENTISSAGE
# ══════════════════════════════════════════════

# ── UA 1 : Structures de contrôle (UE 15 & 16) ──────────────────
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
        "- Plus de 100 000 FCFA : remise de 10%\n\n"
        "Comment Marie peut-elle automatiser ce calcul avec un programme ?"
    ),
    prerequis=[
        "Notions sur les éléments d'un algorithme",
        "Variables et types de données",
        "Instructions d'entrée/sortie",
    ],
    duree_estimee=60,
    ordre=1
)
db.add(ua_structures)
db.flush()

# ── UA 2 : Structure d'un programme C (UE 19) ───────────────────
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
        "et afficher la décision : Admis ou Redoublant."
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
# NIVEAU 5a — RESSOURCES PÉDAGOGIQUES
# ══════════════════════════════════════════════

res1 = RessourcePedagogique(
    ua_id=ua_structures.id,
    titre="Leçon — Les structures de contrôle en algorithmique",
    type="lecon",
    contenu="""## Les structures de contrôle

Les structures de contrôle permettent de diriger l'exécution d'un algorithme selon des conditions ou de répéter des instructions.

### 1. La structure alternative — SI...ALORS...SINON

```
SI condition ALORS
    instructions_si_vrai
SINON
    instructions_si_faux
FIN SI
```

**Exemple :**
```
SI (montant >= 100000) ALORS
    remise ← montant * 0.10
SINON
    remise ← 0
FIN SI
```

### 2. La boucle TANT QUE

La condition est testée **avant** chaque itération. Peut ne jamais s'exécuter.

```
TANT QUE condition FAIRE
    instructions
FIN TANT QUE
```

### 3. La boucle POUR

Utilisée quand le nombre d'itérations est connu à l'avance.

```
POUR i De 1 À n FAIRE
    instructions
FIN POUR
```

### 4. La boucle RÉPÉTER...JUSQU'À

La condition est testée **après** chaque itération. S'exécute au moins une fois.

```
RÉPÉTER
    instructions
JUSQU'À condition
```

### Tableau comparatif

| Boucle | Test | Minimum d'itérations |
|--------|------|---------------------|
| TANT QUE | Avant | 0 |
| POUR | Avant | 0 |
| RÉPÉTER | Après | 1 |
""",
    points_cles=[
        "SI...ALORS...SINON : exécution conditionnelle",
        "TANT QUE : condition testée avant, peut ne pas s'exécuter",
        "POUR : nombre d'itérations connu à l'avance",
        "RÉPÉTER...JUSQU'À : s'exécute au moins une fois"
    ],
    ordre=1
)
db.add(res1)

res2 = RessourcePedagogique(
    ua_id=ua_prog_c.id,
    titre="Leçon — Structure d'un programme C",
    type="lecon",
    contenu="""## Structure d'un programme en langage C

### 1. Structure minimale

```c
#include <stdio.h>

int main() {
    /* Corps du programme */
    return 0;
}
```

### 2. Les directives de préprocesseur

```c
#include <stdio.h>   /* Entrées/sorties : printf, scanf */
#include <stdlib.h>  /* Fonctions générales */
#include <math.h>    /* Fonctions mathématiques */
```

### 3. La fonction main()

**Obligatoire** dans tout programme C. C'est le point d'entrée.

```c
int main() {
    int age;
    float moyenne;

    printf("Entrez votre age : ");
    scanf("%d", &age);

    if (age >= 18) {
        printf("Vous etes majeur.\\n");
    } else {
        printf("Vous etes mineur.\\n");
    }

    return 0;
}
```

### 4. Traduction algorithme → C

| Algorithmique | Langage C |
|--------------|-----------|
| SI...ALORS...SINON | if...else |
| TANT QUE...FAIRE | while (...) { } |
| POUR i De 1 À n | for (i=1; i<=n; i++) |
| Écrire(x) | printf("%d", x) |
| Lire(x) | scanf("%d", &x) |
""",
    points_cles=[
        "#include <stdio.h> pour printf et scanf",
        "main() est obligatoire — point d'entrée du programme",
        "SI devient if, TANT QUE devient while, POUR devient for",
        "return 0 indique que le programme s'est bien terminé"
    ],
    ordre=1
)
db.add(res2)
db.flush()

# ══════════════════════════════════════════════
# NIVEAU 5b — EXERCICES
# ══════════════════════════════════════════════

exercices_ua1 = [
    Exercice(
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
        explication="Condition vraie → bloc ALORS. Condition fausse → bloc SINON. Les deux blocs ne s'exécutent jamais en même temps.",
        indice_1="ALORS correspond au cas où la condition est vraie",
        indice_2="SINON correspond au cas contraire — quand la condition est fausse",
        competence_evaluee="Identifier les structures de contrôle",
        difficulte=1, points=10, ordre=1
    ),
    Exercice(
        ua_id=ua_structures.id,
        titre="Algorithme de parité",
        type="qcm",
        enonce="Si n = 7 et la condition est (n MOD 2 = 0), afficher PAIR sinon IMPAIR. Que s'affiche ?",
        options=["PAIR", "IMPAIR", "0", "1"],
        reponse_correcte="IMPAIR",
        explication="7 MOD 2 = 1 (reste de 7÷2). La condition 1=0 est fausse → on affiche IMPAIR.",
        indice_1="Calcule 7 ÷ 2 : quotient = 3, reste = ?",
        indice_2="7 MOD 2 = 1 ≠ 0, donc la condition est fausse",
        competence_evaluee="Exécuter un algorithme ayant une structure alternative",
        difficulte=1, points=10, ordre=2
    ),
    Exercice(
        ua_id=ua_structures.id,
        titre="Remise de Marie à Ebolowa",
        type="qcm",
        enonce=(
            "Marie vend un téléphone à 75 000 FCFA.\n"
            "Remise : < 50 000 FCFA → 0% | entre 50 000 et 100 000 → 5% | > 100 000 → 10%\n"
            "Quel est le montant de la remise ?"
        ),
        options=["0 FCFA", "3 750 FCFA", "7 500 FCFA", "5 000 FCFA"],
        reponse_correcte="3 750 FCFA",
        explication="75 000 est entre 50 000 et 100 000 → remise de 5%. 75 000 × 0,05 = 3 750 FCFA.",
        indice_1="75 000 se trouve dans quelle tranche ?",
        indice_2="C'est la tranche 5% → 75 000 × 0,05 = ?",
        competence_evaluee="Exécuter un algorithme ayant une structure alternative",
        difficulte=2, points=15, ordre=3
    ),
    Exercice(
        ua_id=ua_structures.id,
        titre="Boucle POUR — comptage",
        type="qcm",
        enonce="POUR i De 1 À 5 FAIRE\n    Écrire('Bonjour')\nFIN POUR\n\nCombien de fois 'Bonjour' est-il affiché ?",
        options=["4 fois", "5 fois", "6 fois", "1 fois"],
        reponse_correcte="5 fois",
        explication="i prend successivement les valeurs 1, 2, 3, 4, 5 → 5 itérations → 5 affichages.",
        indice_1="Compte le nombre de valeurs entre 1 et 5 inclus",
        indice_2="1, 2, 3, 4, 5 → c'est 5 valeurs",
        competence_evaluee="Exécuter des algorithmes itératifs",
        difficulte=1, points=10, ordre=4
    ),
    Exercice(
        ua_id=ua_structures.id,
        titre="TANT QUE vs RÉPÉTER...JUSQU'À",
        type="qcm",
        enonce="Quelle est la principale différence entre TANT QUE et RÉPÉTER...JUSQU'À ?",
        options=[
            "TANT QUE est plus rapide que RÉPÉTER",
            "Avec RÉPÉTER, les instructions s'exécutent au moins une fois",
            "TANT QUE ne peut pas utiliser de compteur",
            "Il n'y a aucune différence pratique"
        ],
        reponse_correcte="Avec RÉPÉTER, les instructions s'exécutent au moins une fois",
        explication=(
            "TANT QUE teste la condition AVANT → si elle est fausse dès le début, "
            "0 itération. RÉPÉTER teste APRÈS → au moins 1 itération garantie."
        ),
        indice_1="Où est placée la condition dans chaque boucle ?",
        indice_2="TANT QUE : condition au début. RÉPÉTER : condition à la fin",
        competence_evaluee="Exécuter des algorithmes itératifs",
        difficulte=2, points=10, ordre=5
    ),
]

exercices_ua2 = [
    Exercice(
        ua_id=ua_prog_c.id,
        titre="Élément obligatoire en C",
        type="qcm",
        enonce="Quel élément est OBLIGATOIRE dans tout programme C pour qu'il compile et s'exécute ?",
        options=[
            "#include <math.h>",
            "int main() { return 0; }",
            "void afficher() {}",
            "#define MAX 100"
        ],
        reponse_correcte="int main() { return 0; }",
        explication="main() est le point d'entrée obligatoire. Sans lui, le compilateur ne sait pas où commencer l'exécution.",
        indice_1="Où le programme commence-t-il son exécution ?",
        indice_2="C'est la fonction main() — elle est toujours requise",
        competence_evaluee="Écrire la structure d'un programme C",
        difficulte=1, points=10, ordre=1
    ),
    Exercice(
        ua_id=ua_prog_c.id,
        titre="Traduction SI...SINON en C",
        type="qcm",
        enonce="Traduis en C :\nSI (age >= 18) ALORS\n    Écrire('Majeur')\nSINON\n    Écrire('Mineur')\nFIN SI",
        options=[
            "if age >= 18 then printf('Majeur') else printf('Mineur')",
            'if (age >= 18) { printf("Majeur"); } else { printf("Mineur"); }',
            'SI (age >= 18) { printf("Majeur"); } SINON { printf("Mineur"); }',
            'if (age => 18) printf("Majeur"); else printf("Mineur");'
        ],
        reponse_correcte='if (age >= 18) { printf("Majeur"); } else { printf("Mineur"); }',
        explication="SI→if, SINON→else, condition entre (), blocs entre {}, printf() pour afficher, >= et non =>.",
        indice_1="En C : SI devient if, SINON devient else",
        indice_2='La condition va entre (), le bloc entre {}. Affichage avec printf("...")',
        competence_evaluee="Traduire un algorithme en langage C",
        difficulte=2, points=15, ordre=2
    ),
    Exercice(
        ua_id=ua_prog_c.id,
        titre="Débogage — accolades manquantes",
        type="qcm",
        enonce=(
            "Que manque-t-il dans ce code C ?\n\n"
            "for (i=1; i<=3; i++)\n"
            "    printf(\"Bonjour\\n\");\n"
            "    printf(\"Fin\\n\");"
        ),
        options=[
            "La variable i n'est pas déclarée",
            "Les accolades { } après le for",
            "printf a une mauvaise syntaxe",
            "i++ devrait être i=i+1"
        ],
        reponse_correcte="Les accolades { } après le for",
        explication=(
            "Sans accolades, seule la PREMIÈRE instruction suit le for. "
            "Ici, printf(\"Bonjour\") est dans la boucle mais printf(\"Fin\") "
            "s'exécute une seule fois après. Il faut ajouter { }."
        ),
        indice_1="En C, sans accolades, combien d'instructions suit le for ?",
        indice_2="Une seule. Pour en inclure plusieurs, il faut { }",
        competence_evaluee="Utiliser un IDE et déboguer un programme C",
        difficulte=3, points=20, ordre=3
    ),
]

for ex in exercices_ua1 + exercices_ua2:
    db.add(ex)

db.commit()

# ── Résumé ────────────────────────────────────────────────────────
total_ex = db.query(Exercice).count()
print("\n✓ Contenu pédagogique APC inséré avec succès")
print(f"\n  Matière  : {matiere.nom} ({matiere.code})")
print(f"  Module   : Module {module2.numero}")
print(f"  Famille  : {famille_prog.titre}")
print(f"\n  UA 1 : {ua_structures.titre}")
print(f"         {len(exercices_ua1)} exercices + 1 ressource")
print(f"  UA 2 : {ua_prog_c.titre}")
print(f"         {len(exercices_ua2)} exercices + 1 ressource")
print(f"\n  Total exercices    : {total_ex}")
print(f"  Compétences APC    : 7")
print(f"  Ressources leçons  : 2")

db.close()