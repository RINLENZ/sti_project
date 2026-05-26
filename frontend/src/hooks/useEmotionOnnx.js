/**
 * Hook de détection d'émotion via notre modèle ONNX africain (EfficientNet-B0).
 * Format d'entrée : (1, 3, 224, 224) channels-first, normalisé ImageNet.
 */
import { useEffect, useRef } from 'react'
import { EMOTION_MODEL_READY } from '../config/models'

const IMG_SIZE    = 224
const TEMPERATURE = 0.8915   // T < 1 → affûte la distribution (modèle légèrement sous-confiant, ECE 0.037)
const LABELS      = ['engagement_eleve','engagement_faible','confusion','frustration','ennui','neutre']
const MEAN        = [0.485, 0.456, 0.406]
const STD         = [0.229, 0.224, 0.225]

let _session  = null
let _loading  = false
let _failed   = false

async function getSession() {
  if (_session)  return _session
  if (_loading)  return null
  if (_failed)   return null
  _loading = true
  console.log('[EmotionONNX] Chargement en cours...')
  try {
    const ort = (await import('onnxruntime-web/wasm')).default ?? (await import('onnxruntime-web/wasm'))
    ort.env.wasm.wasmPaths = import.meta.env.PROD
      ? 'https://sti-proxy.sergedjiomo01.workers.dev/static/wasm/ort/'
      : '/'
    ort.env.wasm.numThreads = 1

    // Timeout 30s pour détecter un blocage WASM silencieux
    const sessionPromise = ort.InferenceSession.create(
      '/models/model_emotions_v4_final.onnx',
      { executionProviders: ['wasm'] }
    )
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout 30s — WASM bloqué')), 30000)
    )
    _session = await Promise.race([sessionPromise, timeoutPromise])
    _loading = false
    console.log('[EmotionONNX] ✓ Modèle EfficientNet-B0 chargé')
    console.log('[EmotionONNX] Inputs :', _session.inputNames, 'Outputs :', _session.outputNames)
    return _session
  } catch (e) {
    console.error('[EmotionONNX] Échec :', e.message)
    _loading = false
    _failed  = true
    return null
  }
}

// Précharge dès l'import du module (avant que MediaPipe démarre)
if (EMOTION_MODEL_READY) {
  setTimeout(() => getSession(), 500)
}

export function useEmotionOnnx() {
  const canvasRef = useRef(null)

  function getCanvas() {
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas')
    return canvasRef.current
  }

  async function predict(videoElement) {
    if (!EMOTION_MODEL_READY) return null
    if (!videoElement?.videoWidth) return null
    const session = await getSession()
    if (!session) return null
    try {
      const ort = (await import('onnxruntime-web/wasm')).default ?? (await import('onnxruntime-web/wasm'))

      const canvas = getCanvas()
      canvas.width  = IMG_SIZE
      canvas.height = IMG_SIZE
      const ctx2d = canvas.getContext('2d', { willReadFrequently: true })
      ctx2d.drawImage(videoElement, 0, 0, IMG_SIZE, IMG_SIZE)
      const { data } = ctx2d.getImageData(0, 0, IMG_SIZE, IMG_SIZE)

      // (1, 3, 224, 224) channels-first + normalisation ImageNet
      const n     = IMG_SIZE * IMG_SIZE
      const input = new Float32Array(3 * n)
      for (let i = 0; i < n; i++) {
        input[i]         = (data[i * 4]     / 255 - MEAN[0]) / STD[0]
        input[n + i]     = (data[i * 4 + 1] / 255 - MEAN[1]) / STD[1]
        input[2 * n + i] = (data[i * 4 + 2] / 255 - MEAN[2]) / STD[2]
      }

      const tensor = new ort.Tensor('float32', input, [1, 3, IMG_SIZE, IMG_SIZE])
      const feeds  = { [session.inputNames[0]]: tensor }
      const out    = await session.run(feeds)
      const logits = Array.from(out[session.outputNames[0]].data)

      // Temperature scaling puis softmax (T=0.8915, modèle V4 légèrement sous-confiant)
      const scaled = logits.map(v => v / TEMPERATURE)
      const maxL   = Math.max(...scaled)
      const exps   = scaled.map(x => Math.exp(x - maxL))
      const sumE   = exps.reduce((a, b) => a + b, 0)
      const probs  = exps.map(x => x / sumE)

      let maxIdx = 0
      probs.forEach((p, i) => { if (p > probs[maxIdx]) maxIdx = i })

      return {
        emotion:    LABELS[maxIdx],
        confidence: probs[maxIdx],
        probs:      Object.fromEntries(LABELS.map((l, i) => [l, probs[i]])),
        source:     'onnx_africain',
      }
    } catch (e) {
      console.error('[EmotionONNX] Prédiction échouée :', e.message)
      return null
    }
  }

  return { predict }
}
