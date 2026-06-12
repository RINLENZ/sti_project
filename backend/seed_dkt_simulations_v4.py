"""
seed_dkt_simulations_v2.py — Génération synthétique pour DKT-E (v2 — ASSISTments-like)
======================================================================================

Refonte fondamentale du seedeur pour rendre le DKT effectivement entraînable :

  1. Sessions focalisées sur 1-2 MACRO-KCs (au lieu de sessions multi-KC alternées),
     ce qui permet au LSTM de modéliser la trajectoire d'apprentissage d'une
     compétence. C'est la convention ASSISTments, qui atteint AUC ~0.81.

  2. Humeur INDÉPENDANTE de la performance — chaque apprenant tire une humeur
     de session, qui influence la performance future via un ajustement du
     P_slip. L'engagement multimodal reflète l'humeur, donc engagement[t]
     contient une information prédictive sur correct[t+1] qui n'est PAS
     dans correct[t]. C'est la condition nécessaire pour que le DKT-E
     apporte une valeur ajoutée sur le DKT vanilla.

  3. 4 profils nettement différenciés (excellent / regulier / en_difficulte /
     volatil) — le "volatil" en particulier (30% des apprenants) a une humeur
     très changeante : c'est sur lui que l'engagement va le plus aider.

  4. Volume calibré : 150 apprenants × ~18 sessions × ~8 exercices ≈ 20 000
     interactions. Réparti sur ~10 macro-KCs, ça donne ~2000 par macro-KC,
     équivalent ASSISTments-scale.

Usage
-----
    cd backend
    python seed_dkt_simulations_v2.py --apprenants 150 --reset

    # Variantes :
    python seed_dkt_simulations_v2.py --apprenants 200 --reset --seed 7
    python seed_dkt_simulations_v2.py --apprenants 0 --reset       # juste nettoyer
"""
import os
import sys
import json
import random
import argparse
import uuid
from collections import defaultdict, Counter
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
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
from app.utils import get_kcs, is_valid_kc, get_macro_kc                    # noqa: E402


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Profils — 4 profils nettement séparés sur (vitesse, stabilité)    ║
# ╚════════════════════════════════════════════════════════════════════╝
#
# Axe 1 (vitesse d'apprentissage) : p_learn élevé → l'apprenant maîtrise vite
# Axe 2 (stabilité émotionnelle)  : humeur_std faible → humeur régulière
#
# Le profil "volatil" est conçu spécifiquement pour montrer la valeur ajoutée
# de l'engagement : humeur très changeante, le BKT seul ne peut pas anticiper
# ses chutes/remontées. L'engagement, lui, contient ce signal.

PROFILS = [
    {
        "label":             "excellent",        # Rapide ET stable
        "weight":            0.15,
        "p_init":            (0.30, 0.05),
        "p_learn":           (0.40, 0.04),
        "p_slip":            (0.05, 0.02),
        "p_guess":           (0.22, 0.03),
        "humeur_base":       (0.80, 0.06),       # haut + stable
        "humeur_drift":      0.02,               # change peu en session
        "concentration_base":  (0.80, 0.06),     # très focalisé
        "concentration_drift": 0.02,             # peu de dérive
        "n_sessions":        (18, 30),
        "exos_par_session":  (6, 12),
        "proba_2_macro":     0.20,
    },
    {
        "label":             "regulier",         # Vitesse moyenne, stable
        "weight":            0.25,
        "p_init":            (0.18, 0.05),
        "p_learn":           (0.25, 0.04),
        "p_slip":            (0.10, 0.03),
        "p_guess":           (0.22, 0.03),
        "humeur_base":       (0.62, 0.08),
        "humeur_drift":      0.03,
        "concentration_base":  (0.65, 0.10),
        "concentration_drift": 0.04,
        "n_sessions":        (15, 25),
        "exos_par_session":  (5, 10),
        "proba_2_macro":     0.20,
    },
    {
        "label":             "en_difficulte",    # Apprend lentement, mais stable
        "weight":            0.20,
        "p_init":            (0.08, 0.03),
        "p_learn":           (0.10, 0.03),
        "p_slip":            (0.20, 0.05),
        "p_guess":           (0.20, 0.03),
        "humeur_base":       (0.40, 0.08),
        "humeur_drift":      0.04,
        "concentration_base":  (0.45, 0.10),
        "concentration_drift": 0.05,
        "n_sessions":        (15, 25),
        "exos_par_session":  (5, 10),
        "proba_2_macro":     0.15,
    },
    {
        "label":             "volatil",          # *** profil clé pour DKT-E (v4: amplifié) ***
        "weight":            0.40,               # 40% des apprenants (vs 30% en v2)
        "p_init":            (0.18, 0.06),
        "p_learn":           (0.22, 0.06),
        "p_slip":            (0.15, 0.04),
        "p_guess":           (0.22, 0.04),
        "humeur_base":       (0.55, 0.30),       # std 0.30 (vs 0.20 en v2)
        "humeur_drift":      0.18,               # drift 0.18 (vs 0.08 en v2)
        "concentration_base":  (0.55, 0.25),     # concentration aussi volatile
        "concentration_drift": 0.15,             # forte dérive cognitive en session
        "n_sessions":        (15, 25),
        "exos_par_session":  (5, 10),
        "proba_2_macro":     0.25,
    },
]


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Identité — prénoms et noms camerounais                            ║
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
# ║  Helpers de bas niveau                                              ║
# ╚════════════════════════════════════════════════════════════════════╝

def _gauss_clamp(mu, sigma, lo=0.01, hi=0.99):
    return max(lo, min(hi, random.gauss(mu, sigma)))


def calibrer_params_bkt(profil):
    return {
        "P_init":  _gauss_clamp(*profil["p_init"]),
        "P_learn": _gauss_clamp(*profil["p_learn"]),
        "P_slip":  _gauss_clamp(*profil["p_slip"], lo=0.01, hi=0.49),
        "P_guess": _gauss_clamp(*profil["p_guess"], lo=0.01, hi=0.49),
    }


def choisir_profil():
    weights = [p["weight"] for p in PROFILS]
    return random.choices(PROFILS, weights=weights, k=1)[0]


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Modèle de performance — intègre l'effet de l'humeur               ║
# ╚════════════════════════════════════════════════════════════════════╝

def proba_reussite_avec_etat(p_mastery, humeur, concentration, params_bkt):
    """
    P(correct) = P(mastery) × (1 - P_slip_ajusté)  +  (1 - P(mastery)) × P_guess

    Le P_slip dépend de DEUX signaux latents indépendants (v4):
      - humeur        : reflet émotionnel (anxiété, joie, frustration...)
      - concentration : état cognitif/attentionnel (focus, fatigue mentale)

    Effet combiné sur P_slip :
      ajustement = (0.5 - humeur)        × 0.50
                 + (0.5 - concentration) × 0.50
      = max ±0.50 quand humeur=0 ET concentration=0

    Cette double dépendance est la clé pour que la DÉCOMPOSITION
    multimodale (qui voit séparément les deux signaux via facial/audio/
    behavioral) batte la FUSION (qui les moyenne).
    """
    ajust_humeur = (0.5 - humeur) * 0.50
    ajust_conc   = (0.5 - concentration) * 0.50
    ajustement   = ajust_humeur + ajust_conc
    p_slip_eff   = max(0.01, min(0.75, params_bkt["P_slip"] + ajustement))
    return p_mastery * (1.0 - p_slip_eff) + (1.0 - p_mastery) * params_bkt["P_guess"]


def temps_reponse_realiste(p_mastery, difficulte, profil_label):
    base = 10 + (difficulte - 1) * 5
    incertitude_penalty = (1 - p_mastery) * 30
    bruit_std = 8 if profil_label in ("en_difficulte", "volatil") else 5
    return max(3, int(base + incertitude_penalty + random.gauss(0, bruit_std)))


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Simulation d'engagement — reflète l'humeur                        ║
# ╚════════════════════════════════════════════════════════════════════╝

def simuler_engagement(humeur, concentration, correct, taux_recent, exo_position, n_total):
    """
    Les 4 scores d'engagement reflètent les DEUX signaux latents (v4) :
      - humeur        : émotion (frustration, joie, etc.)
      - concentration : attention (focus, fatigue cognitive)

    Pondération DÉCORRÉLÉE par modalité (v4) — c'est ce qui permet au modèle
    décomposé de reconstruire séparément humeur et concentration, alors que
    fused (moyenne pondérée) les mélange et perd de l'information :

      - facial    : 50% humeur + 50% concentration     (visage = émotion + focus)
      - audio     : 70% humeur + 30% bruit             (voix = surtout émotion)
      - behavioral: 30% humeur + 70% concentration     (clics/idle = surtout focus)

    Cette décorrélation est l'argument scientifique central : le DKT-décomposé
    a accès aux deux signaux latents séparément, alors que le DKT-fused n'en
    voit qu'une combinaison agrégée.
    """
    perf_signal = 1.0 if correct else 0.0
    taux = taux_recent if taux_recent is not None else 0.5

    # Fatigue progressive en fin de session
    fatigue = 0.08 * (exo_position / max(n_total, 1))

    # ── Décomposition : chaque modalité capte un MÉLANGE DIFFÉRENT ────
    facial     = max(0.05, min(0.95, 0.50 * humeur + 0.50 * concentration + random.gauss(0, 0.04) - fatigue))
    audio      = max(0.05, min(0.95, 0.70 * humeur + 0.10 * perf_signal   + random.gauss(0, 0.10) - fatigue))
    behavioral = max(0.05, min(0.95, 0.30 * humeur + 0.70 * concentration + random.gauss(0, 0.05) - fatigue))

    # Fused = moyenne pondérée → perd de l'info par rapport à décomposé
    fused = round(0.40 * facial + 0.30 * audio + 0.30 * behavioral, 3)

    if fused >= 0.75:
        etat = "engagement_eleve"
    elif fused >= 0.55:
        etat = "engagement_modere"
    elif fused >= 0.40:
        etat = "neutre"
    elif fused >= 0.25:
        etat = "frustration" if not correct else "ennui"
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
# ║  Reset                                                              ║
# ╚════════════════════════════════════════════════════════════════════╝

def reset_synthetics(db):
    synth_users = db.query(User).filter(User.is_synthetic == True).all()  # noqa: E712
    synth_ids = [u.id for u in synth_users]
    if not synth_ids:
        print("  ⓘ Aucun apprenant synthétique précédent à supprimer")
        return
    db.query(BKTMastery).filter(BKTMastery.user_id.in_(synth_ids)).delete(synchronize_session=False)
    db.query(ProgressionApprenant).filter(ProgressionApprenant.user_id.in_(synth_ids)).delete(synchronize_session=False)
    db.query(Interaction).filter(Interaction.user_id.in_(synth_ids)).delete(synchronize_session=False)
    db.query(LearningSession).filter(LearningSession.user_id.in_(synth_ids)).delete(synchronize_session=False)
    db.query(User).filter(User.id.in_(synth_ids)).delete(synchronize_session=False)
    db.commit()
    print(f"  🗑  {len(synth_ids)} apprenants synthétiques supprimés (cascade)")


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Chargement & indexation par macro-KC                              ║
# ╚════════════════════════════════════════════════════════════════════╝

def charger_ressources(db):
    """
    Indexe les exercices par MACRO-KC (pas par UA), pour permettre les
    sessions focalisées sur 1 macro-KC qui piochent dans plusieurs UAs.

    Exclut les exos dont le macro-KC est "Autre" (mapping non reconnu)
    car ils ne portent pas une compétence pédagogique identifiable.
    """
    print("\n  Chargement de la hiérarchie pédagogique…")

    ua_list = db.query(UniteApprentissage).all()
    ua_par_id = {ua.id: ua for ua in ua_list}

    # Index principal : macro_kc → liste d'exercices
    exos_par_macro = defaultdict(list)
    ua_par_macro   = defaultdict(set)  # macro → ensemble d'UAs où il apparaît

    for ua in ua_list:
        exos = db.query(Exercice).filter(Exercice.ua_id == ua.id).all()
        for e in exos:
            kcs = get_kcs(e) or []
            primary = next((k for k in kcs if is_valid_kc(k)), None)
            if not primary:
                continue
            macro = get_macro_kc(primary)
            if macro == "Autre":
                continue  # KCs non mappés → on les écarte du seedeur
            exos_par_macro[macro].append(e)
            ua_par_macro[macro].add(ua.id)

    if not exos_par_macro:
        print("\n  ⚠ ERREUR : Aucun exercice avec macro-KC valide trouvé.")
        print("    Vérifie que le mapping MACRO_KC_MAP dans app/utils.py couvre tes KCs.")
        sys.exit(1)

    print(f"  ✓ {len(exos_par_macro)} macro-KCs avec des exercices :")
    for macro, lst in sorted(exos_par_macro.items(), key=lambda x: -len(x[1])):
        print(f"     • {macro:<22} : {len(lst):>3} exos  (sur {len(ua_par_macro[macro])} UAs)")

    return exos_par_macro, ua_par_id


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Création d'un apprenant                                            ║
# ╚════════════════════════════════════════════════════════════════════╝

def creer_apprenant(db, idx, profil):
    sexe = random.choice(["F", "M"])
    prenom = random.choice(PRENOMS_FEM if sexe == "F" else PRENOMS_MASC)
    nom = random.choice(NOMS)
    suffix = uuid.uuid4().hex[:6]

    user = User(
        email          = f"synth.{idx}.{suffix}@dkt.local",
        nom            = nom,
        prenom         = prenom,
        password       = hash_password("synth_no_login"),
        role           = "apprenant",
        niveau_label   = "Première",
        filiere_label  = "F6 BIPE",
        pays           = "Cameroun",
        is_synthetic   = True,
        actif          = True,
    )
    db.add(user)
    db.flush()
    return user


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Simulation d'UNE session focalisée sur 1-2 macro-KCs              ║
# ╚════════════════════════════════════════════════════════════════════╝

def simuler_session_focalisee(
    db, user, profil, params_bkt,
    macros_session, exos_par_macro, ua_par_id,
    bkt_state, session_start_dt,
    humeur_baseline, concentration_baseline,
):
    """
    Une session focalisée :
      - choisit 1 (ou 2) macro-KC cibles
      - tire 5-12 exercices SUR CES MACRO-KCS uniquement
      - simule la trajectoire avec DEUX latents (humeur, concentration) qui
        dérivent indépendamment au sein de la session
    """
    n_min, n_max = profil["exos_par_session"]

    pool = []
    for macro in macros_session:
        pool.extend(exos_par_macro.get(macro, []))
    if not pool:
        return 0, 0

    n_target = min(random.randint(n_min, n_max), len(pool))
    exos_session = random.sample(pool, k=n_target)
    exos_session.sort(key=lambda e: (e.difficulte or 1))

    # ── Latents de session : humeur ET concentration (v4) ─────────────
    humeur_session_start = _gauss_clamp(
        humeur_baseline, profil["humeur_base"][1],
        lo=0.10, hi=0.95
    )
    concentration_session_start = _gauss_clamp(
        concentration_baseline, profil["concentration_base"][1],
        lo=0.10, hi=0.95
    )
    humeur        = humeur_session_start
    concentration = concentration_session_start

    ua_principale = next(iter(exos_session)).ua_id

    session = LearningSession(
        user_id          = user.id,
        cours_id         = str(ua_principale),
        started_at       = session_start_dt,
        nb_interactions  = 0,
    )
    db.add(session)
    db.flush()

    correct_recent      = []
    nb_correct          = 0
    nb_total            = 0
    engagement_scores   = []
    etats_affectifs     = []
    duree_cumulee       = 0
    current_dt          = session_start_dt

    for i, exo in enumerate(exos_session):
        kcs = get_kcs(exo) or []
        primary_kc = next((k for k in kcs if is_valid_kc(k)), None)
        if not primary_kc:
            continue

        p_mastery = bkt_state.get(primary_kc, params_bkt["P_init"])

        # ── DÉRIVE DES LATENTS (humeur et concentration séparément) ──
        humeur += random.gauss(0, profil["humeur_drift"])
        humeur = max(0.10, min(0.95, humeur))
        concentration += random.gauss(0, profil["concentration_drift"])
        concentration = max(0.10, min(0.95, concentration))

        # ── PERFORMANCE (dépend de p_mastery ET des DEUX latents) ────
        p_correct = proba_reussite_avec_etat(p_mastery, humeur, concentration, params_bkt)
        correct = random.random() < p_correct

        # Temps de réponse (impacté par concentration plus que humeur)
        base_temps = temps_reponse_realiste(p_mastery, exo.difficulte or 1, profil["label"])
        t_sec = int(base_temps * (1.0 + (0.5 - concentration) * 0.5))
        t_sec = max(3, t_sec)
        duree_cumulee += t_sec

        # ── ENGAGEMENT (reflète humeur ET concentration séparément) ──
        taux_recent = (
            sum(correct_recent[-5:]) / max(len(correct_recent[-5:]), 1)
            if correct_recent else None
        )
        eng = simuler_engagement(humeur, concentration, correct, taux_recent, i, n_target)
        engagement_scores.append(eng["fused"])
        etats_affectifs.append(eng["etat"])

        for kc in kcs:
            if not is_valid_kc(kc):
                continue
            current_p = bkt_state.get(kc, params_bkt["P_init"])
            bkt_state[kc] = update_knowledge(current_p, correct, params=params_bkt)

        current_dt = current_dt + timedelta(seconds=t_sec)

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

        progression = ProgressionApprenant(
            user_id        = user.id,
            ua_id          = exo.ua_id,
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
                    ua_id         = exo.ua_id,
                    p_mastery     = bkt_state[kc],
                    nb_tentatives = 1,
                    nb_correct    = 1 if correct else 0,
                    last_updated  = current_dt,
                )
                db.add(bkt_row)
            else:
                bkt_row.p_mastery     = bkt_state[kc]
                bkt_row.nb_tentatives = (bkt_row.nb_tentatives or 0) + 1
                bkt_row.nb_correct    = (bkt_row.nb_correct or 0) + (1 if correct else 0)
                bkt_row.last_updated  = current_dt

        correct_recent.append(1 if correct else 0)
        nb_correct += 1 if correct else 0
        nb_total += 1

    if nb_total > 0:
        session.ended_at        = current_dt
        session.duree_secondes  = duree_cumulee
        session.nb_interactions = nb_total
        session.score_final     = round((nb_correct / nb_total) * 100, 1)
        session.score_engagement     = round(sum(engagement_scores) / len(engagement_scores), 3)
        session.score_facial         = session.score_engagement
        session.score_audio          = session.score_engagement
        session.score_comportemental = session.score_engagement
        session.etat_affectif = Counter(etats_affectifs).most_common(1)[0][0]
    else:
        db.delete(session)

    return nb_correct, nb_total


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Parcours complet d'un apprenant                                    ║
# ╚════════════════════════════════════════════════════════════════════╝

def simuler_parcours(db, user, profil, params_bkt, exos_par_macro, ua_par_id):
    """Simule N sessions étalées sur 1-3 mois, avec DEUX latents de baseline propres."""
    n_min, n_max = profil["n_sessions"]
    n_sessions = random.randint(n_min, n_max)

    # ── Latents baseline de l'apprenant (humeur + concentration) ──────
    humeur_baseline        = _gauss_clamp(*profil["humeur_base"],        lo=0.10, hi=0.95)
    concentration_baseline = _gauss_clamp(*profil["concentration_base"], lo=0.10, hi=0.95)

    bkt_state = {}

    macros_disponibles = sorted(exos_par_macro.keys())
    n_macros = min(3, len(macros_disponibles))
    macros_favoris = random.sample(macros_disponibles, k=n_macros)
    weights = [3.0 if m in macros_favoris else 1.0 for m in macros_disponibles]

    days_ago_start = random.randint(60, 90)
    current_dt = datetime.now(timezone.utc) - timedelta(days=days_ago_start)

    total_correct = 0
    total_exos = 0

    for s in range(n_sessions):
        nb_macros_session = 2 if random.random() < profil["proba_2_macro"] else 1
        macros_session = random.choices(
            macros_disponibles, weights=weights, k=nb_macros_session
        )
        macros_session = list(set(macros_session))

        nb_c, nb_t = simuler_session_focalisee(
            db, user, profil, params_bkt,
            macros_session, exos_par_macro, ua_par_id,
            bkt_state, current_dt,
            humeur_baseline, concentration_baseline,
        )
        total_correct += nb_c
        total_exos += nb_t

        gap_days = random.randint(1, 5)
        gap_hours = max(8, min(22, int(random.gauss(20, 3))))
        current_dt = current_dt + timedelta(days=gap_days)
        current_dt = current_dt.replace(hour=gap_hours, minute=random.randint(0, 59))

    return total_correct, total_exos


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Récap                                                              ║
# ╚════════════════════════════════════════════════════════════════════╝

def afficher_recap(db):
    n_synth = db.query(User).filter(User.is_synthetic == True).count()  # noqa: E712
    synth_ids = [u.id for u in db.query(User.id).filter(User.is_synthetic == True).all()]  # noqa: E712
    n_sess  = db.query(LearningSession).filter(LearningSession.user_id.in_(synth_ids)).count()
    n_inter = db.query(Interaction).filter(Interaction.user_id.in_(synth_ids)).count()
    n_prog  = db.query(ProgressionApprenant).filter(ProgressionApprenant.user_id.in_(synth_ids)).count()
    n_bkt   = db.query(BKTMastery).filter(BKTMastery.user_id.in_(synth_ids)).count()
    moy_sess_apr = n_sess / max(n_synth, 1)
    moy_exo_sess = n_inter / max(n_sess, 1)
    moy_exo_apr = n_inter / max(n_synth, 1)

    print()
    print("  ┌────────────────────────────────────────────────────┐")
    print("  │  Récapitulatif (apprenants synthétiques)           │")
    print("  ├────────────────────────────────────────────────────┤")
    print(f"  │  Apprenants            : {n_synth:>5}                       │")
    print(f"  │  Sessions              : {n_sess:>5}   ({moy_sess_apr:.1f}/apprenant)        │")
    print(f"  │  Interactions          : {n_inter:>5}   ({moy_exo_sess:.1f}/session)         │")
    print(f"  │                                  ({moy_exo_apr:.1f}/apprenant)       │")
    print(f"  │  Progressions exo      : {n_prog:>5}                       │")
    print(f"  │  Lignes BKT (KC×user)  : {n_bkt:>5}                       │")
    print("  └────────────────────────────────────────────────────┘")
    print()
    print("  ✓ Pour exporter le dataset DKT-E :")
    print("      python export_dataset.py")


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Main                                                              ║
# ╚════════════════════════════════════════════════════════════════════╝

def main():
    parser = argparse.ArgumentParser(
        description="Seedeur DKT v2 — sessions focalisées + humeur indépendante",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--apprenants", type=int, default=150)
    parser.add_argument("--reset", action="store_true")
    parser.add_argument("--seed", type=int, default=None)
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)
        print(f"  ⓘ Seed aléatoire fixée : {args.seed}")

    db_url = os.environ.get("DATABASE_URL", "")
    host = db_url.split("@")[-1].split("/")[0] if "@" in db_url else db_url
    print(f"\n  🔌 Connexion : {host}")

    db = SessionLocal()
    try:
        if args.reset:
            reset_synthetics(db)

        exos_par_macro, ua_par_id = charger_ressources(db)

        if args.apprenants <= 0:
            print("  ⓘ --apprenants <= 0 : pas de génération.")
            return

        print(f"\n  🎲 Génération de {args.apprenants} apprenants synthétiques (v2)…")
        compteur_profils = Counter()
        for i in range(args.apprenants):
            profil = choisir_profil()
            compteur_profils[profil["label"]] += 1

            params_bkt = calibrer_params_bkt(profil)
            user = creer_apprenant(db, i, profil)
            simuler_parcours(db, user, profil, params_bkt, exos_par_macro, ua_par_id)

            if (i + 1) % 10 == 0:
                db.commit()
                print(f"     ✓ {i+1}/{args.apprenants} apprenants générés")

        db.commit()
        if args.apprenants % 10 != 0:
            print(f"     ✓ {args.apprenants}/{args.apprenants} apprenants générés")

        print("\n  Répartition par profil :")
        for label in ["excellent", "regulier", "en_difficulte", "volatil"]:
            print(f"     • {label:<16} : {compteur_profils[label]:>3}")

        afficher_recap(db)

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
