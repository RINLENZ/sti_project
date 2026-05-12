"""
Entraîne un modèle d'émotion MobileNetV2 sur les frames collectées
via DataCollection.jsx, puis l'exporte en ONNX pour onnxruntime-web.

Prérequis :
    pip install -r requirements_ml.txt
    Les frames doivent être dans  backend/data/frames/{etat}/*.jpg
    avec etat ∈ {engagement_eleve, engagement_faible, confusion,
                 frustration, ennui, neutre}

Usage :
    python train_emotion_model.py [--epochs 30] [--batch 32] [--img 96]
"""
import argparse, os, sys, json, pathlib, subprocess as _sp
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, Model
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping, ReduceLROnPlateau
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import tf2onnx
import onnx
from PIL import Image
from tqdm import tqdm

# ── Configuration ────────────────────────────────────────────────────
SCRIPT_DIR  = pathlib.Path(__file__).parent
FRAMES_DIR  = SCRIPT_DIR.parent / "data" / "frames"
OUT_DIR     = SCRIPT_DIR.parent.parent / "frontend" / "public" / "models"
LABELS      = ["engagement_eleve", "engagement_faible", "confusion",
               "frustration", "ennui", "neutre"]
LABEL2IDX   = {l: i for i, l in enumerate(LABELS)}

# ── CLI ──────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument("--epochs", type=int, default=30)
parser.add_argument("--batch",  type=int, default=32)
parser.add_argument("--img",    type=int, default=96,
                    help="Taille de l'image (px). 96 = entrée face-api.js")
args = parser.parse_args()
IMG_SIZE = (args.img, args.img)


# ── 1. Chargement des images ─────────────────────────────────────────
def load_dataset():
    X, y = [], []
    totals = {}
    for label in LABELS:
        d = FRAMES_DIR / label
        if not d.exists():
            print(f"  ⚠️  Dossier manquant : {d}")
            totals[label] = 0
            continue
        files = list(d.glob("*.jpg"))
        totals[label] = len(files)
        for fp in tqdm(files, desc=label, unit="img"):
            try:
                img = Image.open(fp).convert("RGB").resize(IMG_SIZE)
                X.append(np.array(img, dtype=np.float32) / 255.0)
                y.append(LABEL2IDX[label])
            except Exception as e:
                print(f"  ⚠️  Skip {fp.name}: {e}")
    print("\n📊 Distribution des frames :")
    for l, n in totals.items():
        bar = "█" * (n // 10) + "░" * max(0, 50 - n // 10)
        print(f"  {l:<22} {bar} {n}")
    return np.array(X), np.array(y)


print("\n🔍 Chargement des images…")
X, y = load_dataset()
if len(X) < 50:
    sys.exit("❌ Pas assez de frames (minimum 50). Collectez davantage via DataCollection.")

print(f"\n✅ {len(X)} images chargées")

# ── 2. Split train / val / test ──────────────────────────────────────
X_tv, X_test, y_tv, y_test = train_test_split(X, y, test_size=0.10, stratify=y, random_state=42)
X_train, X_val, y_train, y_val = train_test_split(X_tv, y_tv, test_size=0.111, stratify=y_tv, random_state=42)
print(f"   Train {len(X_train)} / Val {len(X_val)} / Test {len(X_test)}")

# ── 3. Data augmentation ─────────────────────────────────────────────
aug = tf.keras.Sequential([
    layers.RandomFlip("horizontal"),
    layers.RandomRotation(0.08),
    layers.RandomZoom(0.10),
    layers.RandomBrightness(0.15),
    layers.RandomContrast(0.10),
], name="augmentation")

# ── 4. Architecture : MobileNetV2 + tête de classification ──────────
base = MobileNetV2(input_shape=(*IMG_SIZE, 3), include_top=False, weights="imagenet")
base.trainable = False   # Phase 1 : feature extraction

inp  = tf.keras.Input(shape=(*IMG_SIZE, 3))
x    = aug(inp, training=True)
x    = base(x, training=False)
x    = layers.GlobalAveragePooling2D()(x)
x    = layers.Dropout(0.3)(x)
x    = layers.Dense(128, activation="relu")(x)
x    = layers.Dropout(0.2)(x)
out  = layers.Dense(len(LABELS), activation="softmax")(x)
model = Model(inp, out)

model.compile(
    optimizer=tf.keras.optimizers.Adam(1e-3),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"],
)
model.summary(print_fn=lambda s: None)   # silencieux

# ── 5. Phase 1 : entraîner la tête (feature extraction) ─────────────
print("\n🚀 Phase 1 — Feature extraction (backbone gelé)…")
cb1 = [
    EarlyStopping(patience=5, restore_best_weights=True, monitor="val_accuracy"),
    ReduceLROnPlateau(factor=0.5, patience=3, min_lr=1e-6),
]
h1 = model.fit(
    X_train, y_train,
    validation_data=(X_val, y_val),
    epochs=args.epochs,
    batch_size=args.batch,
    callbacks=cb1,
    verbose=1,
)

# ── 6. Phase 2 : fine-tune les dernières couches du backbone ─────────
print("\n🔧 Phase 2 — Fine-tuning (50 dernières couches)…")
base.trainable = True
for layer in base.layers[:-50]:
    layer.trainable = False

model.compile(
    optimizer=tf.keras.optimizers.Adam(1e-4),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"],
)
OUT_DIR.mkdir(parents=True, exist_ok=True)
keras_path = str(OUT_DIR / "emotion_africain.keras")
cb2 = [
    # Sauvegarde pendant fit() — évite le segfault post-training de TF 2.21
    ModelCheckpoint(keras_path, save_best_only=True, monitor="val_accuracy"),
    EarlyStopping(patience=7, restore_best_weights=True, monitor="val_accuracy"),
    ReduceLROnPlateau(factor=0.5, patience=3, min_lr=1e-7),
]
h2 = model.fit(
    X_train, y_train,
    validation_data=(X_val, y_val),
    epochs=args.epochs,
    batch_size=args.batch,
    callbacks=cb2,
    verbose=1,
)

# ── 7. Évaluation ────────────────────────────────────────────────────
print("\n📈 Évaluation sur le jeu de test…")
loss, acc = model.evaluate(X_test, y_test, verbose=0)
print(f"   Accuracy : {acc:.3f}  |  Loss : {loss:.4f}")

y_pred = np.argmax(model.predict(X_test, verbose=0), axis=1)
print("\n" + classification_report(y_test, y_pred, target_names=LABELS, zero_division=0))

cm = confusion_matrix(y_test, y_pred)
print("Matrice de confusion :")
print(cm)

# Sauvegarde du rapport
report = classification_report(y_test, y_pred, target_names=LABELS,
                                output_dict=True, zero_division=0)
report_path = SCRIPT_DIR / "evaluation_report.json"
with open(report_path, "w") as f:
    json.dump({"accuracy": float(acc), "loss": float(loss),
               "report": report, "labels": LABELS}, f, indent=2)
print(f"\n✅ Rapport sauvegardé → {report_path}")

# ── 8. Export ONNX ───────────────────────────────────────────────────
import subprocess as _sp
OUT_DIR.mkdir(parents=True, exist_ok=True)
onnx_path = OUT_DIR / "emotion_africain.onnx"
saved_model_dir = str(OUT_DIR / "emotion_savedmodel")

# Le modèle est déjà sauvegardé par ModelCheckpoint pendant fit()
print(f"\n📦 Modèle Keras (sauvegardé pendant training) → {keras_path}")
print(f"📦 Conversion ONNX → {onnx_path}…")
res = _sp.run(
    [sys.executable, "-m", "tf2onnx.convert",
     "--keras", keras_path,
     "--output", str(onnx_path),
     "--opset", "13"],
    capture_output=True, text=True
)
if res.returncode != 0:
    print(f"[ERREUR tf2onnx] {res.stderr[-500:]}")
    sys.exit(1)
print("✅ Export ONNX terminé")

# Sauvegarde du mapping label→index
labels_path = OUT_DIR / "emotion_labels.json"
with open(labels_path, "w") as f:
    json.dump(LABELS, f)
print(f"✅ Labels → {labels_path}")

print(f"""
╔══════════════════════════════════════════════════════════╗
║  Entraînement terminé                                    ║
║  Accuracy test : {acc:.1%:<41}║
║  Modèle ONNX   : frontend/public/models/emotion_africain.onnx  ║
╚══════════════════════════════════════════════════════════╝
""")
