from datetime import datetime, timedelta
from typing import Optional

# Seuils de détection (issus de la littérature — ton mémoire §III-3)
IDLE_THRESHOLD_SECONDS = 120      # inactivité > 2 min = décrochage
RESPONSE_TIME_AVG_MULTIPLIER = 2  # temps réponse > 2× la moyenne = difficulté
REPEATED_CLICKS_THRESHOLD = 5     # > 5 clics répétés = frustration

def compute_behavioral_score(events: list[dict]) -> dict:
    """
    Calcule le score d'engagement comportemental à partir
    d'une liste d'événements de la session.
    Retourne un score entre 0.0 (désengagé) et 1.0 (très engagé).
    """
    if not events:
        return {"score": 0.5, "flags": [], "level": "modere"}

    flags = []
    penalties = 0.0
    bonuses = 0.0

    # --- Analyse de l'inactivité ---
    idle_events = [e for e in events if e.get("type") == "idle"]
    for e in idle_events:
        duration = e.get("data", {}).get("duration_seconds", 0)
        if duration > IDLE_THRESHOLD_SECONDS:
            penalties += 0.3
            flags.append("inactivite_prolongee")

    # --- Analyse du temps de réponse ---
    response_events = [e for e in events if e.get("type") == "response"]
    if response_events:
        times = [e.get("data", {}).get("time_seconds", 0) for e in response_events]
        avg_time = sum(times) / len(times)
        slow_responses = [t for t in times if t > avg_time * RESPONSE_TIME_AVG_MULTIPLIER]
        if len(slow_responses) > len(times) * 0.5:
            penalties += 0.2
            flags.append("reponses_lentes")

    # --- Analyse des clics répétés (frustration) ---
    click_events = [e for e in events if e.get("type") == "click"]
    if len(click_events) > REPEATED_CLICKS_THRESHOLD:
        targets = [e.get("data", {}).get("target", "") for e in click_events]
        if len(targets) != len(set(targets)):  # clics répétés sur le même élément
            penalties += 0.2
            flags.append("clics_repetes")

    # --- Bonus pour interactions actives ---
    help_events = [e for e in events if e.get("type") == "help_requested"]
    correct_responses = [
        e for e in response_events
        if e.get("data", {}).get("correct") is True
    ]
    if correct_responses:
        bonuses += 0.1 * min(len(correct_responses), 3)
    if help_events:
        bonuses += 0.05  # chercher de l'aide = engagement actif

    # --- Calcul final ---
    raw_score = 1.0 - penalties + bonuses
    score = max(0.0, min(1.0, raw_score))  # clamp entre 0 et 1

    # --- Niveau d'engagement ---
    if score >= 0.7:
        level = "eleve"
    elif score >= 0.4:
        level = "modere"
    else:
        level = "faible"

    return {
        "score": round(score, 2),
        "flags": flags,
        "level": level,
        "details": {
            "nb_events": len(events),
            "penalties": round(penalties, 2),
            "bonuses": round(bonuses, 2)
        }
    }


def decide_adaptation(score: float, flags: list[str]) -> Optional[dict]:
    """
    Décide d'une action pédagogique selon le score et les signaux détectés.
    Retourne None si aucune intervention n'est nécessaire.
    """
    # Règles expertes — directement issues de ton mémoire Chapitre 2
    if score < 0.3 and "inactivite_prolongee" in flags:
        return {
            "action": "pause_active",
            "message": "Tu sembles fatigué. Prends 2 minutes de pause !",
            "priority": "haute"
        }

    if score < 0.4 and "reponses_lentes" in flags:
        return {
            "action": "simplifier_exercice",
            "message": "Essayons quelque chose de plus simple d'abord.",
            "priority": "moyenne"
        }

    if "clics_repetes" in flags:
        return {
            "action": "afficher_indice",
            "message": "Besoin d'un coup de pouce ?",
            "priority": "moyenne"
        }

    if score > 0.8:
        return {
            "action": "proposer_defi",
            "message": "Excellent travail ! Prêt pour un défi ?",
            "priority": "basse"
        }

    return None  # pas d'intervention nécessaire