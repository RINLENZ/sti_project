/**
 * Hook Web Speech API pour la voix d'Alisha.
 *
 * Problèmes corrigés :
 * 1. Chrome charge les voix en 2 vagues (locales d'abord, cloud ensuite).
 *    L'ancienne version re-pickait à chaque voiceschanged → voix différente
 *    entre sessions en ligne, résultant en une voix bizarre ou mal calibrée.
 * 2. La voix n'était pas stoppée au démontage du composant.
 *
 * Stratégie :
 * - Priorité aux voix LOCAL (v.localService === true) pour la stabilité.
 * - Une fois une voix locale fr-FR trouvée, on l'écrit dans localStorage
 *   et on ne la remplace plus jamais lors des voiceschanged suivants.
 * - Fallback sur voix fr non-locale uniquement si aucune locale n'existe.
 * - Stop automatique au démontage.
 */
import { useCallback, useEffect, useRef } from 'react'

const STORAGE_KEY = 'alisha_voice_name'

// Score de préférence : voix locale FR féminine > voix locale FR > voix cloud FR
function scoreVoice(v) {
  if (!v.lang.startsWith('fr')) return -1
  let s = 0
  if (v.localService)                           s += 100  // voix locale = stable
  if (v.lang === 'fr-FR')                       s += 10
  if (/female|femme|hortense|amelie/i.test(v.name)) s += 5
  return s
}

function bestFrVoice(voices) {
  return voices
    .map(v => ({ v, s: scoreVoice(v) }))
    .filter(({ s }) => s >= 0)
    .sort((a, b) => b.s - a.s)[0]?.v || null
}

export default function useAlishaVoice() {
  const voiceRef    = useRef(null)
  const lockedRef   = useRef(false)   // true dès qu'on a une voix locale fr-FR stable
  const mountedRef  = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    if (!window.speechSynthesis) return

    function pickVoice() {
      if (!mountedRef.current) return

      // Si la voix est déjà verrouillée sur une voix locale, ne rien changer
      if (lockedRef.current) return

      const voices = window.speechSynthesis.getVoices()
      if (!voices.length) return

      // Chercher d'abord par nom persisté (même navigateur, même machine)
      const savedName = localStorage.getItem(STORAGE_KEY)
      if (savedName) {
        const saved = voices.find(v => v.name === savedName)
        if (saved) {
          voiceRef.current = saved
          lockedRef.current = saved.localService
          return
        }
      }

      const best = bestFrVoice(voices)
      if (best) {
        voiceRef.current  = best
        lockedRef.current = best.localService  // verrouiller si locale
        try { localStorage.setItem(STORAGE_KEY, best.name) } catch {}
      }
    }

    pickVoice()
    window.speechSynthesis.addEventListener('voiceschanged', pickVoice)

    return () => {
      mountedRef.current = false
      window.speechSynthesis.removeEventListener('voiceschanged', pickVoice)
      // Stop au démontage pour éviter que la voix continue en arrière-plan
      window.speechSynthesis.cancel()
    }
  }, [])

  const speak = useCallback((text, { onStart, onEnd, rate } = {}) => {
    if (!window.speechSynthesis || !text) return
    window.speechSynthesis.cancel()
    const utt  = new SpeechSynthesisUtterance(text)
    utt.lang   = 'fr-FR'
    utt.rate   = rate ?? 0.95
    utt.pitch  = 1.15
    if (voiceRef.current) utt.voice = voiceRef.current
    if (onStart) utt.onstart = onStart
    if (onEnd)   utt.onend   = onEnd
    window.speechSynthesis.speak(utt)
  }, [])

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel()
  }, [])

  return { speak, stop, supported: !!window.speechSynthesis }
}
