import { useState, useCallback, useRef, useEffect } from 'react'
import { useWebSocket } from './useWebSocket'

/**
 * Hook de gestion d'une session de cours en live.
 *
 * Gère l'état WebSocket (slide, quiz, participants, statut)
 * et expose les actions pilote + élève.
 */
export function useCoursLive(sessionId, { enabled = true } = {}) {
  const [connected,    setConnected]    = useState(false)
  const [role,         setRole]         = useState(null)      // 'pilot' | 'student'
  const [statut,       setStatut]       = useState('attente') // 'attente'|'actif'|'pause'|'termine'
  const [slideIndex,   setSlideIndex]   = useState(0)
  const [slideData,    setSlideData]    = useState(null)
  const [slideTotal,   setSlideTotal]   = useState(0)
  const [quizActif,    setQuizActif]    = useState(false)
  const [quizExercice, setQuizExercice] = useState(null)
  const [quizRepondu,  setQuizRepondu]  = useState(false)
  const [quizCorrect,  setQuizCorrect]  = useState(null)     // null | true | false
  const [quizStats,    setQuizStats]    = useState(null)     // { total, correct, pct }
  const [quizProgress, setQuizProgress] = useState(null)     // { repondu, total_eleves } pour pilote
  const [count,        setCount]        = useState(0)
  const [emotions,     setEmotions]     = useState([])       // [{nom, valeur, ts}] pour pilote

  const { send } = useWebSocket(
    sessionId ? `/ws/live/${sessionId}` : null,
    {
      enabled: enabled && !!sessionId,
      onMessage: useCallback((msg) => {
        switch (msg.type) {
          case 'connected':
            setConnected(true)
            setRole(msg.role)
            setStatut(msg.statut)
            setSlideIndex(msg.slide_index ?? 0)
            setQuizActif(msg.quiz_actif ?? false)
            setCount(msg.count ?? 0)
            break
          case 'session_started':
            setStatut('actif')
            break
          case 'session_paused':
            setStatut('pause')
            break
          case 'session_resumed':
            setStatut('actif')
            break
          case 'session_ended':
            setStatut('termine')
            break
          case 'slide_change':
            setSlideIndex(msg.index ?? 0)
            setSlideTotal(msg.total ?? 0)
            setSlideData(msg.ressource ?? null)
            setQuizActif(false)
            setQuizExercice(null)
            setQuizRepondu(false)
            setQuizCorrect(null)
            setQuizStats(null)
            break
          case 'quiz_start':
            setQuizActif(true)
            setQuizExercice(msg.exercice)
            setQuizRepondu(false)
            setQuizCorrect(null)
            setQuizStats(null)
            setQuizProgress(null)
            break
          case 'quiz_end':
            setQuizActif(false)
            setQuizStats(msg.stats)
            break
          case 'quiz_reponse_ack':
            setQuizRepondu(true)
            setQuizCorrect(msg.correct)
            break
          case 'quiz_progress':
            setQuizProgress({ repondu: msg.repondu, total_eleves: msg.total_eleves })
            break
          case 'participant_join':
            setCount(msg.count ?? 0)
            break
          case 'participant_leave':
            setCount(msg.count ?? 0)
            break
          case 'student_emotion':
            setEmotions(prev => [
              { nom: msg.nom, valeur: msg.valeur, ts: Date.now() },
              ...prev.slice(0, 19),
            ])
            break
          default:
            break
        }
      }, []),
    }
  )

  // ── Actions ────────────────────────────────────────────────────

  const sendEmotion = useCallback((valeur) => {
    send({ type: 'emotion', valeur })
  }, [send])

  const sendQuizReponse = useCallback((reponse) => {
    send({ type: 'quiz_reponse', reponse })
  }, [send])

  return {
    connected,
    role,
    statut,
    slideIndex,
    slideTotal,
    slideData,
    quizActif,
    quizExercice,
    quizRepondu,
    quizCorrect,
    quizStats,
    quizProgress,
    count,
    emotions,
    sendEmotion,
    sendQuizReponse,
  }
}
