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
import argparse, os, sys, json, pathlib, subprocess, textwrap, time
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, Model
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
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
IMG_H, IMG_W = args.img, args.img


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
cb2 = [
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
               "report": report, "labels": LABELS,
               "trained_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}, f, indent=2)
print(f"\n✅ Rapport sauvegardé → {report_path}")

# ── 8. Sauvegarde poids numpy (évite le segfault de model.save() sur TF 2.21) ──
OUT_DIR.mkdir(parents=True, exist_ok=True)
weights_path = str(OUT_DIR / "emotion_weights.npz")
weights = model.get_weights()
np.savez(weights_path, *weights)
print(f"📦 Poids numpy → {weights_path}")

# ── 9. Export ONNX via subprocess isolé ─────────────────────────────
onnx_path   = str(OUT_DIR / "emotion_africain.onnx")
labels_path = str(OUT_DIR / "emotion_labels.json")

conv_script = textwrap.dedent(f"""
import os, sys, numpy as np
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
import tensorflow as tf
from tensorflow.keras import layers, Model
from tensorflow.keras.applications import MobileNetV2
import tf2onnx, onnx

IMG_H, IMG_W = {IMG_H}, {IMG_W}
N_LABELS     = {len(LABELS)}
WEIGHTS_PATH = r"{weights_path}"
ONNX_PATH    = r"{onnx_path}"

# Reconstruit l'architecture identique (sans augmentation, training=False)
base = MobileNetV2(input_shape=(IMG_H, IMG_W, 3), include_top=False, weights=None)
inp  = tf.keras.Input(shape=(IMG_H, IMG_W, 3))
x    = base(inp, training=False)
x    = layers.GlobalAveragePooling2D()(x)
x    = layers.Dropout(0.3)(x)
x    = layers.Dense(128, activation="relu")(x)
x    = layers.Dropout(0.2)(x)
out  = layers.Dense(N_LABELS, activation="softmax")(x)
model_inf = Model(inp, out)

# Charge les poids — attention : le modèle d'inférence n'a pas la couche aug
# → on saute les poids qui correspondent à l'augmentation (premiers N poids)
data = np.load(WEIGHTS_PATH, allow_pickle=True)
saved_weights = [data[k] for k in sorted(data.files, key=lambda x: int(x.replace("arr_","")))]

# Le modèle d'entraînement a la couche aug en plus.
# La couche aug (RandomFlip, RandomRotation...) n'a pas de poids entraînables,
# mais les indices peuvent différer. On tente set_weights directement.
try:
    model_inf.set_weights(saved_weights)
    print("Poids chargés directement")
except ValueError as e:
    # Si décalage dû à la couche aug, on cherche le bon sous-ensemble
    print(f"Ajustement poids nécessaire: {{e}}")
    inf_count = len(model_inf.get_weights())
    model_inf.set_weights(saved_weights[-inf_count:])
    print(f"Poids chargés (derniers {{inf_count}})")

inp_sig = [tf.TensorSpec(shape=(None, IMG_H, IMG_W, 3), dtype=tf.float32, name="input_1")]
model_proto, _ = tf2onnx.convert.from_keras(
    model_inf, input_signature=inp_sig, opset=13, output_path=ONNX_PATH
)
onnx.checker.check_model(onnx.load(ONNX_PATH))
print("ONNX OK")
""")

print(f"\n📦 Conversion ONNX → {onnx_path}…")
res = subprocess.run([sys.executable, "-c", conv_script], capture_output=True, text=True)
if res.returncode != 0:
    print(f"[ERREUR export_onnx]\n{res.stderr[-800:]}")
    sys.exit(1)
print(res.stdout.strip())
print("✅ Export ONNX terminé")

# ── 10. Labels ───────────────────────────────────────────────────────
with open(labels_path, "w") as f:
    json.dump(LABELS, f)
print(f"✅ Labels → {labels_path}")

print(f"""
╔══════════════════════════════════════════════════════════╗
║  Entraînement terminé                                    ║
║  Accuracy test : {acc:.1%}{"" :<{41 - len(f"{acc:.1%}")}}║
║  Modèle ONNX   : frontend/public/models/emotion_africain.onnx  ║
╚══════════════════════════════════════════════════════════╝
""")
