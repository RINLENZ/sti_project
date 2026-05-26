/**
 * Hook KWS — modèle Audio V2 AudioResNet (log-Mel + Δ + ΔΔ, 3 canaux).
 * Input  : (1, 3, 80, 150) — 3 canaux × 80 mels × 150 frames
 * Output : logits (7 classes), calibré par temperature scaling T=0.9513
 * Pas de stats de normalisation externe (le modèle normalise en interne).
 *
 * Usage : const { lastKeyword, kwsReady } = useKWSModel(audioActive)
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { computeLogMelFull, MAX_FRAMES_V4, resampleTo16k } from '../utils/mfcc'
import { KWS_MODEL_READY } from '../config/models'

const N_MELS_V4          = 80
const TEMPERATURE        = 0.9513642191886902  // calibration temperature scaling
const LABELS             = ['aide','oui','non','repeter','incompris','lentement','bruit_silence']
const CONFIDENCE_THRESHOLD = 0.68
const ENTROPY_THRESHOLD    = 1.55
const ENERGY_THRESHOLD     = 0.03
const COLLECT_MS           = 1500   // 1.5s → ~149 frames, padded à 150

let _session = null
let _loading = false
let _failed  = false

async function getKWSSession() {
  if (_session) return _session
  if (_loading) return null
  if (_failed)  return null
  _loading = true
  try {
    const ort = (await import('onnxruntime-web/wasm')).default ?? (await import('onnxruntime-web/wasm'))
    ort.env.wasm.wasmPaths = '/'
    ort.env.wasm.numThreads = 1
    _session = await ort.InferenceSession.create(
      '/models/model_audio_v2_final.onnx',
      { executionProviders: ['wasm'] }
    )
    _loading = false
    console.log('[KWS-V4] ✓ AudioResNet chargé')
    console.log('[KWS-V4] Inputs :', _session.inputNames, 'Outputs :', _session.outputNames)
    return _session
  } catch (e) {
    console.warn('[KWS-V4] Chargement échoué :', e.message)
    _loading = false
    _failed  = true
    return null
  }
}

async function inferKWS(pcmFloat32, nativeSR) {
  const session = await getKWSSession()
  if (!session) return null
  try {
    const ort   = (await import('onnxruntime-web/wasm')).default ?? (await import('onnxruntime-web/wasm'))
    const pcm16 = resampleTo16k(pcmFloat32, nativeSR)

    // VAD énergie
    let sumSq = 0
    for (let i = 0; i < pcm16.length; i++) sumSq += pcm16[i] * pcm16[i]
    if (Math.sqrt(sumSq / pcm16.length) < ENERGY_THRESHOLD) return null

    // log-Mel + Δ + ΔΔ → (3, 80, 150) = 36 000 valeurs
    const features = computeLogMelFull(pcm16)

    // Tensor shape (1, 3, 80, 150)
    const tensor = new ort.Tensor('float32', features, [1, 3, N_MELS_V4, MAX_FRAMES_V4])
    const out    = await session.run({ [session.inputNames[0]]: tensor })
    const logits = Array.from(out[session.outputNames[0]].data)

    // Temperature scaling puis softmax
    const scaled = logits.map(v => v / TEMPERATURE)
    const maxL   = Math.max(...scaled)
    const exps   = scaled.map(x => Math.exp(x - maxL))
    const sumE   = exps.reduce((a, b) => a + b, 0)
    const probs  = exps.map(x => x / sumE)

    // Rejet entropie
    const entropy = -probs.reduce((acc, p) => acc + (p > 0 ? p * Math.log(p) : 0), 0)
    if (entropy > ENTROPY_THRESHOLD) {
      console.log(`[KWS-V4] Rejet entropie ${entropy.toFixed(3)}`)
      return null
    }

    let maxIdx = 0
    probs.forEach((p, i) => { if (p > probs[maxIdx]) maxIdx = i })

    if (LABELS[maxIdx] === 'bruit_silence') return null
    if (probs[maxIdx] < CONFIDENCE_THRESHOLD) return null

    return { keyword: LABELS[maxIdx], confidence: probs[maxIdx] }
  } catch (e) {
    console.warn('[KWS-V4] Inférence échouée :', e.message)
    return null
  }
}

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

      // Buffer glissant : évalue toutes les 500ms sur la dernière fenêtre de 1500ms
      // → garantit que chaque mot est capturé dans au moins une fenêtre
      const HOP_MS    = 500
      let lastHopTime = 0

      proc.onaudioprocess = async (e) => {
        if (!activeRef.current) return
        const chunk = e.inputBuffer.getChannelData(0)
        bufferRef.current.push(...chunk)

        const needed    = Math.ceil(srRef.current * COLLECT_MS / 1000)
        const hopNeeded = Math.ceil(srRef.current * HOP_MS / 1000)

        // Garde le buffer à taille max = 2 × fenêtre pour éviter croissance infinie
        if (bufferRef.current.length > needed * 2)
          bufferRef.current = bufferRef.current.slice(-needed)

        if (bufferRef.current.length < needed) return

        const now = Date.now()
        if (now - lastHopTime < HOP_MS) return
        lastHopTime = now

        // Prend la dernière fenêtre de 1500ms (glissante)
        const pcm = new Float32Array(bufferRef.current.slice(-needed))

        if (!KWS_MODEL_READY) return
        const result = await inferKWS(pcm, srRef.current)
        if (result) setLastKeyword({ ...result, timestamp: Date.now() })
      }

      getKWSSession().then(s => setKwsReady(!!s))
    } catch (e) {
      console.warn('[KWS-V4] Micro non disponible :', e.message)
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
