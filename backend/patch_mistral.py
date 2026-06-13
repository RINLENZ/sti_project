"""
patch_mistral.py — Ajoute le support Mistral à llm_service.py
==============================================================

Modifications appliquées (idempotentes, peut être lancé plusieurs fois) :

  1. Ajout de la fonction _call_mistral() après _call_claude()
  2. Insertion de Mistral dans la cascade call_llm() :
     ordre nouveau : Groq → Mistral → Ollama → Claude

Usage :
    cd backend
    python patch_mistral.py

Le script crée une sauvegarde llm_service.py.bak avant modification.
"""
import re
import sys
from pathlib import Path


LLM_SERVICE_PATH = Path(__file__).parent / "app" / "services" / "llm_service.py"


MISTRAL_FUNCTION = '''
def _call_mistral(prompt: str, max_tokens: int = 8000, system: str = "") -> str:
    """
    Appel Mistral API (https://console.mistral.ai).
    Variables d'environnement :
      MISTRAL_API_KEY  — clé API (free tier 1B tokens/mois)
      MISTRAL_MODEL    — défaut : mistral-small-latest
    """
    import requests
    api_key = os.environ.get("MISTRAL_API_KEY", "")
    if not api_key:
        raise RuntimeError("MISTRAL_API_KEY non configurée")

    model = os.environ.get("MISTRAL_MODEL", "mistral-small-latest")
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    response = requests.post(
        "https://api.mistral.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type":  "application/json",
        },
        json={
            "model":       model,
            "messages":    messages,
            "max_tokens":  max_tokens,
            "temperature": 0.7,
        },
        timeout=30,
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"Mistral API erreur {response.status_code} : {response.text[:200]}"
        )
    return response.json()["choices"][0]["message"]["content"]

'''

MISTRAL_CASCADE_BLOCK = '''    # 2. Mistral (gratuit, free tier 1B tokens/mois, excellent en français)
    if os.environ.get("MISTRAL_API_KEY"):
        try:
            return _call_mistral(prompt, max_tokens, system), "mistral"
        except Exception as e:
            errors.append(f"Mistral: {e}")
'''


def main():
    if not LLM_SERVICE_PATH.exists():
        print(f"❌ {LLM_SERVICE_PATH} introuvable.")
        sys.exit(1)

    source = LLM_SERVICE_PATH.read_text(encoding="utf-8")

    # ── Étape 1 : ajouter _call_mistral() si pas déjà présent ────────
    if "def _call_mistral(" not in source:
        # Insérer juste avant la fonction _call_claude() ou _call_ollama()
        # selon ce qui vient en premier
        ancrage = re.search(r"^def _call_claude\(", source, re.MULTILINE)
        if not ancrage:
            print("❌ Fonction _call_claude() introuvable — structure inattendue")
            sys.exit(1)
        insert_pos = ancrage.start()
        source = source[:insert_pos] + MISTRAL_FUNCTION + source[insert_pos:]
        print("  ✓ Fonction _call_mistral() ajoutée")
    else:
        print("  ⓘ _call_mistral() déjà présente — pas de modification")

    # ── Étape 2 : insérer Mistral dans la cascade call_llm() ─────────
    if 'return _call_mistral(' not in source or '_call_mistral(prompt, max_tokens, system), "mistral"' not in source:
        # On cherche la cascade — pattern : 1. Groq ... 2. Ollama ...
        # On veut insérer Mistral entre Groq et Ollama
        # Pattern à matcher : le bloc Ollama (qui commence par "    # 2. Ollama" ou "    # X. Ollama")
        ollama_pattern = re.compile(
            r"(    # \d+\. Ollama.*?(?:errors\.append.*?)\n)",
            re.DOTALL,
        )
        match = ollama_pattern.search(source)
        if match:
            # Renuméroter : Ollama devient 3., Claude devient 4.
            modified = source[:match.start()] + MISTRAL_CASCADE_BLOCK + source[match.start():]
            # Renuméroter les commentaires
            modified = re.sub(
                r"^(    # )2(\. Ollama)",
                r"\g<1>3\g<2>",
                modified,
                count=1,
                flags=re.MULTILINE,
            )
            modified = re.sub(
                r"^(    # )3(\. Claude)",
                r"\g<1>4\g<2>",
                modified,
                count=1,
                flags=re.MULTILINE,
            )
            source = modified
            print("  ✓ Mistral inséré dans la cascade (position 2)")
        else:
            print("  ⚠ Pattern Ollama non trouvé dans call_llm() — vérifier manuellement")
    else:
        print("  ⓘ Mistral déjà dans la cascade — pas de modification")

    # ── Sauvegarde + écriture ─────────────────────────────────────────
    backup_path = LLM_SERVICE_PATH.with_suffix(".py.bak_pre_mistral")
    if not backup_path.exists():
        backup_path.write_text(
            LLM_SERVICE_PATH.read_text(encoding="utf-8"),
            encoding="utf-8",
        )
        print(f"  ✓ Sauvegarde : {backup_path.name}")

    LLM_SERVICE_PATH.write_text(source, encoding="utf-8")
    print(f"  ✓ {LLM_SERVICE_PATH.name} mis à jour")

    # ── Vérification ──────────────────────────────────────────────────
    import ast
    try:
        ast.parse(source)
        print("  ✓ Syntaxe Python valide")
    except SyntaxError as e:
        print(f"  ❌ ERREUR DE SYNTAXE : {e}")
        print(f"     Restaure avec : cp {backup_path} {LLM_SERVICE_PATH}")
        sys.exit(1)

    print()
    print("✅ Patch Mistral appliqué avec succès.")
    print("   Cascade finale : Groq → Mistral → Ollama → Claude")


if __name__ == "__main__":
    main()
