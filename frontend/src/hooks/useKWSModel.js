/**
 * Hook de détection de mots-clés (KWS) — modèle V3 CNN+BiLSTM+Attention.
 * Features : MFCC + Δ + Δ² (120 coeff × 100 frames).
 * Normalisation globale avec stats du train set (kws_stats_v3.json).
 * Rejet des prédictions incertaines via seuil d'entropie.
 *
 * Usage :
 *   const { lastKeyword, kwsReady } = useKWSModel(audioActive)
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { computeMFCCFull, MAX_FRAMES_V3, resampleTo16k } from '../utils/mfcc'
import { KWS_MODEL_READY } from '../config/models'

const N_FEATURES         = 120   // MFCC + Δ + Δ²
const LABELS             = ['aide','oui','non','repeter','incompris','lentement','bruit_silence']
const CONFIDENCE_THRESHOLD = 0.65   // relevé pour réduire les faux positifs "incompris"
const ENTROPY_THRESHOLD    = 1.30   // abaissé pour rejeter plus agressivement le bruit
const ENERGY_THRESHOLD     = 0.03   // RMS minimum — ignore le silence et le bruit ambiant
const COLLECT_MS           = 1100

// ── Singletons module-level ────────────────────────────────────────────────
let _session   = null
let _loading   = false
let _failed    = false
let _normMean  = null   // Float32Array (120,) — chargé depuis kws_stats_v3.json
let _normStd   = null

async function loadNormStats() {
  if (_normMean) return true
  try {
    const res  = await fetch('/models/kws_stats_v3.json')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    _normMean  = new Float32Array(json.mean)
    _normStd   = new Float32Array(json.std)
    return true
  } catch (e) {
    console.warn('[KWS-V3] Stats normalisation non trouvées :', e.message)
    return false
  }
}

async function getKWSSession() {
  if (_session) return _session
  if (_loading) return null
  if (_failed)  return null
  _loading = true

  try {
    const statsOk = await loadNormStats()
    if (!statsOk) {
      _failed  = true
      _loading = false
      return null
    }

    const ort = (await import('onnxruntime-web')).default ?? (await import('onnxruntime-web'))
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/'
    ort.env.wasm.numThreads = 1

    _session = await ort.InferenceSession.create(
      '/models/kws_commands_v3.onnx',
      { executionProviders: ['wasm'] }
    )
    _loading = false
    console.log('[KWS-V3] ✓ Modèle CNN+BiLSTM+Attn chargé')
    console.log('[KWS-V3] Inputs :', _session.inputNames, 'Outputs :', _session.outputNames)
    return _session
  } catch (e) {
    console.warn('[KWS-V3] Chargement échoué :', e.message)
    _loading = false
    _failed  = true
    return null
  }
}

// Pas de préchargement au démarrage — chargement à la demande quand l'audio s'active.
// Évite le conflit WASM avec useEmotionOnnx qui charge au démarrage.

// ── Inférence ─────────────────────────────────────────────────────────────
async function inferKWS(pcmFloat32, nativeSR) {
  const session = await getKWSSession()
  if (!session) return null

  try {
    const ort = (await import('onnxruntime-web')).default ?? (await import('onnxruntime-web'))

    // Rééchantillonne à 16kHz
    const pcm16 = resampleTo16k(pcmFloat32, nativeSR)

    // VAD énergie : ignore le silence et le bruit ambiant
    let sumSq = 0
    for (let i = 0; i < pcm16.length; i++) sumSq += pcm16[i] * pcm16[i]
    const rms = Math.sqrt(sumSq / pcm16.length)
    if (rms < ENERGY_THRESHOLD) return null

    // MFCC + Δ + Δ² → (120 * 100) row-major
    const full = computeMFCCFull(pcm16)   // Float32Array (12 000)

    // Normalisation globale par feature (μ, σ du train set)
    // full layout : feature k → indices [k*100 .. k*100+99]
    for (let k = 0; k < N_FEATURES; k++) {
      const mean = _normMean[k]
      const std  = _normStd[k] + 1e-8
      for (let t = 0; t < MAX_FRAMES_V3; t++) {
        full[k * MAX_FRAMES_V3 + t] = (full[k * MAX_FRAMES_V3 + t] - mean) / std
      }
    }

    // Tensor shape (1, 1, 120, 100) — batch, channel, features, time
    const tensor = new ort.Tensor('float32', full, [1, 1, N_FEATURES, MAX_FRAMES_V3])
    const feeds  = { [session.inputNames[0]]: tensor }
    const out    = await session.run(feeds)
    const logits = Array.from(out[session.outputNames[0]].data)

    // Softmax
    const maxL = Math.max(...logits)
    const exps = logits.map(x => Math.exp(x - maxL))
    const sumE = exps.reduce((a, b) => a + b, 0)
    const probs = exps.map(x => x / sumE)

    // Entropie — rejette si trop incertain
    const entropy = -probs.reduce((acc, p) => acc + (p > 0 ? p * Math.log(p) : 0), 0)
    if (entropy > ENTROPY_THRESHOLD) {
      console.log(`[KWS-V3] Rejet entropie ${entropy.toFixed(3)} > ${ENTROPY_THRESHOLD}`)
      return null
    }

    let maxIdx = 0
    probs.forEach((p, i) => { if (p > probs[maxIdx]) maxIdx = i })

    if (LABELS[maxIdx] === 'bruit_silence') return null
    if (probs[maxIdx] < CONFIDENCE_THRESHOLD) return null

    console.log('[KWS-V3]', LABELS[maxIdx], `${(probs[maxIdx]*100).toFixed(1)}%`,
                `entropie=${entropy.toFixed(3)}`)

    return { keyword: LABELS[maxIdx], confidence: probs[maxIdx] }
  } catch (e) {
    console.warn('[KWS-V3] Inférence échouée :', e.message)
    return null
  }
}

// ── Hook React ────────────────────────────────────────────────────────────
export function useKWSModel(audioActive) {
  const [lastKeyword, setLastKeyword] = useState(null)
  const [kwsReady,    setKwsReady]    = useState(false)

  const ctxRef    = useRef(null)
  const procRef   = useRef(null)
  const bufferRef = useRef([])
  const activeRef = useRef(false)
  const srRef     = useRef(44100)

  const startListening = useCallback(async () => {
    if (activeRef.current) return
    activeRef.current = true
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx    = new (window.AudioContext || window.webkitAudioContext)()
      ctxRef.current = ctx
      srRef.current  = ctx.sampleRate

      const source = ctx.createMediaStreamSource(stream)
      const proc   = ctx.createScriptProcessor(4096, 1, 1)
      procRef.current = proc
      source.connect(proc)
      proc.connect(ctx.destination)

      proc.onaudioprocess = async (e) => {
        if (!activeRef.current) return
        const chunk = e.inputBuffer.getChannelData(0)
        bufferRef.current.push(...chunk)

        const needed = Math.ceil(srRef.current * COLLECT_MS / 1000)
        if (bufferRef.current.length < needed) return

        const pcm = new Float32Array(bufferRef.current.splice(0, needed))
        bufferRef.current = []

        if (!KWS_MODEL_READY) return

        const result = await inferKWS(pcm, srRef.current)
        if (result) {
          setLastKeyword({ ...result, timestamp: Date.now() })
        }
      }

      // Précharge modèle en arrière-plan
      getKWSSession().then(s => setKwsReady(!!s))
    } catch (e) {
      console.warn('[KWS-V3] Micro non disponible :', e.message)
    }
  }, [])

  const stopListening = useCallback(() => {
    activeRef.current = false
    procRef.current?.disconnect()
    ctxRef.current?.close()
    ctxRef.current  = null
    procRef.current = null
    bufferRef.current = []
  }, [])

  useEffect(() => {
    if (audioActive) startListening()
    else             stopListening()
    return stopListening
  }, [audioActive, startListening, stopListening])

  return { lastKeyword, kwsReady }
}
