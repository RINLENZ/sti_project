/**
 * Mode tutoriel guidé par Alisha.
 * Séquence : Intro → Ressources → Exercices d'application → Terminé
 * BKT mis à jour après chaque réponse. Commandes KWS actives.
 */
import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTheme } from '../../styles/theme.jsx'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import Alisha from '../../components/Alisha'
import useAlishaVoice from '../../hooks/useAlishaVoice'
import { useKWSModel } from '../../hooks/useKWSModel'
import { ProgressiveContent } from '../../components/RichContent'
import api from '../../services/api'

// ── Séquence linéaire : intro → ressources → exercices (triés par difficulté) ──

function buildSequence(ua) {
  const steps = [{ type: 'intro', data: ua }]
  ;(ua.ressources || []).forEach(r => steps.push({ type: 'ressource', data: r }))
  const exercices = [...(ua.exercices || [])].sort((a, b) => (a.difficulte ?? 1) - (b.difficulte ?? 1))
  exercices.forEach(e => steps.push({ type: 'exercice', data: e }))
  return steps
}

// ── Vérification locale (aucun appel API) ─────────────────────────

function checkReponse(exercice, reponse) {
  const norm = s => String(s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  const expected = exercice.reponse_correcte ?? exercice.options?.reponse_correcte ?? ''
  if (exercice.type === 'reponse_libre') {
    return { correct: null, reponse_correcte: expected, explication: exercice.explication || '' }
  }
  return {
    correct: norm(reponse) === norm(expected),
    reponse_correcte: expected,
    explication: exercice.explication || '',
  }
}

// ── Messages contextuels d'Alisha ─────────────────────────────────

function alishaMsg(phase, step, feedback) {
  if (phase === 'loading') return 'Je prépare ta leçon… 📖'
  if (phase === 'done')    return 'Excellent ! Tu as fini cette unité ! 🎉'
  if (!step) return ''

  if (step.type === 'intro') return "Voici ce que tu vas apprendre. Prêt·e ? C'est parti !"

  if (phase === 'feedback' && feedback) {
    if (feedback.correct === null)
      return `Réponse notée !${feedback.reponse_correcte ? ` Exemple : "${feedback.reponse_correcte}"` : ''}`
    return feedback.correct
      ? "Parfait ! C'est la bonne réponse. Continue comme ça !"
      : `Pas tout à fait… La bonne réponse était : "${feedback.reponse_correcte}"`
  }

  if (step.type === 'explication') {
    return "Je vais te réexpliquer ce point avant de continuer. 💡"
  }
  if (step.type === 'ressource') {
    const pts = step.data.points_cles
    return pts?.length > 0 ? `Retiens bien : "${pts[0]}"` : `Voici la leçon : ${step.data.titre}`
  }
  if (step.type === 'exercice') {
    return step.data.type === 'qcm' || step.data.type === 'vrai_faux'
      ? 'Quelle est la bonne réponse ? Choisis !'
      : 'Réponds dans ta propre formulation.'
  }
  return ''
}

function alishaStateFor(phase, step, feedback, bktNiveau) {
  if (phase === 'loading')        return 'thinking'
  if (phase === 'done')           return 'celebration'
  if (step?.type === 'intro')     return 'welcome'
  if (step?.type === 'explication') return 'thinking'
  if (phase === 'feedback' && feedback?.correct === true) {
    return bktNiveau === 'maitrise' ? 'excited' : 'correct'
  }
  if (phase === 'feedback' && feedback?.correct === false) {
    return bktNiveau === 'a_renforcer' ? 'confused' : 'wrong'
  }
  if (phase === 'feedback' && feedback?.correct === null)  return 'speaking'
  if (step?.type === 'exercice') return 'question'
  return 'speaking'
}

// ── Composant exercice ────────────────────────────────────────────

function ExerciceStep({ exercice, onReponse, C }) {
  const [selected, setSelected] = useState(null)
  const [text,     setText]     = useState('')

  const choix = exercice.type === 'vrai_faux'
    ? ['Vrai', 'Faux']
    : exercice.options?.choix || exercice.options || []

  if (exercice.type === 'qcm' || exercice.type === 'vrai_faux') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {choix.map((opt, i) => (
          <button
            key={i}
            onClick={() => { setSelected(opt); onReponse(opt) }}
            style={{
              padding:      '15px 20px',
              borderRadius:  14,
              border:       `2px solid ${selected === opt ? C.brown : C.border}`,
              background:    selected === opt ? C.brownPale : C.surface,
              color:         C.text,
              fontWeight:    selected === opt ? 700 : 500,
              fontSize:      15,
              cursor:        'pointer',
              textAlign:    'left',
              transition:   'all .15s ease',
            }}
          >
            <span style={{
              display:     'inline-block',
              minWidth:     24,
              height:       24,
              lineHeight:  '24px',
              borderRadius: '50%',
              background:   selected === opt ? C.brown : C.border,
              color:        selected === opt ? 'white' : C.textMuted,
              fontSize:     11,
              fontWeight:   800,
              textAlign:   'center',
              marginRight:  10,
            }}>
              {String.fromCharCode(65 + i)}
            </span>
            {opt}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={exercice.type === 'reponse_libre' ? 'Rédige ta réponse…' : 'Complète…'}
        rows={exercice.type === 'reponse_libre' ? 4 : 2}
        style={{
          padding:      '14px 16px',
          borderRadius:  14,
          border:       `2px solid ${C.border}`,
          background:    C.bg,
          color:         C.text,
          fontSize:      15,
          outline:      'none',
          resize:       'none',
          fontFamily:   "'DM Sans', system-ui, sans-serif",
          lineHeight:    1.6,
        }}
      />
      <button
        onClick={() => onReponse(text)}
        disabled={!text.trim()}
        style={{
          padding:      '14px',
          borderRadius:  14,
          border:       'none',
          background:   `linear-gradient(135deg, ${C.brown}, ${C.brownMid})`,
          color:        'white',
          fontWeight:    800,
          fontSize:      15,
          cursor:        !text.trim() ? 'not-allowed' : 'pointer',
          opacity:       !text.trim() ? 0.5 : 1,
        }}
      >
        Valider →
      </button>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────

export default function TutorielAlisha() {
  const { uaId }  = useParams()
  const navigate  = useNavigate()
  const { C }     = useTheme()
  const { xs }    = useBreakpoint()
  const { user }  = useSelector(s => s.auth)

  const [ua,             setUa]           = useState(null)
  const [sequence,       setSequence]     = useState([])
  const [stepIdx,        setStepIdx]      = useState(0)
  const [phase,          setPhase]        = useState('loading')
  const [feedback,       setFeedback]     = useState(null)
  const [isSpeaking,     setIsSpeaking]   = useState(false)
  const [muted,          setMuted]        = useState(() => localStorage.getItem('alisha_muted') === '1')
  const [bktResult,      setBktResult]    = useState(null)
  const [audioActive,    setAudioActive]  = useState(false)
  const [ressourceAide,  setRessourceAide] = useState(null)
  const [badgeNotif,     setBadgeNotif]   = useState(null)  // { titre, message, emoji }
  const [scoreCorrects,  setScoreCorrects] = useState(0)    // nb réponses correctes

  const sessionIdRef       = useRef(null)   // LearningSession courante
  const stepStartRef       = useRef(null)   // timestamp début step actuel
  const consecutiveErrRef  = useRef(0)      // erreurs consécutives sur même compétence
  const lastCompetenceRef  = useRef(null)   // compétence du dernier exercice

  const { speak, stop, supported } = useAlishaVoice()
  const { lastKeyword } = useKWSModel(audioActive)
  const prevMessageRef = useRef(null)

  // ── helper interaction log (fire-and-forget) ──────────────────
  function logInteraction(type, data = {}) {
    if (!sessionIdRef.current) return
    api.post('/api/interaction', {
      session_id: sessionIdRef.current,
      user_id:    user.id,
      type, data,
    }).catch(() => {})
  }

  useEffect(() => {
    let cancelled = false
    api.get(`/api/cours/ua/${uaId}?user_id=${user.id}`)
      .then(async r => {
        if (cancelled) return
        setUa(r.data)
        setSequence(buildSequence(r.data))
        setPhase('step')
        setAudioActive(true)
        stepStartRef.current = Date.now()
        // Crée la LearningSession
        try {
          const s = await api.post('/api/cours/session/creer', { user_id: user.id, ua_id: uaId })
          sessionIdRef.current = s.data.session_id
        } catch {}
      })
      .catch(() => navigate('/dashboard'))
    return () => {
      cancelled = true
      setAudioActive(false)
      // Clôture la session si l'utilisateur quitte avant la fin
      if (sessionIdRef.current) {
        api.post(`/api/cours/session/clore/${sessionIdRef.current}`).catch(() => {})
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uaId, user.id])

  const currentStep = sequence[stepIdx] ?? null

  // ── Voix Alisha ────────────────────────────────────────────────
  useEffect(() => {
    const msg = alishaMsg(phase, currentStep, feedback)
    if (!msg || msg === prevMessageRef.current || muted || !supported) {
      if (muted) stop()
      return
    }
    prevMessageRef.current = msg
    speak(msg, {
      onStart: () => setIsSpeaking(true),
      onEnd:   () => setIsSpeaking(false),
    })
    return stop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stepIdx, muted])

  async function handleReponse(reponse) {
    if (!currentStep || currentStep.type !== 'exercice') return
    const result   = checkReponse(currentStep.data, reponse)
    const timeSecs = stepStartRef.current ? Math.round((Date.now() - stepStartRef.current) / 1000) : 0
    setFeedback(result)
    setPhase('feedback')

    const competence = currentStep.data.kcs?.[0] || currentStep.data.competence_evaluee
    const exerciceId = currentStep.data.id

    // Log interaction réponse
    logInteraction('response', {
      exercice_id: exerciceId,
      competence:  competence ?? null,
      correct:     result.correct,
      time_seconds: timeSecs,
      difficulte:  currentStep.data.difficulte ?? 1,
    })

    if (result.correct) {
      setScoreCorrects(n => n + 1)
      consecutiveErrRef.current = 0
    } else if (result.correct === false) {
      if (competence === lastCompetenceRef.current) {
        consecutiveErrRef.current += 1
      } else {
        consecutiveErrRef.current = 1
      }
    }
    lastCompetenceRef.current = competence ?? null

    // Mise à jour BKT
    if (competence && result.correct !== null) {
      try {
        const bkt = await api.post(`/api/bkt/apprenant/${user.id}/update-exercice`, {
          ua_id:          uaId,
          competence,
          correct:        result.correct,
          exercice_id:    exerciceId,
          reponse_donnee: String(reponse),
        })
        setBktResult(bkt.data)

        // Injecter réexplication si 2 erreurs consécutives et BKT faible
        if (consecutiveErrRef.current >= 2 && bkt.data.p_mastery < 0.40) {
          consecutiveErrRef.current = 0
          api.get(`/api/cours/ua/${uaId}/ressource-aide`, { params: { competence } })
            .then(r => {
              if (!r.data) return
              setSequence(prev => {
                const copy = [...prev]
                const explicationStep = {
                  type: 'explication',
                  data: { ...r.data, _injected: true },
                }
                copy.splice(stepIdx + 1, 0, explicationStep)
                return copy
              })
            }).catch(() => {})
        } else if (bkt.data.niveau === 'a_renforcer') {
          api.get(`/api/cours/ua/${uaId}/ressource-aide`, { params: { competence } })
            .then(r => setRessourceAide(r.data)).catch(() => {})
        }
      } catch {}
    }
  }

  function advance() {
    setFeedback(null)
    setBktResult(null)
    setRessourceAide(null)
    stepStartRef.current = Date.now()
    const next = stepIdx + 1
    if (next >= sequence.length) {
      setPhase('done')
      // Clôture la session avec le score final
      if (sessionIdRef.current) {
        const nbEx = sequence.filter(s => s.type === 'exercice').length
        const score = nbEx > 0 ? scoreCorrects / nbEx : null
        api.post(`/api/cours/session/clore/${sessionIdRef.current}`, { score_final: score })
          .catch(() => {})
        sessionIdRef.current = null
      }
    } else {
      setStepIdx(next)
      setPhase('step')
    }
  }

  // ── Commandes vocales KWS ──────────────────────────────────────
  useEffect(() => {
    if (!lastKeyword) return
    const { keyword } = lastKeyword
    if (keyword === 'aide' && phase === 'step' && currentStep?.type === 'exercice') {
      const details = document.querySelector('details')
      if (details && !details.open) details.open = true
      speak('Voici un indice pour t\'aider.', {})
      logInteraction('help_requested', { level: 1, source: 'kws' })
    } else if (keyword === 'repeter' && supported && !muted) {
      const msg = alishaMsg(phase, currentStep, feedback)
      if (msg) speak(msg, { onStart: () => setIsSpeaking(true), onEnd: () => setIsSpeaking(false) })
    } else if (keyword === 'lentement' && supported && !muted) {
      stop()
      const msg = alishaMsg(phase, currentStep, feedback)
      if (msg) {
        const utt = new SpeechSynthesisUtterance(msg)
        utt.lang = 'fr-FR'; utt.rate = 0.65; utt.pitch = 1.1
        utt.onstart = () => setIsSpeaking(true)
        utt.onend   = () => setIsSpeaking(false)
        window.speechSynthesis.speak(utt)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastKeyword])

  // ── Raccourcis clavier ────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return
      // Entrée → avancer (sauf si exercice en attente de réponse)
      if (e.key === 'Enter' && phase === 'feedback') advance()
      if (e.key === 'Enter' && phase === 'step' && currentStep?.type !== 'exercice') {
        // Déclenche le bouton visible dans ProgressiveContent via focus simulation
        const btn = document.querySelector('button[data-advance]')
        btn?.click()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stepIdx, currentStep])

  // ── WebSocket — notifications badges en temps réel ────────────
  useEffect(() => {
    if (!user?.id) return
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/${user.id}`)
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'notification' && msg.notif_type === 'badge_debloque') {
          setBadgeNotif({ titre: msg.titre, message: msg.message })
          setTimeout(() => setBadgeNotif(null), 5000)
        }
      } catch {}
    }
    return () => ws.close()
  }, [user?.id])

  const totalSteps  = sequence.length
  const progressPct = totalSteps > 0 ? Math.round((stepIdx / totalSteps) * 100) : 0
  const bktNiveau   = bktResult?.niveau ?? null
  const alishaState = isSpeaking && phase !== 'feedback'
    ? 'speaking'
    : alishaStateFor(phase, currentStep, feedback, bktNiveau)
  const message     = alishaMsg(phase, currentStep, feedback)

  function toggleMute() {
    setMuted(m => {
      const next = !m
      localStorage.setItem('alisha_muted', next ? '1' : '0')
      if (next) stop()
      return next
    })
  }

  // ── Écran terminé ─────────────────────────────────────────────
  if (phase === 'done') {
    const nbExercices = ua?.exercices?.length ?? 0
    return (
      <div style={{
        minHeight:      '100vh',
        background:      C.bg,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '40px 20px',
        gap:             28,
        fontFamily:     "'DM Sans', system-ui, sans-serif",
      }}>
        <Alisha state="celebration" size={140} />

        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: C.brown, margin: '0 0 8px' }}>
            Leçon terminée !
          </h1>
          <p style={{ fontSize: 15, color: C.textSec, margin: 0 }}>{ua?.titre}</p>
        </div>

        {/* ── Choix : session complète ou arrêter ── */}
        <div style={{
          background:    C.surface,
          border:       `1.5px solid ${C.border}`,
          borderRadius:  20,
          padding:      '24px 28px',
          maxWidth:      420,
          width:        '100%',
          display:      'flex',
          flexDirection: 'column',
          gap:           14,
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.textSec, margin: 0, textAlign: 'center' }}>
            Que veux-tu faire maintenant ?
          </p>

          {/* Option 1 : session complète */}
          <button
            onClick={() => navigate(`/session/${uaId}?skip=1`)}
            style={{
              padding:      '16px 20px',
              borderRadius:  14,
              border:       'none',
              background:   `linear-gradient(135deg, ${C.brown}, ${C.brownMid})`,
              color:        'white',
              fontWeight:    800,
              fontSize:      15,
              cursor:        'pointer',
              display:      'flex',
              flexDirection: 'column',
              alignItems:   'flex-start',
              gap:           4,
              textAlign:    'left',
            }}
          >
            <span>✏️ Session d'exercices complète</span>
            <span style={{ fontSize: 12, fontWeight: 500, opacity: .8 }}>
              {nbExercices > 0
                ? `${nbExercices} exercice${nbExercices > 1 ? 's' : ''} · BKT mis à jour`
                : 'Tous les exercices de cette unité'}
            </span>
          </button>

          {/* Option 2 : arrêter */}
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding:      '14px 20px',
              borderRadius:  14,
              border:       `2px solid ${C.border}`,
              background:    C.bg,
              color:         C.textSec,
              fontWeight:    700,
              fontSize:      14,
              cursor:        'pointer',
            }}
          >
            🏠 Retourner au tableau de bord
          </button>

          <button
            onClick={() => navigate(`/cours/${uaId}`)}
            style={{
              background: 'none',
              border:     'none',
              color:       C.textMuted,
              fontSize:    12,
              fontWeight:  600,
              cursor:      'pointer',
              padding:     '4px 0',
            }}
          >
            Relire le cours →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight:     '100vh',
      background:     C.bg,
      display:       'flex',
      flexDirection: 'column',
      fontFamily:    "'DM Sans', system-ui, sans-serif",
    }}>
      {/* ── Barre de progression ── */}
      <div style={{
        background:    C.surface,
        borderBottom: `1px solid ${C.border}`,
        padding:      '14px 20px',
        position:     'sticky',
        top:           0,
        zIndex:        10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, maxWidth: 720, margin: '0 auto' }}>
          <button
            onClick={() => navigate(`/cours/${uaId}`)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 20, lineHeight: 1 }}
          >
            ✕
          </button>
          <div style={{ flex: 1, height: 10, background: C.border, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{
              height:       '100%',
              width:        `${progressPct}%`,
              background:   `linear-gradient(90deg, ${C.brown}, ${C.gold})`,
              borderRadius:  8,
              transition:   'width .5s ease',
            }}/>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, whiteSpace: 'nowrap' }}>
            {stepIdx + 1} / {totalSteps}
          </span>
          {supported && (
            <button
              onClick={toggleMute}
              title={muted ? 'Activer la voix' : 'Couper la voix'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 18, lineHeight: 1, padding: 0,
                opacity: muted ? 0.35 : 1,
                transition: 'opacity .2s',
              }}
            >
              {muted ? '🔇' : '🔊'}
            </button>
          )}
        </div>
      </div>

      {/* ── Contenu ── */}
      <div style={{
        flex:          1,
        maxWidth:       720,
        width:         '100%',
        margin:        '0 auto',
        padding:       xs ? '20px 16px' : '32px 20px',
        display:       'flex',
        flexDirection: 'column',
        gap:            24,
      }}>
        {/* Alisha + bulle */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
          <Alisha state={alishaState} size={xs ? 70 : 90} />
          {message && (
            <div style={{
              flex:         1,
              background:    C.surface,
              borderRadius: '18px 18px 18px 4px',
              border:       `1.5px solid ${C.border}`,
              padding:      '12px 16px',
              fontSize:      14,
              color:         C.text,
              lineHeight:    1.6,
              boxShadow:    `0 2px 10px ${C.brown}10`,
              animation:    'fadeUp .3s ease',
            }}>
              {message}
            </div>
          )}
        </div>

        {/* Carte principale */}
        {currentStep && (
          <div key={stepIdx} style={{
            background:    C.surface,
            borderRadius:   20,
            border:        `1.5px solid ${C.border}`,
            padding:       xs ? '20px' : '28px',
            boxShadow:     `0 4px 20px ${C.brown}0C`,
            animation:     'fadeUp .35s ease',
          }}>

            {/* ── Intro ── */}
            {currentStep.type === 'intro' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <span style={tagStyle(C.brownPale, C.brown)}>📚 Introduction</span>
                  <h2 style={{ fontSize: xs ? 18 : 22, fontWeight: 900, color: C.text, margin: 0 }}>
                    {currentStep.data.titre}
                  </h2>
                </div>

                {currentStep.data.situation_probleme && (
                  <div style={sectionBox(C.goldPale, C.gold)}>
                    <p style={sectionLabel(C.brownMid)}>🎯 Situation</p>
                    <p style={{ fontSize: 14, color: C.text, margin: 0, lineHeight: 1.6 }}>
                      {currentStep.data.situation_probleme}
                    </p>
                  </div>
                )}

                {currentStep.data.competences?.length > 0 && (
                  <div>
                    <p style={sectionLabel(C.textMuted)}>✅ Ce que tu vas savoir faire</p>
                    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {currentStep.data.competences.map((c, i) => (
                        <li key={i} style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {currentStep.data.prerequis && (
                  <p style={{ fontSize: 13, color: C.textSec, lineHeight: 1.6, margin: 0 }}>
                    <strong style={{ color: C.text }}>Prérequis :</strong> {currentStep.data.prerequis}
                  </p>
                )}

                {currentStep.data.duree_estimee && (
                  <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
                    ⏱ Durée estimée : <strong>{currentStep.data.duree_estimee} min</strong>
                  </p>
                )}

                <button onClick={advance} style={primaryBtn(C)}>
                  Commencer la leçon →
                </button>
              </div>
            )}

            {/* ── Ressource ── */}
            {currentStep.type === 'ressource' && (
              <ProgressiveContent
                key={currentStep.data.id || stepIdx}
                data={currentStep.data}
                onDone={advance}
                C={C}
                xs={xs}
              />
            )}

            {/* ── Réexplication (injectée dynamiquement après 2 erreurs) ── */}
            {currentStep.type === 'explication' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{
                  background:   '#FFF7ED',
                  border:      '1.5px solid #F97316',
                  borderRadius:  12,
                  padding:      '10px 14px',
                  display:     'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 18 }}>💡</span>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#9A3412' }}>
                    Alisha réexplique ce point avant de continuer
                  </p>
                </div>
                <ProgressiveContent
                  key={`expl-${stepIdx}`}
                  data={currentStep.data}
                  onDone={advance}
                  C={C}
                  xs={xs}
                />
              </div>
            )}

            {/* ── Exercice ── */}
            {currentStep.type === 'exercice' && phase === 'step' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <span style={tagStyle(C.goldPale, C.brownMid)}>❓ Application</span>
                  <p style={{ fontSize: 15, fontWeight: 600, color: C.text, lineHeight: 1.7, margin: 0 }}>
                    {currentStep.data.enonce}
                  </p>
                </div>

                {currentStep.data.indice_1 && (
                  <details style={{ fontSize: 13, color: C.textSec }}>
                    <summary style={{ cursor: 'pointer', color: C.brown, fontWeight: 700 }}>
                      💡 Indice
                    </summary>
                    <p style={{ margin: '8px 0 0' }}>{currentStep.data.indice_1}</p>
                  </details>
                )}

                <ExerciceStep key={currentStep.data.id} exercice={currentStep.data} onReponse={handleReponse} C={C} />
              </div>
            )}

            {/* ── Feedback ── */}
            {phase === 'feedback' && feedback && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <p style={{ fontSize: 13, color: C.textMuted, margin: 0, fontStyle: 'italic' }}>
                  {currentStep.data.enonce}
                </p>
                <div style={{
                  background:    feedback.correct === false ? '#FEF2F2' : C.emeraldPale,
                  borderRadius:   14,
                  padding:       '16px 20px',
                  border:        `2px solid ${feedback.correct === false ? C.red : feedback.correct ? C.emerald : C.brownPale}`,
                }}>
                  <p style={{
                    fontSize:   16,
                    fontWeight:  800,
                    color:       feedback.correct === false ? C.red : feedback.correct ? C.emerald : C.brown,
                    margin:     '0 0 6px',
                  }}>
                    {feedback.correct === null
                      ? '📝 Réponse libre notée'
                      : feedback.correct
                      ? '✅ Bonne réponse !'
                      : '❌ Pas tout à fait'}
                  </p>
                  {!feedback.correct && feedback.reponse_correcte && (
                    <p style={{ fontSize: 14, color: C.text, margin: '4px 0 0' }}>
                      Réponse attendue : <strong>{feedback.reponse_correcte}</strong>
                    </p>
                  )}
                  {feedback.explication && (
                    <p style={{ fontSize: 13, color: C.textSec, margin: '10px 0 0', lineHeight: 1.6 }}>
                      {feedback.explication}
                    </p>
                  )}
                </div>
                {/* Badge BKT après mise à jour */}
                {bktResult && (
                  <div style={{
                    display:    'flex',
                    alignItems: 'center',
                    gap:         8,
                    padding:    '10px 14px',
                    borderRadius: 12,
                    background:  `${bktResult.color}18`,
                    border:      `1.5px solid ${bktResult.color}44`,
                  }}>
                    <span style={{ fontSize: 16 }}>🎯</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 800, color: bktResult.color, margin: 0 }}>
                        {bktResult.competence}
                      </p>
                      <p style={{ fontSize: 11, color: C.textSec, margin: '2px 0 0' }}>
                        Maîtrise : {bktResult.pourcentage}% — {bktResult.label}
                      </p>
                    </div>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: `conic-gradient(${bktResult.color} ${bktResult.pourcentage}%, ${C.border} 0)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: C.surface,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 900, color: bktResult.color }}>
                        {bktResult.pourcentage}%
                      </div>
                    </div>
                  </div>
                )}
                {/* Extrait de cours Alisha — BKT < 0.4 */}
                {ressourceAide && feedback?.correct === false && (
                  <div style={{
                    borderRadius: 14, overflow: 'hidden',
                    border: `1.5px solid ${C.brownLight}40`,
                    animation: 'fadeUp .4s ease',
                  }}>
                    <div style={{
                      background: `linear-gradient(135deg, ${C.brown}, ${C.brownMid})`,
                      padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8
                    }}>
                      <span style={{ fontSize: 16 }}>📖</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: 'white', flex: 1 }}>
                        Révise ce point : {ressourceAide.titre}
                      </span>
                      <button onClick={() => setRessourceAide(null)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>✕</button>
                    </div>
                    <div style={{ background: C.brownPale, padding: '12px 14px' }}>
                      <p style={{ margin: '0 0 8px', fontSize: 13, color: C.text, lineHeight: 1.7, fontStyle: 'italic' }}>
                        {ressourceAide.extrait}
                      </p>
                      {ressourceAide.points_cles?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {ressourceAide.points_cles.map((pt, i) => (
                            <span key={i} style={{
                              background: `${C.brown}18`, color: C.brown,
                              padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700
                            }}>{pt}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button onClick={advance} style={primaryBtn(C)}>
                  {stepIdx + 1 >= sequence.length ? 'Terminer 🎉' : 'Continuer →'}
                </button>
              </div>
            )}
          </div>
        )}

        {phase === 'loading' && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Alisha state="thinking" size={100} />
            <p style={{ color: C.textSec, marginTop: 16 }}>Chargement de la leçon…</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(60px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* ── Toast badge débloqué ── */}
      {badgeNotif && (
        <div style={{
          position:     'fixed',
          bottom:        24,
          right:         24,
          zIndex:        999,
          background:   'linear-gradient(135deg, #6B3A2A, #A0522D)',
          color:        'white',
          borderRadius:  16,
          padding:      '14px 18px',
          boxShadow:    '0 8px 32px rgba(0,0,0,0.25)',
          maxWidth:      300,
          animation:    'slideInRight .35s ease',
          display:      'flex',
          gap:           12,
          alignItems:   'flex-start',
        }}>
          <span style={{ fontSize: 24, flexShrink: 0 }}>🏅</span>
          <div>
            <p style={{ margin: '0 0 3px', fontWeight: 800, fontSize: 13 }}>{badgeNotif.titre}</p>
            <p style={{ margin: 0, fontSize: 11, opacity: .85 }}>{badgeNotif.message}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers de style ──────────────────────────────────────────────

function primaryBtn(C) {
  return {
    padding:      '14px',
    borderRadius:  14,
    border:       'none',
    background:   `linear-gradient(135deg, ${C.brown}, ${C.brownMid})`,
    color:        'white',
    fontWeight:    800,
    fontSize:      15,
    cursor:        'pointer',
    width:        '100%',
  }
}

function actionBtn(bg, color, border) {
  return {
    padding:      '13px 24px',
    borderRadius:  14,
    border:       `2px solid ${border}`,
    background:    bg,
    color,
    fontWeight:    700,
    fontSize:      14,
    cursor:        'pointer',
  }
}

function tagStyle(bg, color) {
  return {
    display:      'inline-block',
    padding:      '3px 12px',
    borderRadius:  20,
    background:    bg,
    color,
    fontSize:      11,
    fontWeight:    700,
    textTransform: 'uppercase',
    marginBottom:  10,
  }
}

function sectionBox(bg, borderColor) {
  return {
    background:    bg,
    borderRadius:   14,
    padding:       '14px 18px',
    border:        `1.5px solid ${borderColor}44`,
  }
}

function sectionLabel(color) {
  return { fontSize: 11, fontWeight: 800, color, margin: '0 0 10px', textTransform: 'uppercase' }
}
