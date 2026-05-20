"""
Convertit model_emotions.pth (EfficientNet-B0 PyTorch) → emotion_africain.onnx

Usage :
    conda activate ml_env
    python convert_to_onnx.py

Le fichier .onnx est déposé dans frontend/public/models/emotion_africain.onnx
"""
import torch
import torchvision.models as models
import torch.nn as nn
from pathlib import Path

SRC_PTH  = Path("/home/djiomo/Téléchargements/model_emotions_v3.pth")
DST_ONNX = Path("/home/djiomo/sti_project/frontend/public/models/emotion_africain.onnx")
LABELS   = ["engagement_eleve", "engagement_faible", "confusion",
            "frustration", "ennui", "neutre"]

# ── Recharge l'architecture ─────────────────────────────────────────────────
checkpoint = torch.load(SRC_PTH, map_location="cpu")
n_classes  = len(LABELS)

net = models.efficientnet_b0(weights=None)
in_features = net.classifier[1].in_features   # 1280
net.classifier = nn.Sequential(
    nn.Dropout(p=0.2),
    nn.Linear(in_features, 512),
    nn.ReLU(),
    nn.Dropout(p=0.3),
    nn.Linear(512, n_classes),
)

state = checkpoint.get("model_state", checkpoint)
net.load_state_dict(state)
net.eval()

print(f"Modèle chargé — {sum(p.numel() for p in net.parameters()):,} paramètres")

# ── Export ONNX ──────────────────────────────────────────────────────────────
dummy   = torch.randn(1, 3, 224, 224)
DST_ONNX.parent.mkdir(parents=True, exist_ok=True)

torch.onnx.export(
    net,
    dummy,
    str(DST_ONNX),
    input_names=["input"],
    output_names=["output"],
    dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
    opset_version=13,
    do_constant_folding=True,
    dynamo=False,
)

print(f"ONNX exporté → {DST_ONNX}")
print(f"Taille : {DST_ONNX.stat().st_size / 1e6:.1f} MB")

# ── Vérification rapide ──────────────────────────────────────────────────────
import onnxruntime as ort
import numpy as np

sess    = ort.InferenceSession(str(DST_ONNX))
inp     = sess.get_inputs()[0]
out_n   = sess.get_outputs()[0]
print(f"Input  : {inp.name}  shape={inp.shape}  type={inp.type}")
print(f"Output : {out_n.name}  shape={out_n.shape}")

test_out = sess.run(None, {inp.name: np.random.randn(1, 3, 224, 224).astype(np.float32)})
probs    = torch.softmax(torch.tensor(test_out[0]), dim=1)[0].numpy()
for label, p in zip(LABELS, probs):
    print(f"  {label:<22}: {p:.3f}")

print("\nConversion OK — activation MODELS_READY dans models.js requise.")
