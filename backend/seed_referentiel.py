"""
Seed du référentiel éducatif camerounais.
À exécuter UNE FOIS après la création des tables.
Le super admin peut ensuite ajouter de nouvelles filières via l'interface.
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
from app.models.referentiel import Cycle, Ordre, Filiere, Niveau
from app.models.user import User
from app.models.cours import Matiere

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# Nettoyage
db.query(Filiere).delete()
db.query(Niveau).delete()
db.query(Ordre).delete()
db.query(Cycle).delete()
db.commit()

# ── Cycles ──────────────────────────────────────────────────────
primaire  = Cycle(nom="Primaire",   code="PRI", ordre=1)
college   = Cycle(nom="Collège",    code="COL", ordre=2)
lycee     = Cycle(nom="Lycée",      code="LYC", ordre=3)
superieur = Cycle(nom="Supérieur",  code="SUP", ordre=4)

for c in [primaire, college, lycee, superieur]:
    db.add(c)
db.flush()

# ── Niveaux Collège ──────────────────────────────────────────────
for i, (nom, code) in enumerate([
    ("6ème","6E"),("5ème","5E"),("4ème","4E"),("3ème","3E")
], 1):
    db.add(Niveau(cycle_id=college.id, nom=nom, code=code, ordre=i))

# ── Niveaux Lycée ────────────────────────────────────────────────
for i, (nom, code) in enumerate([
    ("Seconde","2NDE"),("Première","1ERE"),("Terminale","TLE")
], 1):
    db.add(Niveau(cycle_id=lycee.id, nom=nom, code=code, ordre=i))

db.flush()

# ── Ordres Lycée ─────────────────────────────────────────────────
gen  = Ordre(cycle_id=lycee.id, nom="Général",              code="GEN", ordre=1)
ind  = Ordre(cycle_id=lycee.id, nom="Technique Industriel", code="TI",  ordre=2)
com  = Ordre(cycle_id=lycee.id, nom="Technique Commercial", code="TC",  ordre=3)

for o in [gen, ind, com]:
    db.add(o)
db.flush()

# ── Ordres Collège ───────────────────────────────────────────────
col_gen = Ordre(cycle_id=college.id, nom="Général", code="GEN", ordre=1)
db.add(col_gen)
db.flush()

# ── Filières Général ─────────────────────────────────────────────
filieres_gen = [
    ("Série A",  "A",  "Lettres et Sciences Humaines"),
    ("Série C",  "C",  "Mathématiques et Sciences Physiques"),
    ("Série D",  "D",  "Mathématiques et Sciences de la Vie et de la Terre"),
    ("Série TI", "TI", "Technologies de l'Information (Général)"),
]
for i, (nom, code, desc) in enumerate(filieres_gen, 1):
    db.add(Filiere(ordre_id=gen.id, nom=nom, code=code, description=desc, ordre=i))

# ── Filières Technique Industriel ────────────────────────────────
filieres_ind = [
    ("F1", "F1", "Construction Mécanique"),
    ("F2", "F2", "Électronique"),
    ("F3", "F3", "Électrotechnique"),
    ("F4", "F4", "Génie Civil / Bâtiments et Travaux Publics"),
    ("F5", "F5", "Météorologie"),
    ("F6 BIPE", "F6", "Brevet d'Initiation à la Programmation et à l'Électronique"),
    ("TI Tech.", "TIT","Technologies de l'Information (Technique)"),
]
for i, (nom, code, desc) in enumerate(filieres_ind, 1):
    db.add(Filiere(ordre_id=ind.id, nom=nom, code=code, description=desc, ordre=i))

# ── Filières Technique Commercial ────────────────────────────────
filieres_com = [
    ("G1", "G1", "Secrétariat"),
    ("G2", "G2", "Comptabilité et Gestion"),
    ("G3", "G3", "Action Commerciale"),
    ("H",  "H",  "Hôtellerie et Restauration"),
]
for i, (nom, code, desc) in enumerate(filieres_com, 1):
    db.add(Filiere(ordre_id=com.id, nom=nom, code=code, description=desc, ordre=i))

# ── Filières Collège (unique — pas de spécialisation) ────────────
db.add(Filiere(ordre_id=col_gen.id, nom="Général", code="GEN",
               description="Enseignement général collège", ordre=1))

db.commit()

# ── Résumé ────────────────────────────────────────────────────────
print("\n✓ Référentiel éducatif camerounais créé")
print(f"\n  Cycles    : {db.query(Cycle).count()}")
print(f"  Ordres    : {db.query(Ordre).count()}")
print(f"  Filières  : {db.query(Filiere).count()}")
print(f"  Niveaux   : {db.query(Niveau).count()}")

print("\n  Détail filières :")
for f in db.query(Filiere).all():
    ordre = db.query(Ordre).filter(Ordre.id == f.ordre_id).first()
    print(f"    [{ordre.code}] {f.code} — {f.nom}")

db.close()