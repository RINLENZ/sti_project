"""
Entraînement et calibration des modèles à partir des données de session.

Endpoints (super_admin uniquement) :
  GET  /api/training/stats          — statistiques sur les données disponibles
  POST /api/training/bkt/calibrate  — calibration EM des paramètres BKT
  GET  /api/training/export         — export JSONL des sessions pour ML externe
"""
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from io import StringIO
from datetime import datetime

from ..database import get_db
from ..dependencies import get_current_user
from ..models.user import User
from ..models.cours import BKTMastery, ProgressionApprenant, Exercice, UniteApprentissage
from ..models.session import LearningSession, EngagementAnalysis
from ..models.interaction import Interaction
from ..services.bkt_calibration import em_bkt
from ..services.bkt_service import DEFAULT_PARAMS
from ..utils import get_kcs, get_macro_kc

router = APIRouter(prefix="/api/training", tags=["training"])


def _check_admin(user: User):
    if user.role != "super_admin":
        raise HTTPException(403, "Super admin requis")


# ══════════════════════════════════════════════════════════════════════════════
#  1 — Statistiques sur les données disponibles
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/stats")
def get_training_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_admin(current_user)

    nb_sessions      = db.query(LearningSession).filter(LearningSession.ended_at.isnot(None)).count()
    nb_interactions  = db.query(Interaction).count()
    nb_progressions  = db.query(ProgressionApprenant).filter(ProgressionApprenant.correct.isnot(None)).count()
    nb_bkt           = db.query(BKTMastery).count()
    nb_engagements   = db.query(EngagementAnalysis).count()
    nb_apprenants    = db.query(User).filter(User.role == "apprenant").count()

    # Nombre de séquences BKT disponibles (user × compétence avec ≥ 2 réponses)
    rows = db.execute(text("""
        SELECT COUNT(*) FROM (
            SELECT p.user_id, e.ua_id
            FROM progressions p
            JOIN exercices e ON e.id = p.exercice_id
            WHERE p.correct IS NOT NULL
            GROUP BY p.user_id, e.ua_id
            HAVING COUNT(*) >= 2
        ) sub
    """)).scalar() or 0

    return {
        "nb_apprenants":       nb_apprenants,
        "nb_sessions":         nb_sessions,
        "nb_interactions":     nb_interactions,
        "nb_progressions":     nb_progressions,
        "nb_bkt_mastery":      nb_bkt,
        "nb_engagements":      nb_engagements,
        "nb_sequences_bkt":    int(rows),
        "pret_calibration":    int(rows) >= 5,
        "params_actuels":      DEFAULT_PARAMS,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  2 — Calibration EM des paramètres BKT
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/bkt/calibrate")
def calibrate_bkt(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reconstruit les séquences de réponses par (apprenant, compétence),
    lance l'algorithme EM et retourne les paramètres calibrés.
    """
    _check_admin(current_user)

    # ── Reconstruit les séquences depuis progressions × exercices ────────────
    rows = db.execute(text("""
        SELECT
            p.user_id,
            e.ua_id,
            e.competence_evaluee,
            p.correct,
            p.date_debut
        FROM progressions p
        JOIN exercices e ON e.id = p.exercice_id
        WHERE p.correct IS NOT NULL
        ORDER BY p.user_id, e.ua_id, p.date_debut
    """)).fetchall()

    # Groupe par (user_id, ua_id) pour former des séquences
    seq_map: dict[tuple, list] = {}
    for row in rows:
        key = (str(row.user_id), str(row.ua_id))
        seq_map.setdefault(key, []).append(bool(row.correct))

    sequences = list(seq_map.values())

    if not sequences:
        raise HTTPException(422, "Aucune donnée de progression trouvée. Les apprenants doivent avoir complété des exercices.")

    result = em_bkt(sequences)

    if "error" in result:
        raise HTTPException(422, result["error"])

    # Comparaison avec les params par défaut
    result["params_defaut"] = DEFAULT_PARAMS
    result["delta"] = {
        k: round(result[k] - DEFAULT_PARAMS[k], 4)
        for k in ("P_init", "P_learn", "P_slip", "P_guess")
    }

    # Interprétation pédagogique
    interpretations = []
    if abs(result["delta"]["P_learn"]) > 0.05:
        if result["P_learn"] > DEFAULT_PARAMS["P_learn"]:
            interpretations.append("Les apprenants progressent plus vite que prévu (P_learn ↑) — le contenu est bien adapté.")
        else:
            interpretations.append("La progression est plus lente que le modèle initial (P_learn ↓) — envisager plus d'exercices intermédiaires.")

    if result["P_slip"] > 0.20:
        interpretations.append("Taux d'erreur par inattention élevé (P_slip > 0.20) — les exercices contiennent peut-être des pièges formels.")

    if result["P_guess"] > 0.35:
        interpretations.append("Taux de devinette élevé (P_guess > 0.35) — privilégier les questions ouvertes aux QCM simples.")

    if abs(result["delta"]["P_init"]) > 0.05:
        if result["P_init"] > DEFAULT_PARAMS["P_init"]:
            interpretations.append("Les apprenants ont plus de pré-requis que supposé (P_init ↑).")
        else:
            interpretations.append("Les apprenants ont moins de pré-requis que supposé (P_init ↓) — renforcer les prérequis.")

    if not interpretations:
        interpretations.append("Les paramètres calibrés sont proches des valeurs initiales — le modèle était bien calibré.")

    result["interpretations"] = interpretations
    result["generated_at"]    = datetime.utcnow().isoformat()

    return result


# ══════════════════════════════════════════════════════════════════════════════
#  3 — Export JSONL des données de session pour entraînement ML externe
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/export")
def export_training_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Exporte toutes les sessions terminées en JSONL.
    Chaque ligne = une session avec features et outcome pour ML.
    Format : {student_id, session_features, bkt_state, outcome}
    """
    _check_admin(current_user)

    sessions = (
        db.query(LearningSession)
        .filter(LearningSession.ended_at.isnot(None))
        .order_by(LearningSession.started_at)
        .all()
    )

    if not sessions:
        raise HTTPException(404, "Aucune session terminée à exporter.")

    # Précharge BKT mastery par user
    all_mastery = db.query(BKTMastery).all()
    mastery_by_user: dict[str, list] = {}
    for m in all_mastery:
        uid = str(m.user_id)
        mastery_by_user.setdefault(uid, []).append({
            "competence":    m.competence,
            "ua_id":         str(m.ua_id) if m.ua_id else None,
            "p_mastery":     round(m.p_mastery, 4),
            "nb_tentatives": m.nb_tentatives,
            "nb_correct":    m.nb_correct,
        })

    # Précharge engagements par session
    all_eng = db.query(EngagementAnalysis).all()
    eng_by_session: dict[str, list] = {}
    for e in all_eng:
        sid = str(e.session_id)
        eng_by_session.setdefault(sid, []).append({
            "timestamp":        e.timestamp.isoformat() if e.timestamp else None,
            "facial_score":     e.facial_score,
            "audio_score":      e.audio_score,
            "interaction_score":e.interaction_score,
            "engagement_score": e.engagement_score,
            "etat_affectif":    e.etat_affectif,
            "action_triggered": e.action_triggered,
        })

    def generate():
        for s in sessions:
            sid = str(s.id)
            uid = str(s.user_id)
            engs = eng_by_session.get(sid, [])

            # Agrège les analyses d'engagement de la session
            engagement_moyen = None
            if engs:
                scores = [e["engagement_score"] for e in engs if e["engagement_score"] is not None]
                engagement_moyen = round(sum(scores) / len(scores), 4) if scores else None

            record = {
                "session_id":     sid,
                "student_id":     uid,
                "cours_id":       s.cours_id,
                # ── Features d'entrée ──────────────────────────────────────
                "features": {
                    "duree_secondes":   s.duree_secondes,
                    "nb_interactions":  s.nb_interactions,
                    "engagement_moyen": engagement_moyen,
                    "engagement_score": s.score_engagement,
                    "etat_affectif":    s.etat_affectif,
                    "nb_analyses":      len(engs),
                },
                # ── État BKT à la fin de la session ───────────────────────
                "bkt_state": mastery_by_user.get(uid, []),
                # ── Outcomes (cibles pour ML) ──────────────────────────────
                "outcome": {
                    "score_exercices":  round(s.score_final, 4) if s.score_final is not None else None,
                    "score_engagement": round(s.score_engagement, 4) if s.score_engagement is not None else None,
                },
                "timestamps": {
                    "started_at": s.started_at.isoformat() if s.started_at else None,
                    "ended_at":   s.ended_at.isoformat()   if s.ended_at   else None,
                },
            }
            yield json.dumps(record, ensure_ascii=False) + "\n"

    filename = f"sessions_training_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.jsonl"
    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ══════════════════════════════════════════════════════════════════════════════
#  4 — Export JSONL exercice-niveau pour entraînement DKT
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/export-dkt")
def export_dkt_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Exporte les interactions exercice-niveau pour l'entraînement DKT-E.
    Chaque ligne = une tentative d'exercice par un apprenant.

    Format : {student_id, exercise_id, primary_kc, all_kcs, correct,
              first_attempt, difficulty, timestamp, engagement}
    """
    _check_admin(current_user)

    # Toutes les progressions avec résultat connu et exercice rattaché
    progs = (
        db.query(ProgressionApprenant)
        .filter(
            ProgressionApprenant.correct.isnot(None),
            ProgressionApprenant.exercice_id.isnot(None),
        )
        .order_by(ProgressionApprenant.user_id, ProgressionApprenant.date_debut)
        .all()
    )

    if not progs:
        raise HTTPException(404, "Aucune donnée de progression à exporter.")

    # Précharge exercices
    ex_ids = list({p.exercice_id for p in progs if p.exercice_id})
    exercices_map = {
        str(e.id): e
        for e in db.query(Exercice).filter(Exercice.id.in_(ex_ids)).all()
    }

    # Précharge interactions type="response" pour time_seconds
    response_ints = (
        db.query(Interaction)
        .filter(Interaction.type == "response")
        .all()
    )
    # Index (user_id, exercise_id) → time_seconds (premier enregistrement)
    time_map: dict[tuple, int | None] = {}
    for i in response_ints:
        if i.data and i.data.get("exercice_id"):
            key = (str(i.user_id), str(i.data["exercice_id"]))
            if key not in time_map:
                time_map[key] = i.data.get("time_seconds")

    # Précharge engagement analyses par session
    all_eng = db.query(EngagementAnalysis).all()
    eng_by_session: dict[str, list] = {}
    for e in all_eng:
        eng_by_session.setdefault(str(e.session_id), []).append(e)

    def _avg_engagement(session_id_val) -> dict:
        """
        Jointure directe via session_id (colonne ajoutée à progressions).
        Retourne {"behavioral", "facial", "fused"} moyennés sur la session.
        Si session_id est NULL (anciennes progressions), retourne tous None.
        """
        if not session_id_val:
            return {"behavioral": None, "facial": None, "fused": None}
        engs = eng_by_session.get(str(session_id_val), [])
        if not engs:
            return {"behavioral": None, "facial": None, "fused": None}
        behavioral = [e.interaction_score for e in engs if e.interaction_score is not None]
        facial     = [e.facial_score     for e in engs if e.facial_score     is not None]
        fused      = [e.engagement_score for e in engs if e.engagement_score is not None]
        return {
            "behavioral": round(sum(behavioral) / len(behavioral), 4) if behavioral else None,
            "facial":     round(sum(facial)     / len(facial),     4) if facial     else None,
            "fused":      round(sum(fused)       / len(fused),     4) if fused       else None,
        }

    def generate():
        seen: set[tuple] = set()
        for p in progs:
            ex = exercices_map.get(str(p.exercice_id))
            if not ex:
                continue

            key = (str(p.user_id), str(p.exercice_id))
            first_attempt = key not in seen
            seen.add(key)

            kcs      = get_kcs(ex)
            primary  = kcs[0] if kcs else None
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
                "engagement":    _avg_engagement(p.session_id),
            }
            yield json.dumps(record, ensure_ascii=False) + "\n"

    filename = f"dkt_interactions_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.jsonl"
    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
