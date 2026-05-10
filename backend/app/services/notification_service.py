from sqlalchemy.orm import Session
from uuid import UUID
from ..models.notification import Notification


def create_notification(
    db: Session,
    user_id: UUID,
    type: str,
    titre: str,
    message: str,
    meta: dict = None,
) -> Notification:
    notif = Notification(
        user_id=user_id,
        type=type,
        titre=titre,
        message=message,
        meta=meta or {},
    )
    db.add(notif)
    db.commit()
    return notif


# ── Helpers par type ────────────────────────────────────────────────

BADGE_LABELS = {
    "premier_pas":        ("🚀", "Premier pas",       "Tu as tenté ton premier exercice !"),
    "studieux":           ("📚", "Studieux",           "10 exercices tentés — bel effort !"),
    "assidu":             ("🔥", "Assidu",             "50 exercices tentés — continue comme ça !"),
    "expert":             ("🏆", "Expert",             "100 exercices tentés — tu es un champion !"),
    "premiere_maitrise":  ("⭐", "Première maîtrise",  "Tu maîtrises ta première compétence à ≥ 80% !"),
    "multi_maitre":       ("💎", "Multi-maître",       "5 compétences maîtrisées — impressionnant !"),
    "marathonien":        ("⏱️", "Marathonien",         "1 heure de temps d'étude accumulée !"),
    "infatigable":        ("🌙", "Infatigable",        "5 heures de temps d'étude accumulées !"),
    "precis":             ("🎯", "Précis",             "Taux de réussite ≥ 80% sur 5+ exercices !"),
    "perfectionniste":    ("✨", "Perfectionniste",    "Taux de réussite ≥ 95% sur 10+ exercices !"),
    "regulier":           ("📅", "Régulier",           "5 sessions complétées — garde le rythme !"),
    "perseverant":        ("💪", "Persévérant",        "20 sessions complétées — quelle ténacité !"),
}


def notif_badge(db: Session, user_id: UUID, badge_id: str):
    if badge_id not in BADGE_LABELS:
        return
    emoji, label, msg = BADGE_LABELS[badge_id]
    create_notification(
        db, user_id,
        type="badge_debloque",
        titre=f"{emoji} Badge débloqué : {label}",
        message=msg,
        meta={"badge_id": badge_id},
    )


def notif_competence_maitrisee(db: Session, user_id: UUID, competence: str):
    create_notification(
        db, user_id,
        type="competence_maitrisee",
        titre="⭐ Compétence maîtrisée !",
        message=f"Tu maîtrises maintenant « {competence} » à ≥ 95% — félicitations !",
        meta={"competence": competence},
    )


def notif_competence_progres(db: Session, user_id: UUID, competence: str, palier: int):
    palier_label = "70%" if palier == 70 else "40%"
    create_notification(
        db, user_id,
        type="competence_progres",
        titre=f"📈 Progression : {palier_label} atteint",
        message=f"Ta maîtrise de « {competence} » atteint {palier_label} — tu avances bien !",
        meta={"competence": competence, "palier": palier},
    )


def notif_session_terminee(db: Session, user_id: UUID, cours_titre: str, score: int, duree_min: int):
    create_notification(
        db, user_id,
        type="session_terminee",
        titre="✅ Session terminée",
        message=f"{cours_titre} · Score {score}% · {duree_min} min",
        meta={"cours_titre": cours_titre, "score": score, "duree_min": duree_min},
    )


def notif_enseignant_lie(db: Session, user_id: UUID, enseignant_nom: str):
    create_notification(
        db, user_id,
        type="enseignant_lie",
        titre="👨‍🏫 Enseignant lié",
        message=f"{enseignant_nom} suit maintenant ta progression.",
        meta={"enseignant_nom": enseignant_nom},
    )


def notif_apprenant_lie(db: Session, tuteur_id: UUID, apprenant_nom: str, apprenant_niveau: str):
    create_notification(
        db, tuteur_id,
        type="apprenant_lie",
        titre="🎓 Nouvel apprenant",
        message=f"{apprenant_nom} ({apprenant_niveau or 'niveau non défini'}) a rejoint ta classe.",
        meta={"apprenant_nom": apprenant_nom},
    )


def notif_apprenant_session(db: Session, tuteur_id: UUID, apprenant_nom: str, cours_titre: str, score: int):
    create_notification(
        db, tuteur_id,
        type="apprenant_session",
        titre=f"📖 Session terminée — {apprenant_nom}",
        message=f"{cours_titre} · Score {score}%",
        meta={"apprenant_nom": apprenant_nom, "cours_titre": cours_titre, "score": score},
    )


def notif_apprenant_decrocheur(db: Session, tuteur_id: UUID, apprenant_nom: str, engagement: int):
    create_notification(
        db, tuteur_id,
        type="apprenant_decrocheur",
        titre=f"⚠️ Décrochage détecté — {apprenant_nom}",
        message=f"Score d'engagement très bas ({engagement}%) lors de sa dernière session.",
        meta={"apprenant_nom": apprenant_nom, "engagement": engagement},
    )
