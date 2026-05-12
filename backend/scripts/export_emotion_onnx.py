"""
Export standalone : charge emotion_weights.npz et génère emotion_africain.onnx
Usage : python scripts/export_emotion_onnx.py [--img 96]
"""
import argparse, os, sys, json, pathlib, subprocess, textwrap
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument("--img", type=int, default=96)
args = parser.parse_args()
IMG_H = IMG_W = args.img

SCRIPT_DIR   = pathlib.Path(__file__).parent
OUT_DIR      = SCRIPT_DIR.parent.parent / "frontend" / "public" / "models"
weights_path = str(OUT_DIR / "emotion_weights.npz")
onnx_path    = str(OUT_DIR / "emotion_africain.onnx")
labels_path  = str(OUT_DIR / "emotion_labels.json")

LABELS = ["engagement_eleve", "engagement_faible", "confusion",
          "frustration", "ennui", "neutre"]

if not os.path.exists(weights_path):
    sys.exit(f"❌ Fichier introuvable : {weights_path}\n   Lance d'abord train_emotion_model.py")

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

base = MobileNetV2(input_shape=(IMG_H, IMG_W, 3), include_top=False, weights=None)
inp  = tf.keras.Input(shape=(IMG_H, IMG_W, 3))
x    = base(inp, training=False)
x    = layers.GlobalAveragePooling2D()(x)
x    = layers.Dropout(0.3)(x)
x    = layers.Dense(128, activation="relu")(x)
x    = layers.Dropout(0.2)(x)
out  = layers.Dense(N_LABELS, activation="softmax")(x)
model_inf = Model(inp, out)

data = np.load(WEIGHTS_PATH, allow_pickle=True)
saved_weights = [data[k] for k in sorted(data.files, key=lambda x: int(x.replace("arr_","")))]

try:
    model_inf.set_weights(saved_weights)
    print("Poids chargés directement")
except ValueError as e:
    print(f"Ajustement nécessaire: {{e}}")
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

print(f"📦 Conversion ONNX → {onnx_path}…")
res = subprocess.run([sys.executable, "-c", conv_script], capture_output=True, text=True)
if res.returncode != 0:
    print(f"[ERREUR]\n{res.stderr[-800:]}")
    sys.exit(1)
print(res.stdout.strip())

with open(labels_path, "w") as f:
    json.dump(LABELS, f)

print(f"✅ ONNX → {onnx_path}")
print(f"✅ Labels → {labels_path}")
