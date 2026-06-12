"""
seed_dkt_simulations.py — Génération de données synthétiques pour le DKT-E
========================================================================

Objectif
--------
Augmenter le corpus d'entraînement du DKT-Engagement en simulant N
apprenants synthétiques au comportement réaliste : leurs réponses suivent
un modèle BKT calibré individuellement, leur engagement est cohérent avec
leur performance récente et leur profil émotionnel.

Les apprenants synthétiques sont marqués `is_synthetic = True` afin d'être :
  - inclus dans l'entraînement du DKT (augmentation de données)
  - exclus de l'évaluation finale (qui ne porte QUE sur les vrais apprenants)

Tables alimentées (exactement comme le ferait un vrai apprenant) :
  - users (avec is_synthetic = True)
  - learning_sessions (avec scores agrégés calculés)
  - interactions (events 'response' avec exercice_id, correct, time_seconds)
  - progressions (avec engagement_fused/facial/audio/behavioral par exercice)
  - bkt_mastery (P(maîtrise) par compétence APC)

Usage
-----
    cd backend
    python seed_dkt_simulations.py --apprenants 200 --reset

    # Pour ajouter sans supprimer les synthétiques précédents :
    python seed_dkt_simulations.py --apprenants 50

    # Aide :
    python seed_dkt_simulations.py --help

Sécurité
--------
Le seedeur ne touche JAMAIS les utilisateurs réels (is_synthetic = FALSE).
L'option --reset ne supprime que les apprenants synthétiques.
"""
import sys
import os
import random
import argparse
import uuid
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
# Priorité : DATABASE_URL déjà dans l'env > DATABASE_URL_LOCAL > défaut docker
if not os.environ.get("DATABASE_URL"):
    os.environ["DATABASE_URL"] = os.environ.get(
        "DATABASE_URL_LOCAL",
        "postgresql://sti_user:sti_pass_2024@localhost:5432/sti_db"
    )
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal                                       # noqa: E402
from app.models.user import User                                            # noqa: E402
from app.models.session import LearningSession                              # noqa: E402
from app.models.interaction import Interaction                              # noqa: E402
from app.models.cours import (                                              # noqa: E402
    Exercice, UniteApprentissage, ProgressionApprenant, BKTMastery,
)
from app.models.referentiel import Niveau, Filiere, Cycle, Ordre            # noqa: E402,F401
from app.services.auth_service import hash_password                         # noqa: E402
from app.services.bkt_service import update_knowledge                       # noqa: E402
from app.utils import get_kcs, is_valid_kc                                  # noqa: E402


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Profils d'apprenants — calibrés sur la littérature                ║
# ╚════════════════════════════════════════════════════════════════════╝
#
# Chaque profil définit :
#   - les paramètres BKT moyens (P_init, P_learn, P_slip, P_guess)
#     et leur variance (chaque apprenant tire ses propres valeurs)
#   - le niveau d'engagement de base et sa variabilité
#   - le nombre attendu de sessions par apprenant
#   - la probabilité d'abandon en cours de session

PROFILS = [
    {
        "label":              "regulier",        # Apprenant moyen, progresse normalement
        "weight":             0.35,
        "p_init":             (0.15, 0.05),
        "p_learn":            (0.18, 0.05),
        "p_slip":             (0.10, 0.03),
        "p_guess":            (0.20, 0.04),
        "engagement_base":    (0.65, 0.10),
        "n_sessions":         (3, 6),
        "exos_par_session":   (4, 10),
        "proba_abandon":      0.05,
    },
    {
        "label":              "excellent",       # Apprend vite, engagé
        "weight":             0.20,
        "p_init":             (0.25, 0.08),
        "p_learn":            (0.30, 0.06),
        "p_slip":             (0.05, 0.02),
        "p_guess":            (0.22, 0.04),
        "engagement_base":    (0.80, 0.08),
        "n_sessions":         (4, 8),
        "exos_par_session":   (6, 14),
        "proba_abandon":      0.02,
    },
    {
        "label":              "irregulier",      # Bons jours / mauvais jours
        "weight":             0.20,
        "p_init":             (0.15, 0.06),
        "p_learn":            (0.18, 0.07),
        "p_slip":             (0.15, 0.06),
        "p_guess":            (0.20, 0.05),
        "engagement_base":    (0.55, 0.20),     # forte variance = "humeur changeante"
        "n_sessions":         (2, 6),
        "exos_par_session":   (3, 10),
        "proba_abandon":      0.10,
    },
    {
        "label":              "en_difficulte",   # Lent, taux d'erreur élevé
        "weight":             0.15,
        "p_init":             (0.08, 0.03),
        "p_learn":            (0.10, 0.04),
        "p_slip":             (0.20, 0.05),
        "p_guess":            (0.18, 0.04),
        "engagement_base":    (0.45, 0.12),
        "n_sessions":         (2, 5),
        "exos_par_session":   (3, 8),
        "proba_abandon":      0.15,
    },
    {
        "label":              "decrocheur",      # Abandonne vite, peu de sessions
        "weight":             0.10,
        "p_init":             (0.10, 0.04),
        "p_learn":            (0.12, 0.05),
        "p_slip":             (0.18, 0.06),
        "p_guess":            (0.20, 0.05),
        "engagement_base":    (0.35, 0.15),
        "n_sessions":         (1, 3),
        "exos_par_session":   (2, 6),
        "proba_abandon":      0.30,
    },
]


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Identité — prénoms et noms à consonance camerounaise              ║
# ╚════════════════════════════════════════════════════════════════════╝

PRENOMS_FEM = [
    "Alice", "Carole", "Christelle", "Émilienne", "Estelle", "Fabienne",
    "Grace", "Inès", "Joëlle", "Karine", "Lydie", "Marie", "Nadège",
    "Pélagie", "Rachelle", "Sandrine", "Thérèse", "Valérie", "Yvette",
    "Zita", "Christiane", "Solange", "Marlène", "Honorine", "Patricia",
]
PRENOMS_MASC = [
    "Boris", "Christian", "Daniel", "Emmanuel", "Fabrice", "Gabriel",
    "Hervé", "Idriss", "Jean", "Loïc", "Marcel", "Nicodème", "Olivier",
    "Patrick", "Roméo", "Stéphane", "Théodore", "Ulrich", "Vincent",
    "Wilfried", "Xavier", "Yann", "Bertrand", "Joseph", "Désiré",
]
NOMS = [
    "Mballa", "Tchoufa", "Eyinga", "Nkoumbi", "Mbarga", "Owona", "Atangana",
    "Bessala", "Talla", "Toko", "Bekanga", "Manga", "Ondoa", "Mbida",
    "Onana", "Fouda", "Nkomo", "Tchinda", "Wamba", "Ekambi", "Tagne",
    "Kameni", "Kuate", "Tchassem", "Foe", "Kemajou", "Bidias", "Ngono",
    "Ekobo", "Toung", "Ze", "Mfou", "Engueme", "Ebanga", "Nlend", "Etoa",
    "Mbatchou", "Ekoutou", "Mvogo", "Biyong", "Ngassa", "Tchana", "Sone",
]


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Helpers de calibration                                            ║
# ╚════════════════════════════════════════════════════════════════════╝

def _gauss_clamp(moyenne, ecart_type, lo=0.01, hi=0.99):
    """Tire une valeur gaussienne bornée."""
    return max(lo, min(hi, random.gauss(moyenne, ecart_type)))


def calibrer_params_bkt(profil):
    """Pour un profil donné, tire les 4 paramètres BKT propres à l'apprenant.

    Chaque apprenant a sa propre "personnalité d'apprentissage", c'est plus
    réaliste qu'un BKT universel et c'est exactement ce que le DKT est censé
    apprendre à modéliser implicitement.
    """
    return {
        "P_init":  _gauss_clamp(*profil["p_init"]),
        "P_learn": _gauss_clamp(*profil["p_learn"]),
        "P_slip":  _gauss_clamp(*profil["p_slip"], lo=0.01, hi=0.49),
        "P_guess": _gauss_clamp(*profil["p_guess"], lo=0.01, hi=0.49),
    }


def choisir_profil():
    """Tire un profil d'apprenant selon les poids déclarés."""
    weights = [p["weight"] for p in PROFILS]
    return random.choices(PROFILS, weights=weights, k=1)[0]


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Simulation d'une réponse à un exercice                            ║
# ╚════════════════════════════════════════════════════════════════════╝

def proba_reussite(p_mastery, params):
    """P(réponse correcte) = P(maîtrise) * (1-slip) + (1-P(maîtrise)) * guess.

    Formule classique du BKT (Corbett & Anderson, 1994). Le DKT, lui, va
    apprendre à modéliser cette probabilité de façon plus fine via un LSTM.
    """
    return p_mastery * (1 - params["P_slip"]) + (1 - p_mastery) * params["P_guess"]


def temps_reponse_realiste(p_mastery, difficulte, profil_label):
    """Génère un temps de réponse en secondes (réaliste pour un QCM lycée).

    - Maîtrise élevée → réponse rapide
    - Difficulté élevée → réponse plus lente
    - Profil 'en_difficulte' / 'decrocheur' → variance plus grande
    """
    # Base : 10s pour un exercice maîtrisé facile, +5s par niveau de difficulté
    base = 10 + (difficulte - 1) * 5
    # Pénalité quand non maîtrisé : peut atteindre +30s
    incertitude_penalty = (1 - p_mastery) * 30
    # Bruit gaussien
    bruit_std = 8 if profil_label in ("en_difficulte", "decrocheur") else 5
    bruit = random.gauss(0, bruit_std)
    return max(3, int(base + incertitude_penalty + bruit))


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Simulation d'engagement réaliste                                  ║
# ╚════════════════════════════════════════════════════════════════════╝

def simuler_engagement(profil, taux_recent, position_dans_session, n_total, correct, temps_reponse):
    """Calcule les 4 scores d'engagement cohérents pour cet exercice.

    Modèle de cohérence :
      - Score de base = engagement_base ± variance du profil
      - Modulé par le taux de réussite récent (perf basse → baisse engagement)
      - Modulé par la fatigue (position avancée dans la session → baisse)
      - Si réponse correcte : petit boost ; si incorrecte : petite baisse
      - Si temps très long : signal de confusion → baisse

    Retourne dict avec fused, facial, audio, behavioral, etat_affectif.
    """
    base_mean, base_std = profil["engagement_base"]

    # ── Score "fused" — celui qui sera vu par le DKT-E ────────────────
    score = random.gauss(base_mean, base_std)

    # Modulation par perf récente
    if taux_recent is not None:
        # Taux < 0.4 → -0.20 ; taux > 0.7 → +0.10
        if taux_recent < 0.4:
            score -= 0.20 * (0.4 - taux_recent) / 0.4
        elif taux_recent > 0.7:
            score += 0.10 * (taux_recent - 0.7) / 0.3

    # Fatigue progressive : -0.15 max à la fin d'une session de 10+ exos
    if n_total > 0:
        fatigue = 0.15 * (position_dans_session / max(n_total, 1))
        score -= fatigue

    # Réponse récente
    if correct:
        score += random.uniform(0.02, 0.06)
    else:
        score -= random.uniform(0.02, 0.06)

    # Temps de réponse anormalement long → confusion
    if temps_reponse > 90:
        score -= 0.08

    # Borne [0.05, 0.95]
    score = max(0.05, min(0.95, score))

    # ── Décomposition en 3 modalités cohérentes avec le score fused ───
    # On simule comme si MediaPipe + VAD + comportemental remontaient
    # des signaux corrélés mais légèrement bruités autour de "score".
    facial     = max(0.05, min(0.95, score + random.gauss(0, 0.06)))
    audio      = max(0.05, min(0.95, score + random.gauss(0, 0.08)))
    behavioral = max(0.05, min(0.95, score + random.gauss(0, 0.05)))

    # Renormalisation pour respecter α·facial + β·audio + γ·behavioral = score
    # avec α=0.40, β=0.30, γ=0.30 (cf engagement_service.WEIGHTS_DEFAULT)
    # On corrige légèrement pour que la combinaison pondérée colle au score.
    fused = round(0.40 * facial + 0.30 * audio + 0.30 * behavioral, 3)

    # ── État affectif dominant ───────────────────────────────────────
    if fused >= 0.75:
        etat = "engagement_eleve"
    elif fused >= 0.55:
        etat = "engagement_modere"
    elif fused >= 0.40:
        etat = "neutre"
    elif fused >= 0.25:
        if taux_recent is not None and taux_recent < 0.4:
            etat = "frustration"
        else:
            etat = "ennui"
    else:
        etat = "decrochage"

    return {
        "fused":      fused,
        "facial":     round(facial, 3),
        "audio":      round(audio, 3),
        "behavioral": round(behavioral, 3),
        "etat":       etat,
    }


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Reset des apprenants synthétiques                                 ║
# ╚════════════════════════════════════════════════════════════════════╝

def reset_synthetics(db):
    """Supprime apprenants synthétiques et toutes leurs données associées."""
    synth_users = db.query(User).filter(User.is_synthetic == True).all()  # noqa: E712
    synth_ids = [u.id for u in synth_users]
    if not synth_ids:
        print("  ⓘ Aucun apprenant synthétique précédent à supprimer")
        return

    # Suppression cascade — ordre respectant les contraintes FK
    db.query(BKTMastery).filter(BKTMastery.user_id.in_(synth_ids)).delete(synchronize_session=False)
    db.query(ProgressionApprenant).filter(ProgressionApprenant.user_id.in_(synth_ids)).delete(synchronize_session=False)
    db.query(Interaction).filter(Interaction.user_id.in_(synth_ids)).delete(synchronize_session=False)
    db.query(LearningSession).filter(LearningSession.user_id.in_(synth_ids)).delete(synchronize_session=False)
    db.query(User).filter(User.id.in_(synth_ids)).delete(synchronize_session=False)
    db.commit()
    print(f"  🗑  {len(synth_ids)} apprenants synthétiques supprimés (cascade)")


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Chargement de la hiérarchie pédagogique existante                 ║
# ╚════════════════════════════════════════════════════════════════════╝

def charger_ressources(db):
    """Charge UAs et exercices disponibles, indexés par UA.

    On n'utilise QUE les UAs qui ont au moins 1 exercice avec un KC valide,
    sinon la simulation ne pourra rien faire.

    Retourne :
      - ua_list : liste d'UniteApprentissage utilisables
      - exos_par_ua : dict ua_id -> [Exercice, ...] (avec KCs valides uniquement)
    """
    print("\n  Chargement de la hiérarchie pédagogique…")

    ua_list = db.query(UniteApprentissage).all()
    exos_par_ua = {}

    for ua in ua_list:
        exos = (
            db.query(Exercice)
            .filter(Exercice.ua_id == ua.id)
            .order_by(Exercice.difficulte, Exercice.ordre)
            .all()
        )
        # Filtre : on ne garde que les exercices avec un KC principal valide
        exos_valides = [e for e in exos if is_valid_kc((get_kcs(e) or [None])[0])]
        if exos_valides:
            exos_par_ua[ua.id] = exos_valides

    ua_utilisables = [ua for ua in ua_list if ua.id in exos_par_ua]

    if not ua_utilisables:
        print("\n  ⚠ ERREUR : Aucune UA n'a d'exercice avec KC valide.")
        print("    Vérifie que tu as bien lancé seed_cours.py ou seed_programme.py avant.")
        sys.exit(1)

    nb_exos_total = sum(len(v) for v in exos_par_ua.values())
    print(f"  ✓ {len(ua_utilisables)} UAs utilisables, {nb_exos_total} exercices au total")
    return ua_utilisables, exos_par_ua


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Création d'un apprenant synthétique                               ║
# ╚════════════════════════════════════════════════════════════════════╝

def creer_apprenant(db, idx, profil):
    """Crée un User synthétique avec une identité plausible."""
    sexe = random.choice(["F", "M"])
    prenom = random.choice(PRENOMS_FEM if sexe == "F" else PRENOMS_MASC)
    nom = random.choice(NOMS)

    # Suffixe court unique pour éviter toute collision d'email même sans --reset
    suffix = uuid.uuid4().hex[:6]

    user = User(
        email           = f"synth.{idx}.{suffix}@dkt.local",
        nom             = nom,
        prenom          = prenom,
        password        = hash_password("synth_no_login"),  # compte non utilisé pour login
        role            = "apprenant",
        niveau_label    = "Première",
        filiere_label   = "F6 BIPE",
        pays            = "Cameroun",
        is_synthetic    = True,
        actif           = True,
    )
    db.add(user)
    db.flush()  # nécessaire pour obtenir user.id avant les FK
    return user


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Simulation d'une session d'apprentissage                          ║
# ╚════════════════════════════════════════════════════════════════════╝

def simuler_session(
    db, user, profil, params_bkt, ua_choisie, exos_disponibles,
    bkt_state, session_start_dt,
):
    """Simule une session : 3-15 exercices, état BKT/engagement mis à jour.

    `bkt_state` est un dict {kc: p_mastery} persistant entre sessions du même
    apprenant. C'est ce qui rend la trajectoire d'apprentissage cohérente :
    ce qui est maîtrisé à la session N reste maîtrisé en session N+1.

    Retourne (nb_correct, nb_total, engagement_final_session).
    """
    n_min, n_max = profil["exos_par_session"]
    # Garde contre les UAs trop petites pour le profil demandé
    n_max_eff = min(n_max, len(exos_disponibles))
    if n_max_eff <= 0:
        return 0, 0  # ne devrait pas arriver, charger_ressources filtre déjà
    n_target = random.randint(min(n_min, n_max_eff), n_max_eff)

    # Mélange et limitation au nombre cible
    exos_session = random.sample(exos_disponibles, k=n_target)

    # ── Création de la LearningSession ────────────────────────────────
    session = LearningSession(
        user_id        = user.id,
        cours_id       = str(ua_choisie.id),  # cours_id est un String (cf modèle)
        started_at     = session_start_dt,
        nb_interactions = 0,  # mis à jour à la fin
    )
    db.add(session)
    db.flush()

    # ── État courant de la session ────────────────────────────────────
    correct_recent = []      # 5 derniers : utilisé pour engagement
    nb_correct = 0
    nb_total = 0
    engagement_scores = []
    etats_affectifs = []
    duree_cumulee = 0  # secondes
    current_dt = session_start_dt

    # ── Boucle exercices ──────────────────────────────────────────────
    for i, exo in enumerate(exos_session):
        # Décrocheur : abandonne en cours
        if random.random() < profil["proba_abandon"]:
            break

        kcs = get_kcs(exo) or []
        primary_kc = kcs[0] if kcs else None
        if not is_valid_kc(primary_kc):
            continue

        # P(maîtrise) actuelle sur le KC principal
        p_mastery = bkt_state.get(primary_kc, params_bkt["P_init"])

        # Tirer la réponse
        p_correct = proba_reussite(p_mastery, params_bkt)
        correct = random.random() < p_correct

        # Temps de réponse
        t_sec = temps_reponse_realiste(p_mastery, exo.difficulte or 1, profil["label"])
        duree_cumulee += t_sec

        # Engagement de l'exercice
        taux_recent = sum(correct_recent[-5:]) / max(len(correct_recent[-5:]), 1) if correct_recent else None
        eng = simuler_engagement(
            profil, taux_recent, position_dans_session=i, n_total=n_target,
            correct=correct, temps_reponse=t_sec,
        )
        engagement_scores.append(eng["fused"])
        etats_affectifs.append(eng["etat"])

        # Mise à jour BKT — utilise la VRAIE fonction du service de prod
        new_p = update_knowledge(p_mastery, correct, params=params_bkt)
        # Mise à jour de l'état BKT pour tous les KCs de l'exercice
        # (l'exercice peut évaluer plusieurs compétences)
        for kc in kcs:
            if is_valid_kc(kc):
                current_p = bkt_state.get(kc, params_bkt["P_init"])
                bkt_state[kc] = update_knowledge(current_p, correct, params=params_bkt)

        # Décalage temporel pour cet exercice
        current_dt = current_dt + timedelta(seconds=t_sec)

        # ── Persistence : Interaction de type 'response' ────────────
        # Ce format est exactement celui qu'attend export_dataset.py
        # pour reconstruire le time_seconds.
        interaction = Interaction(
            session_id = session.id,
            user_id    = user.id,
            timestamp  = current_dt,
            type       = "response",
            data       = {
                "exercice_id":  str(exo.id),
                "correct":      correct,
                "time_seconds": t_sec,
                "difficulte":   exo.difficulte,
            },
        )
        db.add(interaction)

        # ── Persistence : ProgressionApprenant (avec engagement per-exo)
        progression = ProgressionApprenant(
            user_id        = user.id,
            ua_id          = ua_choisie.id,
            exercice_id    = exo.id,
            statut         = "termine",
            score          = (exo.points or 10) if correct else 0,
            tentatives     = 1,
            reponse_donnee = exo.reponse_correcte if correct else "(simulé incorrect)",
            correct        = correct,
            date_debut     = current_dt - timedelta(seconds=t_sec),
            date_fin       = current_dt,
            session_id     = session.id,
            engagement_fused      = eng["fused"],
            engagement_facial     = eng["facial"],
            engagement_audio      = eng["audio"],
            engagement_behavioral = eng["behavioral"],
        )
        db.add(progression)

        # ── BKTMastery : INSERT ou UPDATE par (user, competence) ────
        for kc in kcs:
            if not is_valid_kc(kc):
                continue
            bkt_row = (
                db.query(BKTMastery)
                .filter(BKTMastery.user_id == user.id, BKTMastery.competence == kc)
                .first()
            )
            if bkt_row is None:
                bkt_row = BKTMastery(
                    user_id       = user.id,
                    competence    = kc,
                    ua_id         = ua_choisie.id,
                    p_mastery     = bkt_state[kc],
                    nb_tentatives = 1,
                    nb_correct    = 1 if correct else 0,
                    last_updated  = current_dt,
                )
                db.add(bkt_row)
            else:
                bkt_row.p_mastery = bkt_state[kc]
                bkt_row.nb_tentatives = (bkt_row.nb_tentatives or 0) + 1
                bkt_row.nb_correct = (bkt_row.nb_correct or 0) + (1 if correct else 0)
                bkt_row.last_updated = current_dt

        # Comptages
        correct_recent.append(1 if correct else 0)
        nb_correct += 1 if correct else 0
        nb_total += 1

    # ── Finalisation de la LearningSession ────────────────────────────
    if nb_total > 0:
        session.ended_at        = current_dt
        session.duree_secondes  = duree_cumulee
        session.nb_interactions = nb_total
        session.score_final     = round((nb_correct / nb_total) * 100, 1)
        session.score_engagement     = round(sum(engagement_scores) / len(engagement_scores), 3)
        session.score_facial         = session.score_engagement   # approx — moyenne facial ≈ fused
        session.score_audio          = session.score_engagement
        session.score_comportemental = session.score_engagement
        # État affectif dominant de la session
        from collections import Counter
        session.etat_affectif = Counter(etats_affectifs).most_common(1)[0][0] if etats_affectifs else "neutre"
    else:
        # Session vide (décrocheur immédiat) — on la supprime pour ne pas polluer
        db.delete(session)

    return nb_correct, nb_total


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Simulation du parcours complet d'un apprenant                     ║
# ╚════════════════════════════════════════════════════════════════════╝

def simuler_parcours(db, user, profil, params_bkt, ua_list, exos_par_ua):
    """Simule 1-N sessions étalées sur quelques semaines."""
    n_min, n_max = profil["n_sessions"]
    n_sessions = random.randint(n_min, n_max)

    # État BKT persistant entre sessions
    bkt_state = {}

    # Première session : entre 30 et 60 jours avant aujourd'hui
    # (timestamps réalistes pour l'historique)
    days_ago_start = random.randint(30, 60)
    current_dt = datetime.now(timezone.utc) - timedelta(days=days_ago_start)

    total_correct = 0
    total_exos = 0

    for s in range(n_sessions):
        # Choix d'une UA aléatoire pour cette session
        ua = random.choice(ua_list)
        exos = exos_par_ua[ua.id]

        nb_c, nb_t = simuler_session(
            db, user, profil, params_bkt, ua, exos, bkt_state, current_dt,
        )
        total_correct += nb_c
        total_exos += nb_t

        # Espacement aléatoire entre sessions : 1-7 jours
        gap_days = random.randint(1, 7)
        # Heure de la session suivante : préférence pour soir scolaire (16h-21h)
        gap_hours = random.gauss(20, 3)  # heure cible
        current_dt = current_dt + timedelta(days=gap_days)
        current_dt = current_dt.replace(hour=max(8, min(22, int(gap_hours))), minute=random.randint(0, 59))

    return total_correct, total_exos


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Récap                                                              ║
# ╚════════════════════════════════════════════════════════════════════╝

def afficher_recap(db):
    """Affiche les statistiques finales après seeding."""
    n_synth = db.query(User).filter(User.is_synthetic == True).count()  # noqa: E712
    synth_ids = [u.id for u in db.query(User.id).filter(User.is_synthetic == True).all()]  # noqa: E712
    n_sess = db.query(LearningSession).filter(LearningSession.user_id.in_(synth_ids)).count()
    n_inter = db.query(Interaction).filter(Interaction.user_id.in_(synth_ids)).count()
    n_prog = db.query(ProgressionApprenant).filter(ProgressionApprenant.user_id.in_(synth_ids)).count()
    n_bkt = db.query(BKTMastery).filter(BKTMastery.user_id.in_(synth_ids)).count()

    print()
    print("  ┌────────────────────────────────────────────────────┐")
    print("  │  Récapitulatif (apprenants synthétiques)           │")
    print("  ├────────────────────────────────────────────────────┤")
    print(f"  │  Apprenants            : {n_synth:>5}                       │")
    print(f"  │  Sessions              : {n_sess:>5}                       │")
    print(f"  │  Interactions          : {n_inter:>5}                       │")
    print(f"  │  Progressions exo      : {n_prog:>5}                       │")
    print(f"  │  Lignes BKT (KC×user)  : {n_bkt:>5}                       │")
    print("  └────────────────────────────────────────────────────┘")
    print()
    print("  ✓ Pour exporter le dataset DKT-E :")
    print("      python export_dataset.py")
    print()
    print("  ✓ Pour supprimer les synthétiques :")
    print("      python seed_dkt_simulations.py --apprenants 0 --reset")
    print()


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Main                                                              ║
# ╚════════════════════════════════════════════════════════════════════╝

def main():
    parser = argparse.ArgumentParser(
        description="Générateur de données synthétiques pour le DKT-E",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--apprenants", type=int, default=200,
                        help="Nombre d'apprenants synthétiques à créer (défaut: 200)")
    parser.add_argument("--reset", action="store_true",
                        help="Supprimer les apprenants synthétiques précédents avant")
    parser.add_argument("--seed", type=int, default=None,
                        help="Seed aléatoire pour reproductibilité (défaut: aléatoire)")
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)
        print(f"  ⓘ Seed aléatoire fixée : {args.seed}")

    db_url = os.environ.get("DATABASE_URL", "")
    host = db_url.split("@")[-1].split("/")[0] if "@" in db_url else db_url
    print(f"\n  🔌 Connexion : {host}")

    db = SessionLocal()
    try:
        # Étape 1 — reset si demandé
        if args.reset:
            reset_synthetics(db)

        # Étape 2 — chargement des ressources
        ua_list, exos_par_ua = charger_ressources(db)

        # Étape 3 — génération
        if args.apprenants <= 0:
            print("  ⓘ --apprenants <= 0 : pas de génération, sortie.")
            return

        print(f"\n  🎲 Génération de {args.apprenants} apprenants synthétiques…")
        compteur_profils = {}
        for i in range(args.apprenants):
            profil = choisir_profil()
            compteur_profils[profil["label"]] = compteur_profils.get(profil["label"], 0) + 1

            params_bkt = calibrer_params_bkt(profil)
            user = creer_apprenant(db, i, profil)
            simuler_parcours(db, user, profil, params_bkt, ua_list, exos_par_ua)

            # Commit par paquets de 20 pour ne pas garder une transaction géante
            if (i + 1) % 20 == 0:
                db.commit()
                print(f"     ✓ {i+1}/{args.apprenants} apprenants générés")

        db.commit()
        if args.apprenants % 20 != 0:
            print(f"     ✓ {args.apprenants}/{args.apprenants} apprenants générés")

        # Étape 4 — répartition par profil
        print("\n  Répartition par profil :")
        for label, count in sorted(compteur_profils.items()):
            print(f"     • {label:<16} : {count:>3}")

        # Étape 5 — récap final
        afficher_recap(db)

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
