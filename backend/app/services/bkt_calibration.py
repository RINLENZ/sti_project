"""
Calibration des paramètres BKT par EM (Expectation-Maximization).

Algorithme standard BKT (Corbett & Anderson, 1994) avec forward-backward.
Prend des séquences de réponses (True/False) par apprenant/compétence
et retourne les 4 paramètres optimaux : P_init, P_learn, P_slip, P_guess.
"""
import math
from typing import List, Tuple


def _forward(seq: List[bool], params: Tuple[float, float, float, float]):
    """
    Passe avant — calcule alpha[t][k] = P(obs[0..t], K_t=k), normalisé.
    Retourne (alphas, scales) pour la stabilité numérique.
    """
    p_init, p_learn, p_slip, p_guess = params
    alphas, scales = [], []

    for t, obs in enumerate(seq):
        p_ek  = (1 - p_slip) if obs else p_slip       # P(obs | K=1)
        p_enk = p_guess      if obs else (1 - p_guess) # P(obs | K=0)

        if t == 0:
            a1 = p_init * p_ek
            a0 = (1 - p_init) * p_enk
        else:
            prev = alphas[-1]
            a1 = (prev[1] + prev[0] * p_learn) * p_ek
            a0 = prev[0] * (1 - p_learn) * p_enk

        scale = a0 + a1 or 1e-300
        scales.append(scale)
        alphas.append([a0 / scale, a1 / scale])

    return alphas, scales


def _backward(seq: List[bool], params: Tuple, scales: List[float]):
    """
    Passe arrière — calcule beta[t][k] normalisé par les mêmes scales.
    """
    p_init, p_learn, p_slip, p_guess = params
    T = len(seq)
    betas = [[1.0, 1.0]] + [[0.0, 0.0]] * (T - 1)
    betas = [[0.0, 0.0]] * T
    betas[T - 1] = [1.0, 1.0]

    for t in range(T - 2, -1, -1):
        obs_next  = seq[t + 1]
        p_ek_next  = (1 - p_slip) if obs_next else p_slip
        p_enk_next = p_guess      if obs_next else (1 - p_guess)

        betas[t][1] = p_ek_next  * betas[t + 1][1]
        betas[t][0] = (p_enk_next * (1 - p_learn) * betas[t + 1][0]
                       + p_ek_next  * p_learn       * betas[t + 1][1])

        s = scales[t + 1]
        betas[t][0] /= s
        betas[t][1] /= s

    return betas


def em_bkt(sequences: List[List[bool]], n_iter: int = 100, tol: float = 1e-5) -> dict:
    """
    Estime P_init, P_learn, P_slip, P_guess par EM sur les séquences observées.

    Args:
        sequences : liste de listes de booléens (True = bonne réponse)
        n_iter    : nombre maximum d'itérations EM
        tol       : critère de convergence (delta total des paramètres)

    Returns:
        dict avec paramètres calibrés, log-vraisemblance, nb d'itérations.
    """
    seqs = [s for s in sequences if len(s) >= 2]
    if not seqs:
        return {
            "error": "Données insuffisantes — il faut au moins 2 réponses par étudiant/compétence.",
            "n_sequences": len(sequences),
        }

    # Paramètres initiaux (littérature)
    p_init  = 0.10
    p_learn = 0.20
    p_slip  = 0.10
    p_guess = 0.20

    log_lik = float('-inf')

    for iteration in range(n_iter):
        params = (p_init, p_learn, p_slip, p_guess)

        # ── Accumulateurs E-step ──────────────────────────────────────
        n_i1 = n_i0 = 0.0        # compteurs P_init
        n_lrn = n_stay0 = 0.0    # compteurs P_learn
        n_slip_k = n_ok_k = 0.0  # compteurs P_slip
        n_gss = n_wrong_nk = 0.0 # compteurs P_guess
        log_lik_new = 0.0

        for seq in seqs:
            alphas, scales = _forward(seq, params)
            betas          = _backward(seq, params, scales)
            log_lik_new   += sum(math.log(max(s, 1e-300)) for s in scales)

            T = len(seq)

            # ── Posteriors marginaux gamma[t][k] ──────────────────────
            gammas = []
            for t in range(T):
                denom = alphas[t][0] * betas[t][0] + alphas[t][1] * betas[t][1]
                if denom < 1e-300:
                    gammas.append([0.5, 0.5])
                else:
                    gammas.append([
                        alphas[t][0] * betas[t][0] / denom,
                        alphas[t][1] * betas[t][1] / denom,
                    ])

            # ── Accumulation ─────────────────────────────────────────
            n_i1 += gammas[0][1]
            n_i0 += gammas[0][0]

            for t, obs in enumerate(seq):
                g0, g1 = gammas[t]
                if obs:
                    n_ok_k  += g1
                    n_gss   += g0
                else:
                    n_slip_k += g1
                    n_wrong_nk += g0

            # ── Posteriors joints xi pour P_learn ─────────────────────
            for t in range(T - 1):
                obs_n = seq[t + 1]
                p_ek  = (1 - p_slip) if obs_n else p_slip
                p_enk = p_guess      if obs_n else (1 - p_guess)

                xi_00 = alphas[t][0] * (1 - p_learn) * p_enk * betas[t + 1][0]
                xi_01 = alphas[t][0] * p_learn        * p_ek  * betas[t + 1][1]
                xi_11 = alphas[t][1] *                  p_ek  * betas[t + 1][1]

                xi_sum = xi_00 + xi_01 + xi_11 or 1e-300
                n_lrn   += xi_01 / xi_sum
                n_stay0 += xi_00 / xi_sum

        # ── M-step ───────────────────────────────────────────────────
        def safe_ratio(a, b):
            return a / b if b > 1e-300 else 0.5

        p_init_n  = safe_ratio(n_i1,     n_i1 + n_i0)
        p_learn_n = safe_ratio(n_lrn,    n_lrn + n_stay0)
        p_slip_n  = safe_ratio(n_slip_k, n_slip_k + n_ok_k)
        p_guess_n = safe_ratio(n_gss,    n_gss + n_wrong_nk)

        # Clamp : slip < 0.4, guess < 0.5, init et learn dans (0.01, 0.99)
        p_init_n  = max(0.01, min(0.99, p_init_n))
        p_learn_n = max(0.01, min(0.99, p_learn_n))
        p_slip_n  = max(0.01, min(0.40, p_slip_n))
        p_guess_n = max(0.01, min(0.50, p_guess_n))

        delta = (abs(p_init_n  - p_init)
                 + abs(p_learn_n - p_learn)
                 + abs(p_slip_n  - p_slip)
                 + abs(p_guess_n - p_guess))

        p_init, p_learn, p_slip, p_guess = p_init_n, p_learn_n, p_slip_n, p_guess_n
        log_lik = log_lik_new

        if delta < tol:
            break

    return {
        "P_init":         round(p_init,  4),
        "P_learn":        round(p_learn, 4),
        "P_slip":         round(p_slip,  4),
        "P_guess":        round(p_guess, 4),
        "log_likelihood": round(log_lik, 2),
        "n_sequences":    len(seqs),
        "n_observations": sum(len(s) for s in seqs),
        "iterations":     iteration + 1,
    }
