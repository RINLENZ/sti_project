"""
Entraînement du modèle KWS (Keyword Spotting) — commandes vocales STI
======================================================================
Pipeline :
  1. Charge les clips WAV depuis backend/data/audio/{commande}/
  2. Extrait des log-MFCCs (40 coeff, fenêtre 1s, 16 kHz)
  3. Entraîne un CNN 2D sur les spectrogrammes MFCC
  4. Évalue sur split de validation (80/20 stratifié)
  5. Exporte le modèle en ONNX → frontend/public/models/kws_commands.onnx
  6. Sauvegarde le mapping labels → frontend/public/models/kws_labels.json

Usage :
  cd backend
  python scripts/train_kws_model.py [--epochs 40] [--batch 32] [--aug]

Prérequis (requirements_ml.txt) :
  tensorflow>=2.13  tf2onnx>=1.14  librosa>=0.10  soundfile>=0.12
  numpy  scikit-learn  tqdm
"""

import argparse
import json
import os
import sys
import time

import librosa
import numpy as np
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from sklearn.utils.class_weight import compute_class_weight
from tqdm import tqdm

# ── Chemins ──────────────────────────────────────────────────────────
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
AUDIO_DIR    = os.path.join(SCRIPT_DIR, "..", "data", "audio")
OUTPUT_DIR   = os.path.join(SCRIPT_DIR, "..", "..", "frontend", "public", "models")

ONNX_PATH    = os.path.join(OUTPUT_DIR, "kws_commands.onnx")
LABELS_PATH  = os.path.join(OUTPUT_DIR, "kws_labels.json")
KERAS_PATH   = os.path.join(OUTPUT_DIR, "kws_commands.keras")

# ── Hyper-paramètres audio ────────────────────────────────────────────
SR          = 16_000     # Hz mono
DURATION    = 1.0        # secondes par clip (pad ou tronque)
N_MFCC      = 40         # coefficients MFCC
HOP_LENGTH  = 160        # 10 ms @ 16kHz
N_FFT       = 512        # ~32 ms @ 16kHz
N_FRAMES    = int(SR * DURATION / HOP_LENGTH) + 1  # ~101 frames

# ── Classes ───────────────────────────────────────────────────────────
COMMANDES = [
    "aide",
    "oui",
    "non",
    "repeter",
    "incompris",
    "lentement",
    "bruit_silence",
]


# ═══════════════════════════════════════════════════════════════════════
#  1. Extraction des features
# ═══════════════════════════════════════════════════════════════════════

def load_mfcc(path: str, augment: bool = False) -> np.ndarray | None:
    """
    Charge un WAV, resamble à 16kHz mono, extrait un log-MFCC (40×N_FRAMES).
    Retourne un array shape (N_MFCC, N_FRAMES, 1) ou None si erreur.
    """
    try:
        y, _ = librosa.load(path, sr=SR, mono=True, duration=DURATION + 0.1)
    except Exception as e:
        print(f"  [WARN] Impossible de lire {path}: {e}", file=sys.stderr)
        return None

    # Normalisation amplitude
    if np.max(np.abs(y)) > 0:
        y = y / np.max(np.abs(y))

    # Augmentation (bruit léger + décalage temporel)
    if augment:
        y = _augment(y)

    # Pad ou tronque
    target = int(SR * DURATION)
    if len(y) < target:
        y = np.pad(y, (0, target - len(y)))
    else:
        y = y[:target]

    mfcc = librosa.feature.mfcc(
        y=y, sr=SR, n_mfcc=N_MFCC,
        hop_length=HOP_LENGTH, n_fft=N_FFT
    )
    # Normalise par clip (zero-mean, unit-std)
    mfcc = (mfcc - mfcc.mean()) / (mfcc.std() + 1e-8)

    # Pad/tronque sur l'axe temporel
    if mfcc.shape[1] < N_FRAMES:
        mfcc = np.pad(mfcc, ((0, 0), (0, N_FRAMES - mfcc.shape[1])))
    else:
        mfcc = mfcc[:, :N_FRAMES]

    return mfcc[..., np.newaxis]   # (40, N_FRAMES, 1)


def _augment(y: np.ndarray) -> np.ndarray:
    """Augmentation légère : bruit additif + décalage temporel."""
    # Bruit blanc gaussien (SNR ~20 dB)
    noise_amp = 0.005 * np.random.uniform(0, 1)
    y = y + noise_amp * np.random.randn(len(y))
    # Décalage temporel ±100 ms
    shift = int(np.random.uniform(-0.1, 0.1) * SR)
    y = np.roll(y, shift)
    return y.astype(np.float32)


# ═══════════════════════════════════════════════════════════════════════
#  2. Chargement du dataset
# ═══════════════════════════════════════════════════════════════════════

def load_dataset(augment: bool = False):
    X, y_labels, skipped = [], [], 0

    for label_idx, commande in enumerate(COMMANDES):
        cmd_dir = os.path.join(AUDIO_DIR, commande)
        if not os.path.exists(cmd_dir):
            print(f"  [INFO] Dossier absent pour '{commande}' — ignoré")
            continue

        wavs = [f for f in os.listdir(cmd_dir) if f.endswith(".wav")]
        if not wavs:
            print(f"  [WARN] Aucun WAV pour '{commande}'")
            continue

        print(f"  Chargement '{commande}' — {len(wavs)} clips")
        for fname in tqdm(wavs, desc=f"  {commande}", leave=False):
            path = os.path.join(cmd_dir, fname)
            feat = load_mfcc(path, augment=False)
            if feat is not None:
                X.append(feat)
                y_labels.append(label_idx)
            else:
                skipped += 1

            # Augmentation : 1 copie supplémentaire par clip
            if augment:
                feat_aug = load_mfcc(path, augment=True)
                if feat_aug is not None:
                    X.append(feat_aug)
                    y_labels.append(label_idx)

    print(f"\n  Total : {len(X)} exemples ({skipped} ignorés)")
    if len(X) == 0:
        print("\n[ERREUR] Aucune donnée audio trouvée.")
        print(f"  Dossier attendu : {AUDIO_DIR}")
        print("  Lance d'abord la collecte via /collect-audio")
        sys.exit(1)

    return np.array(X, dtype=np.float32), np.array(y_labels, dtype=np.int32)


# ═══════════════════════════════════════════════════════════════════════
#  3. Architecture CNN 2D
# ═══════════════════════════════════════════════════════════════════════

def build_cnn(n_classes: int) -> tf.keras.Model:
    """
    CNN léger sur spectrogramme MFCC (40 × N_FRAMES × 1).
    ~50k paramètres, compatible ONNX.
    """
    inputs = tf.keras.Input(shape=(N_MFCC, N_FRAMES, 1), name="mfcc_input")

    x = tf.keras.layers.Conv2D(32, (3, 3), padding="same", activation="relu")(inputs)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.MaxPooling2D((2, 2))(x)
    x = tf.keras.layers.Dropout(0.25)(x)

    x = tf.keras.layers.Conv2D(64, (3, 3), padding="same", activation="relu")(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.MaxPooling2D((2, 2))(x)
    x = tf.keras.layers.Dropout(0.25)(x)

    x = tf.keras.layers.Conv2D(128, (3, 3), padding="same", activation="relu")(x)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.40)(x)

    x = tf.keras.layers.Dense(64, activation="relu")(x)
    outputs = tf.keras.layers.Dense(n_classes, activation="softmax", name="output")(x)

    model = tf.keras.Model(inputs, outputs)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


# ═══════════════════════════════════════════════════════════════════════
#  4. Entraînement
# ═══════════════════════════════════════════════════════════════════════

def train(epochs: int, batch_size: int, augment: bool):
    print("\n── Chargement du dataset ──────────────────────────────────")
    X, y = load_dataset(augment=augment)

    # Classes présentes (certaines peuvent manquer si < TARGET)
    present_classes = sorted(set(y.tolist()))
    label_map = {COMMANDES[i]: int(i) for i in present_classes}
    n_classes  = len(present_classes)
    print(f"  Classes présentes : {[COMMANDES[i] for i in present_classes]}")

    # Remap labels consécutifs si des classes manquent
    remap = {old: new for new, old in enumerate(present_classes)}
    y = np.array([remap[v] for v in y], dtype=np.int32)
    label_map_final = {COMMANDES[i]: remap[i] for i in present_classes}

    # Split 80/20 stratifié
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.20, stratify=y, random_state=42
    )
    print(f"  Train : {len(X_train)}  Val : {len(X_val)}")

    # Poids de classes pour équilibrage
    cw = compute_class_weight("balanced", classes=np.arange(n_classes), y=y_train)
    class_weight = {i: w for i, w in enumerate(cw)}

    print("\n── Architecture ───────────────────────────────────────────")
    model = build_cnn(n_classes)
    model.summary()

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_accuracy", patience=8, restore_best_weights=True
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.5, patience=4, min_lr=1e-5
        ),
        # Sauvegarde pendant fit() — contexte stable, évite le segfault post-training
        tf.keras.callbacks.ModelCheckpoint(
            KERAS_PATH, save_best_only=True, monitor="val_accuracy", verbose=0
        ),
    ]

    print("\n── Entraînement ───────────────────────────────────────────")
    t0 = time.time()
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=epochs,
        batch_size=batch_size,
        class_weight=class_weight,
        callbacks=callbacks,
        verbose=1,
    )
    elapsed = time.time() - t0
    print(f"\n  Durée : {elapsed:.0f}s")

    # Évaluation
    print("\n── Évaluation ─────────────────────────────────────────────")
    y_pred = np.argmax(model.predict(X_val, verbose=0), axis=1)
    target_names = [COMMANDES[i] for i in present_classes]
    print(classification_report(y_val, y_pred, target_names=target_names))

    val_acc = max(history.history["val_accuracy"])
    print(f"  Meilleure val_accuracy : {val_acc:.3f}")

    return model, label_map_final, val_acc


# ═══════════════════════════════════════════════════════════════════════
#  5. Export ONNX
# ═══════════════════════════════════════════════════════════════════════

def export_onnx(model: tf.keras.Model):
    import subprocess, sys, onnx

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Le modèle est déjà sauvegardé par ModelCheckpoint pendant fit()
    print(f"  Modèle Keras (sauvegardé pendant training) → {KERAS_PATH}")

    # 2. Conversion ONNX via CLI dans un sous-processus séparé
    result = subprocess.run(
        [
            sys.executable, "-m", "tf2onnx.convert",
            "--keras", KERAS_PATH,
            "--output", ONNX_PATH,
            "--opset", "13",
        ],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"  [ERREUR tf2onnx] {result.stderr[-500:]}")
        raise RuntimeError("Conversion ONNX échouée")
    print(f"  Modèle ONNX  → {ONNX_PATH}")

    # 3. Vérification
    onnx_model = onnx.load(ONNX_PATH)
    onnx.checker.check_model(onnx_model)
    print("  Vérification ONNX : OK")


# ═══════════════════════════════════════════════════════════════════════
#  6. Sauvegarde du mapping labels
# ═══════════════════════════════════════════════════════════════════════

def save_labels(label_map: dict, val_acc: float):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    # index → label (pour l'inférence côté frontend)
    idx_to_label = {str(v): k for k, v in label_map.items()}
    payload = {
        "labels":        idx_to_label,
        "n_mfcc":        N_MFCC,
        "n_frames":      N_FRAMES,
        "sample_rate":   SR,
        "duration_s":    DURATION,
        "hop_length":    HOP_LENGTH,
        "n_fft":         N_FFT,
        "val_accuracy":  round(val_acc, 4),
        "trained_at":    time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "commandes":     COMMANDES,
    }
    with open(LABELS_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"  Labels JSON  → {LABELS_PATH}")


# ═══════════════════════════════════════════════════════════════════════
#  Main
# ═══════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Entraîne le modèle KWS commandes vocales")
    parser.add_argument("--epochs",  type=int, default=40,  help="Nombre d'époques max (défaut: 40)")
    parser.add_argument("--batch",   type=int, default=32,  help="Taille du batch (défaut: 32)")
    parser.add_argument("--aug",     action="store_true",   help="Activer l'augmentation des données")
    args = parser.parse_args()

    print("═" * 60)
    print("  Entraînement KWS — Commandes vocales STI")
    print(f"  Epochs: {args.epochs}  Batch: {args.batch}  Augmentation: {args.aug}")
    print(f"  Audio dir : {AUDIO_DIR}")
    print(f"  Output    : {OUTPUT_DIR}")
    print("═" * 60)

    model, label_map, val_acc = train(
        epochs=args.epochs,
        batch_size=args.batch,
        augment=args.aug,
    )

    print("\n── Export ─────────────────────────────────────────────────")
    export_onnx(model)
    save_labels(label_map, val_acc)

    print("\n" + "═" * 60)
    print(f"  Terminé — val_accuracy = {val_acc:.3f}")
    print(f"  Modèle ONNX : {ONNX_PATH}")
    print(f"  Labels      : {LABELS_PATH}")
    print("═" * 60)


if __name__ == "__main__":
    main()
