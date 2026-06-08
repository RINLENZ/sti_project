/**
 * Hook voix Alisha — Edge TTS Neural (fr-FR-DeniseNeural ou VivienneMultilingualNeural)
 * avec fallback Web Speech API.
 *
 * Chaîne de priorité :
 *   1. Edge TTS via backend /api/tts/speak (qualité neural, cache IndexedDB)
 *   2. Web Speech API (voix locale FR si disponible, sinon cloud Google)
 *
 * Fallback automatique : si Edge TTS échoue (backend hors ligne, réseau), on
 * bascule sur Web Speech pour la session. Un flag edgeAvailable permet de
 * réessayer Edge TTS à la prochaine session.
 *
 * Stratégie de verrouillage Web Speech (conservée de la v1) :
 *   Si voix locale fr-FR disponible → verrouillage immédiat (stable).
 *   Sinon → verrouillage après premier voiceschanged (vague cloud chargée).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { splitSpeechChunks } from '../utils/latexToSpeech'
import { getAudio, setAudio } from '../services/ttsCache'
import { BASE_URL } from '../services/api'

const STORAGE_KEY     = 'alisha_voice_name'
const VOICE_SETUP_KEY = 'alisha_voice_setup_done'
const PREF_VOICE_KEY  = 'alisha_edge_voice'   // 'denise' | 'vivienne'

// ── Web Speech — scoring de voix (logique v1 conservée) ───────────

function scoreVoice(v) {
  if (!v.lang.startsWith('fr')) return -1
  let s = 0
  if (v.localService)                                 s += 100
  if (v.lang === 'fr-FR')                             s += 10
  if (/female|femme|hortense|amelie/i.test(v.name))  s += 5
  // Parmi les voix cloud, "Google français" est la mieux notée
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
  const audioRef   = useRef(null)   // HTMLAudioElement courant

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

  // ── Edge TTS — requête backend + cache IndexedDB ──────────────────
  const speakEdge = useCallback(async (text, { onStart, onEnd, onError } = {}) => {
    if (!text || !edgeAvailable) return false
    try {
      // 1. Cache IndexedDB
      let audioBuf = await getAudio(edgeVoice, text)

      if (!audioBuf) {
        // 2. Appel backend
        const resp = await fetch(`${BASE_URL}/api/tts/speak`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice: edgeVoice }),
          signal: AbortSignal.timeout(8000),
        })
        if (!resp.ok) throw new Error(`TTS HTTP ${resp.status}`)
        audioBuf = await resp.arrayBuffer()
        // Mise en cache async — ne bloque pas la lecture
        setAudio(edgeVoice, text, audioBuf)
      }

      // 3. Lecture HTMLAudioElement
      const blob = new Blob([audioBuf], { type: 'audio/mpeg' })
      const url  = URL.createObjectURL(blob)

      if (audioRef.current) {
        audioRef.current.pause()
        URL.revokeObjectURL(audioRef.current._blobUrl)
      }

      const audio = new Audio(url)
      audio._blobUrl  = url
      audioRef.current = audio

      audio.onplay  = onStart || null
      audio.onended = () => { URL.revokeObjectURL(url); onEnd?.() }
      audio.onerror = () => { URL.revokeObjectURL(url); onError?.() }

      await audio.play()
      return true
    } catch {
      // Un seul échec → on désactive Edge TTS pour la session
      setEdgeAvailable(false)
      return false
    }
  }, [edgeVoice, edgeAvailable])

  // ── Web Speech — speak unitaire ───────────────────────────────────
  const speakWebSpeech = useCallback((text, { onStart, onEnd, onError, rate } = {}) => {
    if (!window.speechSynthesis || !text) return
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

  // ── API publique : speak (Edge TTS → fallback Web Speech) ─────────
  const speak = useCallback(async (text, opts = {}) => {
    if (!text) return
    const ok = await speakEdge(text, opts)
    if (!ok) speakWebSpeech(text, opts)
  }, [speakEdge, speakWebSpeech])

  // ── stop ──────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    readingRef.current = false
    setIsReading(false)
    if (audioRef.current) {
      audioRef.current.pause()
      if (audioRef.current._blobUrl) URL.revokeObjectURL(audioRef.current._blobUrl)
      audioRef.current = null
    }
    window.speechSynthesis?.cancel()
  }, [])

  // ── readAloud — lecture longue par chunks ─────────────────────────
  const readAloud = useCallback(async (fullText, { onDone, onChunk } = {}) => {
    if (!fullText) return
    stop()

    const chunks = splitSpeechChunks(fullText, 180)
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

  // ── Changer la voix Edge TTS préférée ────────────────────────────
  const setPreferredVoice = useCallback((voice) => {
    if (!['denise', 'vivienne'].includes(voice)) return
    setEdgeVoice(voice)
    localStorage.setItem(PREF_VOICE_KEY, voice)
    // Réactiver Edge TTS (peut avoir été désactivé suite à une erreur temporaire)
    setEdgeAvailable(true)
    // Note : pas de clearAudioCache() ici — les entrées de l'ancienne voix
    // ont une clé différente, donc elles ne seront jamais servies par erreur.
  }, [])

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
  }
}
