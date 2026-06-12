"""
train_dkt.py — Entraînement DKT-baseline vs DKT-Engagement
==========================================================

Objectif scientifique
---------------------
Comparer empiriquement deux variantes de Deep Knowledge Tracing :
  • DKT-baseline   : LSTM avec features [kc_onehot, correct]
  • DKT-Engagement : LSTM avec features [kc_onehot, correct, engagement, difficulty]

L'apport scientifique du mémoire est précisément la mesure du delta de
performance entre les deux modèles, attribuable à l'enrichissement par
l'engagement multimodal (facial + audio + comportemental).

Méthode rigoureuse
------------------
  • Split patient-level (70/15/15) : aucune fuite d'information entre train/val/test
  • Mêmes seeds aléatoires pour les deux modèles → comparaison équitable
  • Loss BCE masquée (gère le padding des séquences de longueurs variables)
  • Early stopping sur la val_loss (patience 10 epochs)
  • Dropout 0.3 + régularisation L2 légère
  • Métriques : AUC ROC + Accuracy + Loss
  • Export ONNX des deux modèles pour déploiement backend

Sorties produites
-----------------
  backend/models/dkt/dkt_baseline.onnx
  backend/models/dkt/dkt_engagement.onnx
  backend/models/dkt/kc_vocab.json          (mapping KC → index, requis en inférence)
  backend/models/dkt/training_metrics.csv   (résultats détaillés)
  backend/models/dkt/training_curves.png    (figure pour le mémoire)
  backend/models/dkt/training_log.txt       (log complet)

Usage
-----
    cd backend
    python train_dkt.py
    # Avec options :
    python train_dkt.py --epochs 150 --batch-size 32 --hidden-size 64

Reproductibilité
----------------
Toutes les sources d'aléa sont initialisées avec un seed unique (défaut: 42),
ce qui permet de régénérer exactement les mêmes résultats pour la soutenance.
"""
import os
import sys
import json
import time
import random
import argparse
from pathlib import Path
from collections import defaultdict
from datetime import datetime

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from sklearn.metrics import roc_auc_score, accuracy_score
import matplotlib
matplotlib.use("Agg")  # backend sans X server, nécessaire sur Render/headless
import matplotlib.pyplot as plt


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Configuration                                                      ║
# ╚════════════════════════════════════════════════════════════════════╝

THIS_DIR     = Path(__file__).parent
DATASET_PATH = THIS_DIR / "dataset_dkt.jsonl"
OUTPUT_DIR   = THIS_DIR / "models" / "dkt"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Hyperparamètres par défaut (overridables en CLI)
DEFAULT_HIDDEN_SIZE = 32
DEFAULT_NUM_LAYERS  = 1
DEFAULT_DROPOUT     = 0.3
DEFAULT_LR          = 1e-3
DEFAULT_L2          = 1e-5
DEFAULT_BATCH_SIZE  = 16
DEFAULT_MAX_EPOCHS  = 100
DEFAULT_PATIENCE    = 10  # early stopping
DEFAULT_SEED        = 42
DEFAULT_MIN_SEQ_LEN = 3   # apprenants avec < 3 interactions exclus
TRAIN_RATIO         = 0.70
VAL_RATIO           = 0.15
# (le reste = test, soit 15%)


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Reproductibilité — fige toutes les sources d'aléa                 ║
# ╚════════════════════════════════════════════════════════════════════╝

def set_seed(seed):
    """Fige random, numpy et torch sur le même seed pour reproductibilité."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    # Determinisme strict (légère perte de perf, mais reproductible)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark     = False


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Chargement et préparation du dataset                              ║
# ╚════════════════════════════════════════════════════════════════════╝

def charger_dataset(path):
    """Charge le JSONL en mémoire et le retourne brut."""
    if not path.exists():
        print(f"❌ ERREUR : {path} introuvable")
        print(f"   Lance d'abord : python export_dataset.py")
        sys.exit(1)
    with open(path) as f:
        records = [json.loads(line) for line in f]
    print(f"  ✓ {len(records)} interactions chargées depuis {path.name}")
    return records


def construire_sequences(records, min_seq_len):
    """Groupe les interactions par apprenant et trie chronologiquement.

    Filtre les apprenants avec moins de `min_seq_len` interactions :
    impossible d'apprendre quoi que ce soit sur une séquence de 1-2 pas.
    """
    par_apprenant = defaultdict(list)
    for r in records:
        par_apprenant[r["student_id"]].append(r)
    # Trier par timestamp (ordre temporel réel d'apprentissage)
    for sid in par_apprenant:
        par_apprenant[sid].sort(key=lambda x: x["timestamp"])

    # Filtrer les séquences trop courtes
    avant = len(par_apprenant)
    par_apprenant = {sid: seq for sid, seq in par_apprenant.items() if len(seq) >= min_seq_len}
    apres = len(par_apprenant)

    print(f"  ✓ {apres} apprenants conservés (filtré {avant - apres} avec < {min_seq_len} interactions)")
    return par_apprenant


def construire_vocab_kc(par_apprenant):
    """Construit le mapping KC → index entier, deterministe et trié.

    Le tri alphabétique garantit que le vocab est identique entre exécutions
    indépendamment de l'ordre d'arrivée des interactions.
    """
    tous_kcs = set()
    for seq in par_apprenant.values():
        for r in seq:
            if r["primary_kc"]:
                tous_kcs.add(r["primary_kc"])
    vocab = {kc: i for i, kc in enumerate(sorted(tous_kcs))}
    print(f"  ✓ Vocabulaire KC : {len(vocab)} compétences distinctes")
    return vocab


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Split patient-level (aucune fuite de données)                     ║
# ╚════════════════════════════════════════════════════════════════════╝

def split_patient_level(par_apprenant, train_ratio, val_ratio, seed):
    """Sépare les APPRENANTS (pas les interactions) en 3 groupes disjoints.

    C'est la méthode rigoureuse : on évalue la capacité du modèle à généraliser
    à des apprenants jamais vus, pas à compléter des séquences déjà commencées.
    """
    apprenants = sorted(par_apprenant.keys())  # tri déterministe
    rng = random.Random(seed)
    rng.shuffle(apprenants)

    n_total = len(apprenants)
    n_train = int(n_total * train_ratio)
    n_val   = int(n_total * val_ratio)

    train_ids = apprenants[:n_train]
    val_ids   = apprenants[n_train : n_train + n_val]
    test_ids  = apprenants[n_train + n_val :]

    print(f"  ✓ Split patient-level : {len(train_ids)} train / {len(val_ids)} val / {len(test_ids)} test")
    return train_ids, val_ids, test_ids


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Dataset PyTorch                                                   ║
# ╚════════════════════════════════════════════════════════════════════╝

def normaliser_difficulte(d):
    """Difficulté ∈ {1, 2, 3} → ∈ [0, 1] (transformation affine)."""
    if d is None:
        return 0.5  # neutre si manquant
    return (d - 1) / 2.0


class DKTDataset(Dataset):
    """Construit les tenseurs d'entrée et de cible pour un apprenant.

    Pour une séquence de T interactions, on entraîne le modèle à prédire
    le résultat de l'interaction t+1 à partir des t premières.
    Donc : input = (T-1) pas, target = (T-1) pas (alignés avec t+1).
    """

    def __init__(self, par_apprenant, ids, vocab_kc, use_engagement):
        self.sequences = []
        self.vocab_kc       = vocab_kc
        self.K              = len(vocab_kc)
        self.use_engagement = use_engagement

        for sid in ids:
            seq = par_apprenant[sid]
            if len(seq) < 2:
                continue  # pas de cible possible avec 1 seul pas
            self.sequences.append(seq)

    def __len__(self):
        return len(self.sequences)

    def __getitem__(self, idx):
        seq = self.sequences[idx]
        T = len(seq)
        K = self.K

        # input_dim : K (kc one-hot) + 1 (correct) [+ 1 (engagement) + 1 (difficulty)]
        input_dim = K + (3 if self.use_engagement else 1)
        X = np.zeros((T - 1, input_dim), dtype=np.float32)

        # Cible : pour chaque pas t, le KC visé à t+1 et le label correct/incorrect
        target_kc      = np.zeros(T - 1, dtype=np.int64)  # index du KC au pas t+1
        target_correct = np.zeros(T - 1, dtype=np.float32)  # 0 ou 1

        for t in range(T - 1):
            r_curr = seq[t]
            r_next = seq[t + 1]

            kc_curr = self.vocab_kc.get(r_curr.get("primary_kc"))
            kc_next = self.vocab_kc.get(r_next.get("primary_kc"))
            if kc_curr is None or kc_next is None:
                continue  # interaction sans KC : on laisse à zéro

            # Construction du vecteur d'entrée (pas courant)
            X[t, kc_curr] = 1.0
            X[t, K]       = 1.0 if r_curr.get("correct") else 0.0

            if self.use_engagement:
                eng = r_curr.get("engagement") or {}
                X[t, K + 1] = eng.get("fused") or 0.5
                X[t, K + 2] = normaliser_difficulte(r_curr.get("difficulty"))

            # Cible : ce qu'on cherche à prédire pour le pas suivant
            target_kc[t]      = kc_next
            target_correct[t] = 1.0 if r_next.get("correct") else 0.0

        return (
            torch.from_numpy(X),
            torch.from_numpy(target_kc),
            torch.from_numpy(target_correct),
        )


def collate_fn(batch):
    """Padding des séquences de longueurs variables au sein d'un batch.

    Renvoie aussi un mask : 1 = position réelle, 0 = padding (à ignorer dans la loss).
    """
    Xs, kcs, corrects = zip(*batch)
    lengths = [x.size(0) for x in Xs]
    max_len = max(lengths)
    input_dim = Xs[0].size(1)
    B = len(batch)

    X_pad     = torch.zeros(B, max_len, input_dim)
    kc_pad    = torch.zeros(B, max_len, dtype=torch.long)
    corr_pad  = torch.zeros(B, max_len)
    mask      = torch.zeros(B, max_len)

    for i, (x, kc, corr) in enumerate(batch):
        L = x.size(0)
        X_pad[i, :L]    = x
        kc_pad[i, :L]   = kc
        corr_pad[i, :L] = corr
        mask[i, :L]     = 1.0

    return X_pad, kc_pad, corr_pad, mask


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Le modèle — LSTM 1 couche                                         ║
# ╚════════════════════════════════════════════════════════════════════╝

class DKTModel(nn.Module):
    """Deep Knowledge Tracing — LSTM 1 couche, sortie K probas par pas.

    Architecture (Piech et al., 2015, simplifiée pour notre volume) :
        Input  : (batch, seq_len, input_dim)
        LSTM   : 1 couche × hidden_size unités
        Dropout: 0.3 sur la sortie LSTM
        Dense  : hidden → K (logits par KC)
        Sigmoid: appliquée au moment du calcul de la loss (BCEWithLogits)
    """

    def __init__(self, input_dim, output_dim, hidden_size, num_layers, dropout):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size  = input_dim,
            hidden_size = hidden_size,
            num_layers  = num_layers,
            batch_first = True,
            dropout     = dropout if num_layers > 1 else 0.0,
        )
        self.dropout = nn.Dropout(dropout)
        self.fc      = nn.Linear(hidden_size, output_dim)

    def forward(self, x):
        # x : (B, T, input_dim)
        out, _ = self.lstm(x)
        out    = self.dropout(out)
        logits = self.fc(out)  # (B, T, K)
        return logits


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Boucles d'entraînement et d'évaluation                            ║
# ╚════════════════════════════════════════════════════════════════════╝

def calculer_loss(logits, kc_target, corr_target, mask):
    """BCE masquée — ne pénalise que sur les vrais pas de la séquence.

    Pour chaque pas t, on récupère le logit du KC visé au pas t+1, et on
    le compare au label correct/incorrect via la BCE.
    """
    # Extraire le logit du KC cible : gather sur la dim K
    # logits : (B, T, K), kc_target : (B, T)
    logit_target = logits.gather(2, kc_target.unsqueeze(2)).squeeze(2)  # (B, T)

    bce = nn.functional.binary_cross_entropy_with_logits(
        logit_target, corr_target, reduction="none"
    )
    # Appliquer le mask et moyenner sur les positions réelles
    loss_masquee = (bce * mask).sum() / (mask.sum() + 1e-8)
    return loss_masquee


def epoch_train(model, loader, optimizer, device):
    model.train()
    total_loss = 0.0
    n_batches  = 0
    for X, kc, corr, mask in loader:
        X    = X.to(device)
        kc   = kc.to(device)
        corr = corr.to(device)
        mask = mask.to(device)

        optimizer.zero_grad()
        logits = model(X)
        loss   = calculer_loss(logits, kc, corr, mask)
        loss.backward()
        optimizer.step()

        total_loss += loss.item()
        n_batches  += 1

    return total_loss / max(n_batches, 1)


def evaluer(model, loader, device):
    """Calcule loss, accuracy et AUC ROC sur un dataset entier."""
    model.eval()
    total_loss = 0.0
    n_batches  = 0
    all_probs  = []
    all_labels = []

    with torch.no_grad():
        for X, kc, corr, mask in loader:
            X    = X.to(device)
            kc   = kc.to(device)
            corr = corr.to(device)
            mask = mask.to(device)

            logits = model(X)
            loss   = calculer_loss(logits, kc, corr, mask)

            total_loss += loss.item()
            n_batches  += 1

            # Extraction des probas du KC cible
            logit_target = logits.gather(2, kc.unsqueeze(2)).squeeze(2)
            probs = torch.sigmoid(logit_target)

            # Conserver uniquement les positions réelles (pas le padding)
            mask_bool = mask.bool()
            all_probs.append(probs[mask_bool].cpu().numpy())
            all_labels.append(corr[mask_bool].cpu().numpy())

    avg_loss = total_loss / max(n_batches, 1)
    all_probs  = np.concatenate(all_probs)
    all_labels = np.concatenate(all_labels)

    # Métriques classiques
    accuracy = accuracy_score(all_labels, (all_probs > 0.5).astype(int))
    # AUC ROC : nécessite au moins 1 exemple de chaque classe
    if len(np.unique(all_labels)) < 2:
        auc = float("nan")
    else:
        auc = roc_auc_score(all_labels, all_probs)

    return avg_loss, accuracy, auc


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Entraînement complet d'un modèle (baseline OU engagement)         ║
# ╚════════════════════════════════════════════════════════════════════╝

def entrainer_modele(
    nom, use_engagement,
    par_apprenant, vocab_kc,
    train_ids, val_ids, test_ids,
    config, log_lines,
):
    """Entraîne un modèle et retourne l'historique + les métriques finales."""

    def log(msg):
        print(msg)
        log_lines.append(msg)

    log("")
    log("=" * 68)
    log(f"  ENTRAÎNEMENT : {nom}")
    log("=" * 68)

    K = len(vocab_kc)
    input_dim  = K + (3 if use_engagement else 1)
    output_dim = K

    # Datasets et loaders
    train_set = DKTDataset(par_apprenant, train_ids, vocab_kc, use_engagement)
    val_set   = DKTDataset(par_apprenant, val_ids,   vocab_kc, use_engagement)
    test_set  = DKTDataset(par_apprenant, test_ids,  vocab_kc, use_engagement)

    log(f"  Séquences : {len(train_set)} train / {len(val_set)} val / {len(test_set)} test")
    log(f"  Dimensions : input={input_dim}, hidden={config.hidden_size}, output={output_dim}")

    # IMPORTANT : on re-set le seed avant la création du modèle pour
    # que baseline et engagement aient EXACTEMENT les mêmes poids initiaux
    # sur la partie commune (en pratique le seed des datasets PyTorch
    # influence aussi l'ordre des batches, donc on refige tout).
    set_seed(config.seed)

    train_loader = DataLoader(
        train_set, batch_size=config.batch_size, shuffle=True,
        collate_fn=collate_fn, generator=torch.Generator().manual_seed(config.seed),
    )
    val_loader = DataLoader(
        val_set, batch_size=config.batch_size, shuffle=False,
        collate_fn=collate_fn,
    )
    test_loader = DataLoader(
        test_set, batch_size=config.batch_size, shuffle=False,
        collate_fn=collate_fn,
    )

    # Modèle, optimiseur
    device = torch.device("cpu")
    model = DKTModel(
        input_dim   = input_dim,
        output_dim  = output_dim,
        hidden_size = config.hidden_size,
        num_layers  = config.num_layers,
        dropout     = config.dropout,
    ).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=config.lr, weight_decay=config.l2)

    log(f"  Paramètres : {sum(p.numel() for p in model.parameters()):,}")
    log("")

    # Historique pour les graphiques
    history = {"train_loss": [], "val_loss": [], "val_acc": [], "val_auc": []}
    best_val_loss   = float("inf")
    best_state_dict = None
    epochs_no_improve = 0
    t_start = time.time()

    # Boucle d'entraînement
    for epoch in range(1, config.max_epochs + 1):
        train_loss = epoch_train(model, train_loader, optimizer, device)
        val_loss, val_acc, val_auc = evaluer(model, val_loader, device)

        history["train_loss"].append(train_loss)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)
        history["val_auc"].append(val_auc)

        # Early stopping basé sur val_loss
        if val_loss < best_val_loss - 1e-4:
            best_val_loss     = val_loss
            best_state_dict   = {k: v.clone() for k, v in model.state_dict().items()}
            epochs_no_improve = 0
            marker = " ⭐"  # nouveau meilleur
        else:
            epochs_no_improve += 1
            marker = ""

        log(
            f"  Epoch {epoch:3d}/{config.max_epochs} | "
            f"train_loss={train_loss:.4f}  val_loss={val_loss:.4f}  "
            f"val_acc={val_acc:.3f}  val_auc={val_auc:.3f}{marker}"
        )

        if epochs_no_improve >= config.patience:
            log(f"  ⏹  Early stopping après {epoch} epochs (patience={config.patience})")
            break

    duree = time.time() - t_start
    log(f"  ✓ Entraînement terminé en {duree:.1f}s")

    # Restaurer le meilleur modèle (celui avec la plus faible val_loss)
    model.load_state_dict(best_state_dict)

    # Évaluation finale sur le test set
    test_loss, test_acc, test_auc = evaluer(model, test_loader, device)
    log("")
    log(f"  RÉSULTATS FINAUX ({nom}) sur le test set :")
    log(f"    Loss      : {test_loss:.4f}")
    log(f"    Accuracy  : {test_acc:.4f}")
    log(f"    AUC ROC   : {test_auc:.4f}")

    return {
        "model":     model,
        "history":   history,
        "test_loss": test_loss,
        "test_acc":  test_acc,
        "test_auc":  test_auc,
        "input_dim": input_dim,
        "duree":     duree,
    }


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Export ONNX                                                       ║
# ╚════════════════════════════════════════════════════════════════════╝

def exporter_onnx(model, input_dim, path):
    """Exporte le modèle PyTorch en ONNX pour déploiement sans torch."""
    model.eval()
    # Dummy input avec batch_size=1, seq_len=1 — taille minimale qui marche
    dummy = torch.zeros(1, 1, input_dim, dtype=torch.float32)
    torch.onnx.export(
        model,
        dummy,
        str(path),
        input_names    = ["input"],
        output_names   = ["logits"],
        opset_version  = 14,
        dynamic_axes   = {
            "input":  {0: "batch_size", 1: "seq_len"},
            "logits": {0: "batch_size", 1: "seq_len"},
        },
    )
    size_kb = path.stat().st_size / 1024
    print(f"  ✓ Export ONNX : {path.name}  ({size_kb:.1f} KB)")


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Visualisation des courbes d'apprentissage                         ║
# ╚════════════════════════════════════════════════════════════════════╝

def plot_courbes(results_base, results_eng, output_path):
    """Génère une figure 2×2 : loss/AUC train vs val pour les 2 modèles."""
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # ── Subplot 1 : Loss train vs val pour les 2 modèles ──────────────
    ax = axes[0]
    hb = results_base["history"]
    he = results_eng["history"]
    epochs_b = range(1, len(hb["train_loss"]) + 1)
    epochs_e = range(1, len(he["train_loss"]) + 1)

    ax.plot(epochs_b, hb["train_loss"], label="DKT-base train",     color="#1f77b4", linestyle="--", alpha=0.6)
    ax.plot(epochs_b, hb["val_loss"],   label="DKT-base val",       color="#1f77b4", linewidth=2)
    ax.plot(epochs_e, he["train_loss"], label="DKT-engagement train", color="#d62728", linestyle="--", alpha=0.6)
    ax.plot(epochs_e, he["val_loss"],   label="DKT-engagement val", color="#d62728", linewidth=2)
    ax.set_xlabel("Epoch")
    ax.set_ylabel("Loss (BCE)")
    ax.set_title("Loss d'entraînement et de validation")
    ax.legend(loc="best", fontsize=9)
    ax.grid(True, alpha=0.3)

    # ── Subplot 2 : AUC ROC sur validation ────────────────────────────
    ax = axes[1]
    ax.plot(epochs_b, hb["val_auc"], label="DKT-base",       color="#1f77b4", linewidth=2)
    ax.plot(epochs_e, he["val_auc"], label="DKT-engagement", color="#d62728", linewidth=2)
    ax.set_xlabel("Epoch")
    ax.set_ylabel("AUC ROC (validation)")
    ax.set_title("AUC ROC au fil de l'entraînement")
    ax.legend(loc="best", fontsize=9)
    ax.grid(True, alpha=0.3)
    ax.set_ylim(0.4, 1.0)

    plt.tight_layout()
    plt.savefig(output_path, dpi=120, bbox_inches="tight")
    plt.close()
    print(f"  ✓ Figure sauvegardée : {output_path.name}")


# ╔════════════════════════════════════════════════════════════════════╗
# ║  Main                                                              ║
# ╚════════════════════════════════════════════════════════════════════╝

def main():
    parser = argparse.ArgumentParser(
        description="Entraînement DKT vs DKT-Engagement avec comparaison rigoureuse",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--epochs",       type=int,   default=DEFAULT_MAX_EPOCHS)
    parser.add_argument("--batch-size",   type=int,   default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--hidden-size",  type=int,   default=DEFAULT_HIDDEN_SIZE)
    parser.add_argument("--num-layers",   type=int,   default=DEFAULT_NUM_LAYERS)
    parser.add_argument("--dropout",      type=float, default=DEFAULT_DROPOUT)
    parser.add_argument("--lr",           type=float, default=DEFAULT_LR)
    parser.add_argument("--l2",           type=float, default=DEFAULT_L2)
    parser.add_argument("--patience",     type=int,   default=DEFAULT_PATIENCE)
    parser.add_argument("--min-seq-len",  type=int,   default=DEFAULT_MIN_SEQ_LEN)
    parser.add_argument("--seed",         type=int,   default=DEFAULT_SEED)
    args = parser.parse_args()

    # Encapsulation des hyperparamètres pour passage facile aux fonctions
    class Config:
        pass
    config = Config()
    for k, v in vars(args).items():
        setattr(config, k.replace("-", "_"), v)
    config.max_epochs = args.epochs  # alias

    log_lines = []
    def log(msg):
        print(msg)
        log_lines.append(msg)

    log("=" * 68)
    log(f"  ENTRAÎNEMENT DKT-E  -  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log("=" * 68)
    log("")
    log(f"  Configuration :")
    log(f"    hidden_size = {config.hidden_size}, num_layers = {config.num_layers}")
    log(f"    dropout = {config.dropout}, lr = {config.lr}, l2 = {config.l2}")
    log(f"    batch_size = {config.batch_size}, max_epochs = {config.max_epochs}")
    log(f"    early_stopping_patience = {config.patience}, seed = {config.seed}")
    log("")

    # ─── 1. Chargement & préparation des données ──────────────────────
    log("  Étape 1/5 — Chargement du dataset")
    records = charger_dataset(DATASET_PATH)
    par_apprenant = construire_sequences(records, config.min_seq_len)
    vocab_kc = construire_vocab_kc(par_apprenant)

    # Sauvegarde du vocabulaire (indispensable pour l'inférence en production)
    vocab_path = OUTPUT_DIR / "kc_vocab.json"
    with open(vocab_path, "w", encoding="utf-8") as f:
        json.dump(vocab_kc, f, ensure_ascii=False, indent=2)
    log(f"  ✓ Vocabulaire sauvegardé : {vocab_path.name}")

    # ─── 2. Split train/val/test ──────────────────────────────────────
    log("")
    log("  Étape 2/5 — Split patient-level")
    train_ids, val_ids, test_ids = split_patient_level(
        par_apprenant, TRAIN_RATIO, VAL_RATIO, config.seed,
    )

    # ─── 3. Entraînement DKT-baseline ─────────────────────────────────
    log("")
    log("  Étape 3/5 — Entraînement DKT-baseline")
    results_base = entrainer_modele(
        "DKT-baseline", use_engagement=False,
        par_apprenant=par_apprenant, vocab_kc=vocab_kc,
        train_ids=train_ids, val_ids=val_ids, test_ids=test_ids,
        config=config, log_lines=log_lines,
    )

    # ─── 4. Entraînement DKT-Engagement (avec les MÊMES splits) ───────
    log("")
    log("  Étape 4/5 — Entraînement DKT-Engagement")
    results_eng = entrainer_modele(
        "DKT-engagement", use_engagement=True,
        par_apprenant=par_apprenant, vocab_kc=vocab_kc,
        train_ids=train_ids, val_ids=val_ids, test_ids=test_ids,
        config=config, log_lines=log_lines,
    )

    # ─── 5. Exports + récap final ─────────────────────────────────────
    log("")
    log("  Étape 5/5 — Export des artefacts")
    exporter_onnx(
        results_base["model"], results_base["input_dim"],
        OUTPUT_DIR / "dkt_baseline.onnx",
    )
    exporter_onnx(
        results_eng["model"], results_eng["input_dim"],
        OUTPUT_DIR / "dkt_engagement.onnx",
    )

    # Métriques en CSV pour analyse fine
    import csv
    metrics_path = OUTPUT_DIR / "training_metrics.csv"
    with open(metrics_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["model", "test_loss", "test_accuracy", "test_auc", "duree_sec", "n_params"])
        writer.writerow([
            "DKT-baseline",
            f"{results_base['test_loss']:.4f}",
            f"{results_base['test_acc']:.4f}",
            f"{results_base['test_auc']:.4f}",
            f"{results_base['duree']:.1f}",
            sum(p.numel() for p in results_base["model"].parameters()),
        ])
        writer.writerow([
            "DKT-engagement",
            f"{results_eng['test_loss']:.4f}",
            f"{results_eng['test_acc']:.4f}",
            f"{results_eng['test_auc']:.4f}",
            f"{results_eng['duree']:.1f}",
            sum(p.numel() for p in results_eng["model"].parameters()),
        ])
    log(f"  ✓ Métriques CSV : {metrics_path.name}")

    # Graphiques
    plot_courbes(results_base, results_eng, OUTPUT_DIR / "training_curves.png")

    # ─── RÉCAP FINAL ──────────────────────────────────────────────────
    log("")
    log("=" * 68)
    log("  COMPARAISON FINALE")
    log("=" * 68)
    log(f"  {'Métrique':<15} {'DKT-base':<12} {'DKT-engag.':<12} {'Δ (eng - base)'}")
    log(f"  {'-'*15} {'-'*12} {'-'*12} {'-'*15}")

    delta_loss = results_eng["test_loss"] - results_base["test_loss"]
    delta_acc  = results_eng["test_acc"]  - results_base["test_acc"]
    delta_auc  = results_eng["test_auc"]  - results_base["test_auc"]

    log(f"  {'Loss':<15} {results_base['test_loss']:<12.4f} {results_eng['test_loss']:<12.4f} {delta_loss:+.4f}")
    log(f"  {'Accuracy':<15} {results_base['test_acc']:<12.4f} {results_eng['test_acc']:<12.4f} {delta_acc:+.4f}")
    log(f"  {'AUC ROC':<15} {results_base['test_auc']:<12.4f} {results_eng['test_auc']:<12.4f} {delta_auc:+.4f}")
    log("")

    # Interprétation pour le mémoire
    if delta_auc > 0.02:
        log(f"  ✅ L'engagement multimodal apporte un gain significatif "
            f"(+{delta_auc*100:.1f} pts AUC)")
        log(f"     C'est le résultat attendu, à mentionner dans le chapitre 4.")
    elif delta_auc > 0:
        log(f"  ⚠  Gain marginal de l'engagement (+{delta_auc*100:.1f} pts AUC).")
        log(f"     Le signal d'engagement aide peu sur ce dataset.")
    else:
        log(f"  ⚠  L'engagement n'améliore pas (Δ = {delta_auc*100:+.1f} pts AUC).")
        log(f"     Possible cause : engagement bruité, ou modèle déjà optimal sans.")

    log("")
    log(f"  Tous les artefacts sauvegardés dans : {OUTPUT_DIR.relative_to(THIS_DIR.parent)}")

    # Sauvegarde du log complet
    log_path = OUTPUT_DIR / "training_log.txt"
    with open(log_path, "w") as f:
        f.write("\n".join(log_lines))
    print(f"\n  ✓ Log complet : {log_path.name}")


if __name__ == "__main__":
    main()
