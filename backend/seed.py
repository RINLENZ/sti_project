"""
Seed utilisateurs — STI Adaptatif
Crée les comptes de base : super_admin, enseignant, apprenants
Lance avec : python seed.py (depuis ~/sti_project/backend)
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
from app.models.user import User
from app.models.referentiel import Cycle, Ordre, Filiere, Niveau
from app.models.session import LearningSession, EngagementAnalysis
from app.services.auth_service import hash_password

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# Nettoyage dans le bon ordre (contraintes FK)
from app.models.interaction import Interaction
from app.models.cours import BKTMastery, ProgressionApprenant

db.query(BKTMastery).delete()
db.query(ProgressionApprenant).delete()
db.query(Interaction).delete()
db.query(EngagementAnalysis).delete()
db.query(LearningSession).delete()
db.query(User).delete()
db.commit()

users = [
    # ── Super Admin — toi seul ────────────────────────────────────
    User(
        email="admin@sti.cm",
        nom="Admin", prenom="Super",
        role="super_admin",
        password=hash_password("admin1234")
    ),
    # ── Enseignant ────────────────────────────────────────────────
    User(
        email="prof@sti.cm",
        nom="Djiomo", prenom="Serge",
        role="enseignant",
        password=hash_password("prof1234")
    ),
    # ── Apprenants ────────────────────────────────────────────────
    User(
        email="alice@sti.cm",
        nom="Mballa", prenom="Alice",
        role="apprenant",
        niveau_label="Première",     # ← champ correct
        filiere_label="F6 BIPE",     # ← champ correct
        pays="Cameroun",
        password=hash_password("alice1234")
    ),
    User(
        email="bob@sti.cm",
        nom="Tchoufa", prenom="Bob",
        role="apprenant",
        niveau_label="Première",
        filiere_label="F6 BIPE",
        pays="Cameroun",
        password=hash_password("bob1234")
    ),
    User(
        email="carole@sti.cm",
        nom="Eyinga", prenom="Carole",
        role="apprenant",
        niveau_label="Terminale",
        filiere_label="Série C",
        pays="Cameroun",
        password=hash_password("carole1234")
    ),
]

for u in users:
    db.add(u)
db.commit()

print("\n✓ Utilisateurs créés avec succès")
print(f"\n  Super Admin : admin@sti.cm    / admin1234")
print(f"  Enseignant  : prof@sti.cm     / prof1234")
print(f"  Apprenant 1 : alice@sti.cm    / alice1234  (1ère F6)")
print(f"  Apprenant 2 : bob@sti.cm      / bob1234    (1ère F6)")
print(f"  Apprenant 3 : carole@sti.cm   / carole1234 (Tle C)")
print(f"\n  Codes invitation :")
for u in db.query(User).filter(User.role == "apprenant").all():
    print(f"    {u.prenom} {u.nom} : {u.code_invitation}")

db.close()