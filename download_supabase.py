"""
Télécharge les frames et clips audio depuis Supabase Storage
vers les dossiers locaux backend/data/frames/ et backend/data/audio/.

Script 100% lecture seule côté Supabase :
  - utilise uniquement .list() et .download()
  - ne supprime RIEN ni sur Supabase ni en local
  - saute les fichiers déjà présents localement (pas d'écrasement)

Usage :
    python download_supabase.py
"""
import os, sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERREUR : SUPABASE_URL et SUPABASE_SERVICE_KEY manquants dans .env")
    sys.exit(1)

from supabase import create_client
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

BUCKET     = "training-data"
FRAMES_DIR = Path("backend/data/frames")
AUDIO_DIR  = Path("backend/data/audio")

ETATS = [
    "engagement_eleve", "engagement_faible",
    "confusion", "frustration", "ennui", "neutre",
]
COMMANDES = [
    "aide", "oui", "non", "repeter",
    "incompris", "lentement", "bruit_silence",
]


def compter_supabase(prefix: str, ext: str) -> int:
    total, offset, limit = 0, 0, 1000
    while True:
        files = sb.storage.from_(BUCKET).list(prefix, {"limit": limit, "offset": offset})
        if not files:
            break
        total += sum(1 for f in files if (f.get("name") or "").endswith(ext))
        if len(files) < limit:
            break
        offset += limit
    return total


def compter_local(dossier: Path, ext: str) -> int:
    if not dossier.exists():
        return 0
    return len(list(dossier.glob(f"*{ext}")))


def telecharger(prefix: str, ext: str, dest_dir: Path):
    """Télécharge uniquement les fichiers absents en local. Ne supprime rien."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    deja_la = {f.name for f in dest_dir.glob(f"*{ext}")}

    offset, limit, downloaded, skipped = 0, 1000, 0, 0
    while True:
        files = sb.storage.from_(BUCKET).list(prefix, {"limit": limit, "offset": offset})
        if not files:
            break
        for f in files:
            name = f.get("name", "")
            if not name.endswith(ext):
                continue
            if name in deja_la:
                skipped += 1
                continue
            data = sb.storage.from_(BUCKET).download(f"{prefix}/{name}")
            (dest_dir / name).write_bytes(data)
            downloaded += 1
            print(f"    ↓ {name[:50]}...")
        if len(files) < limit:
            break
        offset += limit
    return downloaded, skipped


# ═══════════════════════════════════════════════════════════
print("=" * 62)
print("  COMPTAGE — Supabase vs Local")
print("=" * 62)

print("\n📸  Frames (émotions) :")
print(f"  {'État':<25}  {'Supabase':>9}  {'Local':>7}  {'Total':>7}")
print("  " + "-" * 50)
total_sb_f = total_loc_f = 0
for etat in ETATS:
    sb_n  = compter_supabase(f"frames/{etat}", ".jpg")
    loc_n = compter_local(FRAMES_DIR / etat, ".jpg")
    total_sb_f  += sb_n
    total_loc_f += loc_n
    print(f"  {etat:<25}  {sb_n:>9}  {loc_n:>7}  {sb_n+loc_n:>7}")
print("  " + "-" * 50)
print(f"  {'TOTAL':<25}  {total_sb_f:>9}  {total_loc_f:>7}  {total_sb_f+total_loc_f:>7}")

print("\n🎙️   Audio (commandes) :")
print(f"  {'Commande':<20}  {'Supabase':>9}  {'Local':>7}  {'Total':>7}")
print("  " + "-" * 46)
total_sb_a = total_loc_a = 0
for cmd in COMMANDES:
    sb_n  = compter_supabase(f"audio/{cmd}", ".wav")
    loc_n = compter_local(AUDIO_DIR / cmd, ".wav")
    total_sb_a  += sb_n
    total_loc_a += loc_n
    print(f"  {cmd:<20}  {sb_n:>9}  {loc_n:>7}  {sb_n+loc_n:>7}")
print("  " + "-" * 46)
print(f"  {'TOTAL':<20}  {total_sb_a:>9}  {total_loc_a:>7}  {total_sb_a+total_loc_a:>7}")

# ═══════════════════════════════════════════════════════════
print()
if total_sb_f == 0 and total_sb_a == 0:
    print("ℹ️  Aucun fichier trouvé sur Supabase.")
    sys.exit(0)

rep = input("Télécharger les fichiers Supabase manquants en local ? [o/N] : ").strip().lower()
if rep != "o":
    print("Annulé — aucun téléchargement effectué.")
    sys.exit(0)

print("\n📥  Téléchargement frames...")
for etat in ETATS:
    dl, sk = telecharger(f"frames/{etat}", ".jpg", FRAMES_DIR / etat)
    print(f"  {etat:<25}: {dl} nouveaux  |  {sk} déjà présents")

print("\n📥  Téléchargement audio...")
for cmd in COMMANDES:
    dl, sk = telecharger(f"audio/{cmd}", ".wav", AUDIO_DIR / cmd)
    print(f"  {cmd:<20}: {dl} nouveaux  |  {sk} déjà présents")

print("\n✅ Terminé — dataset local mis à jour.")
print("   Lance les notebooks pour entraîner sur l'ensemble complet.")
