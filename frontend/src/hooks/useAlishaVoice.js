/**
 * Hook Web Speech API pour la voix d'Alisha.
 *
 * Problèmes corrigés :
 * 1. Chrome charge les voix en 2 vagues (locales d'abord, cloud ensuite).
 *    Sur mobile/serveur sans voix locale installée, lockedRef restait false
 *    → un 2ème voiceschanged arrivait après 200-500ms et changeait la voix
 *    en pleine session.
 * 2. La voix n'était pas stoppée au démontage du composant.
 *
 * Stratégie de verrouillage (stable en ligne ET hors ligne) :
 * - Si voix en localStorage → on la réutilise et on verrouille immédiatement.
 * - Si voix locale fr-FR disponible → verrouillage immédiat (stable).
 * - Sinon (voix cloud uniquement, ex. Chrome mobile sans pack) →
 *   on attend le 1er événement voiceschanged (chargement cloud terminé),
 *   puis on verrouille définitivement. Après ça, plus aucun re-pick.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { splitSpeechChunks } from '../utils/latexToSpeech'

const STORAGE_KEY = 'alisha_voice_name'

// Score de préférence : voix locale FR féminine > voix locale FR > Google français > autres cloud FR
function scoreVoice(v) {
  if (!v.lang.startsWith('fr')) return -1
  let s = 0
  if (v.localService)                                 s += 100  // local = stable, meilleure qualité
  if (v.lang === 'fr-FR')                             s += 10
  if (/female|femme|hortense|amelie/i.test(v.name))  s += 5
  // Parmi les voix cloud, "Google français" est la mieux notée — pitch neutre s'applique mieux
  if (!v.localService && /google/i.test(v.name))      s += 8
  return s
}

function bestFrVoice(voices) {
  return voices
    .map(v => ({ v, s: scoreVoice(v) }))
    .filter(({ s }) => s >= 0)
    .sort((a, b) => b.s - a.s)[0]?.v || null
}

const VOICE_SETUP_KEY = 'alisha_voice_setup_done'

export default function useAlishaVoice() {
  const voiceRef          = useRef(null)
  const lockedRef         = useRef(false)
  const voicesChangedOnce = useRef(false)
  const mountedRef        = useRef(true)
  const readingRef        = useRef(false)
  const [isReading,       setIsReading]       = useState(false)
  // true si l'utilisateur est sur un appareil sans voix locale fr-FR (android sans pack, etc.)
  const [needsVoiceSetup, setNeedsVoiceSetup] = useState(false)

  useEffect(() => {
    mountedRef.current = true
    if (!window.speechSynthesis) return

    function pickVoice(fromEvent = false) {
      if (!mountedRef.current || lockedRef.current) return

      const voices = window.speechSynthesis.getVoices()
      if (!voices.length) return

      // 1. Voix persistée en localStorage → confiance totale, verrouillage immédiat
      const savedName = localStorage.getItem(STORAGE_KEY)
      if (savedName) {
        const saved = voices.find(v => v.name === savedName)
        if (saved) {
          voiceRef.current = saved
          lockedRef.current = true
          return
        }
        // Nom sauvé introuvable (autre navigateur/OS) → on supprime et on repick
        try { localStorage.removeItem(STORAGE_KEY) } catch {}
      }

      const best = bestFrVoice(voices)
      if (!best) return

      voiceRef.current = best

      // Signale dès la première sélection d'une voix cloud (pas de voix locale FR).
      // Bug corrigé : l'ancien code mettait ce check dans shouldLock, donc sur les
      // navigateurs où voiceschanged ne fire pas, le banner n'apparaissait jamais.
      if (!best.localService && !localStorage.getItem(VOICE_SETUP_KEY)) {
        setNeedsVoiceSetup(true)
      }

      // Verrouiller si :
      //   (a) voix locale trouvée (stable dès le premier appel)
      //   (b) on est dans un voiceschanged (= vague cloud chargée, liste complète)
      const shouldLock = best.localService || fromEvent
      if (shouldLock) {
        lockedRef.current = true
        try { localStorage.setItem(STORAGE_KEY, best.name) } catch {}
      }
    }

    function onVoicesChanged() {
      voicesChangedOnce.current = true
      pickVoice(true)  // fromEvent=true → verrouillage définitif
    }

    pickVoice(false)
    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged)

    return () => {
      mountedRef.current = false
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged)
      window.speechSynthesis.cancel()
    }
  }, [])

  const speak = useCallback((text, { onStart, onEnd, onError, rate } = {}) => {
    if (!window.speechSynthesis || !text) return
    window.speechSynthesis.cancel()
    const utt  = new SpeechSynthesisUtterance(text)
    utt.lang   = 'fr-FR'
    utt.rate   = rate ?? 0.95
    // Voix locale (Hortense, Thomas…) : pitch 1.15 → chaleureux, naturel.
    // Voix cloud (Google français…)  : pitch 1.0  → neutre, évite l'effet robotique/strident.
    utt.pitch  = (voiceRef.current?.localService ?? false) ? 1.15 : 1.0
    if (voiceRef.current) utt.voice = voiceRef.current
    if (onStart) utt.onstart = onStart
    if (onEnd)   utt.onend   = onEnd
    if (onError) utt.onerror = onError
    window.speechSynthesis.speak(utt)
  }, [])

  const stop = useCallback(() => {
    readingRef.current = false
    setIsReading(false)
    window.speechSynthesis?.cancel()
  }, [])

  /**
   * Lit un texte long (contenu de cours) phrase par phrase.
   * Gère les formules LaTeX converties via blocksToSpeech/latexToFrench avant appel.
   * @param {string} fullText   - texte déjà converti en français lisible
   * @param {object} opts
   * @param {function} opts.onDone     - callback quand lecture terminée
   * @param {function} opts.onChunk    - callback(index, total) à chaque phrase
   */
  const readAloud = useCallback((fullText, { onDone, onChunk } = {}) => {
    if (!window.speechSynthesis || !fullText) return
    window.speechSynthesis.cancel()

    const chunks  = splitSpeechChunks(fullText, 180)
    if (!chunks.length) return

    readingRef.current = true
    setIsReading(true)

    let idx = 0

    function readNext() {
      if (!readingRef.current || idx >= chunks.length) {
        readingRef.current = false
        setIsReading(false)
        onDone?.()
        return
      }

      const utt   = new SpeechSynthesisUtterance(chunks[idx])
      utt.lang    = 'fr-FR'
      utt.rate    = 0.9    // légèrement plus lent pour la lecture de cours
      utt.pitch   = (voiceRef.current?.localService ?? false) ? 1.1 : 1.0
      if (voiceRef.current) utt.voice = voiceRef.current
      utt.onend   = () => { onChunk?.(idx, chunks.length); idx++; readNext() }
      utt.onerror = () => { idx++; readNext() }

      window.speechSynthesis.speak(utt)
    }

    readNext()
  }, [])

  const dismissVoiceSetup = () => {
    setNeedsVoiceSetup(false)
    try { localStorage.setItem(VOICE_SETUP_KEY, '1') } catch {}
  }

  return { speak, stop, readAloud, isReading, supported: !!window.speechSynthesis, needsVoiceSetup, dismissVoiceSetup }
}
