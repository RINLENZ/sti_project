"""
Correction automatique des réponses texte libre.
Stratégie en deux niveaux :
  1. sentence-transformers (si disponible) — similarité neurale multilingue
  2. TF-IDF + cosine (scikit-learn) — fallback léger, fonctionne sans GPU

Chargement paresseux — modèles initialisés au premier appel.
"""
import re
import logging
from typing import Optional

# numpy chargé uniquement si sentence-transformers est disponible (chemin neural)
_np = None
def _get_np():
    global _np
    if _np is None:
        try:
            import numpy as _numpy_mod
            _np = _numpy_mod
        except ImportError:
            pass
    return _np

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    _sklearn_available = True
except ImportError:
    _sklearn_available = False

logger = logging.getLogger(__name__)

# ── Niveau 1 : sentence-transformers (optionnel) ─────────────────────────────
_st_model = None
_st_available = None   # None=inconnu, True/False=testé

def _get_st_model():
    global _st_model, _st_available
    if _st_available is False:
        return None
    if _st_model is not None:
        return _st_model
    try:
        from sentence_transformers import SentenceTransformer
        logger.info("Chargement sentence-transformers…")
        _st_model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
        _st_available = True
        logger.info("sentence-transformers ✓")
        return _st_model
    except Exception as e:
        logger.info(f"sentence-transformers indisponible ({e}) — TF-IDF activé")
        _st_available = False
        return None


# ── Niveau 2 : TF-IDF (si scikit-learn disponible) ────────────────────────────
_tfidf = TfidfVectorizer(
    analyzer="char_wb",   # n-grammes de caractères — robuste aux fautes d'orthographe
    ngram_range=(2, 4),
    min_df=1,
    strip_accents="unicode",
) if _sklearn_available else None

def _tfidf_sim(a: str, b: str) -> float:
    """Cosine similarity TF-IDF entre deux textes courts."""
    if not _sklearn_available or _tfidf is None:
        return _jaccard_sim(a, b)
    try:
        mat = _tfidf.fit_transform([a.lower(), b.lower()])
        return float(cosine_similarity(mat[0], mat[1])[0, 0])
    except Exception:
        return _jaccard_sim(a, b)

def _jaccard_sim(a: str, b: str) -> float:
    """Jaccard sur tokens — dernier recours."""
    ta = set(re.findall(r'\w+', a.lower()))
    tb = set(re.findall(r'\w+', b.lower()))
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)

def similarite_semantique(texte_a: str, texte_b: str) -> tuple[float, str]:
    """
    Retourne (similarité [0,1], méthode utilisée).
    Essaie sentence-transformers d'abord, puis TF-IDF.
    """
    model = _get_st_model()
    if model is not None:
        np = _get_np()
        if np is not None:
            try:
                vecs = model.encode([texte_a.strip(), texte_b.strip()], convert_to_numpy=True)
                sim  = float(np.dot(vecs[0], vecs[1]) / (np.linalg.norm(vecs[0]) * np.linalg.norm(vecs[1]) + 1e-9))
                return round(sim, 4), "neural"
            except Exception:
                pass
    sim = _tfidf_sim(texte_a, texte_b)
    return round(sim, 4), "tfidf"


# ── Barème similarité → ratio de points ──────────────────────────────────────
# Seuils différenciés selon la méthode (TF-IDF est moins précis)

def _sim_to_ratio(sim: float, methode: str) -> float:
    if methode == "neural":
        if sim >= 0.82: return 1.00
        if sim >= 0.68: return 0.75
        if sim >= 0.52: return 0.50
        if sim >= 0.38: return 0.25
        return 0.00
    else:  # tfidf — seuils plus bas car métrique différente
        if sim >= 0.70: return 1.00
        if sim >= 0.50: return 0.75
        if sim >= 0.35: return 0.50
        if sim >= 0.20: return 0.25
        return 0.00


def _split_items(texte: str) -> list[str]:
    """Découpe un texte listé en items individuels."""
    items = re.split(r'[\n;,]+', texte)
    return [i.strip() for i in items if i.strip()]


# ── Scoreur principal ─────────────────────────────────────────────────────────

SEMANTIC_TYPES = {"reponse_libre", "definition", "listage", "code", "question_directe"}

def scorer_question(
    type_q: str,
    reponse_donnee: str,
    reponse_correcte: str,
    max_points: float,
    explication: str = "",
) -> dict:
    """
    Retourne un dict de correction pour une question à réponse libre.
    Champs : score, max, auto, correct, similarite, methode, explication.
    """
    donnee   = (reponse_donnee   or "").strip()
    correcte = (reponse_correcte or "").strip()

    if not donnee:
        return {
            "score": 0.0, "max": max_points, "auto": True,
            "correct": False, "similarite": 0.0,
            "methode": "vide", "explication": "Aucune réponse fournie.",
        }

    # ── Listage : comparaison item par item ───────────────────────────────────
    if type_q == "listage":
        items_ref  = _split_items(correcte)
        items_etud = _split_items(donnee)
        if items_ref:
            total_ratio = 0.0
            detail = []
            for ref_item in items_ref:
                best_sim, best_methode = max(
                    (similarite_semantique(ref_item, e) for e in items_etud),
                    key=lambda x: x[0], default=(0.0, "tfidf")
                )
                ratio = _sim_to_ratio(best_sim, best_methode)
                total_ratio += ratio
                detail.append({"item": ref_item, "sim": round(best_sim, 3), "ratio": ratio})

            ratio_moyen = total_ratio / len(items_ref)
            earned = round(ratio_moyen * max_points, 2)
            _, methode_used = similarite_semantique(donnee, correcte)
            return {
                "score": earned, "max": max_points, "auto": True,
                "correct": earned >= max_points * 0.75,
                "similarite": round(ratio_moyen, 3),
                "methode": f"semantique_listage_{methode_used}",
                "detail_items": detail,
                "explication": explication,
            }

    # ── Correspondance exacte d'abord (définitions courtes) ──────────────────
    if donnee.lower() == correcte.lower():
        return {
            "score": max_points, "max": max_points, "auto": True,
            "correct": True, "similarite": 1.0,
            "methode": "exact", "explication": explication,
        }

    # ── Code : boost mots-clés + similarité ──────────────────────────────────
    sim, methode = similarite_semantique(donnee, correcte)
    if type_q == "code":
        kw = re.findall(r'\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|def |return |if |for |while )\b', donnee, re.I)
        sim = min(1.0, sim + min(0.10, len(kw) * 0.02))

    ratio  = _sim_to_ratio(sim, methode)
    earned = round(ratio * max_points, 2)
    methode_label = f"semantique_{methode}" if type_q != "code" else f"semantique_code_{methode}"

    return {
        "score": earned, "max": max_points, "auto": True,
        "correct": earned >= max_points * 0.75,
        "similarite": round(sim, 4),
        "methode": methode_label,
        "explication": explication,
    }


# ── Re-correction complète d'une copie ───────────────────────────────────────

def recorriger_copie(
    contenu_epreuve: dict,
    reponses: dict,
    corrections_existantes: dict,
) -> tuple[dict, float, float, float]:
    """
    Re-score toutes les questions sémantiques, conserve les scores exacts.
    Retourne (corrections_màj, score_total, score_p1, score_p2).
    """
    corrections = dict(corrections_existantes)
    score_p1 = 0.0
    score_p2 = 0.0

    for partie_key in ("partie1", "partie2"):
        partie = contenu_epreuve.get(partie_key, {})
        for ex in partie.get("exercices", []):
            for q in ex.get("questions", []):
                qid    = q.get("id", "")
                type_q = q.get("type", "")
                points = float(q.get("points", 0))
                reponse = reponses.get(qid, "")

                if type_q in SEMANTIC_TYPES and reponse:
                    corr = scorer_question(
                        type_q=type_q,
                        reponse_donnee=reponse,
                        reponse_correcte=q.get("reponse_correcte", ""),
                        max_points=points,
                        explication=q.get("explication", ""),
                    )
                    corrections[qid] = corr
                elif qid in corrections:
                    corr = corrections[qid]
                else:
                    continue

                earned = corr.get("score") or 0.0
                if partie_key == "partie1":
                    score_p1 += earned
                else:
                    score_p2 += earned

    score_total = round(score_p1 + score_p2, 2)
    return corrections, score_total, round(score_p1, 2), round(score_p2, 2)
