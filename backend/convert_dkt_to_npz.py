"""
convert_dkt_to_npz.py — Convertit le modèle DKT .pth en .npz numpy pur
=====================================================================

Pourquoi ?
  Le service dkt_service.py charge les poids en numpy pur (sans torch)
  pour rester léger en production (Render). Mais le .pth est un format
  PyTorch. Ce script extrait les poids du .pth et les sauve en .npz
  (format numpy natif), lisible sans torch.

À lancer UNE FOIS après chaque (ré)entraînement, sur une machine où torch
est installé (ta machine locale, env backend_env) :

    cd backend
    python convert_dkt_to_npz.py

Génère : models/dkt/dkt_fused.npz

Ensuite, copie le .npz dans le repo et déploie — le container n'aura
JAMAIS besoin de torch.
"""
import sys
from pathlib import Path

import numpy as np

MODEL_DIR = Path(__file__).parent / "models" / "dkt"
PTH_PATH  = MODEL_DIR / "dkt_fused.pth"
NPZ_PATH  = MODEL_DIR / "dkt_fused.npz"


def main():
    if not PTH_PATH.exists():
        print(f"❌ {PTH_PATH} introuvable.")
        print("   Lance d'abord l'entraînement (dkt_train_local.ipynb).")
        sys.exit(1)

    # torch est nécessaire UNIQUEMENT ici, lors de la conversion (pas en prod)
    import torch
    ckpt = torch.load(PTH_PATH, map_location="cpu", weights_only=False)
    state = ckpt["model_state"]

    # Extraction des poids vers numpy
    W_ih  = state["lstm.weight_ih_l0"].numpy()
    W_hh  = state["lstm.weight_hh_l0"].numpy()
    b_ih  = state["lstm.bias_ih_l0"].numpy()
    b_hh  = state["lstm.bias_hh_l0"].numpy()
    W_out = state["out.weight"].numpy()
    b_out = state["out.bias"].numpy()

    kc2idx = ckpt["kc2idx"]
    mode   = ckpt.get("mode", "fused")

    # Sauvegarde en .npz (kc2idx sérialisé comme objet)
    np.savez(
        NPZ_PATH,
        W_ih=W_ih, W_hh=W_hh, b_ih=b_ih, b_hh=b_hh,
        W_out=W_out, b_out=b_out,
        kc2idx=np.array(kc2idx, dtype=object),
        mode=np.array(mode, dtype=object),
    )

    print(f"✓ Modèle converti : {NPZ_PATH}")
    print(f"  Taille : {NPZ_PATH.stat().st_size / 1024:.1f} KB")
    print(f"  hidden_size : {W_hh.shape[1]}")
    print(f"  input_dim   : {W_ih.shape[1]}")
    print(f"  n_skills    : {W_out.shape[0]}")
    print(f"  macro_kcs   : {list(kc2idx.keys())}")
    print()
    print("  Le service dkt_service.py chargera désormais ce .npz sans torch.")


if __name__ == "__main__":
    main()
