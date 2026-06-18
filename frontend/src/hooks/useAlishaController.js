/**
 * useAlishaController — orchestre état visuel + voix d'Alisha
 * selon le contexte BKT, engagement et événements pédagogiques.
 *
 * Architecture :
 *  - Reçoit speakFn / stopFn de useAlishaVoice du composant parent
 *    (pas de 2ème instance TTS, pas de conflit).
 *  - Retourne alishaState + alishaBubble : même interface que ce qui
 *    était calculé manuellement dans Session.jsx / TutorielAlisha.jsx.
 *  - Expose triggerEvent(type, payload) pour les moments clés.
 *  - Auto-revert : après chaque prise de parole, Alisha revient à un
 *    état "baseline" calqué sur le niveau d'engagement courant.
 *
 * Engagement → baseline mapping :
 *   engagement_eleve  → focus
 *   engagement_modere → idle
 *   engagement_faible → idle
 *   confusion         → confused
 *   frustration       → confused
 *   ennui             → sleep
 *   decrochage        → sleep
 *   neutre            → idle
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { pickResponse } from '../constants/alishaResponses'

const REVERT_MS = 600  // délai avant revert à l'état baseline après fin de voix

function engToBaseline(emotion) {
  switch (emotion) {
    case 'engagement_eleve':  return 'focus'
    case 'engagement_modere': return 'idle'
    case 'engagement_faible': return 'idle'
    case 'confusion':         return 'confused'
    case 'frustration':       return 'confused'
    case 'ennui':             return 'sleep'
    case 'decrochage':        return 'sleep'
    default:                  return 'idle'
  }
}

export default function useAlishaController({
  speakFn       = null,   // (text, opts) → void, depuis useAlishaVoice
  stopFn        = null,   // () → void
  engagement    = { score: 0.5, emotion: 'neutre' },
  bkt           = null,   // { niveau, pourcentage, competence } | null
  streak        = 0,
  studentName   = null,
  // Overrides visuels courts (flash 750ms dans Session.jsx)
  answerFlash   = null,   // 'correct' | 'wrong' | null
  loadingIA     = false,
  explicationIA = null,
} = {}) {

  const [alishaState,  setAlishaState]  = useState('idle')
  const [alishaBubble, setAlishaBubble] = useState(null)
  const [isSpeaking,   setIsSpeaking]   = useState(false)

  const timerRef    = useRef(null)

  // Refs "live" — évite les stale closures dans triggerEvent (useCallback [])
  const speakRef      = useRef(speakFn)
  const stopRef       = useRef(stopFn)
  const engRef        = useRef(engagement)
  const studentRef    = useRef(studentName)

  useEffect(() => { speakRef.current    = speakFn      }, [speakFn])
  useEffect(() => { stopRef.current     = stopFn       }, [stopFn])
  useEffect(() => { engRef.current      = engagement   }, [engagement])
  useEffect(() => { studentRef.current  = studentName  }, [studentName])

  // ── Utilitaires internes ──────────────────────────────────────────

  function clearTimer() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }

  function scheduleRevert(delay = REVERT_MS) {
    clearTimer()
    timerRef.current = setTimeout(() => {
      const base = engToBaseline(engRef.current?.emotion ?? 'neutre')
      setAlishaState(base)
      setAlishaBubble(null)
    }, delay)
  }

  /**
   * Fait parler Alisha, change son état, puis revient au baseline.
   * @param {string}      text    - texte à lire (Edge TTS ou Web Speech)
   * @param {string}      state   - état visuel pendant la parole
   * @param {string|null} bubble  - texte de la bulle (null = garder la bulle par défaut)
   */
  function speakAndRevert(text, state, bubble = null) {
    clearTimer()
    setAlishaState(state)
    if (bubble !== undefined) setAlishaBubble(bubble)
    setIsSpeaking(true)

    speakRef.current?.(text, {
      onStart: () => setIsSpeaking(true),
      onEnd:   () => { setIsSpeaking(false); scheduleRevert() },
      onError: () => { setIsSpeaking(false); scheduleRevert(200) },
    })
  }

  // ── API publique : triggerEvent ───────────────────────────────────

  const triggerEvent = useCallback((type, payload = {}) => {
    const name = studentRef.current

    switch (type) {

      // ── Accueil session ─────────────────────────────────────────
      case 'welcome': {
        const text = pickResponse('welcome', { studentName: name })
        speakAndRevert(text, 'welcome', text)
        break
      }

      // ── Nouvelle question affichée (silencieux — lecture d'énoncé gérée ailleurs) ─
      case 'question_shown': {
        setAlishaState('question')
        setAlishaBubble(null)
        break
      }

      // ── Réponse correcte ────────────────────────────────────────
      case 'correct': {
        const { bkt: bktData, streak: streakNow = 0, kc } = payload
        const ctx = kc ? ` · ${kc}` : ''   // A3 — bulle contextualisée par compétence

        if (bktData?.niveau === 'maitrise') {
          // Compétence maîtrisée → célébration
          const text = pickResponse('bkt_mastered', { studentName: name })
          speakAndRevert(text, 'celebration', text)
        } else if (streakNow > 0 && streakNow % 5 === 0) {
          // Jalon de streak → excitation
          const text = pickResponse('streak', { studentName: name })
          speakAndRevert(text, 'excited', text)
        } else {
          const text = pickResponse('correct', { studentName: name })
          speakAndRevert(text, 'correct', text + ctx)
        }
        break
      }

      // ── Réponse incorrecte ──────────────────────────────────────
      case 'wrong': {
        const { bkt: bktData, hintsUsed = 0, kc } = payload
        const ctx = kc ? ` · ${kc}` : ''   // A3 — bulle contextualisée par compétence

        if (bktData?.niveau === 'a_renforcer') {
          // BKT très bas → encouragement doux + indice implicite
          const text = pickResponse('bkt_low', { studentName: name })
          speakAndRevert(text, 'confused', text + ctx)
        } else if (hintsUsed >= 2) {
          // Déjà beaucoup d'indices → reformuler
          const text = pickResponse('reexplain', { studentName: name })
          speakAndRevert(text, 'hint', text)
        } else {
          const text = pickResponse('wrong', { studentName: name })
          speakAndRevert(text, 'wrong', text + ctx)
        }
        break
      }

      // ── Indice demandé — A1 : lit le VRAI indice de l'exercice si fourni ──
      case 'hint_requested': {
        const text = payload.text || pickResponse('hint', { studentName: name })
        speakAndRevert(text, 'hint', text)
        break
      }

      // ── Demande d'explication IA ────────────────────────────────
      case 'reexplain_requested': {
        // Alisha passe en mode typing pendant que le LLM répond
        const text = pickResponse('thinking', { studentName: name })
        speakAndRevert(text, 'typing', text)
        break
      }

      // ── Explication IA prête ────────────────────────────────────
      case 'reexplain_ready': {
        const text = pickResponse('reexplain', { studentName: name })
        speakAndRevert(text, 'speaking', text)
        break
      }

      // ── Fin de session ──────────────────────────────────────────
      case 'session_complete': {
        const { pct = 0 } = payload
        let text, state
        if (pct >= 90) {
          text  = pickResponse('celebration', { studentName: name })
          state = 'celebration'
        } else if (pct >= 70) {
          text  = pickResponse('correct', { studentName: name })
          state = 'excited'
        } else if (pct >= 50) {
          text  = pickResponse('encouragement', { studentName: name })
          state = 'speaking'
        } else {
          text  = pickResponse('encouragement', { studentName: name })
          state = 'speaking'
        }
        speakAndRevert(text, state, text)
        break
      }

      // ── Utilisateur inactif ─────────────────────────────────────
      case 'idle_detected': {
        const text = pickResponse('idle', { studentName: name })
        speakAndRevert(text, 'sleep', text)
        break
      }

      // ── Chute d'engagement (appelé par le parent sur seuil) ─────
      case 'engagement_drop': {
        const text = pickResponse('encouragement', { studentName: name })
        speakAndRevert(text, 'speaking', text)
        break
      }

      // ── Jalon de streak explicite ───────────────────────────────
      case 'streak_milestone': {
        const text = pickResponse('streak', { studentName: name })
        speakAndRevert(text, 'excited', text)
        break
      }

      // ── BKT en progression (palier franchi) ─────────────────────
      case 'bkt_progress': {
        const text = pickResponse('bkt_progress', { studentName: name })
        speakAndRevert(text, 'speaking', text)
        break
      }

      default:
        break
    }
  }, [])  // stable — toutes les dépendances dynamiques passent par des refs

  // ── Réagit aux changements d'engagement (hors prise de parole) ───
  useEffect(() => {
    if (isSpeaking) return
    const base = engToBaseline(engagement?.emotion ?? 'neutre')
    setAlishaState(base)
  }, [engagement?.emotion])   // eslint-disable-line react-hooks/exhaustive-deps

  // ── Nettoyage ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearTimer()
      stopRef.current?.()
    }
  }, [])

  // ── Calcul des surcharges visuelles courtes (flash 750ms) ─────────
  // answerFlash / loadingIA / explicationIA prennent la priorité absolue
  // sur l'état dérivé du contrôleur — même logique qu'avant, centralisée ici.
  const effectiveState = answerFlash === 'correct'           ? 'correct'
    : answerFlash === 'wrong'                                ? 'wrong'
    : loadingIA                                              ? 'typing'
    : explicationIA && !isSpeaking                           ? 'speaking'
    : alishaState

  const effectiveBubble = answerFlash === 'correct'
    ? pickResponse('correct')
    : answerFlash === 'wrong'
    ? pickResponse('wrong')
    : loadingIA
    ? 'Je cherche une explication adaptée à ton profil…'
    : alishaBubble

  return {
    alishaState:  effectiveState,
    alishaBubble: effectiveBubble,
    triggerEvent,
    isSpeaking,
    stop: () => {
      clearTimer()
      setIsSpeaking(false)
      stopRef.current?.()
    },
  }
}
