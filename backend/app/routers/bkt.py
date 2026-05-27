from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime, timezone, date, timedelta
from ..database import get_db
from ..models.cours import BKTMastery, Exercice, UniteApprentissage, ProgressionApprenant
from ..models.examen import EpreuveReponse, Epreuve
from ..models.session import LearningSession
from ..models.user import User
from ..dependencies import get_current_user
from ..services.bkt_service import update_knowledge, interpret_mastery, compute_class_bkt
from ..services.bulletin_service import generate_bulletin

router = APIRouter(prefix="/api/bkt", tags=["BKT"])


class BKTExerciceUpdate(BaseModel):
    ua_id:          UUID
    competence:     str
    correct:        bool
    exercice_id:    Optional[UUID] = None
    reponse_donnee: Optional[str]  = None


@router.post("/apprenant/{user_id}/update-exercice")
def update_mastery_exercice(
    user_id: UUID,
    body: BKTExerciceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Met à jour le BKT d'une compétence après une réponse dans le tutoriel."""
    if str(current_user.id) != str(user_id):
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    mastery = db.query(BKTMastery).filter(
        BKTMastery.user_id == user_id,
        BKTMastery.competence == body.competence,
    ).first()

    if not mastery:
        mastery = BKTMastery(
            user_id=user_id,
            ua_id=body.ua_id,
            competence=body.competence,
            p_mastery=0.1,
            nb_tentatives=0,
            nb_correct=0,
        )
        db.add(mastery)

    mastery.p_mastery = update_knowledge(mastery.p_mastery, body.correct)
    mastery.nb_tentatives += 1
    if body.correct:
        mastery.nb_correct += 1
    mastery.last_updated = datetime.now(timezone.utc)

    db.commit()
    db.refresh(mastery)

    # ── Sync ProgressionApprenant ──────────────────────────────────
    if body.exercice_id:
        exercice = db.query(Exercice).filter(Exercice.id == body.exercice_id).first()
        points   = exercice.points if exercice else 10

        prog = db.query(ProgressionApprenant).filter(
            ProgressionApprenant.user_id     == user_id,
            ProgressionApprenant.exercice_id == body.exercice_id,
        ).first()
        if not prog:
            prog = ProgressionApprenant(
                user_id=user_id, ua_id=body.ua_id,
                exercice_id=body.exercice_id,
                date_debut=datetime.now(timezone.utc),
            )
            db.add(prog)
        prog.tentatives     = (prog.tentatives or 0) + 1
        prog.correct        = body.correct
        prog.reponse_donnee = body.reponse_donnee
        prog.score          = points if body.correct else 0
        prog.statut         = "termine" if body.correct else "en_cours"
        if body.correct:
            prog.date_fin = datetime.now(timezone.utc)
        db.commit()

    # ── Notifications badges ───────────────────────────────────────
    try:
        from ..services.notification_service import notif_badge, notif_competence_maitrisee, notif_competence_progres
        nb_total = db.query(BKTMastery).filter(BKTMastery.user_id == user_id).with_entities(
            BKTMastery.nb_tentatives
        ).all()
        total_tentatives = sum(r[0] for r in nb_total)
        BADGE_TENTATIVES = {1: "premier_pas", 10: "studieux", 50: "assidu", 100: "expert"}
        if total_tentatives in BADGE_TENTATIVES:
            notif_badge(db, user_id, BADGE_TENTATIVES[total_tentatives])

        p_new  = mastery.p_mastery
        p_prev = p_new / (1 + (1 - p_new))  # approximation avant update (non bloquant)
        if p_new >= 0.95 and p_prev < 0.95:
            notif_competence_maitrisee(db, user_id, mastery.competence)
            nb_maitrisees = db.query(BKTMastery).filter(
                BKTMastery.user_id == user_id, BKTMastery.p_mastery >= 0.95
            ).count()
            if nb_maitrisees == 1:
                notif_badge(db, user_id, "premiere_maitrise")
            elif nb_maitrisees == 5:
                notif_badge(db, user_id, "multi_maitre")
        elif p_new >= 0.70 and mastery.nb_tentatives <= 3:
            notif_competence_progres(db, user_id, mastery.competence, 70)
        elif p_new >= 0.40 and mastery.nb_tentatives <= 2:
            notif_competence_progres(db, user_id, mastery.competence, 40)
    except Exception:
        pass

    interp = interpret_mastery(mastery.p_mastery)
    return {
        "competence":    mastery.competence,
        "p_mastery":     mastery.p_mastery,
        "pourcentage":   round(mastery.p_mastery * 100),
        "niveau":        interp["niveau"],
        "label":         interp["label"],
        "color":         interp["color"],
        "nb_tentatives": mastery.nb_tentatives,
        "nb_correct":    mastery.nb_correct,
    }


@router.get("/apprenant/{user_id}")
def get_mastery_apprenant(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if str(current_user.id) != str(user_id) and current_user.role not in ("enseignant", "super_admin"):
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    masteries = db.query(BKTMastery).filter(
        BKTMastery.user_id == user_id
    ).all()

    result = {}
    for m in masteries:
        interp = interpret_mastery(m.p_mastery)
        result[m.competence] = {
            "p_mastery":     m.p_mastery,
            "pourcentage":   round(m.p_mastery * 100),
            "niveau":        interp["niveau"],
            "label":         interp["label"],
            "color":         interp["color"],
            "nb_tentatives": m.nb_tentatives,
            "nb_correct":    m.nb_correct,
        }

    return {
        "user_id":    str(user_id),
        "competences": result,
        "nb_competences_maitrisees": len([
            v for v in result.values() if v["niveau"] == "maitrise"
        ])
    }


@router.get("/apprenant/{user_id}/stats")
def get_stats_apprenant(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stats agrégées : BKT + sessions pour le profil apprenant."""
    if str(current_user.id) != str(user_id) and current_user.role not in ("enseignant", "super_admin"):
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    masteries = db.query(BKTMastery).filter(BKTMastery.user_id == user_id).all()
    nb_competences  = len(masteries)
    nb_maitrisees   = sum(1 for m in masteries if m.p_mastery >= 0.8)
    nb_tentatives   = sum(m.nb_tentatives for m in masteries)
    nb_correct      = sum(m.nb_correct    for m in masteries)
    p_moyen         = (sum(m.p_mastery for m in masteries) / nb_competences) if nb_competences else 0

    sessions = db.query(LearningSession).filter(
        LearningSession.user_id == user_id,
        LearningSession.ended_at.isnot(None),
    ).all()
    nb_sessions    = len(sessions)
    duree_totale   = sum(s.duree_secondes or 0 for s in sessions)
    scores_valides = [s.score_final for s in sessions if s.score_final is not None]
    score_moyen    = (sum(scores_valides) / len(scores_valides)) if scores_valides else 0

    # Streak : jours consécutifs avec au moins une session (jusqu'à aujourd'hui)
    session_dates = sorted({
        s.ended_at.date() if s.ended_at.tzinfo is None else s.ended_at.astimezone().date()
        for s in sessions if s.ended_at
    }, reverse=True)
    streak = 0
    expected = date.today()
    for d in session_dates:
        if d == expected:
            streak += 1
            expected -= timedelta(days=1)
        elif d < expected:
            break

    return {
        "nb_competences":       nb_competences,
        "nb_maitrisees":        nb_maitrisees,
        "nb_tentatives":        nb_tentatives,
        "nb_correct":           nb_correct,
        "taux_reussite":        round(nb_correct / nb_tentatives * 100) if nb_tentatives else 0,
        "p_mastery_moyen":      round(p_moyen * 100),
        "nb_sessions":          nb_sessions,
        "duree_totale_minutes": round(duree_totale / 60),
        "score_moyen":          round(score_moyen * 100),
        "streak_jours":         streak,
    }


@router.get("/apprenant/{user_id}/sessions")
def get_sessions_apprenant(
    user_id: UUID,
    limit: int = Query(10, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dernières sessions d'apprentissage avec titre du cours."""
    if str(current_user.id) != str(user_id) and current_user.role not in ("enseignant", "super_admin"):
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    sessions = (
        db.query(LearningSession)
        .filter(
            LearningSession.user_id == user_id,
            LearningSession.ended_at.isnot(None),
        )
        .order_by(LearningSession.ended_at.desc())
        .limit(limit)
        .all()
    )

    # Précharge les titres UA en une seule requête
    cours_ids = list({s.cours_id for s in sessions if s.cours_id})
    uas = {
        str(ua.id): ua.titre
        for ua in db.query(UniteApprentissage)
        .filter(UniteApprentissage.id.in_(cours_ids))
        .all()
    } if cours_ids else {}

    return [
        {
            "id":              str(s.id),
            "cours_id":        str(s.cours_id) if s.cours_id else None,
            "cours_titre":     uas.get(str(s.cours_id), "Cours inconnu") if s.cours_id else "Cours inconnu",
            "started_at":      s.started_at.isoformat() if s.started_at else None,
            "ended_at":        s.ended_at.isoformat()   if s.ended_at   else None,
            "duree_secondes":  s.duree_secondes,
            "score_final":     round(s.score_final * 100)     if s.score_final     is not None else None,
            "score_engagement":round(s.score_engagement * 100) if s.score_engagement is not None else None,
            "etat_affectif":   s.etat_affectif,
            "nb_interactions": s.nb_interactions,
        }
        for s in sessions
    ]


@router.get("/classe")
def get_mastery_classe(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    apprenants = db.query(User).filter(User.role == "apprenant").all()

    students_data = []
    for apprenant in apprenants:
        masteries = db.query(BKTMastery).filter(
            BKTMastery.user_id == apprenant.id
        ).all()
        if masteries:
            students_data.append({m.competence: m.p_mastery for m in masteries})

    stats = compute_class_bkt(students_data)
    return {
        "nb_apprenants": len(apprenants),
        "competences":   stats
    }


@router.get("/apprenant/{user_id}/bulletin.pdf")
def telecharger_bulletin(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Génère et retourne le bulletin PDF de progression de l'apprenant."""
    if str(current_user.id) != str(user_id) and current_user.role not in ("enseignant", "super_admin"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    # ── Stats BKT ─────────────────────────────────────────────────────────
    raw_masteries = db.query(BKTMastery).filter(BKTMastery.user_id == user_id).all()
    nb_comp  = len(raw_masteries)
    nb_mais  = sum(1 for m in raw_masteries if m.p_mastery >= 0.8)
    nb_tent  = sum(m.nb_tentatives for m in raw_masteries)
    nb_corr  = sum(m.nb_correct for m in raw_masteries)
    p_moyen  = round(sum(m.p_mastery for m in raw_masteries) / nb_comp * 100) if nb_comp else 0

    sessions = db.query(LearningSession).filter(
        LearningSession.user_id == user_id,
        LearningSession.ended_at.isnot(None),
    ).all()
    nb_sess  = len(sessions)
    duree    = sum(s.duree_secondes or 0 for s in sessions)
    scores_v = [s.score_final for s in sessions if s.score_final is not None]
    s_moyen  = round(sum(scores_v) / len(scores_v) * 100) if scores_v else 0

    stats = {
        "nb_competences":       nb_comp,
        "nb_maitrisees":        nb_mais,
        "nb_tentatives":        nb_tent,
        "nb_correct":           nb_corr,
        "taux_reussite":        round(nb_corr / nb_tent * 100) if nb_tent else 0,
        "p_mastery_moyen":      p_moyen,
        "nb_sessions":          nb_sess,
        "duree_totale_minutes": round(duree / 60),
        "score_moyen":          s_moyen,
    }

    # ── Détail compétences avec titre UA ─────────────────────────────────
    ua_ids   = [m.ua_id for m in raw_masteries if m.ua_id]
    ua_map   = {str(ua.id): ua.titre for ua in db.query(UniteApprentissage).filter(UniteApprentissage.id.in_(ua_ids)).all()}
    masteries = [
        {
            "competence":    m.competence,
            "p_mastery":     m.p_mastery,
            "nb_tentatives": m.nb_tentatives,
            "nb_correct":    m.nb_correct,
            "ua_titre":      ua_map.get(str(m.ua_id), ''),
        }
        for m in raw_masteries
    ]

    # ── Épreuves soumises ─────────────────────────────────────────────────
    reponses = (
        db.query(EpreuveReponse, Epreuve)
        .join(Epreuve, EpreuveReponse.epreuve_id == Epreuve.id)
        .filter(
            EpreuveReponse.apprenant_id == user_id,
            EpreuveReponse.statut.in_(["soumis", "corrige"]),
        )
        .order_by(EpreuveReponse.submitted_at.desc())
        .all()
    )
    epreuves = [
        {
            "titre":        ep.titre,
            "type_epreuve": ep.type_epreuve,
            "score_total":  rep.score_total,
            "submitted_at": rep.submitted_at.isoformat() if rep.submitted_at else None,
            "statut":       rep.statut,
        }
        for rep, ep in reponses
    ]

    pdf_bytes = generate_bulletin(user, stats, masteries, epreuves)
    nom_clean = f"{user.prenom}_{user.nom}".replace(" ", "_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="bulletin_{nom_clean}.pdf"'},
    )
