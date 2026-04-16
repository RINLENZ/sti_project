import sys, os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# Remplace l'URL Docker par l'URL locale pour seed.py
os.environ["DATABASE_URL"] = os.environ.get(
    "DATABASE_URL_LOCAL",
    "postgresql://sti_user:sti_pass_2024@localhost:5432/sti_db"
)

sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, engine
from app.models.user import User
from app.models.session import LearningSession, EngagementAnalysis
from app.database import Base
from app.services.auth_service import hash_password

Base.metadata.create_all(bind=engine)

db = SessionLocal()

db.query(EngagementAnalysis).delete()
db.query(LearningSession).delete()
db.query(User).delete()
db.commit()

users = [
    User(
        email="admin@sti.cm",
        nom="Admin", prenom="Super",
        role="super_admin",
        password=hash_password("admin1234")
    ),
    User(
        email="prof@sti.cm",
        nom="Djiomo", prenom="Serge",
        role="enseignant",
        password=hash_password("prof1234")
    ),
    User(
        email="alice@sti.cm",
        nom="Mballa", prenom="Alice",
        role="apprenant",
        niveau="Première",
        pays="Cameroun",
        password=hash_password("alice1234")
    ),
    User(
        email="bob@sti.cm",
        nom="Tchoufa", prenom="Bob",
        role="apprenant",
        niveau="Première",
        pays="Cameroun",
        password=hash_password("bob1234")
    ),
    User(
        email="carole@sti.cm",
        nom="Eyinga", prenom="Carole",
        role="apprenant",
        niveau="Terminale",
        pays="Cameroun",
        password=hash_password("carole1234")
    ),
]

for u in users:
    db.add(u)
db.commit()

print("✓ Base de données peuplée avec succès")
print("  Enseignant : prof@sti.cm / prof1234")
print("  Apprenants : alice@sti.cm / alice1234")
print("               bob@sti.cm / bob1234")
print("               carole@sti.cm / carole1234")
db.close()