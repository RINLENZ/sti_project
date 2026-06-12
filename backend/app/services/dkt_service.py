"""
dkt_service.py — Inférence DKT côté serveur (numpy pur, sans onnxruntime)
=========================================================================

Pourquoi numpy pur plutôt qu'onnxruntime ?
  - Le modèle est minuscule (LSTM 1 couche × 48 unités, ~6K paramètres).
  - onnxruntime ajouterait ~200 Mo de dépendance sur Render (contrainte mémoire).
  - Réimplémenter le forward LSTM en numpy démontre la maîtrise du modèle
    et garantit un démarrage instantané du service.

Rôle pédagogique dans Alisha
---------------------------
Le DKT prédit P(réussite au prochain exercice) pour chacune des 9 macro-
compétences APC, à partir de l'historique séquentiel de l'apprenant.

Ces prédictions servent à ordonner les exercices selon la ZONE PROXIMALE DE
DÉVELOPPEMENT (Vygotsky, 1978) : on présente en priorité les exercices dont la
maîtrise prédite est proche de 0.5 — ni trop faciles (déjà acquis, ennui),
ni trop difficiles (hors de portée, découragement).

Complémentarité avec le BKT
--------------------------
  - BKT  : KC fin (214), choisit l'UA recommandée (existant)
  - DKT  : macro-KC (9), affine l'ordre des exercices DANS une session
Les deux modèles sont complémentaires, pas redondants.

Le modèle déployé est `dkt_fused.pth` (meilleure AUC de validation, 0.659).
"""
import os
import json
import math
from pathlib import Path
from threading import Lock

import numpy as np


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Chargement paresseux du modèle (singleton thread-safe)            ║
# ╚════════════════════════════════════════════════════════════════════╝

_MODEL_DIR = Path(__file__).parent.parent.parent / "models" / "dkt"
_MODEL_PATH = _MODEL_DIR / "dkt_fused.npz"

_model_cache = None
_model_lock = Lock()


def _load_model():
    """
    Charge les poids du .npz UNE SEULE FOIS (singleton).

    Le .npz est un format numpy natif : AUCUNE dépendance torch nécessaire,
    même au chargement. Le .npz est généré depuis le .pth par le script
    convert_dkt_to_npz.py (à lancer une fois après chaque entraînement).
    """
    global _model_cache
    if _model_cache is not None:
        return _model_cache

    with _model_lock:
        if _model_cache is not None:  # double-check après acquisition du lock
            return _model_cache

        if not _MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Modèle DKT introuvable : {_MODEL_PATH}. "
                f"Génère-le avec : python convert_dkt_to_npz.py"
            )

        # Chargement numpy pur — pas de torch
        data = np.load(_MODEL_PATH, allow_pickle=True)

        weights = {
            "W_ih":  data["W_ih"].astype(np.float64),   # (4H, input_dim)
            "W_hh":  data["W_hh"].astype(np.float64),   # (4H, H)
            "b_ih":  data["b_ih"].astype(np.float64),   # (4H,)
            "b_hh":  data["b_hh"].astype(np.float64),   # (4H,)
            "W_out": data["W_out"].astype(np.float64),  # (n_skills, H)
            "b_out": data["b_out"].astype(np.float64),  # (n_skills,)
        }

        hidden_size = weights["W_hh"].shape[1]
        input_dim   = weights["W_ih"].shape[1]
        n_skills    = weights["W_out"].shape[0]

        # kc2idx est sauvé comme un dict sérialisé dans le .npz
        kc2idx = data["kc2idx"].item()  # .item() pour désérialiser le dict
        idx2kc = {v: k for k, v in kc2idx.items()}

        _model_cache = {
            "weights":     weights,
            "hidden_size": hidden_size,
            "input_dim":   input_dim,
            "n_skills":    n_skills,
            "kc2idx":      kc2idx,
            "idx2kc":      idx2kc,
            "mode":        str(data["mode"]) if "mode" in data else "fused",
        }
        return _model_cache


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Forward LSTM en numpy pur                                          ║
# ╚════════════════════════════════════════════════════════════════════╝

def _sigmoid(x):
    # Version stable numériquement (évite l'overflow sur les grands négatifs)
    return np.where(x >= 0, 1.0 / (1.0 + np.exp(-x)), np.exp(x) / (1.0 + np.exp(x)))


def _lstm_forward(X, weights, hidden_size):
    """
    Forward d'un LSTM 1 couche sur une séquence (numpy pur).

    Reproduit EXACTEMENT la formulation PyTorch nn.LSTM :
        i = σ(W_ii x + b_ii + W_hi h + b_hi)
        f = σ(W_if x + b_if + W_hf h + b_hf)
        g = tanh(W_ig x + b_ig + W_hg h + b_hg)
        o = σ(W_io x + b_io + W_ho h + b_ho)
        c' = f ⊙ c + i ⊙ g
        h' = o ⊙ tanh(c')

    Les portes sont concaténées dans l'ordre PyTorch [i, f, g, o].

    Args:
        X : séquence d'entrée (T, input_dim)
        weights : dict des poids
        hidden_size : H

    Returns:
        H_seq : tous les états cachés (T, H)
    """
    T = X.shape[0]
    H = hidden_size

    W_ih = weights["W_ih"]  # (4H, input_dim)
    W_hh = weights["W_hh"]  # (4H, H)
    b_ih = weights["b_ih"]  # (4H,)
    b_hh = weights["b_hh"]  # (4H,)

    h = np.zeros(H, dtype=np.float64)
    c = np.zeros(H, dtype=np.float64)
    H_seq = np.zeros((T, H), dtype=np.float64)

    for t in range(T):
        x_t = X[t]  # (input_dim,)
        # Calcul des 4 portes d'un coup : (4H,)
        gates = W_ih @ x_t + b_ih + W_hh @ h + b_hh

        # Découpage dans l'ordre PyTorch [i, f, g, o]
        i_gate = _sigmoid(gates[0*H:1*H])
        f_gate = _sigmoid(gates[1*H:2*H])
        g_gate = np.tanh(gates[2*H:3*H])
        o_gate = _sigmoid(gates[3*H:4*H])

        c = f_gate * c + i_gate * g_gate
        h = o_gate * np.tanh(c)
        H_seq[t] = h

    return H_seq


def _build_input_vector(macro_kc_idx, correct, engagement_fused, n_skills, input_dim):
    """
    Construit le vecteur d'entrée pour un pas de temps, au format du modèle 'fused'.

    Encodage Piech (2Q) :
      - si correct   : on active la dimension (n_skills + macro_kc_idx)
      - si incorrect : on active la dimension (macro_kc_idx)
    Puis on ajoute l'engagement fused en dernière dimension.

    Total : 2 × n_skills + 1 = input_dim (19 pour 9 macro-KCs)
    """
    x = np.zeros(input_dim, dtype=np.float64)
    offset = n_skills if correct else 0
    x[macro_kc_idx + offset] = 1.0
    # Dernière dimension = engagement fused (mode 'fused')
    x[2 * n_skills] = engagement_fused if engagement_fused is not None else 0.5
    return x


# ╔════════════════════════════════════════════════════════════════════╗
# ║  API publique du service                                            ║
# ╚════════════════════════════════════════════════════════════════════╝

def predict_mastery(historique):
    """
    Prédit P(réussite au prochain exercice) pour chacune des 9 macro-compétences.

    Args:
        historique : liste de dicts, chacun avec :
            - "macro_kc"   (str)   : macro-compétence de l'exercice
            - "correct"    (bool)  : réponse correcte ou non
            - "engagement" (float) : score d'engagement fused (0-1), optionnel

            La liste doit être TRIÉE chronologiquement (plus ancien → plus récent).

    Returns:
        dict {macro_kc: proba_prédite} pour les 9 macro-compétences.
        Si l'historique est vide, retourne 0.5 partout (incertitude maximale).
    """
    model = _load_model()
    weights     = model["weights"]
    hidden_size = model["hidden_size"]
    input_dim   = model["input_dim"]
    n_skills    = model["n_skills"]
    kc2idx      = model["kc2idx"]
    idx2kc      = model["idx2kc"]

    # Cas sans historique : on ne peut rien prédire → incertitude max
    if not historique:
        return {kc: 0.5 for kc in kc2idx.keys()}

    # ── Construction de la séquence d'entrée ──────────────────────────
    X_list = []
    for h in historique:
        macro = h.get("macro_kc")
        if macro not in kc2idx:
            continue  # macro-KC inconnu du modèle → on saute
        x = _build_input_vector(
            macro_kc_idx     = kc2idx[macro],
            correct          = bool(h.get("correct")),
            engagement_fused = h.get("engagement"),
            n_skills         = n_skills,
            input_dim        = input_dim,
        )
        X_list.append(x)

    if not X_list:
        return {kc: 0.5 for kc in kc2idx.keys()}

    X = np.stack(X_list)  # (T, input_dim)

    # ── Forward LSTM ──────────────────────────────────────────────────
    H_seq = _lstm_forward(X, weights, hidden_size)

    # On utilise le DERNIER état caché (résume toute la séquence)
    h_last = H_seq[-1]  # (H,)

    # ── Couche de sortie : logits → probabilités ──────────────────────
    logits = weights["W_out"] @ h_last + weights["b_out"]  # (n_skills,)
    probs  = _sigmoid(logits)

    return {idx2kc[i]: float(probs[i]) for i in range(n_skills)}


def zpd_score(proba_predite, cible=0.5, largeur=2.0):
    """
    Score ZPD (Zone Proximale de Développement) pour une maîtrise prédite.

    Maximal (=1.0) quand la maîtrise prédite est à la cible (0.5),
    décroît linéairement en s'en éloignant.

      proba=0.5 → score 1.0   (zone optimale : juste assez difficile)
      proba=0.25 ou 0.75 → score 0.5
      proba=0.0 ou 1.0 → score 0.0  (trop dur ou trop facile)

    Args:
        proba_predite : P(réussite) prédite par le DKT (0-1)
        cible         : centre de la ZPD (0.5 par défaut)
        largeur       : pente de décroissance (2.0 = linéaire jusqu'aux bords)

    Returns:
        score ZPD entre 0.0 et 1.0
    """
    return max(0.0, 1.0 - abs(proba_predite - cible) * largeur)


def rank_exercices_zpd(exercices, predictions, get_macro_kc_fn):
    """
    Trie une liste d'exercices selon leur score ZPD basé sur les prédictions DKT.

    Args:
        exercices : liste d'objets exercice (doivent avoir un moyen de
                    récupérer leur macro-KC via get_macro_kc_fn)
        predictions : dict {macro_kc: proba} issu de predict_mastery()
        get_macro_kc_fn : fonction(exercice) → macro_kc (str)

    Returns:
        liste de tuples (exercice, zpd_score, proba_predite, macro_kc),
        triée par zpd_score décroissant (meilleur exercice ZPD en premier).
    """
    scored = []
    for exo in exercices:
        macro = get_macro_kc_fn(exo)
        proba = predictions.get(macro, 0.5)  # 0.5 si macro inconnu
        score = zpd_score(proba)
        scored.append((exo, score, proba, macro))

    # Tri par score ZPD décroissant ; en cas d'égalité, difficulté croissante
    scored.sort(key=lambda t: (-t[1], getattr(t[0], "difficulte", 1) or 1))
    return scored


def is_model_available():
    """Indique si le modèle DKT est entraîné et chargeable (pour /health)."""
    try:
        _load_model()
        return True
    except (FileNotFoundError, KeyError, Exception):
        return False


def get_model_info():
    """Retourne les métadonnées du modèle pour debug / monitoring."""
    try:
        model = _load_model()
        return {
            "available":   True,
            "mode":        model["mode"],
            "hidden_size": model["hidden_size"],
            "input_dim":   model["input_dim"],
            "n_skills":    model["n_skills"],
            "macro_kcs":   list(model["kc2idx"].keys()),
        }
    except Exception as e:
        return {"available": False, "error": str(e)}
