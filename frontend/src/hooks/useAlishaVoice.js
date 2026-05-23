/**
 * Hook Web Speech API pour la voix d'Alisha.
 * Sélectionne automatiquement une voix française féminine si disponible.
 */
import { useCallback, useEffect, useRef } from 'react'

export default function useAlishaVoice() {
  const voiceRef = useRef(null)

  useEffect(() => {
    if (!window.speechSynthesis) return

    function pickVoice() {
      const voices = window.speechSynthesis.getVoices()
      voiceRef.current =
        voices.find(v => v.lang.startsWith('fr') && /female|femme/i.test(v.name)) ||
        voices.find(v => v.lang === 'fr-FR') ||
        voices.find(v => v.lang.startsWith('fr')) ||
        null
    }

    pickVoice()
    window.speechSynthesis.addEventListener('voiceschanged', pickVoice)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', pickVoice)
  }, [])

  const speak = useCallback((text, { onStart, onEnd } = {}) => {
    if (!window.speechSynthesis || !text) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang  = 'fr-FR'
    utt.rate  = 0.95
    utt.pitch = 1.15
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
