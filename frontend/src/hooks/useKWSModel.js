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
const CONFIDENCE_THRESHOLD = 0.60   // équilibre : assez bas pour valider, assez haut pour éviter le bruit
const ENTROPY_THRESHOLD    = 1.55   // strict (valeur d'origine) — rejette les prédictions incertaines (bruit)
const ENERGY_THRESHOLD     = 0.02   // capte aussi la parole un peu plus faible
const COLLECT_MS           = 1500   // 1.5s → ~149 frames, padded à 150

let _session   = null
let _loading   = false
let _failed    = false
let _failCount = 0
const MAX_RETRIES = 3

async function getKWSSession() {
  if (_session) return _session
  if (_loading) return null
  if (_failed && _failCount >= MAX_RETRIES) return null
  _loading = true
  _failed  = false
  try {
    const ort = (await import('onnxruntime-web/wasm')).default ?? (await import('onnxruntime-web/wasm'))
    // Les fichiers ort-wasm-* sont dans public/ → servis depuis '/' (Netlify, dev, partout)
    // Ne JAMAIS pointer vers le proxy CF qui ne les héberge pas.
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
    _failCount++
    console.warn(`[KWS-V4] Chargement échoué (${_failCount}/${MAX_RETRIES}) :`, e.message)
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

// ── Seuil VAD énergie float32 (calibré micro standard) ───────────
// RMS > 0.008 sur au moins 4 chunks consécutifs (~370ms) → parole active
const VAD_RMS_THRESHOLD = 0.008
const VAD_CONFIRM_FRAMES = 4   // fenêtres consécutives pour confirmer début/fin parole

export function useKWSModel(audioActive, onVadActivity, sharedStreamRef = null) {
  const [lastKeyword, setLastKeyword] = useState(null)
  const [kwsReady,    setKwsReady]    = useState(false)

  const ctxRef         = useRef(null)
  const procRef        = useRef(null)
  const bufferRef      = useRef([])
  const activeRef      = useRef(false)
  const srRef          = useRef(44100)
  const onVadRef       = useRef(onVadActivity)
  // VAD state
  const vadActiveRef   = useRef(false)
  const vadStartRef    = useRef(0)
  const vadFramesRef   = useRef(0)   // frames consécutives au-dessus du seuil
  const gestureCleanupRef = useRef(null)  // retire les listeners de reprise audio
  const ownStreamRef      = useRef(null)  // piste micro que CE hook a ouverte (à fermer)
  // Anti-rebond : évite la ré-émission du même mot sur fenêtres qui se recouvrent
  const lastEmitRef    = useRef({ keyword: null, t: 0 })

  useEffect(() => { onVadRef.current = onVadActivity }, [onVadActivity])

  const startListening = useCallback(async () => {
    if (activeRef.current) return
    activeRef.current = true
    try {
      // 1) Créer + REPRENDRE le contexte AVANT getUserMedia. La demande de
      //    permission micro peut consommer la fenêtre d'activation du geste ;
      //    si le contexte est créé après, il reste "suspended" et aucun audio
      //    n'est traité → aucune commande détectée.
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      ctxRef.current = ctx
      srRef.current  = ctx.sampleRate
      try { await ctx.resume() } catch {}
      // Filet : relance le contexte au prochain geste tant qu'il n'est pas "running"
      const resumeCtx = () => { ctxRef.current?.resume?.().catch(() => {}) }
      const evs = ['pointerdown', 'keydown', 'touchstart', 'click']
      evs.forEach(e => window.addEventListener(e, resumeCtx, { passive: true }))
      gestureCleanupRef.current = () => evs.forEach(e => window.removeEventListener(e, resumeCtx))

      // 2) Micro — réutilise la piste déjà ouverte par le parent si fournie
      //    (évite une 2e capture du même micro, qui revient muette sur certains
      //    navigateurs → rms=0). Sinon, on ouvre notre propre piste.
      let stream = sharedStreamRef?.current || null
      const ownStream = !stream
      if (!stream) {
        // Réglages PAR DÉFAUT : le modèle KWS a été entraîné sur l'audio traité
        // (AEC/NS/AGC) du navigateur. Désactiver ces traitements dégrade fortement
        // la reconnaissance (la voix passe pour du « bruit de fond »).
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      ownStreamRef.current = ownStream ? stream : null
      if (!activeRef.current) { if (ownStream) stream.getTracks().forEach(t => t.stop()); return }
      const source = ctx.createMediaStreamSource(stream)

      // 3) Capture via AudioWorklet (remplace le ScriptProcessorNode déprécié).
      //    Le worklet tourne sur le thread audio et POSTe des blocs au thread JS.
      await ctx.audioWorklet.addModule('/kws-worklet.js')
      const node = new AudioWorkletNode(ctx, 'kws-capture')
      procRef.current = node
      source.connect(node)
      // GainNode silencieux : garde le nœud dans le graphe sans router le micro
      // vers les haut-parleurs (n'interfère pas avec le TTS d'Alisha).
      const silencer = ctx.createGain()
      silencer.gain.value = 0
      node.connect(silencer)
      silencer.connect(ctx.destination)

      // Inférence déclenchée à la FIN d'une parole (VAD) → mot complet & aligné.
      // Repli périodique (HOP_MS) quand aucune parole n'est en cours.
      const HOP_MS    = 500
      let lastHopTime = 0
      let inferring   = false

      const emitDebounced = (result) => {
        const t  = Date.now()
        const le = lastEmitRef.current
        const REFRACTORY_MS = 1500
        if (result.keyword !== le.keyword || t - le.t > REFRACTORY_MS) {
          lastEmitRef.current = { keyword: result.keyword, t }
          setLastKeyword({ ...result, timestamp: t })
        } else {
          lastEmitRef.current.t = t
        }
      }

      const runInference = async () => {
        if (inferring || !KWS_MODEL_READY) return
        const needed = Math.ceil(srRef.current * COLLECT_MS / 1000)
        if (bufferRef.current.length < needed) return
        inferring = true
        try {
          const pcm    = new Float32Array(bufferRef.current.slice(-needed))
          const result = await inferKWS(pcm, srRef.current)
          if (result) emitDebounced(result)
        } finally {
          inferring = false
        }
      }

      // Blocs audio reçus du worklet (Float32Array ~2048 échantillons)
      node.port.onmessage = (e) => {
        if (!activeRef.current) return
        const chunk = e.data
        bufferRef.current.push(...chunk)

        const needed = Math.ceil(srRef.current * COLLECT_MS / 1000)
        if (bufferRef.current.length > needed * 2)
          bufferRef.current = bufferRef.current.slice(-needed)

        // ── VAD énergie (déclenchement KWS + log engagement) ──
        let sumSq = 0
        for (let i = 0; i < chunk.length; i++) sumSq += chunk[i] * chunk[i]
        const rms       = Math.sqrt(sumSq / chunk.length)
        const isSpeech  = rms > VAD_RMS_THRESHOLD
        let speechEnded = false

        if (isSpeech) {
          vadFramesRef.current += 1
          if (!vadActiveRef.current && vadFramesRef.current >= VAD_CONFIRM_FRAMES) {
            vadActiveRef.current = true
            vadStartRef.current  = Date.now()
          }
        } else {
          if (vadActiveRef.current) {
            const durMs = Date.now() - vadStartRef.current
            const dur   = Math.round(durMs / 1000)
            if (dur >= 1 && onVadRef.current) onVadRef.current(dur)   // log engagement
            if (durMs >= 300 && durMs <= 1700) speechEnded = true     // mot exploitable
          }
          vadActiveRef.current = false
          vadFramesRef.current = 0
        }

        // ── Déclenchement ──
        if (speechEnded) {
          runInference()
        } else if (!vadActiveRef.current) {
          const now = Date.now()
          if (now - lastHopTime >= HOP_MS) {
            lastHopTime = now
            runInference()
          }
        }
      }

      getKWSSession().then(s => setKwsReady(!!s))
    } catch (e) {
      console.warn('[KWS-V4] Audio worklet indisponible :', e.message)
      activeRef.current = false
    }
  }, [])

  const stopListening = useCallback(() => {
    // Émet l'événement de fin si parole en cours au moment de l'arrêt
    if (vadActiveRef.current && onVadRef.current) {
      const dur = Math.round((Date.now() - vadStartRef.current) / 1000)
      if (dur >= 1) onVadRef.current(dur)
    }
    vadActiveRef.current = false
    vadFramesRef.current = 0
    activeRef.current = false
    gestureCleanupRef.current?.()
    gestureCleanupRef.current = null
    // Ne ferme QUE la piste que ce hook a ouverte (jamais la piste partagée du parent)
    ownStreamRef.current?.getTracks().forEach(t => t.stop())
    ownStreamRef.current = null
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
