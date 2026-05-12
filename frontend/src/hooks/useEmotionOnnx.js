/**
 * Hook de détection d'émotion via notre modèle ONNX africain.
 * Désactivé tant que MODELS_READY = false — ne remplace pas face-api.js.
 */
import { useRef } from 'react'
import { MODELS_READY } from '../config/models'

const IMG_SIZE = 96
const LABELS   = ['engagement_eleve','engagement_faible','confusion','frustration','ennui','neutre']

let _session    = null
let _loading    = false

async function getSession() {
  if (_session) return _session
  if (_loading) return null
  _loading = true
  try {
    const ort = await import('onnxruntime-web')
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/'
    _session = await ort.InferenceSession.create('/models/emotion_africain.onnx')
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
      const canvas = getCanvas()
      canvas.width  = IMG_SIZE
      canvas.height = IMG_SIZE
      canvas.getContext('2d').drawImage(videoElement, 0, 0, IMG_SIZE, IMG_SIZE)
      const { data } = canvas.getContext('2d').getImageData(0, 0, IMG_SIZE, IMG_SIZE)

      // (1, 96, 96, 3) float32
      const input = new Float32Array(IMG_SIZE * IMG_SIZE * 3)
      for (let i = 0; i < IMG_SIZE * IMG_SIZE; i++) {
        input[i * 3]     = data[i * 4]     / 255
        input[i * 3 + 1] = data[i * 4 + 1] / 255
        input[i * 3 + 2] = data[i * 4 + 2] / 255
      }

      const tensor = new ort.Tensor('float32', input, [1, IMG_SIZE, IMG_SIZE, 3])
      const feeds  = { [session.inputNames[0]]: tensor }
      const out    = await session.run(feeds)
      const probs  = out[session.outputNames[0]].data

      let maxIdx = 0
      for (let i = 1; i < probs.length; i++) if (probs[i] > probs[maxIdx]) maxIdx = i

      return {
        emotion:    LABELS[maxIdx],
        confidence: probs[maxIdx],
        probs:      Object.fromEntries(LABELS.map((l, i) => [l, probs[i]])),
        source:     'onnx_africain',
      }
    } catch { return null }
  }

  return { predict }
}
