"""
seed_programme.py — Seed programme MINESEC Cameroun
Exécution :
    conda activate backend_env
    cd ~/sti_project/backend
    export DATABASE_URL="postgresql://sti_user:sti_pass_2024@localhost:5432/sti_db"
    python seed_programme.py
"""

import os, sys
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.cours import Matiere, Module, FamilleSituation, UniteApprentissage
from app.models.referentiel import Cycle, Niveau
from app.models.user import User

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://sti_user:sti_pass_2024@localhost:5432/sti_db"
)
engine = create_engine(DATABASE_URL)
db = sessionmaker(bind=engine)()

# ── helpers ─────────────────────────────────────────────────────

def find_cycle(nom):
    return db.query(Cycle).filter(Cycle.nom == nom).first()

def find_or_add_cycle(nom, code, ordre):
    obj = find_cycle(nom)
    if not obj:
        obj = Cycle(nom=nom, code=code, ordre=ordre)
        db.add(obj); db.flush()
    return obj

def find_or_add_niveau(code, nom, cycle_id, ordre):
    obj = db.query(Niveau).filter(Niveau.code == code).first()
    if not obj:
        obj = Niveau(code=code, nom=nom, cycle_id=cycle_id, ordre=ordre)
        db.add(obj); db.flush()
    return obj

def find_or_add_matiere(code, nom):
    obj = db.query(Matiere).filter(Matiere.code == code).first()
    if not obj:
        obj = Matiere(code=code, nom=nom)
        db.add(obj); db.flush()
    return obj

def find_or_add_module(matiere_id, niveau_id, numero, titre, desc, ordre):
    obj = db.query(Module).filter(
        Module.matiere_id == matiere_id,
        Module.niveau_id  == niveau_id,
        Module.numero     == numero
    ).first()
    if not obj:
        obj = Module(matiere_id=matiere_id, niveau_id=niveau_id,
                     numero=numero, titre=titre, description=desc, ordre=ordre)
        db.add(obj); db.flush()
    else:
        obj.niveau_id = niveau_id
        db.flush()
    return obj

def find_or_add_famille(module_id, titre, ordre):
    obj = db.query(FamilleSituation).filter(
        FamilleSituation.module_id == module_id,
        FamilleSituation.titre     == titre
    ).first()
    if not obj:
        obj = FamilleSituation(module_id=module_id, titre=titre, ordre=ordre)
        db.add(obj); db.flush()
    return obj

def find_or_add_ua(famille_id, titre, ref, duree, competences, prerequis, ordre):
    obj = db.query(UniteApprentissage).filter(
        UniteApprentissage.famille_id == famille_id,
        UniteApprentissage.titre      == titre
    ).first()
    if obj:
        return obj, False
    obj = UniteApprentissage(
        famille_id=famille_id, titre=titre, reference_ue=ref,
        duree_estimee=duree, competences=competences, prerequis=prerequis,
        situation_probleme="Situation : " + titre, ordre=ordre
    )
    db.add(obj); db.flush()
    return obj, True


print("=" * 55)
print("SEED PROGRAMME MINESEC")
print("=" * 55)

# ── 1. Cycles ───────────────────────────────────────────────────
print("\n[1/4] Cycles...")
# Note : les noms sont sans accent pour eviter les doublons avec
# ce qui existe deja (ex : "Lycee" vs "Lycée").
# On cherche d abord avec le nom exact existant.
c_sec = (db.query(Cycle).filter(Cycle.code == "LY").first() or
         find_or_add_cycle("Lycee", "LY", 3))
# Pour le secondaire premier cycle, le code ESG ne devrait pas exister
c_esc = (db.query(Cycle).filter(Cycle.code == "ESG").first() or
         find_or_add_cycle("Enseignement Secondaire", "ESG", 2))
db.commit()
print("  OK")

# ── 2. Niveaux ──────────────────────────────────────────────────
print("[2/4] Niveaux...")
n = {
    "6E":  find_or_add_niveau("6E",  "Sixieme",   c_esc.id, 1),
    "5E":  find_or_add_niveau("5E",  "Cinquieme", c_esc.id, 2),
    "4E":  find_or_add_niveau("4E",  "Quatrieme", c_esc.id, 3),
    "3E":  find_or_add_niveau("3E",  "Troisieme", c_esc.id, 4),
    "2DE": find_or_add_niveau("2DE", "Seconde",   c_sec.id, 5),
    "1RE": find_or_add_niveau("1RE", "Premiere",  c_sec.id, 6),
    "TLE": find_or_add_niveau("TLE", "Terminale", c_sec.id, 7),
}
db.commit()
print(f"  {len(n)} niveaux OK")

# ── 3. Matiere ──────────────────────────────────────────────────
print("[3/4] Matiere Informatique...")
info = find_or_add_matiere("INFO", "Informatique")
db.commit()

# ── 4. Programme ────────────────────────────────────────────────
# Format UA : (titre, ref_ue, duree_min, [competences], [prerequis])
print("[4/4] Modules, familles, UAs...")

PROG = {
    "3E": [
        (1, 1, 14, "Architecture microordinateur et representation de l information", [
            ("Architecture d un microordinateur", 1, [
                ("Architecture et composants Von Neumann RISC CISC", "UE 1", 90,
                 ["Decrire l architecture Von Neumann", "Identifier composants E T S"], []),
                ("Maintenance de premier niveau", "UE 2", 60,
                 ["Effectuer la maintenance preventive"],
                 ["Decrire l architecture Von Neumann"]),
            ]),
            ("Representation de l information", 2, [
                ("Formats numeriques binaire octal hexadecimal ASCII", "UE 3", 120,
                 ["Convertir entre bases numeriques", "Coder en ASCII"], []),
            ]),
        ]),
        (2, 2, 16, "Production des contenus numeriques", [
            ("Traitement de texte avance", 1, [
                ("Mise en forme long document styles table des matieres", "UE 4", 120,
                 ["Utiliser les styles Word", "Generer table des matieres"], []),
            ]),
            ("Tableur et representation graphique", 2, [
                ("Fonctions predefinies et graphiques statistiques", "UE 5", 120,
                 ["Utiliser SOMME MOYENNE SI", "Creer un graphique"], []),
            ]),
            ("Publication Assistee par Ordinateur PAO", 3, [
                ("Initiation PAO affiche flyer carte d invitation", "UE 6", 90,
                 ["Utiliser un logiciel PAO"], []),
            ]),
        ]),
        (3, 3, 8, "Citoyennete numerique IV", [
            ("Ethique et reseaux sociaux", 1, [
                ("Fakenews infox deepfake distinguer vrai et faux", "UE 7", 60,
                 ["Distinguer vraie et fausse information"], []),
                ("Legislation numerique nationale et internationale", "UE 8", 60,
                 ["Citer les sanctions legales"], []),
            ]),
        ]),
        (4, 4, 12, "Initiation algorithmique et developpement logiciel", [
            ("Algorithmique avec le LDA", 1, [
                ("LDA structure de base variables constantes", "UE 9", 90,
                 ["Ecrire un algorithme en LDA", "Declarer variables et constantes"], []),
                ("LDA structures alternatives et iteratives SI TantQue Pour", "UE 10", 120,
                 ["Utiliser les structures alternatives", "Utiliser TantQue et Pour"],
                 ["Ecrire un algorithme en LDA"]),
            ]),
            ("Concepts du developpement logiciel", 2, [
                ("Cycle de vie d un logiciel et approches de developpement", "UE 11", 60,
                 ["Decrire le cycle de vie d un logiciel"], []),
            ]),
        ]),
    ],

    "1RE": [
        (1, 1, 20, "Reseaux Internet Humanites Numeriques Algorithmique Programmation C", [
            ("Reseaux et Internet", 1, [
                ("Architecture des reseaux modele OSI et TCP IP", "UE 1 & 2", 90,
                 ["Decrire le modele OSI", "Expliquer TCP IP"], []),
                ("Services Internet DNS HTTP FTP messagerie", "UE 3", 60,
                 ["Expliquer DNS et HTTP"], ["Decrire le modele OSI"]),
            ]),
            ("Programmation en C", 2, [
                ("Les instructions de base et structures de controle en C", "UE 15 & 16", 120,
                 ["Ecrire des instructions de base en C", "Utiliser SI ALORS SINON"], []),
                ("Les tableaux et chaines de caracteres en C", "UE 17 & 18", 120,
                 ["Declarer et utiliser un tableau en C"],
                 ["Ecrire des instructions de base en C"]),
                ("Les fonctions en C", "UE 19 & 20", 120,
                 ["Definir et appeler une fonction en C"],
                 ["Declarer et utiliser un tableau en C"]),
            ]),
        ]),
    ],

    "TLE": [
        (1, 1, 20, "Bases de donnees Algorithmique avancee et Programmation", [
            ("Bases de donnees relationnelles", 1, [
                ("Modele relationnel tables cles primaires etrangeres", "UE 1", 120,
                 ["Concevoir un schema relationnel", "Creer des tables SQL"], []),
                ("SQL requetes SELECT INSERT UPDATE DELETE et JOIN", "UE 2", 120,
                 ["Ecrire des requetes SQL", "Utiliser WHERE et JOIN"],
                 ["Concevoir un schema relationnel"]),
            ]),
            ("Programmation avancee en C", 2, [
                ("Les structures et fichiers en C", "UE 3", 120,
                 ["Definir et utiliser une structure en C"],
                 ["Definir et appeler une fonction en C"]),
                ("Les pointeurs en C", "UE 4", 120,
                 ["Declarer et utiliser un pointeur"],
                 ["Definir et utiliser une structure en C"]),
            ]),
        ]),
    ],
}

nb_created = 0
for code_niv, modules_list in PROG.items():
    niv = n[code_niv]
    print(f"\n  Niveau {niv.nom} :")
    for (num, ordre, duree, titre_mod, familles_list) in modules_list:
        mod = find_or_add_module(
            info.id, niv.id, num, titre_mod,
            f"Module {num} - {duree}H", ordre
        )
        print(f"    M{num}: {titre_mod[:52]}")
        for (titre_fam, ordre_fam, uas_list) in familles_list:
            fam = find_or_add_famille(mod.id, titre_fam, ordre_fam)
            for i, (titre_ua, ref, duree_ua, comp, prereq) in enumerate(uas_list):
                ua, created = find_or_add_ua(
                    fam.id, titre_ua, ref, duree_ua, comp, prereq, i + 1
                )
                if created:
                    nb_created += 1
                    print(f"      + {ref}: {titre_ua[:48]}")

db.commit()

# ── Comptes de test ─────────────────────────────────────────────
print("\n  Comptes de test...")
for email, code in [("alice@sti.cm", "6E"), ("bob@sti.cm", "3E"), ("carole@sti.cm", "1RE")]:
    user = db.query(User).filter(User.email == email).first()
    if user:
        user.niveau_label = n[code].nom
        print(f"  -> {email} = {n[code].nom}")
db.commit()

# ── Resume ──────────────────────────────────────────────────────
print("\n" + "=" * 55)
for code in ["3E", "1RE", "TLE"]:
    niv = n[code]
    nb_m = db.query(Module).filter(Module.niveau_id == niv.id).count()
    nb_u = (db.query(UniteApprentissage)
            .join(FamilleSituation, UniteApprentissage.famille_id == FamilleSituation.id)
            .join(Module, FamilleSituation.module_id == Module.id)
            .filter(Module.niveau_id == niv.id).count())
    print(f"  {niv.nom:<12}: {nb_m} module(s), {nb_u} UA(s)")
print(f"\n  Nouvelles UAs creees : {nb_created}")
print("  Seed OK")
db.close()