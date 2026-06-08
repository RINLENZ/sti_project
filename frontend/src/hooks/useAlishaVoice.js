/**
 * Hook voix Alisha — Edge TTS Neural (fr-FR-DeniseNeural ou VivienneMultilingualNeural)
 * avec fallback Web Speech API.
 *
 * Chaîne de priorité :
 *   1. Edge TTS via backend /api/tts/speak (qualité neural, cache IndexedDB)
 *   2. Web Speech API (voix locale FR si disponible, sinon cloud Google)
 *
 * Fixes :
 *   - request-ID mutex : chaque appel speakEdge() annule les requêtes en vol précédentes
 *   - cleanForTTS() : retire emojis + markdown avant de parler
 *   - cross-cancel : Edge TTS stoppe Web Speech et vice-versa
 *   - edgeAvailable : ne bascule sur false que si la requête N'a pas été supplantée
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { splitSpeechChunks, latexToFrench } from '../utils/latexToSpeech'
import { getAudio, setAudio } from '../services/ttsCache'
import { BASE_URL } from '../services/api'

const STORAGE_KEY     = 'alisha_voice_name'
const VOICE_SETUP_KEY = 'alisha_voice_setup_done'
const PREF_VOICE_KEY  = 'alisha_edge_voice'   // 'denise' | 'vivienne'

// ── Nettoyage du texte avant TTS ──────────────────────────────────
// Ordre important : LaTeX d'abord (remplace $...$ par du texte),
// puis emojis/markdown (évite de lire "backslash frac" ou "dollar").
function cleanForTTS(text) {
  if (!text) return ''
  // 1. Convertit LaTeX display ($$...$$) et inline ($...$) en français parlé
  let clean = text
    .replace(/\$\$([^$]+)\$\$/gs, (_, latex) => { try { return ' ' + latexToFrench(latex) + ' ' } catch { return ' ' } })
    .replace(/\$([^$\n]+)\$/g,    (_, latex) => { try { return ' ' + latexToFrench(latex) + ' ' } catch { return ' ' } })
  // 2. Emojis (plages Unicode principales)
  clean = clean
    .replace(/[\u{1F300}-\u{1FAD6}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}]/gu, '')
    // Markdown léger (* _ ` ~ # |)
    .replace(/[*_`~#|]/g, '')
    // Espaces multiples
    .replace(/\s{2,}/g, ' ')
    .trim()
  return clean
}

// ── Web Speech — scoring de voix (logique v1 conservée) ───────────

function scoreVoice(v) {
  if (!v.lang.startsWith('fr')) return -1
  let s = 0
  if (v.localService)                                 s += 100
  if (v.lang === 'fr-FR')                             s += 10
  if (/female|femme|hortense|amelie/i.test(v.name))  s += 5
  if (!v.localService && /google/i.test(v.name))      s += 8
  return s
}

function bestFrVoice(voices) {
  return voices
    .map(v => ({ v, s: scoreVoice(v) }))
    .filter(({ s }) => s >= 0)
    .sort((a, b) => b.s - a.s)[0]?.v || null
}

// ── Hook principal ────────────────────────────────────────────────

export default function useAlishaVoice() {

  // ── Refs Web Speech ───────────────────────────────────────────────
  const voiceRef   = useRef(null)
  const lockedRef  = useRef(false)
  const mountedRef = useRef(true)
  const readingRef = useRef(false)

  // ── Refs Edge TTS ─────────────────────────────────────────────────
  const audioRef      = useRef(null)   // HTMLAudioElement courant
  const edgeReqIdRef  = useRef(0)      // mutex : chaque appel incrémente, annule les précédents

  // ── State ─────────────────────────────────────────────────────────
  const [edgeVoice, setEdgeVoice] = useState(
    () => localStorage.getItem(PREF_VOICE_KEY) || 'denise'
  )
  const [edgeAvailable,   setEdgeAvailable]   = useState(true)
  const [isReading,       setIsReading]       = useState(false)
  const [needsVoiceSetup, setNeedsVoiceSetup] = useState(false)

  // ── Init Web Speech (fallback) ────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true
    if (!window.speechSynthesis) return

    function pickVoice(fromEvent = false) {
      if (!mountedRef.current || lockedRef.current) return
      const voices = window.speechSynthesis.getVoices()
      if (!voices.length) return

      const savedName = localStorage.getItem(STORAGE_KEY)
      if (savedName) {
        const saved = voices.find(v => v.name === savedName)
        if (saved) { voiceRef.current = saved; lockedRef.current = true; return }
        try { localStorage.removeItem(STORAGE_KEY) } catch {}
      }

      const best = bestFrVoice(voices)
      if (!best) return
      voiceRef.current = best

      if (!best.localService && !localStorage.getItem(VOICE_SETUP_KEY)) {
        setNeedsVoiceSetup(true)
      }

      if (best.localService || fromEvent) {
        lockedRef.current = true
        try { localStorage.setItem(STORAGE_KEY, best.name) } catch {}
      }
    }

    function onVoicesChanged() { pickVoice(true) }
    pickVoice(false)
    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged)

    return () => {
      mountedRef.current = false
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged)
      window.speechSynthesis.cancel()
    }
  }, [])

  // ── Helper interne : arrêter tout audio en cours ──────────────────
  const _stopAll = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      if (audioRef.current._blobUrl) URL.revokeObjectURL(audioRef.current._blobUrl)
      audioRef.current = null
    }
    window.speechSynthesis?.cancel()
  }, [])

  // ── Edge TTS — requête backend + cache IndexedDB ──────────────────
  const speakEdge = useCallback(async (text, { onStart, onEnd, onError } = {}) => {
    if (!text || !edgeAvailable) return false

    // Chaque appel génère un ID unique. Si un appel plus récent arrive
    // avant que celui-ci soit terminé, on abandonne silencieusement.
    const reqId = ++edgeReqIdRef.current

    // Stoppe immédiatement tout audio en cours (évite le double canal)
    _stopAll()

    try {
      // 1. Cache IndexedDB
      let audioBuf = await getAudio(edgeVoice, text)
      if (reqId !== edgeReqIdRef.current) return null  // supplanté → pas de fallback Web Speech

      if (!audioBuf) {
        // 2. Appel backend
        const resp = await fetch(`${BASE_URL}/api/tts/speak`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice: edgeVoice }),
          signal: AbortSignal.timeout(10000),
        })
        if (!resp.ok) throw new Error(`TTS HTTP ${resp.status}`)
        if (reqId !== edgeReqIdRef.current) return null  // supplanté

        audioBuf = await resp.arrayBuffer()
        if (reqId !== edgeReqIdRef.current) return null  // supplanté

        // Mise en cache async — ne bloque pas la lecture
        setAudio(edgeVoice, text, audioBuf).catch?.(() => {})
      }

      if (reqId !== edgeReqIdRef.current) return null  // supplanté

      // 3. Lecture HTMLAudioElement
      const blob = new Blob([audioBuf], { type: 'audio/mpeg' })
      const url  = URL.createObjectURL(blob)

      const audio = new Audio(url)
      audio._blobUrl  = url
      audioRef.current = audio

      audio.onplay  = onStart || null
      audio.onended = () => { URL.revokeObjectURL(url); onEnd?.() }
      audio.onerror = () => { URL.revokeObjectURL(url); onError?.() }

      await audio.play()
      return true
    } catch {
      // Ne marque pas edgeAvailable=false si la requête a été supplantée
      if (reqId === edgeReqIdRef.current) {
        setEdgeAvailable(false)
      }
      return false
    }
  }, [edgeVoice, edgeAvailable, _stopAll])

  // ── Web Speech — speak unitaire ───────────────────────────────────
  const speakWebSpeech = useCallback((text, { onStart, onEnd, onError, rate } = {}) => {
    if (!window.speechSynthesis || !text) return
    // Stoppe Edge TTS avant Web Speech (cross-cancel)
    if (audioRef.current) {
      audioRef.current.pause()
      if (audioRef.current._blobUrl) URL.revokeObjectURL(audioRef.current._blobUrl)
      audioRef.current = null
    }
    window.speechSynthesis.cancel()
    const utt  = new SpeechSynthesisUtterance(text)
    utt.lang   = 'fr-FR'
    utt.rate   = rate ?? 0.95
    utt.pitch  = (voiceRef.current?.localService ?? false) ? 1.15 : 1.0
    if (voiceRef.current) utt.voice = voiceRef.current
    if (onStart) utt.onstart = onStart
    if (onEnd)   utt.onend   = onEnd
    if (onError) utt.onerror = onError
    window.speechSynthesis.speak(utt)
  }, [])

  // ── API publique : speak (nettoyage → Edge TTS → fallback Web Speech) ─
  const speak = useCallback(async (text, opts = {}) => {
    const clean = cleanForTTS(text)
    if (!clean) { opts.onEnd?.(); return }
    // Mode système : bypasse Edge TTS, utilise la voix OS directement
    if (edgeVoice === 'system') {
      speakWebSpeech(clean, opts)
      return
    }
    const ok = await speakEdge(clean, opts)
    // ok === true  → Edge TTS a joué
    // ok === null  → supplanté par un appel plus récent, ne rien faire
    // ok === false → vrai échec Edge TTS, basculer sur Web Speech
    if (ok === false) speakWebSpeech(clean, opts)
  }, [edgeVoice, speakEdge, speakWebSpeech])

  // ── stop ──────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    readingRef.current = false
    setIsReading(false)
    edgeReqIdRef.current++  // invalide toute requête en vol
    _stopAll()
  }, [_stopAll])

  // ── readAloud — lecture longue par chunks ─────────────────────────
  const readAloud = useCallback(async (fullText, { onDone, onChunk } = {}) => {
    if (!fullText) return
    stop()

    const chunks = splitSpeechChunks(cleanForTTS(fullText), 180)
    if (!chunks.length) return

    readingRef.current = true
    setIsReading(true)

    for (let i = 0; i < chunks.length; i++) {
      if (!readingRef.current) break
      await new Promise((resolve) => {
        speak(chunks[i], { onEnd: resolve, onError: resolve })
      })
      onChunk?.(i, chunks.length)
    }

    readingRef.current = false
    setIsReading(false)
    onDone?.()
  }, [speak, stop])

  // ── Changer la voix préférée (denise | vivienne | system) ───────
  const setPreferredVoice = useCallback((voice) => {
    if (!['denise', 'vivienne', 'system'].includes(voice)) return
    stop()
    setEdgeVoice(voice)
    localStorage.setItem(PREF_VOICE_KEY, voice)
    if (voice !== 'system') setEdgeAvailable(true)
  }, [stop])

  // ── Nom de la voix système disponible ────────────────────────────
  const systemVoiceName = voiceRef.current?.name ?? null

  const dismissVoiceSetup = useCallback(() => {
    setNeedsVoiceSetup(false)
    try { localStorage.setItem(VOICE_SETUP_KEY, '1') } catch {}
  }, [])

  return {
    speak,
    stop,
    readAloud,
    isReading,
    supported: !!window.speechSynthesis || edgeAvailable,
    needsVoiceSetup,
    dismissVoiceSetup,
    // Edge TTS
    edgeVoice,
    setPreferredVoice,
    edgeAvailable,
    systemVoiceName,
  }
}
