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
from app.utils import get_kcs, get_macro_kc, is_valid_kc
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

# ── Jointure learning_sessions par session_id ────────────────────────────────
# EngagementAnalysis n'est jamais peuplé (table morte) → on joint learning_sessions
# directement pour récupérer les 3 composantes calculées par clore_session().
all_sessions = db.query(LearningSession).filter(LearningSession.ended_at.isnot(None)).all()
sessions_by_id = {str(s.id): s for s in all_sessions}

def _engagement_for_prog(prog) -> dict:
    """
    Retourne les 4 composantes d'engagement pour une interaction DKT.

    Priorité 1 — Per-exercice (post-refactor, granularité temporelle réelle) :
        engagement_fused / facial / audio / behavioral sur ProgressionApprenant.
        Valeur différente par exercice → signal temporel exploitable par le LSTM DKT-E.

    Priorité 2 — Session globale (fallback pour données historiques) :
        Score agrégé depuis learning_sessions.
        Même valeur pour tous les exercices d'une session → constante, non idéal
        mais préserve la compatibilité avec les données collectées avant le refactor.
    """
    # Priorité 1 : scores per-exercice
    if prog.engagement_fused is not None:
        return {
            "behavioral": round(prog.engagement_behavioral, 4) if prog.engagement_behavioral is not None else None,
            "audio":      round(prog.engagement_audio,      4) if prog.engagement_audio      is not None else None,
            "facial":     round(prog.engagement_facial,     4) if prog.engagement_facial     is not None else None,
            "fused":      round(prog.engagement_fused,      4),
        }
    # Priorité 2 : score session global (fallback)
    if not prog.session_id:
        return {"behavioral": None, "audio": None, "facial": None, "fused": None}
    s = sessions_by_id.get(str(prog.session_id))
    if not s:
        return {"behavioral": None, "audio": None, "facial": None, "fused": None}
    return {
        "behavioral": round(s.score_comportemental, 4) if s.score_comportemental is not None else None,
        "audio":      round(s.score_audio,           4) if s.score_audio          is not None else None,
        "facial":     round(s.score_facial,           4) if s.score_facial         is not None else None,
        "fused":      round(s.score_engagement,       4) if s.score_engagement     is not None else None,
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

        # Exclut les KCs invalides : None (pas de compétence définie) et "QCM"
        # (type d'exercice copié par erreur dans competence_evaluee)
        if not is_valid_kc(primary):
            continue

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
            "engagement":    _engagement_for_prog(p),
        }
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
        dkt_count += 1

excluded_kc = sum(1 for p in progs if not is_valid_kc((get_kcs(exercices_map[str(p.exercice_id)])[0] if exercices_map.get(str(p.exercice_id)) and get_kcs(exercices_map[str(p.exercice_id)]) else None)))
if null_session_count:
    print(f"  ⚠ {null_session_count} progressions sans session_id (antérieures à la migration) → engagement=null")
if excluded_kc:
    print(f"  ⚠ {excluded_kc} interactions exclues (KC=None ou KC=type d'exercice)")

print(f"✓ dataset_dkt.jsonl créé ({dkt_count} interactions)")
db.close()