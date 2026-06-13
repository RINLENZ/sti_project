"""
Service LLM unifié — priorité : Groq → Ollama → Claude (Anthropic)

Variables d'env :
  GROQ_API_KEY   — clé API gratuite sur console.groq.com
  GROQ_MODEL     — défaut : llama-3.3-70b-versatile
  OLLAMA_HOST    — ex: http://host.docker.internal:11434
  OLLAMA_MODEL   — défaut : mistral
  ANTHROPIC_API_KEY — clé Anthropic (fallback final)
"""

import json
import os
import urllib.request
import urllib.error


# ── Groq ────────────────────────────────────────────────────────────────────

def _call_groq(prompt: str, max_tokens: int = 8000, system: str = "") -> str:
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY non configurée")

    model = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    payload = json.dumps({
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": max_tokens,
    }).encode()

    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "python-httpx/0.27.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read())
            return data["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        raise RuntimeError(f"Groq HTTP {e.code}: {body[:300]}")


# ── Ollama ───────────────────────────────────────────────────────────────────

def _call_ollama(prompt: str, max_tokens: int = 8000, system: str = "") -> str:
    host = os.environ.get("OLLAMA_HOST", "http://host.docker.internal:11434").rstrip("/")
    model = os.environ.get("OLLAMA_MODEL", "mistral")

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    payload = json.dumps({
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {"temperature": 0.7, "num_predict": max_tokens},
    }).encode()

    req = urllib.request.Request(
        f"{host}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read())
            return data["message"]["content"]
    except urllib.error.URLError as e:
        raise RuntimeError(f"Ollama injoignable ({host}): {e.reason}")
    except (KeyError, json.JSONDecodeError) as e:
        raise RuntimeError(f"Réponse Ollama invalide : {e}")


# ── Claude / Anthropic ───────────────────────────────────────────────────────

def _call_claude(prompt: str, max_tokens: int = 8000, system: str = "") -> str:
    import anthropic as _anthropic

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY non configurée")

    client = _anthropic.Anthropic(api_key=api_key)
    kwargs = dict(
        model="claude-haiku-4-5-20251001",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    if system:
        kwargs["system"] = system

    msg = client.messages.create(**kwargs)
    return msg.content[0].text


# ── Vision — correction de copies manuscrites ────────────────────────────────

def corriger_copie_vision(image_bytes: bytes, media_type: str, contenu: dict) -> dict:
    """
    Utilise Claude Vision (claude-sonnet-4-6) pour lire et corriger une copie manuscrite.
    Retourne un dict: {reponses_lues, corrections, score_total, observations}
    """
    import anthropic as _anthropic
    import base64

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY non configurée — correction vision impossible")

    # Construire le barème depuis le contenu de l'épreuve
    bareme = []
    for partie_key in ("partie1", "partie2"):
        partie = contenu.get(partie_key, {})
        for ex in partie.get("exercices", []):
            for q in ex.get("questions", []):
                bareme.append({
                    "id": q.get("id"),
                    "enonce": q.get("enonce", ""),
                    "type": q.get("type", ""),
                    "points": q.get("points", 0),
                    "reponse_correcte": q.get("reponse_correcte", ""),
                    "explication": q.get("explication", ""),
                })

    bareme_text = json.dumps(bareme, ensure_ascii=False, indent=2)

    prompt = f"""Tu es un correcteur d'épreuves scolaires camerounaises (format APC/MINESEC).
Tu reçois une photo d'une copie d'élève manuscrite. Lis attentivement toutes les réponses visibles.

Barème de l'épreuve :
{bareme_text}

Pour chaque question du barème :
1. Lis la réponse manuscrite de l'élève (indique "non répondu" si absent)
2. Compare avec la réponse correcte
3. Attribue un score entre 0 et le maximum de points

Réponds UNIQUEMENT avec un JSON valide sans explication supplémentaire :
{{
  "reponses_lues": {{"qid": "réponse lue textuellement", ...}},
  "corrections": {{
    "qid": {{
      "score": 0.0,
      "max": 0.0,
      "correct": true,
      "reponse_lue": "...",
      "commentaire": "..."
    }}
  }},
  "score_total": 0.0,
  "observations": "Observations générales sur la lisibilité et la qualité de la copie"
}}"""

    image_b64 = base64.standard_b64encode(image_bytes).decode()

    client = _anthropic.Anthropic(api_key=api_key)
    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": image_b64,
                    },
                },
                {"type": "text", "text": prompt},
            ],
        }],
    )

    text = msg.content[0].text.strip()
    # Retire les blocs markdown si présents
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    return json.loads(text)


# ── Détection Ollama ─────────────────────────────────────────────────────────

def _ollama_reachable() -> bool:
    host = os.environ.get("OLLAMA_HOST", "http://host.docker.internal:11434").rstrip("/")
    try:
        req = urllib.request.Request(f"{host}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=2):
            return True
    except Exception:
        return False


# ── Point d'entrée public ────────────────────────────────────────────────────

def call_llm(
    prompt: str,
    max_tokens: int = 8000,
    system: str = "",
) -> tuple[str, str]:
    """
    Appelle le LLM disponible dans l'ordre de priorité.
    Retourne (texte_réponse, nom_du_backend_utilisé).
    Lève HTTPException si aucun backend ne fonctionne.
    """
    from fastapi import HTTPException

    errors: list[str] = []

    # 1. Groq (priorité — gratuit, Llama 3.3 70B, rapide)
    if os.environ.get("GROQ_API_KEY"):
        try:
            return _call_groq(prompt, max_tokens, system), "groq"
        except Exception as e:
            errors.append(f"Groq: {e}")

    # 2. Ollama (local, si installé et joignable)
    if os.environ.get("OLLAMA_HOST") or _ollama_reachable():
        try:
            return _call_ollama(prompt, max_tokens, system), "ollama"
        except Exception as e:
            errors.append(f"Ollama: {e}")

    # 3. Claude — fallback
    if os.environ.get("ANTHROPIC_API_KEY"):
        try:
            return _call_claude(prompt, max_tokens, system), "claude"
        except Exception as e:
            errors.append(f"Claude: {e}")

    raise HTTPException(
        status_code=503,
        detail=(
            "Aucun LLM disponible. Configure au moins une des variables :\n"
            "  • GROQ_API_KEY (gratuit sur console.groq.com)\n"
            "  • OLLAMA_HOST + Ollama installé localement\n"
            "  • ANTHROPIC_API_KEY\n"
            f"Erreurs : {' | '.join(errors)}"
        ),
    )
