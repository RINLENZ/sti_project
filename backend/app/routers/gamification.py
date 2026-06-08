"""
Routeur gamification : XP, niveaux, streak, badges Adinkra.

Endpoints :
  GET  /api/gamification/stats/{user_id}    → stats complètes
  POST /api/gamification/award-xp           → award XP + maj streak + vérification badges
  GET  /api/gamification/badges/{user_id}   → tous les badges (obtenus + locked)
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models.user_stats import UserStats

router = APIRouter(prefix="/api/gamification", tags=["gamification"])

# ── Formule de niveau ─────────────────────────────────────────────
# Niveau n requiert 100 × 2^(n-1) XP cumulatifs depuis le niveau précédent.
# Ex : niveau 2 = 100 XP, niveau 3 = 200 XP de plus, niveau 4 = 400 XP de plus…

def xp_pour_niveau(n: int) -> int:
    """XP total requis pour atteindre le niveau n (depuis 0)."""
    total = 0
    for i in range(1, n):
        total += 100 * (2 ** (i - 1))
    return total


def calculer_niveau(xp: int) -> tuple[int, int, int]:
    """Retourne (niveau, xp_dans_niveau, xp_pour_prochain)."""
    niveau = 1
    while xp >= xp_pour_niveau(niveau + 1):
        niveau += 1
    xp_debut = xp_pour_niveau(niveau)
    xp_fin   = xp_pour_niveau(niveau + 1)
    return niveau, xp - xp_debut, xp_fin - xp_debut


# ── Définition des 10 badges Adinkra ─────────────────────────────
BADGES_DEF = [
    {
        "id":          "nyame_nti",
        "nom":         "Nyame Nti",
        "symbole":     "🌟",
        "description": "Premier exercice réussi — par la grâce, tout commence.",
        "condition":   "total_corrects >= 1",
    },
    {
        "id":          "sankofa",
        "nom":         "Sankofa",
        "symbole":     "🦅",
        "description": "Revenir apprendre encore et encore — 3 sessions complétées.",
        "condition":   "total_sessions >= 3",
    },
    {
        "id":          "gye_nyame",
        "nom":         "Gye Nyame",
        "symbole":     "✨",
        "description": "5 jours consécutifs de session — persévérance absolue.",
        "condition":   "streak_jours >= 5",
    },
    {
        "id":          "akoma",
        "nom":         "Akoma",
        "symbole":     "❤️",
        "description": "Patience — 10 sessions complétées sans abandonner.",
        "condition":   "total_sessions >= 10",
    },
    {
        "id":          "dwennimmen",
        "nom":         "Dwennimmen",
        "symbole":     "🦁",
        "description": "Force et humilité — 100 exercices tentés.",
        "condition":   "total_exercices >= 100",
    },
    {
        "id":          "aya",
        "nom":         "Aya",
        "symbole":     "🌿",
        "description": "Endurance — 300 minutes d'apprentissage cumulées.",
        "condition":   "duree_totale_min >= 300",
    },
    {
        "id":          "bese_saka",
        "nom":         "Bese Saka",
        "symbole":     "💎",
        "description": "Abondance — 5 compétences maîtrisées (BKT ≥ 0.95).",
        "condition":   "nb_maitrisees >= 5",
    },
    {
        "id":          "kramo_bone",
        "nom":         "Kramo Bone",
        "symbole":     "🎯",
        "description": "Excellence — 95% de réussite sur au moins 10 exercices.",
        "condition":   "total_corrects >= 10 AND taux >= 95",
    },
    {
        "id":          "sunsum",
        "nom":         "Sunsum",
        "symbole":     "🌙",
        "description": "Esprit en éveil — au moins une session avec engagement ≥ 80%.",
        "condition":   "session_engagement_eleve",
    },
    {
        "id":          "adinkrahene",
        "nom":         "Adinkrahene",
        "symbole":     "👑",
        "description": "Chef des symboles — les 9 autres badges débloqués.",
        "condition":   "all_9_badges",
    },
]

BADGE_IDS_9 = [b["id"] for b in BADGES_DEF if b["id"] != "adinkrahene"]


def _get_or_create_stats(db: Session, user_id: uuid.UUID) -> UserStats:
    stats = db.query(UserStats).filter(UserStats.user_id == user_id).first()
    if not stats:
        stats = UserStats(user_id=user_id)
        db.add(stats)
        db.flush()
    return stats


def _compute_badge_conditions(db: Session, user_id: uuid.UUID, stats: UserStats) -> dict:
    """Calcule les valeurs nécessaires à la vérification des conditions de badge."""

    # Durée totale de sessions (minutes)
    row = db.execute(text(
        "SELECT COALESCE(SUM(duree_secondes), 0) FROM learning_sessions "
        "WHERE user_id = :uid AND duree_secondes IS NOT NULL"
    ), {"uid": str(user_id)}).fetchone()
    duree_totale_min = int((row[0] or 0) // 60)

    # Nombre de compétences BKT maîtrisées (p_mastery ≥ 0.95)
    row2 = db.execute(text(
        "SELECT COUNT(*) FROM bkt_mastery WHERE user_id = :uid AND p_mastery >= 0.95"
    ), {"uid": str(user_id)}).fetchone()
    nb_maitrisees = int(row2[0] or 0)

    # Taux de réussite (%)
    taux = 0
    if stats.total_exercices > 0:
        taux = round(stats.total_corrects / stats.total_exercices * 100)

    # Session avec engagement fusionné ≥ 0.80
    row3 = db.execute(text(
        "SELECT COUNT(*) FROM learning_sessions "
        "WHERE user_id = :uid AND score_fusionne >= 0.80 AND ended_at IS NOT NULL"
    ), {"uid": str(user_id)}).fetchone()
    session_engagement_eleve = int(row3[0] or 0) > 0

    return {
        "total_corrects":         stats.total_corrects,
        "total_exercices":        stats.total_exercices,
        "total_sessions":         stats.total_sessions,
        "streak_jours":           stats.streak_jours,
        "duree_totale_min":       duree_totale_min,
        "nb_maitrisees":          nb_maitrisees,
        "taux":                   taux,
        "session_engagement_eleve": session_engagement_eleve,
    }


def _check_badge_unlocked(badge_id: str, ctx: dict, current_badges: list) -> bool:
    """Retourne True si le badge est débloqué selon les valeurs du contexte."""
    c = ctx
    if badge_id == "nyame_nti":       return c["total_corrects"] >= 1
    if badge_id == "sankofa":         return c["total_sessions"] >= 3
    if badge_id == "gye_nyame":       return c["streak_jours"] >= 5
    if badge_id == "akoma":           return c["total_sessions"] >= 10
    if badge_id == "dwennimmen":      return c["total_exercices"] >= 100
    if badge_id == "aya":             return c["duree_totale_min"] >= 300
    if badge_id == "bese_saka":       return c["nb_maitrisees"] >= 5
    if badge_id == "kramo_bone":      return c["total_corrects"] >= 10 and c["taux"] >= 95
    if badge_id == "sunsum":          return c["session_engagement_eleve"]
    if badge_id == "adinkrahene":     return all(bid in current_badges for bid in BADGE_IDS_9)
    return False


def _compute_all_badges(db: Session, user_id: uuid.UUID, stats: UserStats) -> list[str]:
    """Recompute la liste complète des badges débloqués."""
    ctx = _compute_badge_conditions(db, user_id, stats)
    earned = []
    for badge in BADGES_DEF:
        if badge["id"] == "adinkrahene":
            continue
        if _check_badge_unlocked(badge["id"], ctx, earned):
            earned.append(badge["id"])
    # adinkrahene en dernier
    if _check_badge_unlocked("adinkrahene", ctx, earned):
        earned.append("adinkrahene")
    return earned


# ── Endpoints ─────────────────────────────────────────────────────

@router.get("/stats/{user_id}")
def get_stats(user_id: uuid.UUID, db: Session = Depends(get_db),
              current_user=Depends(get_current_user)):
    stats = _get_or_create_stats(db, user_id)
    db.commit()

    niveau, xp_dans_niveau, xp_pour_prochain = calculer_niveau(stats.xp)
    ctx = _compute_badge_conditions(db, user_id, stats)

    badges_with_meta = []
    for b in BADGES_DEF:
        unlocked = b["id"] in (stats.badges or [])
        badges_with_meta.append({
            **b,
            "unlocked": unlocked,
        })

    return {
        "user_id":          str(user_id),
        "xp":               stats.xp,
        "niveau":           niveau,
        "xp_dans_niveau":   xp_dans_niveau,
        "xp_pour_prochain": xp_pour_prochain,
        "streak_jours":     stats.streak_jours,
        "derniere_session": stats.derniere_session.isoformat() if stats.derniere_session else None,
        "badges":           stats.badges or [],
        "badges_detail":    badges_with_meta,
        "total_sessions":   stats.total_sessions,
        "total_exercices":  stats.total_exercices,
        "total_corrects":   stats.total_corrects,
        "duree_totale_min": ctx["duree_totale_min"],
        "nb_maitrisees":    ctx["nb_maitrisees"],
        "taux_reussite":    ctx["taux"],
    }


class AwardXPRequest(BaseModel):
    user_id:         uuid.UUID
    xp_gagnes:       int = 0
    session_terminee: bool = False
    nb_exercices:    int = 0
    nb_corrects:     int = 0


@router.post("/award-xp")
def award_xp(req: AwardXPRequest, db: Session = Depends(get_db),
             current_user=Depends(get_current_user)):
    stats = _get_or_create_stats(db, req.user_id)
    today = date.today()

    # ── Mise à jour XP + compteurs ────────────────────────────────
    stats.xp               += max(0, req.xp_gagnes)
    stats.total_exercices  += max(0, req.nb_exercices)
    stats.total_corrects   += max(0, req.nb_corrects)

    if req.session_terminee:
        stats.total_sessions += 1
        # ── Streak ───────────────────────────────────────────────
        if stats.derniere_session is None:
            stats.streak_jours = 1
        elif stats.derniere_session == today:
            pass  # déjà compté aujourd'hui
        elif stats.derniere_session == today - timedelta(days=1):
            stats.streak_jours += 1
        else:
            stats.streak_jours = 1  # rupture de streak
        stats.derniere_session = today

    # ── Niveau ───────────────────────────────────────────────────
    niveau, _, _ = calculer_niveau(stats.xp)
    stats.niveau = niveau

    # ── Badges ───────────────────────────────────────────────────
    badges_avant  = set(stats.badges or [])
    badges_apres  = set(_compute_all_badges(db, req.user_id, stats))
    nouveaux      = sorted(badges_apres - badges_avant)
    stats.badges  = sorted(badges_apres)

    db.commit()

    # Retourne les nouveaux badges avec leurs métadonnées pour le toast frontend
    nouveaux_detail = [b for b in BADGES_DEF if b["id"] in nouveaux]
    niveau_final, xp_dans_niveau, xp_pour_prochain = calculer_niveau(stats.xp)

    return {
        "xp":               stats.xp,
        "niveau":           niveau_final,
        "xp_dans_niveau":   xp_dans_niveau,
        "xp_pour_prochain": xp_pour_prochain,
        "streak_jours":     stats.streak_jours,
        "badges":           stats.badges,
        "nouveaux_badges":  nouveaux_detail,
    }


@router.get("/badges/{user_id}")
def get_badges(user_id: uuid.UUID, db: Session = Depends(get_db),
               current_user=Depends(get_current_user)):
    stats = _get_or_create_stats(db, user_id)
    db.commit()
    ctx = _compute_badge_conditions(db, user_id, stats)

    result = []
    for b in BADGES_DEF:
        unlocked  = b["id"] in (stats.badges or [])
        result.append({**b, "unlocked": unlocked})
    return result
