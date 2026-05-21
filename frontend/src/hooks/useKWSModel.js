/**
 * Hook de détection de mots-clés (KWS) via notre modèle ONNX.
 * Quand MODELS_READY = false : collecte audio mais n'envoie aucun signal.
 * Quand MODELS_READY = true  : détecte les commandes vocales et retourne
 *   { keyword, confidence, timestamp } via lastKeyword.
 *
 * Usage :
 *   const { lastKeyword, kwsReady } = useKWSModel(audioActive)
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { computeMFCC, resampleTo16k, N_FRAMES } from '../utils/mfcc'
import { MODELS_READY } from '../config/models'

const N_MFCC     = 40
const LABELS     = ['aide','oui','non','repeter','incompris','lentement','bruit_silence']
const CONFIDENCE_THRESHOLD = 0.65  // confiance minimale pour déclarer un mot-clé
const COLLECT_MS = 1100            // durée d'écoute par fenêtre (légèrement > 1s)

let _session  = null
let _loading  = false

async function getKWSSession() {
  if (_session) return _session
  if (_loading) return null
  _loading = true
  try {
    const ort = await import('onnxruntime-web')
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/'
    _session = await ort.InferenceSession.create(
      '/models/kws_commands.onnx',
      { executionProviders: ['wasm'] }
    )
    return _session
  } catch (e) {
    console.warn('[KWS] Chargement échoué :', e.message)
    _loading = false
    return null
  }
}

async function inferKWS(pcmFloat32, nativeSR) {
  const session = await getKWSSession()
  if (!session) return null
  try {
    const ort   = await import('onnxruntime-web')
    const pcm16 = resampleTo16k(pcmFloat32, nativeSR)
    const mfcc  = computeMFCC(pcm16)          // Float32Array (40 * 101)

    // Shape (1, 40, 101, 1)
    const input  = new Float32Array(N_MFCC * N_FRAMES)
    input.set(mfcc)
    const tensor = new ort.Tensor('float32', input, [1, N_MFCC, N_FRAMES, 1])
    const feeds  = { [session.inputNames[0]]: tensor }
    const out    = await session.run(feeds)
    const probs  = out[session.outputNames[0]].data

    let maxIdx = 0
    for (let i = 1; i < probs.length; i++) if (probs[i] > probs[maxIdx]) maxIdx = i

    // 'bruit_silence' est la classe "pas de commande"
    if (LABELS[maxIdx] === 'bruit_silence') return null
    if (probs[maxIdx] < CONFIDENCE_THRESHOLD) return null

    return { keyword: LABELS[maxIdx], confidence: probs[maxIdx] }
  } catch { return null }
}

export function useKWSModel(audioActive) {
  const [lastKeyword, setLastKeyword] = useState(null)
  const [kwsReady, setKwsReady]       = useState(false)

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
      // ScriptProcessor collecte des PCM bruts
      const proc = ctx.createScriptProcessor(4096, 1, 1)
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
        bufferRef.current = []  // reset pour la prochaine fenêtre

        if (!MODELS_READY) return  // modèle pas encore fiable

        const result = await inferKWS(pcm, srRef.current)
        if (result) {
          setLastKeyword({ ...result, timestamp: Date.now() })
        }
      }

      // Précharger le modèle ONNX en arrière-plan
      getKWSSession().then(s => setKwsReady(!!s))
    } catch (e) {
      console.warn('[KWS] Micro non disponible :', e.message)
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
