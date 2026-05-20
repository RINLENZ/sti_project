/**
 * Hook de détection d'émotion via notre modèle ONNX africain (EfficientNet-B0).
 * Format d'entrée : (1, 3, 224, 224) channels-first, normalisé ImageNet.
 * Désactivé tant que MODELS_READY = false.
 */
import { useRef } from 'react'
import { MODELS_READY } from '../config/models'

const IMG_SIZE = 224
const LABELS   = ['engagement_eleve','engagement_faible','confusion','frustration','ennui','neutre']

// ImageNet mean/std — doivent correspondre exactement à la normalisation d'entraînement
const MEAN = [0.485, 0.456, 0.406]
const STD  = [0.229, 0.224, 0.225]

let _session = null
let _loading = false

async function getSession() {
  if (_session) return _session
  if (_loading) return null
  _loading = true
  try {
    const ort = await import('onnxruntime-web')
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/'
    _session = await ort.InferenceSession.create('/models/emotion_africain.onnx')
    console.log('[EmotionONNX] Modèle EfficientNet-B0 chargé ✓')
    return _session
  } catch (e) {
    console.warn('[EmotionONNX] Chargement échoué :', e.message)
    _loading = false
    return null
  }
}

export function useEmotionOnnx() {
  const canvasRef = useRef(null)

  function getCanvas() {
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas')
    return canvasRef.current
  }

  async function predict(videoElement) {
    if (!MODELS_READY) return null
    if (!videoElement?.videoWidth) return null
    const session = await getSession()
    if (!session) return null
    try {
      const ort = await import('onnxruntime-web')

      // Resize à 224×224 via canvas
      const canvas = getCanvas()
      canvas.width  = IMG_SIZE
      canvas.height = IMG_SIZE
      canvas.getContext('2d').drawImage(videoElement, 0, 0, IMG_SIZE, IMG_SIZE)
      const { data } = canvas.getContext('2d').getImageData(0, 0, IMG_SIZE, IMG_SIZE)

      // Channels-first (1, 3, 224, 224) + normalisation ImageNet
      const n     = IMG_SIZE * IMG_SIZE
      const input = new Float32Array(3 * n)
      for (let i = 0; i < n; i++) {
        input[i]         = (data[i * 4]     / 255 - MEAN[0]) / STD[0]  // R
        input[n + i]     = (data[i * 4 + 1] / 255 - MEAN[1]) / STD[1]  // G
        input[2 * n + i] = (data[i * 4 + 2] / 255 - MEAN[2]) / STD[2]  // B
      }

      const tensor = new ort.Tensor('float32', input, [1, 3, IMG_SIZE, IMG_SIZE])
      const feeds  = { [session.inputNames[0]]: tensor }
      const out    = await session.run(feeds)
      const logits = out[session.outputNames[0]].data

      // Softmax
      const maxL  = Math.max(...logits)
      const exps  = Array.from(logits).map(x => Math.exp(x - maxL))
      const sumE  = exps.reduce((a, b) => a + b, 0)
      const probs = exps.map(x => x / sumE)

      let maxIdx = 0
      probs.forEach((p, i) => { if (p > probs[maxIdx]) maxIdx = i })

      return {
        emotion:    LABELS[maxIdx],
        confidence: probs[maxIdx],
        probs:      Object.fromEntries(LABELS.map((l, i) => [l, probs[i]])),
        source:     'onnx_africain',
      }
    } catch (e) {
      console.warn('[EmotionONNX] Prédiction échouée :', e.message)
      return null
    }
  }

  return { predict }
}
