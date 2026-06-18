/**
 * Mode tutoriel guidé par Alisha.
 * Séquence : Intro → Ressources → Exercices d'application → Terminé
 * BKT mis à jour après chaque réponse. Commandes vocales KWS actives.
 *
 * Engagement v2 :
 * P1 — Barre segmentée par type (violet=ressource, orange=exercice, vert=terminé)
 * P2 — Confetti CSS + son Web Audio (440→880 Hz) sur bonne réponse
 * P3 — Streak in-session 🔥×N + vibration haptique aux jalons
 * P4 — Transition slide-out gauche / slide-in droite entre étapes
 * P5 — Alisha passe en état 'listening' quand le textarea a le focus
 * P6 — Pop-in flottante à mi-parcours (auto-dismiss 3 s)
 * P7 — Écran terminé : badge 🥉/🥈/🥇 + confetti + delta BKT + message personnalisé
 * P8 — Mode audio tri-état : 🔊 voix → 📖 texte seul → 🔇 silencieux
 * P9 — Niveau de départ depuis ?level= (injecté par CoursDetail)
 * P10 — Son descendant (440→220 Hz) sur erreur
 */
import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTheme } from '../../styles/theme.jsx'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import Alisha from '../../components/Alisha'
import useAlishaVoice from '../../hooks/useAlishaVoice'
import useAlishaController from '../../hooks/useAlishaController'
import { useKWSModel } from '../../hooks/useKWSModel'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useEmotionOnnx, preloadEmotionModel } from '../../hooks/useEmotionOnnx'
import { EMOTION_MODEL_READY } from '../../config/models'
import { ProgressiveContent, parseBlocks } from '../../components/RichContent'
import { blocksToSpeech } from '../../utils/latexToSpeech'
import api from '../../services/api'
import { AdaptationOrchestrator, useAdaptation } from '../../components/adaptation/index.js'

// ── Suivi facial — mêmes helpers que Session.jsx ─────────────────
// Mapping expressions CNN → états affectifs académiques (Ekman adapté)
const CNN_TO_ETAT = {
  happy: 'engagement_eleve', neutral: 'neutre', sad: 'ennui',
  angry: 'frustration', fearful: 'confusion', surprised: 'confusion', disgusted: 'frustration',
}

function fusionnerEmotion(cnnEmotion, cnnProbs, ear, yaw, pitch) {
  const earSignal  = ear < 0.18
  const poseSignal = Math.abs(yaw) > 28
  if (earSignal && Math.abs(pitch) > 10) return 'ennui'
  if (poseSignal && (!cnnProbs || (cnnProbs.neutral || 0) > 0.5)) return 'engagement_faible'
  if (cnnEmotion) return cnnEmotion
  if (poseSignal) return 'engagement_faible'
  return 'neutre'
}

function computeEAR(lm, idx) {
  const p = idx.map(i => lm[i])
  return (Math.hypot(p[1].x-p[5].x, p[1].y-p[5].y) + Math.hypot(p[2].x-p[4].x, p[2].y-p[4].y)) /
         (2 * Math.hypot(p[0].x-p[3].x, p[0].y-p[3].y))
}

const FACE_SEND_MS = 5000  // intervalle entre deux envois facial_analysis

// ── P2 / P10 — Sons Web Audio API ────────────────────────────────

function playTone(freqStart, freqEnd, duration = 150) {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(freqStart, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + duration / 1000)
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration / 1000)
    osc.start()
    osc.stop(ctx.currentTime + duration / 1000 + 0.02)
    osc.onended = () => ctx.close()
  } catch {}
}

// ── P1 — Barre de progression segmentée ──────────────────────────

// Utilise les tokens du thème (C) pour s'adapter au mode sombre
function getStepColor(type, C) {
  switch (type) {
    case 'intro':       return C.brownMid
    case 'ressource':   return C.purple
    case 'explication': return C.purple
    case 'exercice':    return C.accent
    default:            return C.brown
  }
}

function SegmentedBar({ sequence, stepIdx, C }) {
  if (!sequence.length) return null
  return (
    <div style={{ display: 'flex', gap: 2, flex: 1, alignItems: 'center', height: 12 }}>
      {sequence.map((step, i) => {
        const done   = i < stepIdx
        const active = i === stepIdx
        return (
          <div key={i} style={{
            flex:         1,
            height:       active ? '100%' : '65%',
            background:   done ? C.emerald : active ? getStepColor(step.type, C) : C.border,
            borderRadius: i === 0 ? '6px 0 0 6px' : i === sequence.length - 1 ? '0 6px 6px 0' : 2,
            transition:   'background .35s ease, height .2s ease',
          }} />
        )
      })}
    </div>
  )
}

// ── P2 / P7 — Confetti burst CSS ─────────────────────────────────

const CONF_COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6', '#EF4444', '#D4A853']

function Confetti({ active, count = 12 }) {
  if (!active) return null
  // position:fixed pour sortir du contexte overflow:hidden de la carte parente
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 500 }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{
          position:     'absolute',
          left:         `${8 + (i * Math.floor(84 / count))}%`,
          top:          '38%',
          width:        5 + (i % 4) * 2,
          height:       5 + (i % 4) * 2,
          borderRadius: i % 3 !== 0 ? '50%' : 2,
          background:   CONF_COLORS[i % CONF_COLORS.length],
          animation:    `confettiPop .65s ${(i * 0.04).toFixed(2)}s ease-out both`,
        }} />
      ))}
    </div>
  )
}

// ── L2 — Séquence adaptive BKT (3 niveaux) ───────────────────────

function buildSequence(ua, { bktScore = null, startLevel = 1, dktOrder = null } = {}) {
  const level = startLevel >= 3 ? 3
    : startLevel >= 2 ? 2
    : bktScore === null ? 1
    : bktScore >= 0.6 ? 3
    : bktScore >= 0.3 ? 2
    : 1

  // Tri DKT ZPD si disponible, fallback difficulté croissante
  const exercices = ua.exercices || []
  const allEx = dktOrder && dktOrder.length > 0
    ? (() => {
        const pos = new Map(dktOrder.map((id, i) => [id, i]))
        return [...exercices].sort((a, b) => {
          const ia = pos.has(a.id) ? pos.get(a.id) : Infinity
          const ib = pos.has(b.id) ? pos.get(b.id) : Infinity
          return ia !== ib ? ia - ib : (a.difficulte ?? 1) - (b.difficulte ?? 1)
        })
      })()
    : [...exercices].sort((a, b) => (a.difficulte ?? 1) - (b.difficulte ?? 1))
  const easy  = allEx.filter(e => (e.difficulte ?? 1) === 1)
  const mid   = allEx.filter(e => e.difficulte === 2)
  const hard  = allEx.filter(e => e.difficulte >= 3)
  // pick : premier tableau non-vide parmi les arguments
  const pick  = (...arrs) => { for (const a of arrs) if (a.length) return a; return allEx }

  if (level === 1) {
    // Intro → Ressource complète → 1 Facile → Récap → 1 Facile/Moyen
    const steps = [{ type: 'intro', data: ua }]
    ;(ua.ressources || []).forEach(r => steps.push({ type: 'ressource', data: r }))
    const e1 = pick(easy)[0], e2 = pick(easy)[1] || pick(mid)[0]
    if (e1) steps.push({ type: 'exercice', data: e1 })
    const hasPts = (ua.points_cles?.length || ua.ressources?.[0]?.points_cles?.length)
    if (hasPts) steps.push({ type: 'recap', data: ua })
    if (e2 && e2 !== e1) steps.push({ type: 'exercice', data: e2 })
    return steps
  }

  if (level === 2) {
    // Ressource abrégée → 1 Facile → 1 Moyen → Mini-défi bonus
    const steps = []
    ;(ua.ressources || []).forEach(r => steps.push({ type: 'ressource_abregee', data: r }))
    const e1 = pick(easy)[0]
    const e2 = pick(mid)[0] || pick(easy)[1]
    const e3 = pick(mid)[1] || pick(hard)[0]
    if (e1) steps.push({ type: 'exercice', data: e1 })
    if (e2 && e2 !== e1) steps.push({ type: 'exercice', data: e2 })
    if (e3 && e3 !== e2 && e3 !== e1) steps.push({ type: 'exercice', data: { ...e3, _bonus: true } })
    return steps.length ? steps : allEx.slice(0, 3).map(e => ({ type: 'exercice', data: e }))
  }

  // level 3 — Défi direct : 2 Difficile
  const e1 = pick(hard)[0] || pick(mid)[0] || allEx[0]
  const e2 = pick(hard)[1] || pick(mid)[1] || allEx[1]
  const steps = []
  if (e1) steps.push({ type: 'exercice', data: e1 })
  if (e2 && e2 !== e1) steps.push({ type: 'exercice', data: e2 })
  return steps.length ? steps : allEx.slice(0, 3).map(e => ({ type: 'exercice', data: e }))
}

// ── L4 — Typewriter (situation-problème) ─────────────────────────

function TypewriterText({ text, speedMs = 32, onDone, C }) {
  const [idx,       setIdx]     = useState(0)
  const cancelRef               = useRef(false)
  const skipRef                 = useRef(false)

  useEffect(() => {
    cancelRef.current = false; skipRef.current = false; setIdx(0)
    function tick(i) {
      if (cancelRef.current) return
      if (skipRef.current) { setIdx(text.length); onDone?.(); return }
      if (i >= text.length) { onDone?.(); return }
      setIdx(i + 1)
      setTimeout(() => tick(i + 1), speedMs)
    }
    tick(0)
    return () => { cancelRef.current = true }
  }, [text]) // eslint-disable-line

  return (
    <span onClick={() => { skipRef.current = true }} style={{ cursor: idx < text.length ? 'pointer' : 'default' }}>
      {text.slice(0, idx)}
      {idx < text.length && (
        <span style={{ borderRight: `2px solid ${C.brown}`, marginLeft: 1, animation: 'blink .7s step-end infinite' }}>&nbsp;</span>
      )}
    </span>
  )
}

// ── L5 — XP flottant ─────────────────────────────────────────────

function XpFloat({ notif, C }) {
  if (!notif) return null
  return (
    <div key={notif.key} style={{
      position: 'fixed', bottom: 88, right: 20, zIndex: 450,
      background: `linear-gradient(135deg, ${C.gold}, ${C.orange})`,
      color: 'white', borderRadius: 20, padding: '6px 14px',
      fontWeight: 900, fontSize: 14, letterSpacing: '.02em',
      boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
      animation: 'xpFloat 1.3s ease forwards', pointerEvents: 'none',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <span>⭐ +{notif.amount} XP</span>
      {notif.label && <span style={{ fontSize: 10, opacity: .9, fontWeight: 700 }}>{notif.label}</span>}
    </div>
  )
}

// ── L2 / Niveau 1 — Récapitulatif animé ──────────────────────────

function RecapStep({ ua, C, xs, onDone }) {
  const pts = ua.points_cles || ua.ressources?.[0]?.points_cles || []
  const [visible, setVisible] = useState(0)

  useEffect(() => {
    let i = 0
    function next() {
      if (i >= pts.length) return
      setVisible(++i)
      setTimeout(next, 480)
    }
    const t = setTimeout(next, 200)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <span style={tagStyle('#FBF3E0', '#A05C38')}>🔑 Points clés</span>
        <h3 style={{ fontSize: xs ? 15 : 17, fontWeight: 800, color: C.text, margin: '4px 0 0' }}>
          Ce qu'il faut retenir
        </h3>
      </div>
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pts.map((p, i) => (
          <li key={i} style={{
            display: 'flex', gap: 12, alignItems: 'flex-start',
            padding: '10px 14px', borderRadius: 12,
            background:  i < visible ? C.goldPale : 'transparent',
            border:      `1.5px solid ${i < visible ? C.gold + '55' : 'transparent'}`,
            opacity:     i < visible ? 1 : 0,
            transform:   i < visible ? 'translateX(0)' : 'translateX(-12px)',
            transition:  'all .35s ease',
          }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: C.gold, flexShrink: 0 }}>✦</span>
            <span style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>{p}</span>
          </li>
        ))}
      </ul>
      {visible >= pts.length && (
        <button data-advance onClick={onDone} style={{ ...primaryBtn(C), animation: 'fadeUp .3s ease' }}>
          C'est noté ! Continuer →
        </button>
      )}
    </div>
  )
}

// ── L1 — Layout conversationnel ───────────────────────────────────

function getAlishaLayout(phase, step, feedback, xs) {
  if (xs) {
    const size = phase === 'feedback' && feedback?.correct === true ? 88
               : phase === 'feedback' ? 68
               : step?.type === 'exercice' ? 74 : 80
    return { pos: 'top', size }
  }
  if (phase === 'feedback' && feedback?.correct === true)
    return { pos: 'center', size: 108 }
  if (phase === 'feedback' && feedback?.correct === false)
    return { pos: 'left', size: 72 }
  if (step?.type === 'exercice')
    return { pos: 'right', size: 82 }
  return { pos: 'left', size: 90 }
}

// ── Vérification locale ───────────────────────────────────────────

function checkReponse(exercice, reponse) {
  const norm = s => String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  const expected = exercice.reponse_correcte ?? exercice.options?.reponse_correcte ?? ''
  if (exercice.type === 'reponse_libre') {
    return { correct: null, reponse_correcte: expected, explication: exercice.explication || '' }
  }
  return {
    correct:          norm(reponse) === norm(expected),
    reponse_correcte: expected,
    explication:      exercice.explication || '',
  }
}

// ── Messages contextuels d'Alisha ────────────────────────────────

function alishaMsg(phase, step, feedback, user) {
  const prenom = user?.prenom || user?.username || ''
  if (phase === 'loading') return 'Je prépare ta leçon… 📖'
  if (phase === 'done')    return 'Excellent ! Tu as fini cette unité ! 🎉'
  if (!step) return ''
  if (step.type === 'intro') {
    return step.data?.bkt_score > 0
      ? `Bon retour ${prenom} ! Tu en étais à ${Math.round(step.data.bkt_score * 100)}% de maîtrise. Continuons !`
      : `Salut ${prenom} ! Voici ce que tu vas apprendre.`
  }
  if (step.type === 'recap') return '🔑 Ancrons ces points clés dans ta mémoire !'
  if (phase === 'feedback' && feedback) {
    if (feedback.correct === null)
      return `Réponse notée !${feedback.reponse_correcte ? ` Exemple : "${feedback.reponse_correcte}"` : ''}`
    return feedback.correct
      ? "Parfait ! C'est la bonne réponse. Continue comme ça !"
      : `Pas tout à fait… La bonne réponse était : "${feedback.reponse_correcte}"`
  }
  if (step.type === 'explication') return "Je vais te réexpliquer ce point avant de continuer. 💡"
  if (step.type === 'ressource' || step.type === 'ressource_abregee') {
    const pts = step.data.points_cles
    return pts?.length > 0 ? `Retiens bien : "${pts[0]}"` : `Voici la leçon : ${step.data.titre}`
  }
  if (step.type === 'exercice') {
    if (step.data._bonus) return '🔥 Mini-défi bonus ! Prêt·e ?'
    return step.data.type === 'qcm' || step.data.type === 'vrai_faux'
      ? 'Quelle est la bonne réponse ? Choisis !'
      : 'Réponds dans ta propre formulation.'
  }
  return ''
}

function alishaStateFor(phase, step, feedback, bktNiveau) {
  if (phase === 'loading')                          return 'thinking'
  if (phase === 'done')                             return 'celebration'
  if (step?.type === 'intro')                       return 'welcome'
  if (step?.type === 'recap')                       return 'speaking'
  if (step?.type === 'explication')                 return 'speaking'
  if (phase === 'feedback' && feedback?.correct === true)
    return bktNiveau === 'maitrise' ? 'excited' : 'correct'
  if (phase === 'feedback' && feedback?.correct === false)
    return bktNiveau === 'a_renforcer' ? 'confused' : 'wrong'
  if (phase === 'feedback' && feedback?.correct === null) return 'speaking'
  if (step?.type === 'exercice') return 'question'
  return 'speaking'
}

// ── L3 — Composant exercice enrichi ──────────────────────────────

function ExerciceStep({ exercice, onReponse, C, onAlishaState, disabled, audioMode }) {
  const [selected,  setSelected]  = useState(null)
  const [text,      setText]      = useState('')
  const [wordCount, setWordCount] = useState(0)
  const MIN_WORDS = 3

  const choix = exercice.type === 'vrai_faux'
    ? ['Vrai', 'Faux']
    : exercice.options?.choix || exercice.options || []

  function selectOpt(opt) {
    if (disabled) return
    navigator.vibrate?.(25)
    if (audioMode === 'full') playTone(880, 880, 60)  // click feedback
    setSelected(opt)
  }

  // ── Vrai / Faux — deux grandes cartes côte à côte ─────────────
  if (exercice.type === 'vrai_faux') {
    return (
      <div style={{ display: 'flex', gap: 10 }}>
        {['Vrai', 'Faux'].map(opt => {
          const isSel  = selected === opt
          const isVrai = opt === 'Vrai'
          return (
            <button
              key={opt}
              disabled={disabled}
              onClick={() => {
                selectOpt(opt)
                // VF : confirmation immédiate après 200ms (une seule action)
                setTimeout(() => { if (!disabled) { navigator.vibrate?.(30); onReponse(opt) } }, 200)
              }}
              style={{
                flex: 1, padding: '28px 12px', borderRadius: 16,
                border: `2.5px solid ${isSel ? (isVrai ? C.emerald : C.red) : C.border}`,
                background: isSel
                  ? (isVrai ? `${C.emerald}18` : `${C.red}18`)
                  : C.surface,
                color:     C.text,
                cursor:    disabled ? 'not-allowed' : 'pointer',
                display:   'flex', flexDirection: 'column',
                alignItems: 'center', gap: 8,
                transform: isSel ? 'scale(1.04)' : 'scale(1)',
                transition: 'all .18s cubic-bezier(0.34, 1.56, 0.64, 1)',
                opacity:   disabled ? 0.6 : 1,
                boxShadow: isSel ? `0 4px 16px ${isVrai ? C.emerald : C.red}28` : 'none',
              }}
            >
              <span style={{ fontSize: 30 }}>{isVrai ? '✅' : '❌'}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: isSel ? (isVrai ? C.emerald : C.red) : C.text }}>
                {opt}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  // ── QCM — sélection (scale) + bouton Confirmer ────────────────
  if (exercice.type === 'qcm') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {choix.map((opt, i) => {
          const isSel = selected === opt
          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => selectOpt(opt)}
              style={{
                padding: '14px 18px', borderRadius: 14,
                border:  `2px solid ${isSel ? C.brown : C.border}`,
                background: isSel ? C.brownPale : C.surface,
                color: C.text, fontWeight: isSel ? 700 : 500, fontSize: 14,
                cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left',
                transform: isSel ? 'scale(1.025)' : 'scale(1)',
                transition: 'all .18s cubic-bezier(0.34, 1.56, 0.64, 1)',
                opacity: disabled ? 0.65 : 1,
                display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: isSel ? `0 2px 12px ${C.brown}22` : 'none',
              }}
            >
              <span style={{
                display: 'inline-flex', width: 26, height: 26,
                borderRadius: '50%', alignItems: 'center', justifyContent: 'center',
                background: isSel ? C.brown : C.border,
                color: isSel ? 'white' : C.textMuted,
                fontSize: 11, fontWeight: 800, flexShrink: 0,
                transition: 'background .15s ease',
              }}>
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
            </button>
          )
        })}

        {selected !== null && (
          <button
            onClick={() => { navigator.vibrate?.(30); onReponse(selected) }}
            disabled={disabled}
            style={{
              padding: '13px', borderRadius: 14, border: 'none',
              background: disabled ? C.border : `linear-gradient(135deg, ${C.brown}, ${C.brownMid})`,
              color: disabled ? C.textMuted : 'white',
              fontWeight: 800, fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer',
              animation: 'slideUp .22s cubic-bezier(0.34,1.56,0.64,1)',
              transition: 'background .15s ease',
            }}
          >
            {disabled ? '⏳ Vérification…' : '✓ Confirmer ma réponse'}
          </button>
        )}
      </div>
    )
  }

  // ── Réponse libre — border illuminée + compteur mots ──────────
  const enoughWords = wordCount >= MIN_WORDS
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ position: 'relative' }}>
        <textarea
          value={text}
          onChange={e => {
            setText(e.target.value)
            setWordCount(e.target.value.trim().split(/\s+/).filter(Boolean).length)
          }}
          onFocus={() => onAlishaState?.('listening')}
          onBlur={()  => onAlishaState?.(null)}
          disabled={disabled}
          placeholder={exercice.type === 'reponse_libre' ? 'Rédige ta réponse…' : 'Complète…'}
          rows={exercice.type === 'reponse_libre' ? 4 : 2}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '14px 16px', borderRadius: 14,
            border: `2px solid ${text ? C.brown : C.border}`,
            background: C.bg, color: C.text, fontSize: 14,
            outline: 'none', resize: 'none',
            fontFamily: "'DM Sans', system-ui, sans-serif",
            lineHeight: 1.6, opacity: disabled ? 0.65 : 1,
            transition: 'border-color .15s ease',
          }}
        />
        {exercice.type === 'reponse_libre' && (
          <span style={{
            position: 'absolute', bottom: 10, right: 12,
            fontSize: 10, fontWeight: 700,
            color: enoughWords ? C.emerald : C.textMuted,
            transition: 'color .2s ease',
          }}>
            {enoughWords ? '✓ OK' : `~${MIN_WORDS} mots min`}
          </span>
        )}
      </div>
      <button
        onClick={() => { onAlishaState?.(null); onReponse(text) }}
        disabled={!text.trim() || disabled}
        style={{
          padding: '14px', borderRadius: 14, border: 'none',
          background: (!text.trim() || disabled) ? C.border : `linear-gradient(135deg, ${C.brown}, ${C.brownMid})`,
          color: (!text.trim() || disabled) ? C.textMuted : 'white',
          fontWeight: 800, fontSize: 14,
          cursor: (!text.trim() || disabled) ? 'not-allowed' : 'pointer',
          opacity: !text.trim() ? 0.5 : 1,
          transition: 'background .15s ease',
        }}
      >
        {disabled ? '⏳ Vérification…' : 'Valider →'}
      </button>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────

export default function TutorielAlisha() {
  const { uaId }       = useParams()
  const [searchParams] = useSearchParams()
  const startLevel     = parseInt(searchParams.get('level') || '1', 10)
  const navigate       = useNavigate()
  const { C }          = useTheme()
  const { xs }         = useBreakpoint()
  const { user }       = useSelector(s => s.auth)

  const [ua,             setUa]             = useState(null)
  const [sequence,       setSequence]       = useState([])
  const [stepIdx,        setStepIdx]        = useState(0)
  const [phase,          setPhase]          = useState('loading')
  const [feedback,       setFeedback]       = useState(null)
  const [isSpeaking,     setIsSpeaking]     = useState(false)
  // P8 — tri-état : 'full' | 'text' | 'silent'
  const [audioMode,      setAudioMode]      = useState(
    () => localStorage.getItem('alisha_audio_mode') || 'full'
  )
  const [bktResult,      setBktResult]      = useState(null)
  const [finalBktResult, setFinalBktResult] = useState(null)
  const [audioActive,    setAudioActive]    = useState(false)
  // Consentement caméra + micro (persisté dans localStorage)
  // Valeurs : null (non demandé) | 'full' | 'camera' | 'none'
  const CONSENT_KEY = 'alisha_media_consent'
  const [mediaConsent,   setMediaConsent]   = useState(
    () => localStorage.getItem('alisha_media_consent')
  )
  const [showConsent,    setShowConsent]    = useState(false)
  const [ressourceAide,  setRessourceAide]  = useState(null)
  const [badgeNotif,     setBadgeNotif]     = useState(null)
  const [scoreCorrects,  setScoreCorrects]  = useState(0)
  const [streakSession,  setStreakSession]  = useState(0)
  const [alishaOverride, setAlishaOverride] = useState(null)
  const [confettiCorrect,setConfettiCorrect]= useState(false)
  const [midpointNotif,  setMidpointNotif]  = useState(false)
  const [checkingAnswer, setCheckingAnswer] = useState(false)
  // L5 — XP in-session
  const [xpSession,      setXpSession]      = useState(0)
  const [xpFloat,        setXpFloat]        = useState(null)
  // L6 — Tooltip segment
  const [hoveredSeg,     setHoveredSeg]     = useState(null)
  // L4 — Intro typewriter
  const [introPhase,     setIntroPhase]     = useState(0)   // 0=bounce 1=tw 2=comps 3=cta
  const [introVisComp,   setIntroVisComp]   = useState(0)
  // DKT — ordre ZPD recommandé par le modèle Deep Knowledge Tracing
  const [dktOrder,       setDktOrder]       = useState(null)
  const [dktSource,      setDktSource]      = useState(null)

  const sessionIdRef           = useRef(null)
  const stepStartRef           = useRef(null)
  const consecutiveErrRef      = useRef(0)
  const lastCompetenceRef      = useRef(null)
  // Métriques pour le moteur d'adaptation
  const sessionStartTimeRef    = useRef(null)
  const nbResponsesTotalRef    = useRef(0)
  const erreursSessionRef      = useRef(0)
  const reussitesMacroRef      = useRef(0)
  const lastFaceScoreRef       = useRef(0.6)
  const lastFaceEmotionRef     = useRef('neutre')
  const recentTimesRef         = useRef([])
  const engHistoryRef          = useRef([])
  const lowEngStreakRef         = useRef(0)
  const explicationInjectedRef = useRef(false)
  const midpointShownRef       = useRef(false)
  const bktInitialRef          = useRef(null)
  const cardRef                = useRef(null)
  const transitioningRef       = useRef(false)
  const touchStartYRef         = useRef(null)   // L7 — swipe-up

  // ── Suivi facial ─────────────────────────────────────────────────
  const videoRef           = useRef(null)
  const faceMeshRef        = useRef(null)
  const cameraStartingRef  = useRef(false)   // guard anti double-appel startCamera()
  const cnnEmotionRef      = useRef({ emotion: null, probs: null })
  const lastFaceSendRef    = useRef(0)
  const earBufferRef       = useRef([])
  const faceIntervalRef    = useRef(null)
  const [cameraActive, setCameraActive] = useState(false)

  const { predict: predictEmotionOnnx } = useEmotionOnnx()

  const { speak, stop, readAloud, isReading, supported, needsVoiceSetup, dismissVoiceSetup, edgeVoice, setPreferredVoice, edgeAvailable, systemVoiceName } = useAlishaVoice()

  // Contrôleur diversifiers — gère uniquement la phase feedback (correct/wrong)
  // Les phases intro/ressources/exercices gardent leur propre TTS via alishaMsg()
  const alishaCtrl = useAlishaController({
    speakFn:     speak,
    stopFn:      stop,
    engagement:  { score: 0.6, emotion: 'neutre' },
    bkt:         bktResult,
    streak:      streakSession,
    studentName: user?.prenom ?? null,
  })
  const { currentAdaptation, evaluate, dismiss } = useAdaptation()
  const { lastKeyword } = useKWSModel(audioActive, (dur) => {
    logInteraction('vad_speech', { event: 'end', duration_seconds: dur })
  })
  const prevMessageRef = useRef(null)

  // ── L5 — Attribution XP ──────────────────────────────────────
  function awardXP(amount, label = '') {
    setXpSession(n => n + amount)
    const key = Date.now()
    setXpFloat({ amount, label, key })
    setTimeout(() => setXpFloat(v => v?.key === key ? null : v), 1400)
  }

  function logInteraction(type, data = {}) {
    if (!sessionIdRef.current) return
    api.post('/api/interaction', { session_id: sessionIdRef.current, user_id: user.id, type, data }).catch(() => {})
  }

  // ── Suivi facial discret — même pipeline que Session.jsx ─────────
  // Auto-démarrage silencieux après création de la session.
  // Pas de toast bloquant : si la caméra est refusée, on continue sans.
  function onFaceResults(results) {
    if (!results.multiFaceLandmarks?.length) {
      const now = Date.now()
      if (now - lastFaceSendRef.current > FACE_SEND_MS) {
        logInteraction('facial_analysis', { visual_score: 0.0, face_detected: false, emotion: 'absent' })
        lastFaceSendRef.current = now
      }
      return
    }
    const lm = results.multiFaceLandmarks[0]
    const earRaw = (computeEAR(lm, [362,385,387,263,373,380]) + computeEAR(lm, [33,160,158,133,153,144])) / 2
    earBufferRef.current.push(earRaw)
    if (earBufferRef.current.length > 8) earBufferRef.current.shift()
    const ear   = earBufferRef.current.reduce((a,b) => a+b, 0) / earBufferRef.current.length
    const yaw   = (lm[1].x - 0.5) * 180
    const pitch = (lm[1].y - lm[152].y) * 200

    let score = 1.0
    if (ear < 0.15) score -= 0.5; else if (ear < 0.20) score -= 0.4; else if (ear < 0.25) score -= 0.2
    if (Math.abs(yaw) > 45) score -= 0.4; else if (Math.abs(yaw) > 30) score -= 0.3; else if (Math.abs(yaw) > 15) score -= 0.1
    if (Math.abs(pitch) > 30) score -= 0.2; else if (Math.abs(pitch) > 15) score -= 0.1
    score = Math.max(0, Math.min(1, score))

    const { emotion: cnnEmotion, probs: cnnProbs, dominant: cnnDominant } = cnnEmotionRef.current
    const em = fusionnerEmotion(cnnEmotion, cnnProbs, ear, yaw, pitch)
    lastFaceScoreRef.current = score
    lastFaceEmotionRef.current = em

    const now = Date.now()
    if (now - lastFaceSendRef.current > FACE_SEND_MS) {
      logInteraction('facial_analysis', {
        visual_score:  Math.round(score * 100) / 100,
        ear:           Math.round(ear * 100) / 100,
        yaw:           Math.round(yaw),
        pitch:         Math.round(pitch),
        face_detected: true,
        emotion:       em,
        cnn_dominant:  cnnDominant || null,
        cnn_happy:     cnnProbs ? Math.round((cnnProbs.happy     || 0) * 100) / 100 : null,
        cnn_neutral:   cnnProbs ? Math.round((cnnProbs.neutral   || 0) * 100) / 100 : null,
        cnn_sad:       cnnProbs ? Math.round((cnnProbs.sad       || 0) * 100) / 100 : null,
        cnn_angry:     cnnProbs ? Math.round((cnnProbs.angry     || 0) * 100) / 100 : null,
        cnn_fearful:   cnnProbs ? Math.round((cnnProbs.fearful   || 0) * 100) / 100 : null,
        cnn_surprised: cnnProbs ? Math.round((cnnProbs.surprised || 0) * 100) / 100 : null,
        cnn_disgusted: cnnProbs ? Math.round((cnnProbs.disgusted || 0) * 100) / 100 : null,
        source:        cnnDominant ? 'cnn+geometry' : 'geometry',
      })
      lastFaceSendRef.current = now
    }
  }

  async function startCamera() {
    if (cameraActive || cameraStartingRef.current) return
    cameraStartingRef.current = true
    try {
      const conn    = navigator.connection || navigator.mozConnection || navigator.webkitConnection
      const slowNet = conn && (conn.effectiveType === '2g' || conn.downlink < 1.5)
      const camW    = slowNet ? 160 : 320
      const camH    = slowNet ? 120 : 240

      // Attend MediaPipe WASM (max 5s)
      let tries = 0
      while ((!window.FaceMesh || !window.Camera) && tries < 10) {
        await new Promise(r => setTimeout(r, 500)); tries++
      }
      if (!window.FaceMesh || !window.Camera) return

      const fm = new window.FaceMesh({ locateFile: f => `/mediapipe/face_mesh/${f}` })
      fm.setOptions({
        maxNumFaces: 1, refineLandmarks: !slowNet,
        minDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
      })
      fm.onResults(onFaceResults)
      faceMeshRef.current = fm

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: camW, height: camH, frameRate: slowNet ? 10 : 15 },
      })
      if (!videoRef.current) return
      videoRef.current.srcObject = stream
      const cam = new window.Camera(videoRef.current, {
        onFrame: async () => {
          if (!faceMeshRef.current || !videoRef.current?.videoWidth) return
          try { await faceMeshRef.current.send({ image: videoRef.current }) } catch {}
        },
        width: camW, height: camH,
      })
      await cam.start()
      setCameraActive(true)

      // Précharge ONNX après MediaPipe — évite la compétition de runtimes WASM
      // MediaPipe vient de démarrer cam.start() ; on lui laisse 4s pour compiler
      // son WASM avant de lancer un deuxième InferenceSession.
      setTimeout(preloadEmotionModel, 4000)

      // Modèle ONNX africain pour les expressions
      faceIntervalRef.current = setInterval(async () => {
        const vid = videoRef.current
        if (!vid || !vid.videoWidth || !EMOTION_MODEL_READY) return
        const res = await predictEmotionOnnx(vid)
        if (res) cnnEmotionRef.current = { emotion: res.emotion, probs: res.probs, dominant: res.emotion, source: 'onnx' }
      }, 3000)
    } catch {
      // Permission caméra refusée ou indisponible → silencieux, pas de toast
    } finally {
      cameraStartingRef.current = false
    }
  }

  function stopCamera() {
    if (faceIntervalRef.current)  { clearInterval(faceIntervalRef.current); faceIntervalRef.current = null }
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop())
      videoRef.current.srcObject = null
    }
    if (faceMeshRef.current) { faceMeshRef.current.close?.(); faceMeshRef.current = null }
    setCameraActive(false)
  }

  // ── DKT — récupère l'ordre ZPD recommandé après chargement de l'UA ─
  useEffect(() => {
    if (!ua?.id || !user?.id) return
    api.get(`/api/dkt/apprenant/${user.id}/prochain-exercice?ua_id=${ua.id}`)
      .then(r => {
        setDktSource(r.data.source)
        const ordered = [r.data.prochain_exercice, ...r.data.alternatives].filter(Boolean)
        setDktOrder(ordered.map(e => e.id))
      })
      .catch(err => {
        console.warn('DKT indisponible, fallback difficulté', err)
        setDktSource('fallback_error')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ua?.id, user?.id])

  // Rebuild de la séquence quand l'ordre DKT arrive (après l'UA chargée)
  useEffect(() => {
    if (!ua || !dktOrder) return
    const seq = buildSequence(ua, { bktScore: bktInitialRef.current, startLevel, dktOrder })
    setSequence(seq)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dktOrder])

  // ── Chargement UA ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    api.get(`/api/cours/ua/${uaId}`)
      .then(async r => {
        if (cancelled) return
        setUa(r.data)
        bktInitialRef.current = r.data.bkt_score ?? null
        // L2 — séquence adaptive selon BKT + level choisi par l'apprenant
        const seq = buildSequence(r.data, { bktScore: r.data.bkt_score ?? null, startLevel })
        setSequence(seq)
        setStepIdx(0)
        setIntroPhase(0)
        setPhase('step')
        stepStartRef.current = Date.now()
        try {
          const s = await api.post('/api/cours/session/creer', { user_id: user.id, ua_id: uaId })
          sessionIdRef.current = s.data.session_id
          sessionStartTimeRef.current = Date.now()
          // Demande de consentement si jamais accordé, sinon applique immédiatement
          const consent = localStorage.getItem('alisha_media_consent')
          if (!consent) {
            setShowConsent(true)
          } else {
            if (consent === 'full' || consent === 'camera') startCamera()
            if (consent === 'full') {
              // L'AudioContext ne peut démarrer QUE sur un geste utilisateur.
              // Au rechargement avec consentement mémorisé, il n'y a pas de geste
              // → on diffère l'activation micro à la 1ère interaction.
              if (cancelled) return
              const armAudio = () => { setAudioActive(true) }
              window.addEventListener('pointerdown', armAudio, { once: true })
              window.addEventListener('keydown',    armAudio, { once: true })
            }
          }
        } catch {}
      })
      .catch(() => navigate('/dashboard'))
    return () => {
      cancelled = true
      setAudioActive(false)
      stopCamera()
      if (sessionIdRef.current)
        api.post(`/api/cours/session/clore/${sessionIdRef.current}`).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uaId, user.id])

  const currentStep = sequence[stepIdx] ?? null
  const totalSteps  = sequence.length
  // Badge DKT : s'affiche uniquement sur le premier exercice quand le modèle a trié
  const firstExoIdx         = sequence.findIndex(s => s.type === 'exercice')
  const isFirstDktExercice  = dktSource === 'dkt_zpd' && stepIdx === firstExoIdx

  // ── L4 — Intro : orchestration phases (bounce→TW→compétences→CTA) ─
  useEffect(() => {
    if (phase !== 'step' || currentStep?.type !== 'intro') return
    setIntroPhase(0); setIntroVisComp(0)
    const t = setTimeout(() => {
      const msg = alishaMsg(phase, currentStep, feedback, user)
      if (audioMode === 'full' && supported)
        speak(msg, { onStart: () => setIsSpeaking(true), onEnd: () => setIsSpeaking(false) })
      if (currentStep.data?.situation_probleme) setIntroPhase(1)
      else startIntroComps(currentStep.data)
    }, 450)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stepIdx])

  function startIntroComps(ua_data) {
    setIntroPhase(2)
    const n = ua_data?.competences?.length || 0
    let i = 0
    function next() {
      if (i >= n) { setIntroPhase(3); return }
      setIntroVisComp(++i)
      setTimeout(next, 340)
    }
    setTimeout(next, 80)
  }

  // ── L7 — Swipe-up pour avancer (phase feedback) ───────────────
  function onTouchStart(e) { touchStartYRef.current = e.touches[0]?.clientY ?? null }
  function onTouchEnd(e) {
    if (touchStartYRef.current === null) return
    const dy = touchStartYRef.current - (e.changedTouches[0]?.clientY ?? 0)
    touchStartYRef.current = null
    if (dy > 55 && phase === 'feedback') advance()
  }

  // ── Voix Alisha ───────────────────────────────────────────────
  useEffect(() => {
    if (currentStep?.type === 'intro') return  // géré par l'effet intro
    // Phase feedback : TTS délégué au contrôleur (diversifiers) via triggerEvent dans handleReponse
    if (phase === 'feedback') return
    const msg = alishaMsg(phase, currentStep, feedback, user)
    if (!msg || msg === prevMessageRef.current || audioMode !== 'full' || !supported) {
      if (audioMode !== 'full') stop()
      return
    }
    prevMessageRef.current = msg
    speak(msg, { onStart: () => setIsSpeaking(true), onEnd: () => setIsSpeaking(false) })
    return stop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stepIdx, audioMode])

  // ── P6 — Pop-in mi-parcours ───────────────────────────────────
  useEffect(() => {
    if (midpointShownRef.current || totalSteps < 8) return
    if (stepIdx === Math.floor(totalSteps / 2)) {
      midpointShownRef.current = true
      setMidpointNotif(true)
      setTimeout(() => setMidpointNotif(false), 3000)
    }
  }, [stepIdx, totalSteps])

  // ── Réponse à un exercice ─────────────────────────────────────
  // Correction autoritaire via POST /api/cours/exercice/verifier (normalisation serveur).
  // Fallback local si réseau indisponible.
  async function handleReponse(reponse) {
    if (!currentStep || currentStep.type !== 'exercice') return
    const exerciceId = currentStep.data.id
    const competence = currentStep.data.kcs?.[0] || currentStep.data.competence_evaluee
    const timeSecs   = stepStartRef.current ? Math.round((Date.now() - stepStartRef.current) / 1000) : 99
    const isBonus    = !!currentStep.data._bonus

    setCheckingAnswer(true)
    setAlishaOverride('thinking')

    // L3 / L7 — délai suspense 600 ms (Alisha réfléchit) avant feedback
    await new Promise(r => setTimeout(r, 600))

    let result, bktFromServer = null

    try {
      const res = await api.post('/api/cours/exercice/verifier', {
        exercice_id: exerciceId, user_id: user.id, reponse: String(reponse),
        session_id: sessionIdRef.current ?? undefined,  // lie la progression → jointure engagement DKT
      })
      result = {
        correct:          res.data.correct,
        reponse_correcte: res.data.reponse_correcte || '',
        explication:      res.data.explication || '',
      }
      bktFromServer = res.data.bkt || null
    } catch {
      result = checkReponse(currentStep.data, reponse)
    }

    setCheckingAnswer(false)
    setAlishaOverride(null)
    setFeedback(result)
    setPhase('feedback')
    // L7 — flip 3D au moment de l'affichage du feedback
    requestAnimationFrame(() => {
      if (cardRef.current) {
        cardRef.current.style.animation = 'none'
        requestAnimationFrame(() => {
          if (cardRef.current) cardRef.current.style.animation = 'flipInY .38s ease'
        })
      }
    })
    if (bktFromServer) setBktResult(bktFromServer)

    logInteraction('response', {
      exercice_id: exerciceId, competence: competence ?? null,
      correct: result.correct, time_seconds: timeSecs,
      difficulte: currentStep.data.difficulte ?? 1,
    })

    if (result.correct === true) {
      setScoreCorrects(n => n + 1)
      const newStreak = streakSession + 1
      setStreakSession(newStreak)
      if (newStreak === 3 || newStreak === 5 || newStreak === 10) navigator.vibrate?.([30, 20, 40])
      consecutiveErrRef.current = 0
      playTone(440, 880, 150)
      setConfettiCorrect(true)
      setTimeout(() => setConfettiCorrect(false), 800)
      if (audioMode === 'full') {
        alishaCtrl.triggerEvent('correct', { bkt: bktFromServer, streak: newStreak })
      }
      // L5 — XP selon contexte
      if (isBonus)          awardXP(20, '💪 Bonus !')
      else if (timeSecs < 15) awardXP(15, '⚡ Rapide !')
      else if (newStreak >= 3) awardXP(10, '🔥 Combo !')
      else                    awardXP(10)
    } else if (result.correct === false) {
      if (competence === lastCompetenceRef.current) consecutiveErrRef.current += 1
      else consecutiveErrRef.current = 1
      setStreakSession(0)
      playTone(440, 220, 80)
      if (audioMode === 'full') {
        alishaCtrl.triggerEvent('wrong', { bkt: bktFromServer, hintsUsed: consecutiveErrRef.current })
      }
    } else {
      consecutiveErrRef.current = 0
      awardXP(5, '📝 Noté')   // réponse libre
    }

    // ── Métriques pour le moteur d'adaptation ────────────────────
    nbResponsesTotalRef.current += 1
    if (result.correct === false) erreursSessionRef.current += 1
    if (result.correct === true) {
      reussitesMacroRef.current = competence === lastCompetenceRef.current ? reussitesMacroRef.current + 1 : 1
    } else {
      reussitesMacroRef.current = 0
    }
    const _rt = recentTimesRef.current; _rt.push(timeSecs); if (_rt.length > 5) _rt.shift()
    const _fs = lastFaceScoreRef.current
    const _eh = engHistoryRef.current; _eh.push(_fs); if (_eh.length > 5) _eh.shift()
    if (_fs < 0.4) lowEngStreakRef.current += 1; else lowEngStreakRef.current = 0
    const _nextExo = sequence[stepIdx + 1]?.type === 'exercice' ? sequence[stepIdx + 1].data : null
    evaluate({
      session_id:       sessionIdRef.current,
      engagement:       { fused: _fs, etat: lastFaceEmotionRef.current },
      metrics: {
        duree_session_sec:               sessionStartTimeRef.current ? Math.round((Date.now() - sessionStartTimeRef.current) / 1000) : 0,
        nb_responses:                    nbResponsesTotalRef.current,
        nb_correct:                      scoreCorrects + (result.correct === true ? 1 : 0),
        erreurs_consecutives_macro_kc:   consecutiveErrRef.current,
        erreurs_session:                 erreursSessionRef.current,
        reussites_consecutives:          result.correct === true ? streakSession + 1 : 0,
        reussites_consecutives_macro_kc: reussitesMacroRef.current,
        low_engagement_streak:           lowEngStreakRef.current,
        temps_reponses_recents:          [...recentTimesRef.current],
        temps_moyen_profil:              recentTimesRef.current.length > 0
          ? Math.round(recentTimesRef.current.reduce((a, b) => a + b, 0) / recentTimesRef.current.length)
          : 60,
        engagement_recent_5:             [...engHistoryRef.current],
      },
      current_macro_kc:  competence ?? undefined,
      current_exercise:  _nextExo ? {
        id:         _nextExo.id,
        difficulte: _nextExo.difficulte ?? 1,
        macro_kc:   _nextExo.kcs?.[0] ?? _nextExo.competence_evaluee ?? undefined,
      } : undefined,
    }).catch(() => {})

    lastCompetenceRef.current = competence ?? null

    // Réexplication — BKT fourni par le serveur, guard double injection
    if (result.correct !== null && bktFromServer) {
      if (consecutiveErrRef.current >= 2 && bktFromServer.p_mastery < 0.40 && !explicationInjectedRef.current) {
        consecutiveErrRef.current = 0
        explicationInjectedRef.current = true
        api.get(`/api/cours/ua/${uaId}/ressource-aide`, { params: { competence } })
          .then(r => {
            if (!r.data) { explicationInjectedRef.current = false; return }
            setSequence(prev => {
              const copy = [...prev]
              copy.splice(stepIdx + 1, 0, { type: 'explication', data: { ...r.data, _injected: true } })
              return copy
            })
          }).catch(() => { explicationInjectedRef.current = false })
      } else if (bktFromServer.niveau === 'a_renforcer' && !explicationInjectedRef.current) {
        api.get(`/api/cours/ua/${uaId}/ressource-aide`, { params: { competence } })
          .then(r => setRessourceAide(r.data)).catch(() => {})
      }
    }
  }

  // ── Avancer (P4 slide-out + L2 streak-skip) ──────────────────
  function advance() {
    if (transitioningRef.current) return
    navigator.vibrate?.(20)
    if (bktResult) setFinalBktResult(bktResult)
    if (currentStep?.type === 'explication') explicationInjectedRef.current = false
    stepStartRef.current = Date.now()

    let next = stepIdx + 1

    // L2 — Streak ≥ 3 : sauter le prochain exercice facile (une fois par multiple de 3)
    if (
      streakSession >= 3 && streakSession % 3 === 0 &&
      sequence[next]?.type === 'exercice' &&
      (sequence[next]?.data?.difficulte ?? 1) === 1 &&
      sequence[next + 1]  // il reste quelque chose après
    ) {
      next += 1
    }

    if (next >= sequence.length) {
      setFeedback(null); setBktResult(null); setRessourceAide(null)
      setPhase('done')
      localStorage.setItem(`sti_defi_${new Date().toDateString()}`, 'done')
      const nbEx = sequence.filter(s => s.type === 'exercice' && s.data?.type !== 'reponse_libre').length
      if (sessionIdRef.current) {
        const score = nbEx > 0 ? scoreCorrects / nbEx : null
        api.post(`/api/cours/session/clore/${sessionIdRef.current}`, { score_final: score }).catch(() => {})
        sessionIdRef.current = null
      }
      const xpGagnes = 20 + (scoreCorrects * 10) + (nbEx > 0 && scoreCorrects / nbEx >= 0.8 ? 50 : 0) + (nbEx > 0 && scoreCorrects === nbEx ? 50 : 0)
      api.post('/api/gamification/award-xp', { user_id: user.id, xp_gagnes: xpGagnes, session_terminee: true, nb_exercices: nbEx, nb_corrects: scoreCorrects }).catch(() => {}).then(() => window.__refreshXPBar?.())
      return
    }

    const doAdvance = () => {
      transitioningRef.current = false
      setFeedback(null); setBktResult(null); setRessourceAide(null)
      // reset intro state si la prochaine étape est intro
      if (sequence[next]?.type === 'intro') { setIntroPhase(0); setIntroVisComp(0) }
      setStepIdx(next); setPhase('step')
    }

    const cardEl = cardRef.current
    if (cardEl) {
      transitioningRef.current = true
      // Écoute animationend pour fiabilité + fallback 280ms si reduced-motion
      let settled = false
      const onEnd = () => {
        if (settled) return
        settled = true
        doAdvance()
      }
      cardEl.addEventListener('animationend', onEnd, { once: true })
      setTimeout(onEnd, 280)  // garde-fou prefers-reduced-motion / nœud déjà démis
      cardEl.style.animation = 'slideOutLeft .22s ease forwards'
    } else {
      doAdvance()
    }
  }

  // ── Commandes vocales KWS ─────────────────────────────────────
  useEffect(() => {
    if (!lastKeyword) return
    const { keyword } = lastKeyword
    if ((keyword === 'aide' || keyword === 'incompris') && phase === 'step' && currentStep?.type === 'exercice') {
      const details = document.querySelector('details')
      if (details && !details.open) details.open = true
      speak("Voici un indice pour t'aider.", {})
      logInteraction('help_requested', { level: 1, source: 'kws' })
    } else if (keyword === 'repeter' && audioMode === 'full' && supported) {
      const msg = alishaMsg(phase, currentStep, feedback, user)
      if (msg) speak(msg, { onStart: () => setIsSpeaking(true), onEnd: () => setIsSpeaking(false) })
    } else if (keyword === 'lentement' && audioMode === 'full' && supported) {
      const msg = alishaMsg(phase, currentStep, feedback, user)
      if (msg) speak(msg, { rate: 0.65, onStart: () => setIsSpeaking(true), onEnd: () => setIsSpeaking(false) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastKeyword])

  // ── Gestion consentement média ───────────────────────────────
  function handleConsent(choice) {
    localStorage.setItem(CONSENT_KEY, choice)
    setMediaConsent(choice)
    setShowConsent(false)
    if (choice === 'full' || choice === 'camera') startCamera()
    if (choice === 'full') setAudioActive(true)
  }

  // ── Raccourcis clavier ────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return
      if (e.key === 'Enter' && phase === 'feedback') advance()
      if (e.key === 'Enter' && phase === 'step' && currentStep?.type !== 'exercice')
        document.querySelector('button[data-advance]')?.click()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stepIdx, currentStep])

  // ── WebSocket — badges (Bug 1 fix) ───────────────────────────
  useWebSocket(`/ws/${user?.id}`, {
    enabled: !!user?.id,
    onMessage: (msg) => {
      if (msg.type === 'notification' && msg.notif_type === 'badge_debloque') {
        setBadgeNotif({ titre: msg.titre, message: msg.message })
        setTimeout(() => setBadgeNotif(null), 5000)
      }
    },
  })

  // ── Calculs dérivés ───────────────────────────────────────────
  const progressPct  = totalSteps > 0 ? Math.round((stepIdx / totalSteps) * 100) : 0
  const bktNiveau    = bktResult?.niveau ?? null
  const alishaLayout = getAlishaLayout(phase, currentStep, feedback, xs)
  // Phase feedback → état géré par le contrôleur (suit BKT + diversifiers)
  // Autres phases → logique alishaStateFor() conservée intacte
  const alishaState  = alishaOverride
    || (phase === 'feedback'
      ? alishaCtrl.alishaState
      : (isSpeaking ? 'speaking' : alishaStateFor(phase, currentStep, feedback, bktNiveau)))
  const message      = alishaMsg(phase, currentStep, feedback, user)

  // P8 — cycle mode audio
  function cycleAudioMode() {
    setAudioMode(prev => {
      const next = prev === 'full' ? 'text' : prev === 'text' ? 'silent' : 'full'
      localStorage.setItem('alisha_audio_mode', next)
      if (next !== 'full') stop()
      return next
    })
  }

  // ── Écran terminé ─────────────────────────────────────────────
  if (phase === 'done') {
    const nbAnswerable = sequence.filter(s => s.type === 'exercice' && s.data?.type !== 'reponse_libre').length
    const scorePct     = nbAnswerable > 0 ? Math.round(scoreCorrects / nbAnswerable * 100) : null
    const badge        = scorePct === null ? null : scorePct >= 80 ? '🥇' : scorePct >= 50 ? '🥈' : '🥉'
    const showConfetti = scorePct !== null && scorePct >= 80
    const bktFinalPct  = finalBktResult?.pourcentage ?? null
    const bktInitPct   = bktInitialRef.current !== null ? Math.round(bktInitialRef.current * 100) : null
    const bktDelta     = bktFinalPct !== null && bktInitPct !== null ? bktFinalPct - bktInitPct : null

    return (
      <div style={{
        minHeight: '100vh', background: C.bg, fontFamily: "'DM Sans', system-ui, sans-serif",
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 20px', gap: 28, position: 'relative', overflow: 'hidden',
      }}>
        {/* P7 — Confetti plein écran si ≥ 80% */}
        {showConfetti && <Confetti active count={24} />}

        {/* Alisha + badge */}
        <div style={{ position: 'relative' }}>
          <Alisha state="celebration" size={140} />
          {badge && (
            <div style={{
              position: 'absolute', bottom: -4, right: -4,
              fontSize: 36, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.2))',
              animation: 'badgePop .4s .2s ease both',
            }}>
              {badge}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: C.brown, margin: '0 0 8px' }}>
            {showConfetti ? 'Bravo, bien joué !' : 'Leçon terminée !'}
          </h1>
          <p style={{ fontSize: 15, color: C.textSec, margin: 0 }}>{ua?.titre}</p>
          {finalBktResult?.niveau === 'maitrise' && (
            <p style={{ fontSize: 13, color: C.emerald, fontWeight: 700, margin: '8px 0 0' }}>
              ✅ Tu maîtrises maintenant : {finalBktResult.competence}
            </p>
          )}
        </div>

        {/* P7 — Métriques : score + BKT + delta + streak */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {nbAnswerable > 0 && (
            <div style={metricCard(C)}>
              <p style={{ fontSize: 22, fontWeight: 900, color: C.emerald, margin: '0 0 2px' }}>
                {scoreCorrects}/{nbAnswerable}
              </p>
              <p style={{ fontSize: 10, color: C.textMuted, margin: 0, fontWeight: 600 }}>bonnes réponses</p>
            </div>
          )}
          {bktFinalPct !== null && (
            <div style={metricCard(C)}>
              <p style={{ fontSize: 22, fontWeight: 900, color: C.brown, margin: '0 0 2px' }}>
                {bktFinalPct}%
              </p>
              <p style={{ fontSize: 10, color: C.textMuted, margin: 0, fontWeight: 600 }}>maîtrise BKT</p>
            </div>
          )}
          {bktDelta !== null && bktDelta > 0 && (
            <div style={metricCard(C)}>
              <p style={{ fontSize: 22, fontWeight: 900, color: C.purple, margin: '0 0 2px' }}>
                +{bktDelta}%
              </p>
              <p style={{ fontSize: 10, color: C.textMuted, margin: 0, fontWeight: 600 }}>progrès gagné</p>
            </div>
          )}
          {streakSession >= 3 && (
            <div style={metricCard(C)}>
              <p style={{ fontSize: 22, fontWeight: 900, color: C.accent, margin: '0 0 2px' }}>
                🔥×{streakSession}
              </p>
              <p style={{ fontSize: 10, color: C.textMuted, margin: 0, fontWeight: 600 }}>streak max</p>
            </div>
          )}
          {xpSession > 0 && (
            <div style={metricCard(C)}>
              <p style={{ fontSize: 22, fontWeight: 900, color: C.gold, margin: '0 0 2px' }}>
                ⭐{xpSession}
              </p>
              <p style={{ fontSize: 10, color: C.textMuted, margin: 0, fontWeight: 600 }}>XP gagnés</p>
            </div>
          )}
        </div>

        <div style={{
          background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 20,
          padding: '24px 28px', maxWidth: 420, width: '100%',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.textSec, margin: 0, textAlign: 'center' }}>
            Que veux-tu faire maintenant ?
          </p>
          <button onClick={() => navigate(`/session/${uaId}?skip=1`)} style={{
            padding: '16px 20px', borderRadius: 14, border: 'none',
            background: `linear-gradient(135deg, ${C.brown}, ${C.brownMid})`,
            color: 'white', fontWeight: 800, fontSize: 15, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
          }}>
            <span>✏️ Session d'exercices complète</span>
            <span style={{ fontSize: 12, fontWeight: 500, opacity: .8 }}>
              {nbAnswerable > 0
                ? `${nbAnswerable} exercice${nbAnswerable > 1 ? 's' : ''} · BKT mis à jour`
                : 'Tous les exercices de cette unité'}
            </span>
          </button>
          <button onClick={() => navigate('/dashboard')} style={{
            padding: '14px 20px', borderRadius: 14, border: `2px solid ${C.border}`,
            background: C.bg, color: C.textSec, fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>
            🏠 Retourner au tableau de bord
          </button>
          <button onClick={() => navigate(`/cours/${uaId}`, { state: { from: 'tutoriel' } })} style={{
            background: 'none', border: 'none', color: C.textMuted,
            fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '4px 0',
          }}>
            Relire le cours →
          </button>
        </div>

        <style>{`
          @keyframes badgePop {
            from { transform: scale(0) rotate(-20deg); opacity: 0; }
            to   { transform: scale(1) rotate(0deg);   opacity: 1; }
          }
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    )
  }

  // ── Écran principal ───────────────────────────────────────────
  const isAlishaRight  = !xs && alishaLayout.pos === 'right'
  const isAlishaCenter = !xs && alishaLayout.pos === 'center'

  return (
    <div
      style={{
        minHeight: '100vh', background: C.bg,
        display: 'flex', flexDirection: 'column',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <style>{`
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>
      {/* Capture vidéo cachée pour l'analyse faciale MediaPipe */}
      <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }}/>

      {/* ── Modal consentement caméra + micro ── */}
      {showConsent && (
        <PermissionModal C={C} onChoice={handleConsent}/>
      )}

      {/* ── Notification voix (une seule fois, appareils sans voix locale FR) ── */}
      {needsVoiceSetup && supported && (
        <div style={{
          background: `linear-gradient(135deg, ${C.brownDark}, ${C.brown})`,
          color: 'white',
          padding: '11px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          fontSize: 12, lineHeight: 1.5,
          boxShadow: `0 2px 12px ${C.brown}40`,
          animation: 'slideDown .3s ease',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(255,255,255,.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>🔊</div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 2px', fontWeight: 800, fontSize: 12 }}>Améliore la voix d'Alisha</p>
            <p style={{ margin: 0, opacity: .85, fontSize: 11 }}>
              Va dans <strong>Paramètres → Accessibilité → Synthèse vocale</strong>, puis sélectionne <em>Français (France)</em>.
            </p>
          </div>
          <button onClick={dismissVoiceSetup} style={{
            background: 'rgba(255,255,255,.2)',
            border: '1px solid rgba(255,255,255,.3)',
            color: 'white', borderRadius: 9,
            padding: '5px 12px', cursor: 'pointer',
            fontSize: 11, fontWeight: 700, flexShrink: 0,
            transition: 'background .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.32)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.2)'}
          >
            Compris ✓
          </button>
        </div>
      )}

      {/* ── L6+P1+P3+P8 — Barre de progression enrichie ── */}
      <div style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: '12px 20px', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 720, margin: '0 auto' }}>
          <button onClick={() => navigate(`/cours/${uaId}`, { state: { from: 'tutoriel' } })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 20, lineHeight: 1, flexShrink: 0 }}>✕</button>

          <SegmentedBar
            sequence={sequence} stepIdx={stepIdx} C={C}
            onHover={setHoveredSeg} hoveredSeg={hoveredSeg}
          />

          {streakSession >= 3 && (
            <span style={{
              fontSize: 12, fontWeight: 800, color: C.accent, flexShrink: 0, whiteSpace: 'nowrap',
              animation: (streakSession === 3 || streakSession === 5 || streakSession === 10) ? 'streakPop .3s ease' : 'none',
            }}>🔥×{streakSession}</span>
          )}

          {/* L5 — XP counter */}
          {xpSession > 0 && (
            <span style={{ fontSize: 11, fontWeight: 800, color: C.gold, flexShrink: 0, whiteSpace: 'nowrap' }}>
              ⭐{xpSession}
            </span>
          )}

          <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {stepIdx + 1}/{totalSteps}
          </span>

          {supported && (
            <button onClick={cycleAudioMode}
              title={audioMode === 'full' ? 'Mode texte seul' : audioMode === 'text' ? 'Couper' : 'Activer la voix'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0, opacity: audioMode === 'silent' ? 0.35 : 1, transition: 'opacity .2s' }}>
              {audioMode === 'full' ? '🔊' : audioMode === 'text' ? '📖' : '🔇'}
            </button>
          )}
          {/* Sélecteur voix Alisha — toujours visible quand audio actif */}
          {audioMode !== 'silent' && (
            <>
              {[
                { id: 'denise',   label: 'D', title: 'Denise (Neural FR)' },
                { id: 'vivienne', label: 'H', title: 'Henri (Neural FR)' },
                { id: 'system',   label: '💻', title: systemVoiceName ? `Voix système : ${systemVoiceName}` : 'Voix système (OS)' },
              ].map(v => (
                <button key={v.id} onClick={() => setPreferredVoice(v.id)}
                  title={v.title}
                  style={{ width: 22, height: 22, borderRadius: 5, border: `1.5px solid ${edgeVoice === v.id ? C.brown : C.border}`, cursor: 'pointer', fontSize: v.id === 'system' ? 11 : 9, fontWeight: 800, background: edgeVoice === v.id ? C.brownPale : 'transparent', color: edgeVoice === v.id ? C.brown : C.textMuted, flexShrink: 0, padding: 0 }}>
                  {v.label}
                </button>
              ))}
            </>
          )}

          {/* Indicateur caméra active — discret, informatif */}
          {cameraActive && (
            <div title="Analyse IA active (caméra + audio)" style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: `${C.emerald}18`,
              border: `1px solid ${C.emerald}40`,
              borderRadius: 20, padding: '3px 8px', flexShrink: 0,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: C.emerald,
                boxShadow: `0 0 0 3px ${C.emerald}30`,
                animation: 'pulse 2s infinite',
                flexShrink: 0,
              }}/>
              <span style={{ fontSize: 9, fontWeight: 700, color: C.emerald, letterSpacing: .3 }}>
                IA active
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── L5 — XP float ── */}
      <XpFloat notif={xpFloat} C={C} />

      {/* ── Contenu ── */}
      <div style={{
        flex: 1, maxWidth: 720, width: '100%', margin: '0 auto',
        padding: xs ? '16px' : '28px 20px',
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        {/* ── L1 — Layout conversationnel ── */}
        {isAlishaCenter ? (
          /* Feedback correct : Alisha au centre en grand + carte feedback dessous */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%' }}>
            <Alisha state={alishaState} size={alishaLayout.size} />
            {message && (
              <div style={{
                background: C.surface, borderRadius: '18px 18px 18px 18px',
                border: `1.5px solid ${C.border}`, padding: '10px 16px',
                fontSize: 14, color: C.text, lineHeight: 1.6, textAlign: 'center',
                maxWidth: 340, animation: 'fadeUp .3s ease',
              }}>{message}</div>
            )}
            {/* ── FIX : feedback + bouton Continuer toujours visibles en mode centré ── */}
            {phase === 'feedback' && feedback && (
              <div
                ref={cardRef}
                style={{
                  background: C.surface, borderRadius: 20,
                  border: `1.5px solid ${C.border}`,
                  padding: xs ? '18px' : '22px 24px',
                  boxShadow: `0 4px 20px ${C.brown}18`,
                  animation: 'flipInY .38s ease',
                  width: '100%', maxWidth: 480,
                  display: 'flex', flexDirection: 'column', gap: 14,
                }}
              >
                <Confetti active={confettiCorrect} count={12} />
                {/* Résumé feedback correct */}
                <div style={{
                  background: C.emeraldPale, borderRadius: 12,
                  padding: '14px 18px',
                  border: `2px solid ${C.emerald}`,
                }}>
                  <p style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px', color: C.emerald }}>
                    ✅ Bonne réponse !
                  </p>
                  {feedback.explication && (
                    <p style={{ fontSize: 14, color: C.textSec, margin: 0, lineHeight: 1.6 }}>
                      {feedback.explication}
                    </p>
                  )}
                </div>
                {/* BKT si disponible */}
                {bktResult && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px', borderRadius: 12,
                    background: `${bktResult.color}18`,
                    border: `1.5px solid ${bktResult.color}44`,
                  }}>
                    <span style={{ fontSize: 16 }}>🎯</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 800, color: bktResult.color, margin: 0 }}>{bktResult.competence}</p>
                      <p style={{ fontSize: 11, color: C.textSec, margin: '2px 0 0' }}>Maîtrise : {bktResult.pourcentage}% — {bktResult.label}</p>
                    </div>
                  </div>
                )}
                <button onClick={advance} style={{ ...primaryBtn(C), animation: 'bounceIn .4s ease .35s both' }}>
                  {stepIdx + 1 >= sequence.length ? 'Terminer 🎉' : 'Continuer →'}
                  {xs && <span style={{ fontSize: 10, opacity: .6, marginLeft: 6 }}>↑ swipe</span>}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Ressource (gauche) ou Exercice (droite) */
          <div style={{
            display: 'flex',
            flexDirection: xs ? 'column' : isAlishaRight ? 'row-reverse' : 'row',
            gap: xs ? 10 : 18,
            alignItems: xs ? 'stretch' : 'flex-start',
          }}>
            {/* Colonne Alisha */}
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Alisha state={alishaState} size={alishaLayout.size} />
              {!xs && message && (
                <div style={{
                  background: C.surface, padding: '10px 12px', lineHeight: 1.55,
                  borderRadius: isAlishaRight ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                  border: `1.5px solid ${C.border}`, fontSize: 13, color: C.text,
                  boxShadow: `0 2px 10px ${C.brown}18`, animation: 'fadeUp .3s ease',
                  maxWidth: 190,
                }}>{message}</div>
              )}
            </div>

            {/* Colonne contenu */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {xs && message && (
                <div style={{
                  background: C.surface, borderRadius: '4px 18px 18px 18px',
                  border: `1.5px solid ${C.border}`, padding: '10px 14px',
                  fontSize: 14, color: C.text, lineHeight: 1.6,
                  boxShadow: `0 2px 10px ${C.brown}18`, animation: 'fadeUp .3s ease',
                }}>{message}</div>
              )}

              {/* Carte principale */}
              {currentStep && (
                <div
                  ref={cardRef}
                  key={stepIdx}
                  style={{
                    background:   C.surface, borderRadius: 20,
                    border:      `1.5px solid ${C.border}`,
                    padding:      xs ? '18px' : '24px',
                    boxShadow:   `0 4px 20px ${C.brown}18`,
                    animation:   'slideInRight .32s ease',
                    position:   'relative', overflow: 'hidden',
                  }}
                >
                  <Confetti active={confettiCorrect} count={12} />

                  {/* ── L4 Intro — typewriter + compétences animées ── */}
                  {currentStep.type === 'intro' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                      <div style={{ animation: introPhase === 0 ? 'bounceIn .5s ease' : 'none' }}>
                        <span style={tagStyle(C.brownPale, C.brown)}>📚 Introduction</span>
                        <h2 style={{ fontSize: xs ? 17 : 22, fontWeight: 900, color: C.text, margin: '4px 0 0' }}>
                          {currentStep.data.titre}
                        </h2>
                      </div>
                      {currentStep.data.situation_probleme && introPhase >= 1 && (
                        <div style={sectionBox(C.goldPale, C.gold)}>
                          <p style={sectionLabel(C.brownMid)}>🎯 Situation</p>
                          <p style={{ fontSize: 14, color: C.text, margin: 0, lineHeight: 1.7 }}>
                            <TypewriterText
                              text={currentStep.data.situation_probleme}
                              speedMs={30}
                              onDone={() => startIntroComps(currentStep.data)}
                              C={C}
                            />
                          </p>
                        </div>
                      )}
                      {currentStep.data.competences?.length > 0 && introPhase >= 2 && (
                        <div>
                          <p style={sectionLabel(C.textMuted)}>✅ Ce que tu vas savoir faire</p>
                          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {currentStep.data.competences.map((c, i) => (
                              <li key={i} style={{
                                fontSize: 14, color: C.text, lineHeight: 1.6,
                                display: 'flex', gap: 8, alignItems: 'flex-start',
                                opacity:   i < introVisComp ? 1 : 0,
                                transform: i < introVisComp ? 'translateX(0)' : 'translateX(-8px)',
                                transition: 'all .28s ease',
                              }}>
                                <span style={{ color: C.emerald, fontWeight: 900, flexShrink: 0 }}>✓</span>{c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {currentStep.data.prerequis && introPhase >= 2 && (
                        <p style={{ fontSize: 12, color: C.textSec, lineHeight: 1.6, margin: 0 }}>
                          <strong style={{ color: C.text }}>Prérequis :</strong> {currentStep.data.prerequis}
                        </p>
                      )}
                      {currentStep.data.duree_estimee && introPhase >= 2 && (
                        <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>
                          ⏱ Durée estimée : <strong>{currentStep.data.duree_estimee} min</strong>
                        </p>
                      )}
                      {introPhase >= 3 && (
                        <button data-advance onClick={advance}
                          style={{ ...primaryBtn(C), animation: 'pulse 2s ease infinite' }}>
                          C'est parti ! →
                        </button>
                      )}
                    </div>
                  )}

                  {/* ── Ressource complète ── */}
                  {currentStep.type === 'ressource' && (
                    <div>
                      {/* Bouton "Alisha lit le cours" — visible si audioMode actif */}
                      {audioMode !== 'silent' && supported && (
                        <button
                          onClick={() => {
                            if (isReading) {
                              stop()
                            } else {
                              const blocks = parseBlocks(currentStep.data?.contenu)
                              const text   = blocksToSpeech(blocks)
                              if (text) readAloud(text, {
                                onDone: () => {},
                              })
                            }
                          }}
                          style={{
                            display:        'flex',
                            alignItems:     'center',
                            gap:             6,
                            padding:        '8px 14px',
                            borderRadius:    20,
                            border:         `1.5px solid ${isReading ? C.accent + '80' : C.purple + '60'}`,
                            background:      isReading ? `${C.accent}12` : `${C.purple}10`,
                            color:           isReading ? C.accent : C.purple,
                            fontSize:        12,
                            fontWeight:      700,
                            cursor:         'pointer',
                            marginBottom:    12,
                            transition:     'all .2s',
                          }}
                        >
                          {isReading
                            ? <><span style={{ animation: 'blink 1s ease infinite' }}>🔊</span> Arrêter la lecture</>
                            : <>📖 Alisha lit le cours</>
                          }
                        </button>
                      )}
                      <ProgressiveContent
                        key={currentStep.data.id || stepIdx}
                        data={currentStep.data}
                        onDone={advance}
                        C={C}
                        xs={xs}
                      />
                    </div>
                  )}

                  {/* ── L2 Ressource abrégée (niveau 2) — points clés seulement ── */}
                  {currentStep.type === 'ressource_abregee' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <span style={tagStyle(C.purplePale, C.purple)}>⚡ Rappel rapide</span>
                        <h3 style={{ fontSize: xs ? 15 : 17, fontWeight: 800, color: C.text, margin: '4px 0 0' }}>
                          {currentStep.data.titre}
                        </h3>
                      </div>
                      {currentStep.data.points_cles?.length > 0 && (
                        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {currentStep.data.points_cles.map((p, i) => (
                            <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 12px', background: C.brownPale, borderRadius: 10 }}>
                              <span style={{ color: C.brown, fontWeight: 900, flexShrink: 0 }}>✦</span>
                              <span style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>{p}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <button data-advance onClick={advance} style={primaryBtn(C)}>Compris ! Passons aux exercices →</button>
                    </div>
                  )}

                  {/* ── L2 Récapitulatif animé (niveau 1) ── */}
                  {currentStep.type === 'recap' && (
                    <RecapStep ua={currentStep.data} C={C} xs={xs} onDone={advance} />
                  )}

            {/* ── Réexplication dynamique ── */}
            {currentStep.type === 'explication' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{
                  background: C.goldPale, border: `1.5px solid ${C.orange}`,
                  borderRadius: 12, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 18 }}>💡</span>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.brownMid }}>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div>
                        <span style={tagStyle(
                          currentStep.data._bonus ? C.purplePale : C.goldPale,
                          currentStep.data._bonus ? C.purple    : C.brownMid
                        )}>
                          {currentStep.data._bonus ? '🔥 Mini-défi' : '❓ Application'}
                        </span>
                        {isFirstDktExercice && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            background: `${C.emerald}18`, color: C.emerald,
                            border: `1px solid ${C.emerald}35`, borderRadius: 20,
                            fontSize: 10, fontWeight: 700, padding: '2px 9px', marginLeft: 6,
                          }}>
                            ✨ Recommandé pour toi
                          </span>
                        )}
                        <p style={{ fontSize: 15, fontWeight: 600, color: C.text, lineHeight: 1.7, margin: 0 }}>
                          {currentStep.data.enonce}
                        </p>
                      </div>
                      {currentStep.data.indice_1 && (
                        <details style={{ fontSize: 12, color: C.textSec }}>
                          <summary style={{ cursor: 'pointer', color: C.brown, fontWeight: 700 }}>💡 Indice</summary>
                          <p style={{ margin: '8px 0 0' }}>{currentStep.data.indice_1}</p>
                        </details>
                      )}
                      <ExerciceStep
                        key={currentStep.data.id}
                        exercice={currentStep.data}
                        onReponse={handleReponse}
                        onAlishaState={setAlishaOverride}
                        disabled={checkingAnswer}
                        audioMode={audioMode}
                        C={C}
                      />
                    </div>
                  )}

            {/* ── Feedback ── */}
            {phase === 'feedback' && feedback && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <p style={{ fontSize: 12, color: C.textMuted, margin: 0, fontStyle: 'italic' }}>
                  {currentStep.data.enonce}
                </p>
                <div style={{
                  background:   feedback.correct === false ? C.redPale : C.emeraldPale,
                  borderRadius: 14, padding: '16px 20px',
                  border: `2px solid ${feedback.correct === false ? C.red : feedback.correct ? C.emerald : C.brownPale}`,
                }}>
                  <p style={{
                    fontSize: 16, fontWeight: 800, margin: '0 0 6px',
                    color: feedback.correct === false ? C.red : feedback.correct ? C.emerald : C.brown,
                  }}>
                    {feedback.correct === null ? '📝 Réponse libre notée'
                      : feedback.correct ? '✅ Bonne réponse !'
                      : '❌ Pas tout à fait'}
                  </p>
                  {!feedback.correct && feedback.reponse_correcte && (
                    <p style={{ fontSize: 14, color: C.text, margin: '4px 0 0' }}>
                      Réponse attendue : <strong>{feedback.reponse_correcte}</strong>
                    </p>
                  )}
                  {feedback.explication && (
                    <p style={{ fontSize: 14, color: C.textSec, margin: '10px 0 0', lineHeight: 1.6 }}>
                      {feedback.explication}
                    </p>
                  )}
                </div>

                {bktResult && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                    borderRadius: 12, background: `${bktResult.color}18`,
                    border: `1.5px solid ${bktResult.color}44`,
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
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%', background: C.surface,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 900, color: bktResult.color,
                      }}>
                        {bktResult.pourcentage}%
                      </div>
                    </div>
                  </div>
                )}

                {ressourceAide && feedback?.correct === false && (
                  <div style={{ borderRadius: 14, overflow: 'hidden', border: `1.5px solid ${C.brownLight}40`, animation: 'fadeUp .4s ease' }}>
                    <div style={{ background: `linear-gradient(135deg, ${C.brown}, ${C.brownMid})`, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>📖</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: 'white', flex: 1 }}>
                        Révise ce point : {ressourceAide.titre}
                      </span>
                      <button onClick={() => setRessourceAide(null)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.9)', fontSize: 14 }}>✕</button>
                    </div>
                    <div style={{ background: C.brownPale, padding: '12px 14px' }}>
                      <p style={{ margin: '0 0 8px', fontSize: 14, color: C.text, lineHeight: 1.7, fontStyle: 'italic' }}>
                        {ressourceAide.extrait}
                      </p>
                      {ressourceAide.points_cles?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {ressourceAide.points_cles.map((pt, i) => (
                            <span key={i} style={{ background: `${C.brown}18`, color: C.brown, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{pt}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                  {/* L7 — Continuer (swipe-up hint mobile) */}
                  <button onClick={advance} style={{ ...primaryBtn(C), marginTop: 4 }}>
                    {stepIdx + 1 >= sequence.length ? 'Terminer 🎉' : 'Continuer →'}
                    {xs && <span style={{ fontSize: 10, opacity: .6, marginLeft: 6 }}>↑ swipe</span>}
                  </button>
                </div>
              )}
                </div>
              )}
            </div>
          </div>
        )}

        {phase === 'loading' && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Alisha state="thinking" size={100} />
            <p style={{ color: C.textSec, marginTop: 16 }}>Chargement de la leçon…</p>
          </div>
        )}
      </div>

      {/* ── P6 — Pop-in mi-parcours ── */}
      {midpointNotif && (
        <div style={{
          position: 'fixed', top: 76, left: '50%', transform: 'translateX(-50%)',
          zIndex: 200, background: C.surface, border: `2px solid ${C.gold}`,
          borderRadius: 16, padding: '11px 22px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          animation: 'fadeUp .3s ease', textAlign: 'center', whiteSpace: 'nowrap',
        }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: C.brown, margin: '0 0 2px' }}>
            🎯 Tu es à mi-chemin !
          </p>
          <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>
            {scoreCorrects} bonne{scoreCorrects !== 1 ? 's' : ''} réponse{scoreCorrects !== 1 ? 's' : ''} · {progressPct}% parcouru
          </p>
        </div>
      )}

      {/* ── CSS animations ── */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(48px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideOutLeft {
          to { opacity: 0; transform: translateX(-48px); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes confettiPop {
          0%   { transform: translateY(0)     rotate(0deg)   scale(1);   opacity: 1; }
          100% { transform: translateY(-72px) rotate(380deg) scale(0.4); opacity: 0; }
        }
        @keyframes streakPop {
          0%,100% { transform: scale(1); }
          50%     { transform: scale(1.45); }
        }
        /* L7 — Flip 3D exercice→feedback */
        @keyframes flipInY {
          from { transform: perspective(900px) rotateY(-80deg); opacity: 0; }
          to   { transform: perspective(900px) rotateY(0);      opacity: 1; }
        }
        /* L5 — XP float */
        @keyframes xpFloat {
          0%   { opacity: 0; transform: translateY(0); }
          20%  { opacity: 1; transform: translateY(-6px); }
          80%  { opacity: 1; transform: translateY(-24px); }
          100% { opacity: 0; transform: translateY(-36px); }
        }
        /* L4 — typewriter cursor */
        @keyframes blink {
          0%,100% { opacity: 1; }
          50%     { opacity: 0; }
        }
        /* L4 — intro bounce */
        @keyframes bounceIn {
          0%   { transform: scale(0.92); opacity: 0; }
          60%  { transform: scale(1.04); opacity: 1; }
          100% { transform: scale(1); }
        }
        /* L6 — segment pulse */
        @keyframes segPulse {
          0%,100% { opacity: 1; }
          50%     { opacity: 0.7; }
        }
        /* L6 — checkmark flash */
        @keyframes checkFlash {
          0%   { opacity: 0; transform: scale(0.5); }
          50%  { opacity: 1; transform: scale(1.2); }
          100% { opacity: 0; transform: scale(1); }
        }
        /* CTA pulse */
        @keyframes pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(107,58,42,0.25); }
          50%     { box-shadow: 0 0 0 8px rgba(107,58,42,0); }
        }
      `}</style>

      {/* ── Moteur d'adaptation comportementale ── */}
      <AdaptationOrchestrator
        adaptation={currentAdaptation}
        onDismiss={(actionType) => dismiss(actionType)}
      />

      {/* ── Toast badge débloqué ── */}
      {badgeNotif && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 999,
          background: `linear-gradient(135deg, ${C.brownDark}, ${C.brownMid})`, color: 'white',
          borderRadius: 16, padding: '14px 18px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)', maxWidth: 300,
          animation: 'slideInRight .35s ease', display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 24, flexShrink: 0 }}>🏅</span>
          <div>
            <p style={{ margin: '0 0 3px', fontWeight: 800, fontSize: 13 }}>{badgeNotif?.titre}</p>
            <p style={{ margin: 0, fontSize: 11, opacity: .85 }}>{badgeNotif?.message || ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers de style ──────────────────────────────────────────────

function metricCard(C) {
  return { background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: '12px 20px', textAlign: 'center', minWidth: 90 }
}

function primaryBtn(C) {
  return {
    padding: '14px', borderRadius: 14, border: 'none',
    background: `linear-gradient(135deg, ${C.brown}, ${C.brownMid})`,
    color: 'white', fontWeight: 800, fontSize: 15, cursor: 'pointer', width: '100%',
  }
}

function tagStyle(bg, color) {
  return { display: 'inline-block', padding: '3px 12px', borderRadius: 20, background: bg, color, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }
}

function sectionBox(bg, borderColor) {
  return { background: bg, borderRadius: 14, padding: '14px 18px', border: `1.5px solid ${borderColor}44` }
}

function sectionLabel(color) {
  return { fontSize: 11, fontWeight: 800, color, margin: '0 0 10px', textTransform: 'uppercase' }
}

// ── Modal de consentement caméra + micro ─────────────────────────
function PermissionModal({ C, onChoice }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(26,18,7,.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: C.surface, borderRadius: 22, padding: '28px 24px',
        maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.3)',
        display: 'flex', flexDirection: 'column', gap: 0,
      }}>
        {/* Icon */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', margin: '0 auto 12px',
            background: `linear-gradient(135deg, ${C.brownPale}, ${C.emeraldPale})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
          }}>🤖</div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: C.text }}>
            Alisha va analyser ton engagement
          </h2>
        </div>

        {/* Description */}
        <p style={{ fontSize: 13, color: C.textSec, lineHeight: 1.6, margin: '0 0 20px', textAlign: 'center' }}>
          Pour adapter le tutoriel à ton niveau de concentration, Alisha peut analyser
          ton <strong style={{ color: C.text }}>visage</strong> (attention, émotions)
          et ta <strong style={{ color: C.text }}>voix</strong> (commandes : "Aide", "Répéter", "Plus lentement").
        </p>

        {/* Détails collecte */}
        <div style={{
          background: C.bg, borderRadius: 12, padding: '10px 14px', marginBottom: 20,
          border: `1px solid ${C.border}`, fontSize: 12, color: C.textSec, lineHeight: 1.7,
        }}>
          <p style={{ margin: 0, fontWeight: 700, color: C.text, marginBottom: 4 }}>Ce qui est analysé :</p>
          <p style={{ margin: 0 }}>📷 Orientation du regard, ouverture des yeux, expression</p>
          <p style={{ margin: 0 }}>🎤 Énergie sonore et mots-clés vocaux seulement</p>
          <p style={{ margin: '4px 0 0', color: C.textMuted }}>Aucune image ni enregistrement audio n'est envoyé.</p>
        </div>

        {/* Boutons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => onChoice('full')}
            style={{
              padding: '13px', borderRadius: 12, border: 'none',
              background: `linear-gradient(135deg, ${C.brown}, ${C.brownMid})`,
              color: 'white', fontSize: 14, fontWeight: 800, cursor: 'pointer',
            }}
          >
            📷 🎤 Activer caméra + micro
          </button>
          <button
            onClick={() => onChoice('camera')}
            style={{
              padding: '11px', borderRadius: 12,
              border: `1.5px solid ${C.border}`, background: C.bg,
              color: C.text, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            📷 Caméra uniquement
          </button>
          <button
            onClick={() => onChoice('none')}
            style={{
              padding: '10px', borderRadius: 12, border: 'none',
              background: 'none', color: C.textMuted,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Continuer sans analyse
          </button>
        </div>

        <p style={{ margin: '12px 0 0', fontSize: 10, color: C.textMuted, textAlign: 'center' }}>
          Ce choix est mémorisé. Tu peux le modifier depuis ton profil.
        </p>
      </div>
    </div>
  )
}
