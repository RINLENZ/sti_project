"""
Export du dataset pour entraînement des modèles ONNX.
Lance : python export_dataset.py
"""
import sys, os, csv, json
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
# Priorité : DATABASE_URL déjà dans l'env (Supabase/Render) > DATABASE_URL_LOCAL > défaut docker
if not os.environ.get("DATABASE_URL"):
    os.environ["DATABASE_URL"] = os.environ.get(
        "DATABASE_URL_LOCAL",
        "postgresql://sti_user:sti_pass_2024@localhost:5432/sti_db"
    )
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models.session import LearningSession
from app.models.interaction import Interaction
from app.models.cours import ProgressionApprenant, Exercice, BKTMastery
from app.models.session import EngagementAnalysis
from app.utils import get_kcs, get_macro_kc
from datetime import datetime

db_url = os.environ.get("DATABASE_URL", "")
host = db_url.split("@")[-1].split("/")[0] if "@" in db_url else db_url
print(f"\n🔌 Connexion : {host}")

db = SessionLocal()

sessions = db.query(LearningSession).filter(
    LearningSession.score_engagement != None
).all()

print(f"📊 {len(sessions)} sessions terminées trouvées\n")

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
        nb_correct   = sum(1 for e in events if e.type == "response" and (e.data or {}).get("correct"))
        nb_help      = sum(1 for e in events if e.type == "help_requested")
        temps_list   = [(e.data or {}).get("time_seconds", 0) for e in events if e.type == "response"]
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
        "ear", "yaw", "pitch",           # landmarks MediaPipe
        "visual_score",                  # score EAR+pose
        "emotion_detectee",              # état fusionné final
        "source",                        # 'cnn+geometry' ou 'geometry'
        "cnn_dominant",                  # expression CNN brute
        "cnn_happy", "cnn_neutral", "cnn_sad",
        "cnn_angry", "cnn_fearful", "cnn_surprised", "cnn_disgusted",
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
                str(s.id), str(e.timestamp) if e.timestamp else "",
                d.get("ear", ""), d.get("yaw", ""), d.get("pitch", ""),
                d.get("visual_score", ""), d.get("emotion", ""),
                d.get("source", "geometry"),
                d.get("cnn_dominant", ""),
                d.get("cnn_happy", ""), d.get("cnn_neutral", ""), d.get("cnn_sad", ""),
                d.get("cnn_angry", ""), d.get("cnn_fearful", ""), d.get("cnn_surprised", ""), d.get("cnn_disgusted", ""),
                s.etat_affectif,
            ])

print("✓ dataset_comportemental.csv créé")
print("✓ dataset_visuel.csv créé")

# ── Dataset DKT (pour entraînement DKT-E) ────────────────────────
progs = (
    db.query(ProgressionApprenant)
    .filter(
        ProgressionApprenant.correct.isnot(None),
        ProgressionApprenant.exercice_id.isnot(None),
    )
    .order_by(ProgressionApprenant.user_id, ProgressionApprenant.date_debut)
    .all()
)

ex_ids = list({p.exercice_id for p in progs if p.exercice_id})
exercices_map = {str(e.id): e for e in db.query(Exercice).filter(Exercice.id.in_(ex_ids)).all()}

response_ints = db.query(Interaction).filter(Interaction.type == "response").all()
time_map = {}
for i in response_ints:
    if i.data and i.data.get("exercice_id"):
        key = (str(i.user_id), str(i.data["exercice_id"]))
        if key not in time_map:
            time_map[key] = i.data.get("time_seconds")

all_eng = db.query(EngagementAnalysis).all()
eng_by_session = {}
for e in all_eng:
    eng_by_session.setdefault(str(e.session_id), []).append(e)

# ── Engagement via jointure directe session_id ────────────────────────────────
def _avg_engagement_direct(session_id_val) -> dict:
    """Jointure directe session_id → EngagementAnalysis (pas de proximité temporelle)."""
    if not session_id_val:
        return {"behavioral": None, "facial": None, "fused": None}
    engs = eng_by_session.get(str(session_id_val), [])
    if not engs:
        return {"behavioral": None, "facial": None, "fused": None}
    b  = [e.interaction_score for e in engs if e.interaction_score is not None]
    fc = [e.facial_score      for e in engs if e.facial_score      is not None]
    fu = [e.engagement_score  for e in engs if e.engagement_score  is not None]
    return {
        "behavioral": round(sum(b) /len(b),  4) if b  else None,
        "facial":     round(sum(fc)/len(fc), 4) if fc else None,
        "fused":      round(sum(fu)/len(fu), 4) if fu else None,
    }

dkt_count = 0
null_session_count = 0
with open("dataset_dkt.jsonl", "w") as f:
    seen = set()
    for p in progs:
        ex = exercices_map.get(str(p.exercice_id))
        if not ex:
            continue
        key = (str(p.user_id), str(p.exercice_id))
        first_attempt = key not in seen
        seen.add(key)

        if not p.session_id:
            null_session_count += 1

        kcs     = get_kcs(ex)
        primary = kcs[0] if kcs else None
        record = {
            "student_id":    str(p.user_id),
            "session_id":    str(p.session_id) if p.session_id else None,
            "exercise_id":   str(p.exercice_id),
            "primary_kc":    primary,
            "macro_kc":      get_macro_kc(primary),
            "all_kcs":       kcs,
            "correct":       bool(p.correct),
            "first_attempt": first_attempt,
            "time_seconds":  time_map.get(key),
            "difficulty":    ex.difficulte,
            "timestamp":     p.date_debut.isoformat() if p.date_debut else None,
            "engagement":    _avg_engagement_direct(p.session_id),
        }
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
        dkt_count += 1

if null_session_count:
    print(f"  ⚠ {null_session_count} progressions sans session_id (antérieures à la migration) → engagement=null")

print(f"✓ dataset_dkt.jsonl créé ({dkt_count} interactions)")
db.close()