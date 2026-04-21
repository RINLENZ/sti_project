"""
Export du dataset pour entraînement des modèles ONNX.
Lance : python export_dataset.py
"""
import sys, os, csv, json
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
os.environ["DATABASE_URL"] = os.environ.get(
    "DATABASE_URL_LOCAL",
    "postgresql://sti_user:sti_pass_2024@localhost:5432/sti_db"
)
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models.session import LearningSession
from app.models.interaction import Interaction
from app.models.cours import ProgressionApprenant

db = SessionLocal()

sessions = db.query(LearningSession).filter(
    LearningSession.score_engagement != None
).all()

print(f"\n{len(sessions)} sessions trouvées\n")

# ── Dataset comportemental (pour Random Forest) ──────────────────
with open("dataset_comportemental.csv", "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow([
        "session_id", "nb_idles", "nb_responses", "nb_correct",
        "nb_help", "taux_reussite", "temps_moyen_reponse",
        "duree_secondes", "nb_interactions",
        "score_engagement",   # ← variable cible
        "etat_affectif",      # ← variable cible alternative
    ])

    for s in sessions:
        events = db.query(Interaction).filter(
            Interaction.session_id == s.id
        ).all()

        nb_idles     = sum(1 for e in events if e.type == "idle")
        nb_responses = sum(1 for e in events if e.type == "response")
        nb_correct   = sum(1 for e in events if e.type == "response" and e.data.get("correct"))
        nb_help      = sum(1 for e in events if e.type == "help_requested")
        temps_list   = [e.data.get("time_seconds", 0) for e in events if e.type == "response"]
        temps_moyen  = sum(temps_list) / len(temps_list) if temps_list else 0
        taux         = nb_correct / nb_responses if nb_responses > 0 else 0

        writer.writerow([
            str(s.id), nb_idles, nb_responses, nb_correct,
            nb_help, round(taux, 3), round(temps_moyen, 1),
            s.duree_secondes, s.nb_interactions,
            s.score_engagement, s.etat_affectif,
        ])

# ── Dataset visuel (pour réseau dense ONNX) ──────────────────────
with open("dataset_visuel.csv", "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow([
        "session_id", "timestamp",
        "ear", "yaw", "pitch",          # landmarks calculés
        "visual_score",                  # score EAR+pose
        "emotion_detectee",              # état frontend
        "etat_affectif_final",           # ground truth session
    ])

    for s in sessions:
        events = db.query(Interaction).filter(
            Interaction.session_id == s.id,
            Interaction.type == "facial_analysis"
        ).all()

        for e in events:
            d = e.data or {}
            writer.writerow([
                str(s.id), str(e.created_at) if hasattr(e, 'created_at') else "",
                d.get("ear", ""), d.get("yaw", ""), d.get("pitch", ""),
                d.get("visual_score", ""), d.get("emotion", ""),
                s.etat_affectif,
            ])

print("✓ dataset_comportemental.csv créé")
print("✓ dataset_visuel.csv créé")
db.close()