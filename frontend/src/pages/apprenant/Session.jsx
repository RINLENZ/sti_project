import { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react'
const Alisha = lazy(() => import('../../components/Alisha'))
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  Camera, Lightbulb, CheckCircle, XCircle,
  ChevronRight, Home, ArrowLeft, Zap, Mic,
  X, Activity, Clock, Target, Award
} from 'lucide-react'

import { useTheme } from '../../styles/theme.jsx'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { Spinner } from '../../components/Skeleton'
import ContentRenderer from '../../components/ContentRenderer'
import RichText, { RichTextInline } from '../../components/RichText'
import { useEmotionOnnx } from '../../hooks/useEmotionOnnx'
import { useKWSModel } from '../../hooks/useKWSModel'
import { MODELS_READY, EMOTION_MODEL_READY } from '../../config/models'
import { clearCache } from '../../services/cache'
import useAlishaVoice from '../../hooks/useAlishaVoice'

/* ── Engagement helpers ──────────────────────────────────────── */
const engColor = (s, C) =>
  s >= 0.80 ? C.emerald : s >= 0.60 ? '#2563eb' :
  s >= 0.40 ? C.orange  : s >= 0.20 ? C.red : '#7F1D1D'

const engLabel = s =>
  s >= 0.80 ? 'Élevé' : s >= 0.60 ? 'Modéré' :
  s >= 0.40 ? 'Faible' : s >= 0.20 ? 'Ennui' : 'Décroché'

const ETATS = {
  engagement_eleve:  { label: '😊 Engagé',     color: '#0D9373' },
  engagement_modere: { label: '🙂 Modéré',      color: '#2563eb' },
  engagement_faible: { label: '😐 Peu engagé',  color: '#F59E0B' },
  confusion:         { label: '🤔 Confusion',   color: '#F59E0B' },
  frustration:       { label: '😤 Frustration', color: '#DC2626' },
  ennui:             { label: '😴 Ennui',        color: '#6B5744' },
  neutre:            { label: '😐 Neutre',       color: '#C4865A' },
  decrochage:        { label: '⚠️ Décroché',    color: '#7F1D1D' },
}

/* ── face-api.js : désactivé — CDN 404, remplacé par ONNX EfficientNet-B0 ── */
let faceApiReady = false
async function loadFaceApiModels() { return false }

/* ── Mapping expressions CNN → états affectifs académiques ─────
   Basé sur Ekman & Friesen (FACS) adapté au contexte scolaire :
   fearful ≈ confusion (stress cognitif, pas danger physique)
   surprised ≈ confusion (inattendu = incompréhension)          */
const CNN_TO_ETAT = {
  happy:     'engagement_eleve',
  neutral:   'neutre',
  sad:       'ennui',
  angry:     'frustration',
  fearful:   'confusion',
  surprised: 'confusion',
  disgusted: 'frustration',
}

/* ── Fusion CNN + signal géométrique MediaPipe ───────────────── */
function fusionnerEmotion(cnnEmotion, cnnProbs, ear, yaw, pitch) {
  // Signal géométrique : attention (EAR) + orientation tête (pose)
  const earSignal  = ear < 0.18   // yeux très fermés → somnolence
  const poseSignal = Math.abs(yaw) > 28  // tête tournée → désengagement

  // Si somnolence forte → ennui (priorité physiologique)
  if (earSignal && Math.abs(pitch) > 10) return 'ennui'
  // Si tête très tournée → engagement_faible
  if (poseSignal && (!cnnProbs || (cnnProbs.neutral || 0) > 0.5)) return 'engagement_faible'
  // Sinon, confiance au CNN si disponible
  if (cnnEmotion) return cnnEmotion
  // Fallback géométrique si CNN indisponible
  if (Math.abs(yaw) > 25) return 'engagement_faible'
  return 'neutre'
}

/* ── Gauge component ─────────────────────────────────────────── */
const MiniGauge = ({ score, emotion, compact = false }) => {
  const { C } = useTheme()
  const color = engColor(score, C)
  const em = ETATS[emotion] || ETATS.neutre

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: `conic-gradient(${color} ${score * 360}deg, #E5E7EB 0deg)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%', background: C.surface,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <span style={{ fontSize: 9, fontWeight: 900, color }}>{Math.round(score * 100)}</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color, lineHeight: 1.2 }}>{engLabel(score)}</div>
          <div style={{ fontSize: 10, color: C.textSec, lineHeight: 1.2 }}>{em.label}</div>
        </div>
      </div>
    )
  }

  const r = 30, circ = 2 * Math.PI * r
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: 80, height: 80 }}>
        <svg width={80} height={80} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={40} cy={40} r={r} fill="none" stroke={C.brownPale} strokeWidth={7}/>
          <circle cx={40} cy={40} r={r} fill="none" stroke={color} strokeWidth={7}
            strokeDasharray={circ} strokeDashoffset={circ - score * circ}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset .6s ease, stroke .3s ease' }}/>
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 900, color, lineHeight: 1 }}>{Math.round(score * 100)}</span>
          <span style={{ fontSize: 9, color: C.textSec, fontWeight: 600 }}>%</span>
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{engLabel(score)}</span>
      <div style={{
        backgroundColor: `${em.color}18`, borderRadius: 20,
        padding: '3px 10px', border: `1px solid ${em.color}35`,
        fontSize: 11, fontWeight: 700, color: em.color
      }}>{em.label}</div>
    </div>
  )
}

/* ── Option QCM ──────────────────────────────────────────────── */
const ExerciceOption = ({ lettre, texte, selected, correct, incorrect, onClick }) => {
  const { C } = useTheme()
  let bg = C.surface, border = `1.5px solid ${C.brownPale}`, textColor = C.text
  let lBg = C.border, lColor = C.textSec
  if (selected && !correct && !incorrect) {
    bg = C.brownPale; border = `2px solid ${C.brown}`
    textColor = C.brown; lBg = C.brown; lColor = 'white'
  }
  if (correct)   { bg = C.emeraldPale; border = `2px solid ${C.emerald}`; textColor = C.emerald; lBg = C.emerald; lColor = 'white' }
  if (incorrect) { bg = '#FEE2E2';     border = `2px solid ${C.red}`;     textColor = C.red;     lBg = C.red;     lColor = 'white' }

  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '13px 15px', backgroundColor: bg, border,
      borderRadius: 14, cursor: correct || incorrect ? 'default' : 'pointer',
      textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
      transition: 'all .15s ease', color: textColor, minHeight: 52
    }}>
      <span style={{
        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
        backgroundColor: lBg, color: lColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 900
      }}>{lettre}</span>
      <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5, flex: 1 }}><RichTextInline text={texte}/></span>
      {correct   && <CheckCircle size={17} color={C.emerald} style={{ flexShrink: 0 }}/>}
      {incorrect && <XCircle     size={17} color={C.red}     style={{ flexShrink: 0 }}/>}
    </button>
  )
}

/* ── Confetti ────────────────────────────────────────────────── */
const CONFETTI_COLORS = ['#6B3A2A', '#C4865A', '#0D9373', '#D4A853', '#FCD34D', '#EC4899', '#60A5FA', '#A78BFA', '#34D399', '#F87171']
const CONFETTI_PIECES = Array.from({ length: 70 }, (_, i) => {
  const shape = i % 3  // 0=square, 1=circle, 2=diamond
  const anim  = i % 3 === 0 ? 'confettiFall' : i % 3 === 1 ? 'confettiFallL' : 'confettiFallR'
  return {
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: `${(i * 1.45 + 1) % 100}%`,
    delay: `${(i * 0.038) % 2.5}s`,
    duration: `${2.2 + (i % 6) * 0.35}s`,
    size: 5 + (i % 4) * 3,
    borderRadius: shape === 1 ? '50%' : shape === 2 ? '2px' : '2px',
    rotate: shape === 2 ? 'rotate(45deg)' : undefined,
    anim,
  }
})

const Confetti = () => (
  <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 999 }}>
    {CONFETTI_PIECES.map(p => (
      <div key={p.id} style={{
        position: 'absolute', top: 0, left: p.left,
        width: p.size, height: p.size, backgroundColor: p.color,
        borderRadius: p.borderRadius,
        transform: p.rotate,
        animation: `${p.anim} ${p.duration} ${p.delay} ease-in both`
      }}/>
    ))}
  </div>
)

/* ── Bottom sheet caméra/micro mobile ────────────────────────── */
const CameraChip = ({ onActivate, onDismiss }) => {
  const { C } = useTheme()
  return (
    <div style={{
      position: 'fixed', bottom: 76, left: 12, right: 12, zIndex: 200,
      background: C.surface, borderRadius: 14,
      padding: '10px 12px',
      boxShadow: '0 4px 20px rgba(107,58,42,0.18)',
      border: `1px solid ${C.brownPale}`,
      display: 'flex', alignItems: 'center', gap: 8,
      animation: 'slideUp .3s ease'
    }}>
      <Camera size={15} color={C.brown} style={{ flexShrink: 0 }}/>
      <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: C.text }}>
        Activer l'analyse IA ?
      </span>
      <button onClick={onActivate} style={{
        padding: '6px 12px', background: C.brown, color: 'white',
        border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer'
      }}>Oui</button>
      <button onClick={onDismiss} style={{
        width: 26, height: 26, background: C.brownPale, border: 'none',
        borderRadius: 7, cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}><X size={12} color={C.textSec}/></button>
    </div>
  )
}


// LECON READER

function LeconReader({ ua, ressources, onStart, onResourceView }) {
  const { C } = useTheme()
  const [idx, setIdx] = useState(0)
  const readStartRef  = useRef(Date.now())
  const res = ressources[idx]

  function logAndGo(newIdx) {
    const secs = Math.round((Date.now() - readStartRef.current) / 1000)
    onResourceView?.(res.id, secs)
    readStartRef.current = Date.now()
    setIdx(newIdx)
  }

  const typeLabel = {
    lecon:   { icon: '📖', label: 'Leçon',    color: C.brown    },
    tp:      { icon: '🔬', label: 'TP',       color: C.emerald  },
    resume:  { icon: '📋', label: 'Résumé',   color: '#2563EB'  },
    video:   { icon: '🎬', label: 'Vidéo',    color: '#7C3AED'  },
  }[res?.type] || { icon: '📄', label: 'Ressource', color: C.brown }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${C.brownDark}, ${C.brown})`,
        padding: '20px 24px', color: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 11, opacity: .7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5 }}>
            {ua?.reference_ue} · {ua?.titre}
          </span>
        </div>
        {ressources.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ressources.map((r, i) => {
              const t = { lecon: '📖', tp: '🔬', resume: '📋', video: '🎬' }[r.type] || '📄'
              return (
                <button key={r.id} onClick={() => logAndGo(i)} style={{
                  padding: '4px 12px', borderRadius: 20,
                  background: i === idx ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.12)',
                  border: `1px solid ${i === idx ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.2)'}`,
                  color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  {t} {r.titre.length > 20 ? r.titre.substring(0, 20) + '…' : r.titre}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Contenu */}
      <div style={{ flex: 1, maxWidth: 760, width: '100%', margin: '0 auto', padding: '28px 20px' }}>

        {/* Titre ressource */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `${typeLabel.color}18`, border: `1.5px solid ${typeLabel.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
            {typeLabel.icon}
          </div>
          <div>
            <span style={{ fontSize: 10, fontWeight: 700, color: typeLabel.color, textTransform: 'uppercase', letterSpacing: .5 }}>{typeLabel.label}</span>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0 }}>{res?.titre}</h2>
          </div>
        </div>

        {/* Situation problème */}
        {ua?.situation_probleme && (
          <div style={{ background: `linear-gradient(135deg, ${C.emeraldPale}, ${C.brownPale})`, borderRadius: 14, padding: '14px 18px', marginBottom: 20, border: `1px solid ${C.emerald}30` }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: C.emerald, textTransform: 'uppercase', letterSpacing: .5, margin: '0 0 6px' }}>🎯 Situation problème</p>
            <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7, margin: 0 }}>{ua.situation_probleme}</p>
          </div>
        )}

        {/* Contenu principal */}
        <div style={{ background: C.surface, borderRadius: 16, padding: '24px 28px', border: `1px solid ${C.border}`, boxShadow: '0 2px 16px rgba(107,58,42,0.07)', marginBottom: 20 }}>
          <ContentRenderer content={res?.contenu || ''} />
        </div>

        {/* Points clés */}
        {res?.points_cles && res.points_cles.length > 0 && (
          <div style={{ background: `${C.gold}15`, borderRadius: 14, padding: '16px 18px', marginBottom: 24, border: `1px solid ${C.gold}50` }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: C.gold, textTransform: 'uppercase', letterSpacing: .5, margin: '0 0 10px' }}>⭐ Points clés à retenir</p>
            {res.points_cles.map((pt, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <span style={{ color: C.gold, fontWeight: 900, flexShrink: 0, marginTop: 1 }}>→</span>
                <p style={{ fontSize: 13, color: C.text, margin: 0, lineHeight: 1.6 }}>{pt}</p>
              </div>
            ))}
          </div>
        )}

        {/* Compétences */}
        {ua?.competences && ua.competences.length > 0 && (
          <div style={{ background: C.emeraldPale, borderRadius: 12, padding: '14px 18px', marginBottom: 24, border: `1px solid ${C.emerald}35` }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: C.emerald, textTransform: 'uppercase', letterSpacing: .5, margin: '0 0 8px' }}>🎓 Compétences visées</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ua.competences.map((c, i) => (
                <span key={i} style={{ background: `${C.emerald}20`, color: C.emerald, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{c}</span>
              ))}
            </div>
          </div>
        )}

        {/* Navigation + bouton démarrer */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {idx > 0 && (
            <button onClick={() => logAndGo(idx - 1)} style={{ padding: '12px 20px', background: C.brownPale, color: C.brown, border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              ← Précédent
            </button>
          )}
          {idx < ressources.length - 1 ? (
            <button onClick={() => logAndGo(idx + 1)} style={{ flex: 1, padding: '14px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              Ressource suivante → ({idx + 2}/{ressources.length})
            </button>
          ) : (
            <button onClick={() => { logAndGo(idx); onStart() }} style={{ flex: 1, padding: '14px', background: `linear-gradient(135deg, ${C.emerald}, #0A7A5E)`, color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 4px 20px ${C.emerald}40` }}>
              Commencer →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}



/* ── Sons de feedback ─────────────────────────────────────────────
   Web Audio API synthétisé — aucune dépendance externe          */
function playFeedback(correct) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (correct) {
      [[523.25, 0], [659.25, 0.13], [783.99, 0.26]].forEach(([freq, t]) => {
        const osc = ctx.createOscillator(), g = ctx.createGain()
        osc.type = 'sine'; osc.frequency.value = freq
        g.gain.setValueAtTime(0.22, ctx.currentTime + t)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.36)
        osc.connect(g); g.connect(ctx.destination)
        osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.36)
      })
    } else {
      const osc = ctx.createOscillator(), g = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(260, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(130, ctx.currentTime + 0.36)
      g.gain.setValueAtTime(0.14, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.46)
      osc.connect(g); g.connect(ctx.destination)
      osc.start(); osc.stop(ctx.currentTime + 0.46)
    }
  } catch {}
}

const MSG_CORRECT = [
  'Bravo ! 🎉', 'Super ! ✨', 'Excellent ! 🏆',
  'Bien joué ! 👏', 'Parfait ! 🌟', 'Tu maîtrises ! 💪',
  "C'est ça ! 🎯", 'Bonne réponse ! 🔥',
]
const MSG_WRONG = [
  'Pas cette fois…', 'Continue, tu progresses ! 💪',
  'Presque ! Retiens bien la réponse', 'Tu y arriveras ! 🔥',
  'Bonne tentative, regarde la correction', 'Relève-toi ! 💡',
]
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)] }

/* ── Sélection de la meilleure voix française disponible ────────
   Ordre de préférence : voix neuronales (Denise, Amélie, Thomas)
   > voix Google > n'importe quelle voix fr > défaut système.
   Résultat mis en cache après le premier appel.               */
let _cachedFrVoice = undefined   // undefined = pas encore cherché, null = aucune trouvée
function getBestFrenchVoice() {
  if (_cachedFrVoice !== undefined) return _cachedFrVoice
  const voices = window.speechSynthesis?.getVoices() || []
  const PREF = ['Denise', 'Amélie', 'Thomas', 'Google français',
                'Hortense', 'Julie', 'Virginie', 'Nicolas']
  for (const name of PREF) {
    const v = voices.find(v => v.name.includes(name))
    if (v) { _cachedFrVoice = v; return v }
  }
  _cachedFrVoice = voices.find(v => v.lang?.startsWith('fr')) || null
  return _cachedFrVoice
}
// Recharge la liste quand le navigateur finit de charger les voix
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    _cachedFrVoice = undefined   // force re-sélection au prochain tts()
  })
}

/* ═══════════════════════════════════════════════════════════════ */
export default function Session() {
  const { C } = useTheme()
  const { uaId }   = useParams()
  const navigate   = useNavigate()
  const [searchParams] = useSearchParams()
  const groupeParam     = searchParams.get('groupe')     ? parseInt(searchParams.get('groupe')) : null
  const difficulteParam = searchParams.get('difficulte') ? parseInt(searchParams.get('difficulte')) : null
  const exerciceIdParam = searchParams.get('exercice_id') || null
  const rateesParam     = searchParams.get('ratees')     || null   // IDs séparés par virgule
  const skipLecon       = searchParams.get('skip') === '1'
  const { user }   = useSelector(s => s.auth)
  const { xs, mobile: isMobile, tablet } = useBreakpoint()
  const sessionIdRef = useRef(null)

  const [ua, setUA]               = useState(null)
  const [exercices, setExercices] = useState([])
  const [current, setCurrent]     = useState(0)
  const [reponse, setReponse]     = useState(null)
  const [blanks, setBlanks]       = useState([])
  const [activeBlank, setActiveBlank] = useState(null)   // index du trou sélectionné
  const [resultat, setResultat]   = useState(null)
  const [indices, setIndices]     = useState(0)
  const [termine, setTermine]     = useState(false)
  const [scores, setScores]       = useState([])
  const [startTime]               = useState(Date.now())
  const [questionTime, setQuestionTime] = useState(Date.now())
  const [confetti, setConfetti]   = useState(false)
  const [displayPct, setDisplayPct] = useState(0)
  const [streak, setStreak]       = useState(0)
  const [floatingPts, setFloatingPts] = useState(null)
  const [adaptation, setAdaptation] = useState(null)
  const [showPanel, setShowPanel] = useState(false)
  const [showCameraBanner, setShowCameraBanner] = useState(false)

  const [engagementScore, setEngagementScore] = useState(0.5)
  const [emotion, setEmotion]   = useState('neutre')
  const [cameraActive, setCameraActive] = useState(false)
  const [audioActive,  setAudioActive]  = useState(false)
  const [niveauBruit,  setNiveauBruit]  = useState(0)
  const [bruitPerturb, setBruitPerturb] = useState(false)
  const [explicationIA, setExplicationIA] = useState(null)
  const [loadingIA,     setLoadingIA]     = useState(false)
  const [iaHistory,     setIaHistory]     = useState([])   // historique conversationnel tuteur IA par exercice
  const [ressourceAide, setRessourceAide] = useState(null) // extrait de cours affiché sur BKT < 0.4
  const [ressources, setRessources] = useState([])
  const [phase,      setPhase]      = useState(skipLecon ? 'exercices' : 'lecon')
  const [elapsedMin, setElapsedMin] = useState(0)
  const [loading,         setLoading]         = useState(true)
  const [questionElapsed, setQuestionElapsed] = useState(0)

  const [submitting,     setSubmitting]     = useState(false)
  const [speaking,       setSpeaking]       = useState(false)
  const [ttsRate,        setTtsRate]        = useState(0.9)
  const [noiseAdaptatif, setNoiseAdaptatif] = useState(null)  // null|'eleve'|'tres_eleve'
  const [picModal,       setPicModal]       = useState(false)
  const [vadSpeech,      setVadSpeech]      = useState(false) // parole active détectée
  const [answerFlash,    setAnswerFlash]    = useState(null)  // null|'correct'|'wrong'
  const [feedbackMsg,    setFeedbackMsg]    = useState('')    // message aléatoire de feedback

  const videoRef         = useRef(null)
  const canvasRef        = useRef(null)
  const displayRef       = useRef(null)
  const faceMeshRef      = useRef(null)
  const lastSendRef      = useRef(0)
  const earBufferRef     = useRef([])
  const termineeRef      = useRef(false)
  const cnnEmotionRef    = useRef({ emotion: null, probs: null })  // dernière détection CNN (face-api.js ou ONNX)
  const triedExercices   = useRef(new Set())                       // first_attempt tracking

  // ── Modèles ONNX africains ───────────────────────────────────────
  const { predict: predictEmotionOnnx } = useEmotionOnnx()
  const { lastKeyword }                 = useKWSModel(audioActive)
  const { speak: alishaSpeak }          = useAlishaVoice()
  const faceApiIntervalRef = useRef(null)
  const audioContextRef  = useRef(null)
  const analyserRef      = useRef(null)
  const audioIntervalRef = useRef(null)
  const baselineRmsRef   = useRef(0)    // bruit ambiant mesuré à l'activation micro
  const lastSpikeRef     = useRef(0)    // timestamp du dernier pic soudain (anti-spam)
  const vadBufferRef     = useRef([])   // fenêtre glissante RMS pour VAD (8 × 300ms = 2.4s)
  const vadIntervalRef   = useRef(null) // intervalle rapide VAD
  const vadSpeechRef     = useRef(false)// état courant parole (sans re-render)
  const vadSpeechStart   = useRef(0)    // timestamp début de parole (durée)

  /* ── KWS : réaction aux mots-clés détectés ─────────────────────── */
  useEffect(() => {
    if (!lastKeyword || !MODELS_READY) return
    const sid = sessionIdRef.current
    if (sid) {
      api.post('/api/interaction', {
        session_id: sid, user_id: user.id,
        type: 'kws_keyword',
        data: { keyword: lastKeyword.keyword, confidence: Math.round(lastKeyword.confidence * 100) / 100 }
      }).catch(() => {})
    }
    // Réponses TTS aux commandes
    if (lastKeyword.keyword === 'aide')      tts('Je t\'envoie une explication.')
    if (lastKeyword.keyword === 'repeter')   tts('Je répète la question.')
    if (lastKeyword.keyword === 'lentement') tts('D\'accord, je vais plus lentement.')
  }, [lastKeyword])

  /* Afficher le banner caméra 4s après le chargement (mobile seulement) */
  useEffect(() => {
    if (!isMobile || cameraActive) return
    const t = setTimeout(() => setShowCameraBanner(true), 4000)
    return () => clearTimeout(t)
  }, [isMobile, cameraActive])

  /* Timer elapsed */
  useEffect(() => {
    const t = setInterval(() => setElapsedMin(Math.max(1, Math.round((Date.now() - startTime) / 60000))), 10000)
    return () => clearInterval(t)
  }, [startTime])

  useEffect(() => {
    async function init() {
      try {
        const { data: uaData } = await api.get(`/api/cours/ua/${uaId}`)
        setUA(uaData)
        const allEx = uaData.exercices || []
        let filtered = allEx
        if (rateesParam)                  filtered = allEx.filter(e => rateesParam.split(',').includes(e.id))
        else if (exerciceIdParam)         filtered = allEx.filter(e => e.id === exerciceIdParam)
        else if (groupeParam != null)     filtered = allEx.filter(e => e.groupe === groupeParam)
        else if (difficulteParam != null) filtered = allEx.filter(e => e.difficulte === difficulteParam)
        setExercices(filtered)
        const resos = uaData.ressources || []
        setRessources(resos)
        if (resos.length === 0 || skipLecon) setPhase('exercices')
        const { data: sess } = await api.post('/api/cours/session/creer', { user_id: user.id, ua_id: uaId })
        sessionIdRef.current = sess.session_id
      } catch { toast.error('Erreur de chargement') }
      finally { setLoading(false) }
    }
    init()
  }, [uaId, user.id])

  useEffect(() => {
    let timer = null
    function reset() {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const sid = sessionIdRef.current
        if (sid) api.post('/api/interaction', { session_id: sid, user_id: user.id, type: 'idle', data: { duration_seconds: 30 } }).catch(() => {})
      }, 30000)
    }
    const evts = ['mousedown', 'mousemove', 'keydown', 'scroll', 'click', 'touchstart']
    evts.forEach(e => window.addEventListener(e, reset)); reset()
    return () => { clearTimeout(timer); evts.forEach(e => window.removeEventListener(e, reset)) }
  }, [user.id])

  useEffect(() => () => {
    if (audioIntervalRef.current)   clearInterval(audioIntervalRef.current)
    if (vadIntervalRef.current)     clearInterval(vadIntervalRef.current)
    if (faceApiIntervalRef.current) clearInterval(faceApiIntervalRef.current)
    if (audioContextRef.current)    audioContextRef.current.close()
    if (window.speechSynthesis)     window.speechSynthesis.cancel()
  }, [])

  // Chrono par question — reset à chaque nouvelle question, s'arrête après réponse
  useEffect(() => {
    setQuestionElapsed(0)
    if (resultat) return
    const t = setInterval(() => setQuestionElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [current, resultat])

  // Clôture silencieuse si l'utilisateur quitte sans terminer
  useEffect(() => {
    return () => {
      if (sessionIdRef.current && !termineeRef.current) {
        api.post(`/api/cours/session/clore/${sessionIdRef.current}`).catch(() => {})
      }
    }
  }, [])

  const sendEvent = useCallback(async (type, data = {}) => {
    const sid = sessionIdRef.current
    if (!sid) return
    try {
      const { data: res } = await api.post('/api/interaction', { session_id: sid, user_id: user.id, type, data })
      if (res.engagement_score !== undefined) setEngagementScore(res.engagement_score)
      if (res.adaptation) setAdaptation(res.adaptation)
    } catch {}
  }, [user.id])

  // ── TTS (Text-To-Speech) ─────────────────────────────────────────
  const tts = useCallback((text, rate) => {
    if (!window.speechSynthesis || !text) return
    window.speechSynthesis.cancel()
    const utt    = new SpeechSynthesisUtterance(text)
    utt.lang     = 'fr-FR'
    utt.rate     = rate ?? ttsRate
    utt.pitch    = 1.08    // légèrement plus haut → ton chaleureux et engageant
    utt.volume   = 1.0
    const voice  = getBestFrenchVoice()
    if (voice) utt.voice = voice
    utt.onstart  = () => setSpeaking(true)
    utt.onend    = () => setSpeaking(false)
    utt.onerror  = () => setSpeaking(false)
    window.speechSynthesis.speak(utt)
  }, [ttsRate])

  const stopTts = useCallback(() => {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [])

  // Auto-lecture de l'énoncé quand le bruit devient perturbateur
  useEffect(() => {
    if (bruitPerturb && phase === 'exercices' && !resultat) {
      const enonce = exercices[current]?.enonce
      if (enonce) tts(enonce)
    }
  }, [bruitPerturb]) // eslint-disable-line react-hooks/exhaustive-deps

  // Page Visibility : log si l'utilisateur cache l'onglet (déclaré après sendEvent)
  useEffect(() => {
    function onVisibility() {
      if (document.hidden) sendEvent('visibility_change', { visible: false })
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [sendEvent])

  // Score count-up animation + Alisha speech when session ends
  useEffect(() => {
    if (!termine) return
    const pct = scores.length > 0 ? Math.round(scores.filter(s => s > 0).length / scores.length * 100) : 0
    const finMsg = pct >= 90 ? 'Incroyable ! Tu as presque tout réussi !'
      : pct >= 70 ? 'Très bien joué ! Tu progresses vraiment.'
      : pct >= 50 ? 'Bien essayé. Continue, tu vas y arriver !'
      : 'Chaque tentative te rapproche du succès !'
    setTimeout(() => alishaSpeak(finMsg), 600)
    let startTs = null
    const anim = (ts) => {
      if (!startTs) startTs = ts
      const prog = Math.min((ts - startTs) / 1400, 1)
      const eased = 1 - Math.pow(1 - prog, 3)
      setDisplayPct(Math.round(eased * pct))
      if (prog < 1) requestAnimationFrame(anim)
    }
    const id = setTimeout(() => requestAnimationFrame(anim), 250)
    return () => clearTimeout(id)
  }, [termine])

  async function startCamera() {
    setShowCameraBanner(false)
    let attempts = 0
    while ((!window.FaceMesh || !window.Camera) && attempts < 10) {
      await new Promise(r => setTimeout(r, 500)); attempts++
    }
    if (!window.FaceMesh || !window.Camera) { toast.error('MediaPipe non disponible'); return }
    try {
      const fm = new window.FaceMesh({ locateFile: f => import.meta.env.PROD
        ? `https://sti-proxy.sergedjiomo01.workers.dev/static/wasm/mediapipe/${f}`
        : `/mediapipe/face_mesh/${f}` })
      fm.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 })
      fm.onResults(onFaceResults)
      faceMeshRef.current = fm
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
      videoRef.current.srcObject = stream
      const cam = new window.Camera(videoRef.current, {
        onFrame: async () => {
          if (!faceMeshRef.current || !videoRef.current) return
          if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) return
          try { await faceMeshRef.current.send({ image: videoRef.current }) } catch {}
        },
        width: 320, height: 240
      })
      await cam.start()
      await new Promise(r => setTimeout(r, 1000))
      setCameraActive(true)
      toast.success('Analyse visuelle activée ✓')

      // Démarre l'intervalle ONNX immédiatement (sans attendre face-api.js)
      faceApiIntervalRef.current = setInterval(async () => {
        const vid = videoRef.current
        if (!vid || !vid.videoWidth) return

        // Priorité au modèle ONNX africain EfficientNet-B0 V3
        if (EMOTION_MODEL_READY) {
          const res = await predictEmotionOnnx(vid)
          if (res) {
            cnnEmotionRef.current = { emotion: res.emotion, probs: res.probs, dominant: res.emotion, source: 'onnx' }
            return
          }
        }

        // Fallback : face-api.js (modèle générique Ekman)
        if (!faceApiReady) return
        try {
          const opts = new window.faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.4 })
          const det  = await window.faceapi.detectSingleFace(vid, opts).withFaceExpressions()
          if (det?.expressions) {
            const probs = det.expressions
            const dominant = Object.entries(probs).sort((a, b) => b[1] - a[1])[0][0]
            cnnEmotionRef.current = { emotion: CNN_TO_ETAT[dominant] || 'neutre', probs, dominant, source: 'faceapi' }
          }
        } catch {}
      }, 3000)

      // Charge face-api.js en arrière-plan (fallback optionnel)
      loadFaceApiModels().then(ok => {
        if (ok) toast.success('face-api chargé ✓', { duration: 2000 })
      })
    } catch { toast.error('Caméra non disponible') }
  }

  async function startAudio() {
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx      = new (window.AudioContext || window.webkitAudioContext)()
      const source   = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioContextRef.current = ctx
      analyserRef.current     = analyser

      // ── Calibration baseline 3s ──────────────────────────────
      toast('🎙 Calibration du micro… (3s)', { duration: 3200, icon: '⏳' })
      const calibBuf = new Uint8Array(analyser.fftSize)
      const calibSamples = []
      const calibId = setInterval(() => {
        analyser.getByteTimeDomainData(calibBuf)
        const rms = Math.sqrt(calibBuf.reduce((s, v) => s + (v - 128) ** 2, 0) / calibBuf.length)
        calibSamples.push(rms)
      }, 150)
      await new Promise(r => setTimeout(r, 3000))
      clearInterval(calibId)
      const baseline = calibSamples.length
        ? calibSamples.reduce((a, b) => a + b, 0) / calibSamples.length
        : 5
      baselineRmsRef.current = Math.max(3, baseline)   // plancher évite division par zéro

      // ── Analyse continue (toutes les 3s) ────────────────────
      audioIntervalRef.current = setInterval(() => {
        const buf = new Uint8Array(analyser.fftSize)
        analyser.getByteTimeDomainData(buf)
        const rms  = Math.sqrt(buf.reduce((s, v) => s + (v - 128) ** 2, 0) / buf.length)
        const db   = Math.round(rms)
        const base = baselineRmsRef.current
        const ratio = base > 0 ? rms / base : 1

        const perturb    = ratio > 2.5
        const tresEleve  = ratio > 4.5
        const picSoudain = ratio > 6 && Date.now() - lastSpikeRef.current > 15000

        setNiveauBruit(db)
        setBruitPerturb(perturb)

        if (picSoudain) {
          lastSpikeRef.current = Date.now()
          setPicModal(true)
          tts('Une interruption a été détectée. Es-tu toujours là ?')
        } else if (tresEleve) {
          setNoiseAdaptatif('tres_eleve')
        } else if (perturb) {
          setNoiseAdaptatif('eleve')
        } else {
          setNoiseAdaptatif(null)
        }

        sendEvent('audio_analysis', {
          rms_level:      db,
          rms_ratio:      Math.round(ratio * 100) / 100,
          baseline:       Math.round(base),
          db_normalise:   Math.min(100, Math.round(db * 100 / 128)),
          bruit_perturb:  perturb,
          speech_detected: vadSpeechRef.current,
          contexte:       picSoudain ? 'pic_soudain'
                         : tresEleve ? 'bruit_tres_eleve'
                         : perturb   ? 'bruit_eleve'
                         : 'calme',
        })
      }, 3000)

      // ── VAD — fenêtre glissante 300ms × 8 = 2.4s ────────────
      // Critère parole : amplitude > 1.3× baseline (signal présent)
      //                  ET < 4.5× baseline (pas bruit constant)
      //                  ET variance élevée  (rythme vocal)
      const vadBuf = new Uint8Array(analyser.fftSize)
      vadIntervalRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(vadBuf)
        const rms  = Math.sqrt(vadBuf.reduce((s, v) => s + (v - 128) ** 2, 0) / vadBuf.length)
        const base = baselineRmsRef.current

        vadBufferRef.current.push(rms)
        if (vadBufferRef.current.length > 8) vadBufferRef.current.shift()
        const win = vadBufferRef.current
        if (win.length < 5) return

        const mean = win.reduce((a, b) => a + b, 0) / win.length
        const variance = win.reduce((s, v) => s + (v - mean) ** 2, 0) / win.length
        const varianceThreshold = (base * 0.25) ** 2

        const isSpeech = mean > base * 1.3
                      && mean < base * 4.5
                      && variance > varianceThreshold

        if (isSpeech !== vadSpeechRef.current) {
          vadSpeechRef.current = isSpeech
          setVadSpeech(isSpeech)
          if (isSpeech) {
            vadSpeechStart.current = Date.now()
            sendEvent('vad_speech', { event: 'start', mean_rms: Math.round(mean), baseline: Math.round(base) })
          } else {
            const duration = Math.round((Date.now() - vadSpeechStart.current) / 1000)
            sendEvent('vad_speech', { event: 'end', duration_seconds: duration })
          }
        }
      }, 300)

      setAudioActive(true)
      toast.success('Analyse audio activée ✓')
    } catch { toast.error('Micro non disponible') }
  }

  async function startBoth() {
    await startCamera()
    await startAudio()
  }

  function computeEAR(lm, idx) {
    const p = idx.map(i => lm[i])
    return (Math.hypot(p[1].x - p[5].x, p[1].y - p[5].y) + Math.hypot(p[2].x - p[4].x, p[2].y - p[4].y)) / (2 * Math.hypot(p[0].x - p[3].x, p[0].y - p[3].y))
  }

  function onFaceResults(results) {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) return
    const display = displayRef.current
    if (display) {
      display.width = video.videoWidth; display.height = video.videoHeight
      display.getContext('2d').drawImage(video, 0, 0, display.width, display.height)
    }
    if (!results.multiFaceLandmarks?.length) {
      const now = Date.now()
      if (now - lastSendRef.current > 5000) {
        sendEvent('facial_analysis', { visual_score: 0.0, face_detected: false, emotion: 'absent' })
        lastSendRef.current = now
      }
      return
    }
    const lm     = results.multiFaceLandmarks[0]
    const earRaw = (computeEAR(lm, [362, 385, 387, 263, 373, 380]) + computeEAR(lm, [33, 160, 158, 133, 153, 144])) / 2
    // Lissage EAR sur 8 frames
    earBufferRef.current.push(earRaw)
    if (earBufferRef.current.length > 8) earBufferRef.current.shift()
    const ear   = earBufferRef.current.reduce((a, b) => a + b, 0) / earBufferRef.current.length
    const yaw   = (lm[1].x - 0.5) * 180
    const pitch = (lm[1].y - lm[152].y) * 200

    // Score visuel (attention + pose)
    let score = 1.0
    if (ear < 0.15) score -= 0.5; else if (ear < 0.20) score -= 0.4; else if (ear < 0.25) score -= 0.2
    if (Math.abs(yaw) > 45) score -= 0.4; else if (Math.abs(yaw) > 30) score -= 0.3; else if (Math.abs(yaw) > 15) score -= 0.1
    if (Math.abs(pitch) > 30) score -= 0.2; else if (Math.abs(pitch) > 15) score -= 0.1
    score = Math.max(0, Math.min(1, score))

    // Fusion CNN (face-api.js) + géométrie (MediaPipe)
    const { emotion: cnnEmotion, probs: cnnProbs, dominant: cnnDominant } = cnnEmotionRef.current
    const em = fusionnerEmotion(cnnEmotion, cnnProbs, ear, yaw, pitch)
    setEmotion(em)

    const now = Date.now()
    if (now - lastSendRef.current > 5000) {
      sendEvent('facial_analysis', {
        visual_score:    Math.round(score * 100) / 100,
        ear:             Math.round(ear * 100) / 100,
        yaw:             Math.round(yaw),
        pitch:           Math.round(pitch),
        face_detected:   true,
        emotion:         em,
        // Données CNN brutes pour le dataset
        cnn_dominant:    cnnDominant  || null,
        cnn_happy:       cnnProbs ? Math.round((cnnProbs.happy    || 0) * 100) / 100 : null,
        cnn_neutral:     cnnProbs ? Math.round((cnnProbs.neutral  || 0) * 100) / 100 : null,
        cnn_sad:         cnnProbs ? Math.round((cnnProbs.sad      || 0) * 100) / 100 : null,
        cnn_angry:       cnnProbs ? Math.round((cnnProbs.angry    || 0) * 100) / 100 : null,
        cnn_fearful:     cnnProbs ? Math.round((cnnProbs.fearful  || 0) * 100) / 100 : null,
        cnn_surprised:   cnnProbs ? Math.round((cnnProbs.surprised|| 0) * 100) / 100 : null,
        cnn_disgusted:   cnnProbs ? Math.round((cnnProbs.disgusted|| 0) * 100) / 100 : null,
        source:          cnnDominant ? 'cnn+geometry' : 'geometry',
      })
      lastSendRef.current = now
    }
  }

  async function soumettre() {
    if (!reponse || submitting) return
    const sid = sessionIdRef.current
    if (!sid) { toast.error('Session non initialisée, patiente…'); return }
    const ex = exercices[current]
    const tempsReponse = Math.round((Date.now() - questionTime) / 1000)
    setSubmitting(true)
    try {
      const { data } = await api.post('/api/cours/exercice/verifier', { exercice_id: ex.id, user_id: user.id, reponse })
      const msg = pickRandom(data.correct ? MSG_CORRECT : MSG_WRONG)
      setResultat({ ...data, msg })
      setFeedbackMsg(msg)
      setScores(prev => [...prev, data.points_gagnes])
      playFeedback(data.correct)
      setAnswerFlash(data.correct ? 'correct' : 'wrong')
      alishaSpeak(data.correct ? 'Excellent ! Continue comme ça !' : 'Pas tout à fait — tu vas y arriver !')
      setTimeout(() => setAnswerFlash(null), 750)
      const p = cnnEmotionRef.current?.probs || {}
      const emotion_probs = {
        engagement:  p.happy    || 0,
        neutre:      p.neutral  || 0,
        ennui:       p.sad      || 0,
        frustration: (p.angry   || 0) + (p.disgusted  || 0),
        confusion:   (p.fearful || 0) + (p.surprised  || 0),
      }
      const first_attempt = !triedExercices.current.has(ex.id)
      await sendEvent('response', {
        exercice_id:   ex.id,
        correct:       data.correct,
        time_seconds:  tempsReponse,
        difficulty:    ex.difficulte,
        kc_ids:        ex.kcs || [ex.competence_evaluee].filter(Boolean),
        n_hints_used:  indices,
        first_attempt,
        emotion,
        emotion_probs,
      })
      triedExercices.current.add(ex.id)
      if (data.correct) {
        setStreak(s => s + 1)
        if (data.points_gagnes > 0) {
          setFloatingPts({ pts: data.points_gagnes, id: Date.now() })
          setTimeout(() => setFloatingPts(null), 1100)
        }
        toast.success(`+${data.points_gagnes} points !`, { icon: '🎯' })
      } else {
        setStreak(0)
        // Si BKT indique que la compétence est à renforcer, charger l'extrait de cours
        if (data.bkt?.niveau === 'a_renforcer') {
          api.get(`/api/cours/ua/${uaId}/ressource-aide`, {
            params: { competence: data.bkt.competence }
          }).then(r => setRessourceAide(r.data)).catch(() => {})
        }
      }
    } catch { toast.error('Erreur de vérification') }
    finally { setSubmitting(false) }
  }

  function suivant() {
    navigator.vibrate?.(30)
    if (current + 1 >= exercices.length) {
      const r = scores.filter(s => s > 0).length
      if (exercices.length > 0 && Math.round(r / exercices.length * 100) >= 80) setConfetti(true)
      if (sessionIdRef.current) {
        termineeRef.current = true
        api.post(`/api/cours/session/clore/${sessionIdRef.current}`).catch(() => {})
      }
      clearCache('dashboard_' + user.id)
      // Marque le défi du jour comme accompli
      localStorage.setItem(`sti_defi_${new Date().toDateString()}`, 'done')
      setTermine(true)
    } else {
      setCurrent(c => c + 1); setReponse(null); setResultat(null); setBlanks([]); setActiveBlank(null)
      setIndices(0); setAdaptation(null); setExplicationIA(null); setIaHistory([]); setRessourceAide(null)
      setAnswerFlash(null); setFeedbackMsg('')
      setQuestionTime(Date.now())
    }
  }

  async function demanderExplication() {
    if (!resultat || resultat.correct) return
    setLoadingIA(true); setExplicationIA(null)
    try {
      const ex = exercices[current]
      const { data } = await api.post('/api/tuteur/expliquer', {
        exercice_id: ex.id, reponse_donnee: reponse || '',
        niveau: user?.niveau_label || 'Première', filiere: user?.filiere_label || 'F6 BIPE',
        conversation_history: iaHistory,
      })
      setExplicationIA(data.explication_ia)
      // Conserve l'échange pour les relances suivantes sur le même exercice
      if (data.assistant_message) {
        setIaHistory(prev => [
          ...prev,
          { role: 'user', content: `J'ai répondu « ${reponse || ''} ». Explique-moi.` },
          { role: 'assistant', content: data.assistant_message },
        ])
      }
    } catch { toast.error('Tuteur IA indisponible') }
    finally { setLoadingIA(false) }
  }

  /* ── Chargement ──────────────────────────────────────────── */
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.bg, gap: 12 }}>
      <Spinner size={44} />
      <p style={{ color: C.textSec, fontSize: 14, fontWeight: 600 }}>Chargement…</p>
    </div>
  )
  if (!ua) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.bg, gap: 12 }}>
      <p style={{ color: C.red, fontSize: 14, fontWeight: 700 }}>Unité d'apprentissage introuvable.</p>
      <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', background: C.brown, color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}>Retour</button>
    </div>
  )
  if (exercices.length === 0) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.bg, gap: 12 }}>
      <p style={{ color: C.textSec, fontSize: 14, fontWeight: 600 }}>Aucun exercice disponible pour cette unité.</p>
      <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', background: C.brown, color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}>Retour</button>
    </div>
  )

  if (phase === 'lecon' && ua) {
    return <LeconReader
      ua={ua} ressources={ressources}
      onStart={() => setPhase('exercices')}
      onResourceView={(ressourceId, secs) => sendEvent('resource_read', { ressource_id: ressourceId, temps_secondes: secs })}
    />
  }

  /* ── Fin de session ──────────────────────────────────────── */
  if (termine) {
    const total = scores.length, reussis = scores.filter(s => s > 0).length
    const pct = total > 0 ? Math.round(reussis / total * 100) : 0
    const rateesIds = exercices.filter((_, i) => scores[i] === 0).map(e => e.id)
    const totalPtsGagnes = scores.reduce((a, b) => a + b, 0)
    const grade = pct >= 90 ? { emoji: '🏆', label: 'Excellent !',       bg: 'linear-gradient(135deg,#F59E0B,#D97706)', anim: 'goldGlow 2s ease infinite' }
                : pct >= 70 ? { emoji: '🌟', label: 'Très bien !',        bg: `linear-gradient(135deg,${C.emerald},#059669)`, anim: undefined }
                : pct >= 50 ? { emoji: '👍', label: 'Bien joué !',        bg: `linear-gradient(135deg,${C.brown},${C.brownLight})`, anim: undefined }
                :             { emoji: '💪', label: 'Continue comme ça !', bg: 'linear-gradient(135deg,#6366F1,#4F46E5)', anim: undefined }

    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
        {confetti && <Confetti/>}
        <div style={{ maxWidth: 520, width: '100%', animation: 'fadeUp .5s ease' }}>

          {/* ── Carte principale ── */}
          <div style={{ backgroundColor: C.surface, borderRadius: 24, padding: isMobile ? '24px 20px' : '36px 40px', boxShadow: '0 8px 48px rgba(107,58,42,0.14)', border: `1px solid ${C.brownPale}`, textAlign: 'center', marginBottom: 14 }}>

            {/* Alisha fin de session */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4, animation: 'trophyPop .6s ease .1s both' }}>
              <Suspense fallback={<div style={{ width: 60, height: 70 }} />}>
                <Alisha state={pct >= 70 ? 'excited' : pct >= 50 ? 'welcome' : 'idle'} size={60} />
              </Suspense>
            </div>

            {/* Trophée animé */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: isMobile ? 72 : 90, height: isMobile ? 72 : 90, borderRadius: '50%', background: grade.bg, boxShadow: '0 6px 30px rgba(0,0,0,0.18)', animation: grade.anim, marginBottom: 10 }}>
                <span style={{ fontSize: isMobile ? 36 : 44, animation: 'trophyPop .7s cubic-bezier(.22,1,.36,1) .2s both', display: 'block' }}>{grade.emoji}</span>
              </div>
              <h2 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, color: C.brown, margin: '0 0 4px' }}>{grade.label}</h2>
              <p style={{ color: C.textSec, fontSize: 13, margin: 0 }}>{ua.titre}</p>
            </div>

            {/* Score animé central */}
            <div style={{ margin: '20px 0', position: 'relative' }}>
              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', background: C.brownPale, borderRadius: 20, padding: isMobile ? '16px 28px' : '20px 40px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Score global</span>
                <span style={{ fontSize: isMobile ? 52 : 68, fontWeight: 900, color: pct >= 70 ? C.emerald : pct >= 50 ? C.brown : C.red, lineHeight: 1, animation: 'scoreCount .5s cubic-bezier(.22,1,.36,1) .3s both' }}>
                  {displayPct}<span style={{ fontSize: isMobile ? 24 : 32, color: C.textSec }}>%</span>
                </span>
                <span style={{ fontSize: 12, color: C.textSec, fontWeight: 600 }}>{reussis} / {total} réussis · {totalPtsGagnes} pts</span>
              </div>
            </div>

            {/* Timeline des réponses */}
            {scores.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: .5, margin: '0 0 8px' }}>Détail des réponses</p>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {scores.map((s, i) => (
                    <div key={i} title={`Q${i+1} : ${s > 0 ? '+'+s+' pts' : 'faux'}`} style={{
                      width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: s > 0 ? C.emeraldPale : '#FEE2E2',
                      border: `1.5px solid ${s > 0 ? C.emerald : C.red}50`,
                      fontSize: 10, fontWeight: 900, color: s > 0 ? C.emerald : C.red,
                      animation: `scaleIn .3s ease ${i * 0.045}s both`,
                    }}>
                      {s > 0 ? '✓' : '✗'}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats en 3 colonnes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
              {[
                { label: 'Engagement',  value: `${Math.round(engagementScore * 100)}%`, color: engColor(engagementScore, C), icon: <Activity size={13}/> },
                { label: 'Durée',       value: `${elapsedMin}min`,                       color: C.textSec,                icon: <Clock size={13}/>   },
                { label: 'Pts gagnés',  value: `${totalPtsGagnes}`,                      color: C.gold,                   icon: <Award size={13}/>   },
              ].map((s, i) => (
                <div key={s.label} style={{ backgroundColor: C.brownPale, borderRadius: 12, padding: '12px 8px', animation: `scaleIn .35s ease ${.5 + i * .08}s both` }}>
                  <div style={{ color: s.color, marginBottom: 3, display: 'flex', justifyContent: 'center' }}>{s.icon}</div>
                  <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: C.textSec, fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Message motivant */}
            <div style={{ background: pct >= 70 ? C.emeraldPale : C.brownPale, borderRadius: 12, padding: '10px 14px', marginBottom: 20, border: `1px solid ${pct >= 70 ? C.emerald : C.brownLight}30` }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: pct >= 70 ? C.emerald : C.brown, margin: 0, lineHeight: 1.6 }}>
                {pct === 100 ? '🎉 Score parfait ! Tu maîtrises cette unité à 100% !'
                  : pct >= 90 ? '🌟 Excellent résultat ! Tes compétences progressent très bien.'
                  : pct >= 70 ? '👏 Bien joué ! Quelques points à revoir pour atteindre la maîtrise.'
                  : pct >= 50 ? '📚 Bon effort ! Revoir les exercices ratés avant de continuer.'
                  : '🎯 Continue à pratiquer — chaque tentative renforce la mémoire !'}
              </p>
            </div>

            {/* Boutons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Revoir les ratées — visible seulement si ≥1 question ratée et pas déjà en mode ratées */}
              {rateesIds.length > 0 && !rateesParam && (
                <button onClick={() => navigate(`/session/${uaId}?ratees=${rateesIds.join(',')}&skip=1`)} style={{
                  width: '100%', padding: '14px',
                  background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                  color: 'white', border: 'none', borderRadius: 14,
                  fontSize: isMobile ? 13 : 14, fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48,
                  boxShadow: '0 4px 16px rgba(239,68,68,0.35)'
                }}>
                  🔁 Revoir les {rateesIds.length} question{rateesIds.length > 1 ? 's' : ''} ratée{rateesIds.length > 1 ? 's' : ''}
                </button>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button onClick={() => navigate(`/cours/${uaId}`)} style={{
                  padding: '13px', background: C.brownPale,
                  color: C.brown, border: `1.5px solid ${C.brownLight}40`,
                  borderRadius: 14, fontSize: isMobile ? 13 : 14, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48
                }}>
                  <ArrowLeft size={15}/> Retour au cours
                </button>
                <button onClick={() => { setTermine(false); setCurrent(0); setReponse(null); setResultat(null); setScores([]); setIndices(0); setAdaptation(null); setExplicationIA(null); setConfetti(false); setStreak(0); setDisplayPct(0); setBlanks([]); setActiveBlank(null) }} style={{
                  padding: '13px', background: C.brownPale,
                  color: C.brown, border: `1.5px solid ${C.brownLight}40`,
                  borderRadius: 14, fontSize: isMobile ? 13 : 14, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48
                }}>
                  🔄 Refaire
                </button>
              </div>
              <button onClick={() => navigate('/dashboard')} style={{
                width: '100%', padding: '15px',
                background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
                color: 'white', border: 'none', borderRadius: 14,
                fontSize: isMobile ? 14 : 15, fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: `0 4px 20px ${C.brown}40`, minHeight: 52
            }}>
              <Home size={17}/> Tableau de bord
            </button>
          </div>
          </div>
        </div>
      </div>
    )
  }

  const ex = exercices[current]
  const diffStyle = {
    1: { bg: C.emeraldPale, color: C.emerald,   label: 'Facile',    icon: '🟢' },
    2: { bg: '#FEF3C7',     color: '#92400E',    label: 'Moyen',     icon: '🟡' },
    3: { bg: '#FEE2E2',     color: C.red,        label: 'Difficile', icon: '🔴' },
  }
  const ds = diffStyle[ex.difficulte] || diffStyle[1]
  const totalPts = scores.reduce((a, b) => a + b, 0)
  const isIdentification = ex.type === 'qcm' && !!ex.options?.[0]?.startsWith?.('__img__:')
  const identImgUrl  = isIdentification ? ex.options[0].slice(8) : null
  const identChoices = isIdentification ? ex.options.slice(1) : (ex.options || [])
  const isAPC  = ex.type === 'reponse_libre' && !!ex.enonce?.startsWith?.('__APC__')
  const apcData = isAPC ? (() => { try { return JSON.parse(ex.enonce.slice(7)) } catch { return null } })() : null
  const isVraiFaux = !isIdentification &&
    (ex.type === 'vrai_faux' || ex.type === 'qcm') &&
    ex.options?.length === 2 &&
    (ex.options.includes('Vrai') || ex.options.includes('Faux'))
  const nbBlanksInEnonce = ex.type === 'texte_trou' ? (ex.enonce.match(/___/g) || []).length : 0
  const isMultiBlank     = nbBlanksInEnonce > 1
  const multiParts       = isMultiBlank ? ex.enonce.split('___') : []
  const multiNbBlanks    = nbBlanksInEnonce
  const MASCOT = {
    engagement_eleve:'🦁', engagement_modere:'🐘', engagement_faible:'🐢',
    confusion:'🤔', frustration:'🐆', ennui:'😴', neutre:'🦉', decrochage:'⚠️',
  }
  const mascot = MASCOT[emotion] || '🦉'

  // ── État Alisha mappé sur contexte session ────────────────────
  const alishaState = answerFlash === 'correct'        ? 'correct'
    : answerFlash === 'wrong'                           ? 'wrong'
    : loadingIA                                         ? 'typing'
    : explicationIA                                     ? 'speaking'
    : emotion === 'confusion' || emotion === 'decrochage' ? 'confused'
    : emotion === 'frustration'                         ? 'wrong'
    : emotion === 'ennui'                               ? 'idle'
    : emotion === 'engagement_eleve'                    ? 'excited'
    : resultat                                          ? 'speaking'
    : 'question'

  const alishaBubble = answerFlash === 'correct'
    ? 'Excellent ! Continue comme ça !'
    : answerFlash === 'wrong'
    ? 'Pas tout à fait — tu vas y arriver !'
    : loadingIA
    ? 'Je cherche une explication adaptée…'
    : explicationIA
    ? 'Voilà une autre façon de voir les choses.'
    : emotion === 'confusion'
    ? 'Tu sembles perdu·e ? Les indices peuvent t\'aider.'
    : emotion === 'frustration'
    ? 'Prends une respiration. Tu progresses !'
    : emotion === 'ennui'
    ? 'Allez, encore un effort !'
    : emotion === 'decrochage'
    ? 'Tu es toujours là ? Fais une petite pause si besoin.'
    : null

  /* ── Panneau IA ─────────────────────────────────────────── */
  const PanneauIA = ({ isOverlay = false }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Carte caméra */}
      <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: 14, boxShadow: '0 2px 10px rgba(107,58,42,0.08)', border: `1px solid ${C.brownPale}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={12} color="white"/>
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: C.brown, flex: 1 }}>Analyse IA</span>
          {isOverlay && (
            <button onClick={() => setShowPanel(false)} style={{ background: C.brownPale, border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={13} color={C.textSec}/>
            </button>
          )}
        </div>

        {/* Feed caméra */}
        <div style={{ aspectRatio: '4/3', backgroundColor: '#1A1207', borderRadius: 10, marginBottom: 10, position: 'relative', overflow: 'hidden' }}>
          <canvas ref={displayRef} style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraActive ? 'block' : 'none' }}/>
          {!cameraActive && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Camera size={20} color="rgba(255,255,255,0.25)"/>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600, margin: 0 }}>Caméra désactivée</p>
            </div>
          )}
          {cameraActive && (
            <div style={{ position: 'absolute', bottom: 6, left: 6, display: 'flex', gap: 4 }}>
              <div style={{ backgroundColor: C.emerald, borderRadius: 20, padding: '2px 8px', fontSize: 9, fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: 'white', animation: 'pulse 1.5s infinite' }}/>LIVE
              </div>
              {faceApiReady && (
                <div style={{ backgroundColor: '#7C3AED', borderRadius: 20, padding: '2px 8px', fontSize: 9, fontWeight: 800, color: 'white' }}>
                  CNN ✓
                </div>
              )}
            </div>
          )}
        </div>

        {/* Boutons activation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {!cameraActive ? (
            <button onClick={startCamera} style={{ padding: '9px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 38 }}>
              <Camera size={13}/> Activer la caméra
            </button>
          ) : (
            <div style={{ backgroundColor: C.emeraldPale, borderRadius: 9, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: C.emerald, animation: 'pulse 1.5s infinite', flexShrink: 0 }}/>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.emerald }}>Caméra active</span>
            </div>
          )}
          {!audioActive ? (
            <button onClick={startAudio} style={{ padding: '9px', background: `linear-gradient(135deg, ${C.emerald}, #0A7A5E)`, color: 'white', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 38 }}>
              <Mic size={13}/> Activer le micro
            </button>
          ) : (
            <div style={{ backgroundColor: bruitPerturb ? '#FEE2E2' : C.emeraldPale, borderRadius: 9, padding: '7px 10px', border: `1px solid ${bruitPerturb ? C.red : C.emerald}30` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: bruitPerturb ? C.red : C.emerald }}>
                  {bruitPerturb ? '🔊 Bruit élevé' : '🎤 Ambiance calme'}
                </span>
                <span style={{ fontSize: 9, color: C.textSec }}>{Math.min(100, Math.round(niveauBruit * 100 / 128))}%</span>
              </div>
              <div style={{ height: 3, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(100, Math.round(niveauBruit * 100 / 128))}%`, backgroundColor: bruitPerturb ? C.red : C.emerald, transition: 'width .5s ease' }}/>
              </div>
              {/* Indicateur VAD */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: vadSpeech ? C.emerald : '#D1D5DB',
                  animation: vadSpeech ? 'pulse 1s infinite' : 'none',
                  transition: 'background .3s'
                }}/>
                <span style={{ fontSize: 10, fontWeight: 700, color: vadSpeech ? C.emerald : C.textSec }}>
                  {vadSpeech ? 'Parole détectée' : 'Silence / bruit'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Contrôles TTS */}
        <div style={{ borderTop: `1px solid ${C.brownPale}`, paddingTop: 10, marginTop: 2 }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: .5, margin: '0 0 7px' }}>Lecture vocale</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => speaking ? stopTts() : tts(exercices[current]?.enonce)}
              style={{ flex: 1, padding: '7px 6px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: speaking ? C.red : C.brownPale, color: speaking ? 'white' : C.brown, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              {speaking ? '⏹ Stop' : '🔊 Lire'}
            </button>
            <button
              onClick={() => { setTtsRate(0.65); tts(exercices[current]?.enonce, 0.65) }}
              title="Lire plus lentement"
              style={{ padding: '7px 8px', borderRadius: 8, border: `1px solid ${ttsRate === 0.65 ? C.brown : C.brownPale}`, cursor: 'pointer', fontSize: 11, fontWeight: 700, background: ttsRate === 0.65 ? C.brownPale : 'transparent', color: C.brown }}>
              🐢
            </button>
            <button
              onClick={() => setTtsRate(0.9)}
              title="Vitesse normale"
              style={{ padding: '7px 8px', borderRadius: 8, border: `1px solid ${ttsRate === 0.9 ? C.brown : C.brownPale}`, cursor: 'pointer', fontSize: 11, fontWeight: 700, background: ttsRate === 0.9 ? C.brownPale : 'transparent', color: C.brown }}>
              🐇
            </button>
          </div>
        </div>

        <MiniGauge score={engagementScore} emotion={emotion} compact={false}/>
      </div>

      {/* Stats session */}
      <div style={{ backgroundColor: C.surface, borderRadius: 14, padding: 14, boxShadow: '0 2px 8px rgba(107,58,42,0.07)', border: `1px solid ${C.brownPale}` }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: C.brown, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: .5 }}>Session</p>
        {[
          { icon: <CheckCircle size={12}/>, label: 'Réussis', value: `${scores.filter(s => s > 0).length}/${scores.length || 0}` },
          { icon: <Target size={12}/>,      label: 'Points',  value: `${totalPts} pts` },
          { icon: <Clock size={12}/>,       label: 'Temps',   value: `${elapsedMin} min` },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${C.brownPale}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.textSec }}>
              {s.icon}
              <span style={{ fontSize: 11, fontWeight: 600 }}>{s.label}</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.brown }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )

  /* ── Rendu principal ────────────────────────────────────── */
  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none', position: 'absolute' }}/>
      <canvas ref={canvasRef} style={{ display: 'none', position: 'absolute' }}/>

      {/* ── Floating +pts overlay ── */}
      {floatingPts && (
        <div key={floatingPts.id} style={{
          position: 'fixed', top: '38%', left: '50%', zIndex: 998,
          fontSize: isMobile ? 28 : 36, fontWeight: 900, color: C.emerald,
          pointerEvents: 'none', whiteSpace: 'nowrap',
          textShadow: `0 3px 10px ${C.emerald}60`,
          animation: 'floatUpFade .9s ease forwards',
        }}>+{floatingPts.pts} pts 🎯</div>
      )}

      {/* ── Modal pic sonore — confirmation présence ── */}
      {picModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: C.surface, borderRadius: 20, padding: '32px 24px', maxWidth: 340, width: '100%', textAlign: 'center', boxShadow: '0 16px 48px rgba(0,0,0,0.3)', animation: 'fadeUp .3s ease' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>👋</div>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: C.text, margin: '0 0 10px' }}>Tu es toujours là ?</h3>
            <p style={{ fontSize: 13, color: C.textSec, margin: '0 0 24px', lineHeight: 1.7 }}>
              Une interruption a été détectée dans ton environnement.<br/>Prends le temps qu'il te faut — la session t'attend.
            </p>
            <button
              onClick={() => { setPicModal(false); setNoiseAdaptatif(null); tts('Bienvenue ! On continue.') }}
              style={{ width: '100%', padding: '13px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: `0 4px 18px ${C.brown}35` }}>
              ✅ Je suis là, on continue !
            </button>
          </div>
        </div>
      )}

      {/* ── Header sticky ── */}
      <div style={{
        backgroundColor: C.surface, borderBottom: `1px solid ${C.brownPale}`,
        padding: `0 ${isMobile ? 12 : 24}px`, height: 58,
        display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16,
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 2px 12px rgba(107,58,42,0.07)'
      }}>
        {/* Bouton retour */}
        <button onClick={() => navigate(`/cours/${uaId}`)} style={{
          background: C.brownPale, border: 'none', borderRadius: 9,
          padding: isMobile ? '8px 10px' : '7px 14px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
          color: C.brown, fontSize: 12, fontWeight: 700, flexShrink: 0, minHeight: 36
        }}>
          <ArrowLeft size={13}/>{!isMobile && ' Quitter'}
        </button>

        {/* Titre + progression */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!isMobile && (
            <p style={{ fontSize: 10, color: C.textSec, fontWeight: 600, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ua.reference_ue} — {ua.titre}
              {exerciceIdParam
                ? ` · ${exercices[0]?.titre || 'Question'}`
                : groupeParam != null
                  ? ` · Exercice ${groupeParam}${exercices[0]?.groupe_titre ? ` : ${exercices[0].groupe_titre}` : ''}`
                  : difficulteParam === 1 ? ' · Niveau Facile'
                  : difficulteParam === 2 ? ' · Niveau Moyen'
                  : difficulteParam === 3 ? ' · Niveau Difficile'
                  : ''}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 5, borderRadius: 5, overflow: 'hidden', display: 'flex', gap: 1 }}>
              {exercices.map((_, i) => (
                <div key={i} style={{
                  flex: 1, height: '100%',
                  background: i < scores.length
                    ? (scores[i] > 0 ? C.emerald : C.red)
                    : i === current ? C.brown : '#E5E7EB',
                  borderRadius: i === 0 ? '5px 0 0 5px' : i === exercices.length - 1 ? '0 5px 5px 0' : 0,
                  transition: 'background .3s ease'
                }}/>
              ))}
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.brown, flexShrink: 0 }}>
              {current + 1}/{exercices.length}
            </span>
          </div>
        </div>

        {/* Droite : engagement + bouton IA (mobile) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {isMobile ? (
            <>
              <MiniGauge score={engagementScore} emotion={emotion} compact={true}/>
              <button onClick={() => setShowPanel(true)} style={{
                background: cameraActive ? C.emeraldPale : C.brownPale,
                border: `1px solid ${cameraActive ? C.emerald : C.brownLight}40`,
                borderRadius: 9, padding: '7px 9px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: cameraActive ? C.emerald : C.brown, minHeight: 36
              }}>
                <Zap size={14}/>
                {cameraActive && <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: C.emerald, marginLeft: 3, animation: 'pulse 1.5s infinite' }}/>}
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 13px', borderRadius: 20, background: C.brownPale }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: engColor(engagementScore, C), animation: 'pulse 2s infinite' }}/>
              <span style={{ fontSize: 13, fontWeight: 800, color: engColor(engagementScore, C) }}>{Math.round(engagementScore * 100)}%</span>
              <span style={{ fontSize: 11 }}>{(ETATS[emotion] || ETATS.neutre).label.split(' ')[0]}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Overlay panneau IA (mobile) ── */}
      {isMobile && showPanel && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) setShowPanel(false) }}>
          <div style={{ backgroundColor: C.bg, borderRadius: '20px 20px 0 0', padding: '16px 16px 24px', width: '100%', maxHeight: '82vh', overflowY: 'auto', animation: 'fadeUp .3s cubic-bezier(.22,1,.36,1)' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.brownPale, margin: '0 auto 16px' }}/>
            <PanneauIA isOverlay={true}/>
          </div>
        </div>
      )}

      {/* ── Chip caméra mobile ── */}
      {isMobile && showCameraBanner && !cameraActive && (
        <CameraChip
          onActivate={startBoth}
          onDismiss={() => setShowCameraBanner(false)}
        />
      )}

      {/* ── Body ── */}
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: `${xs ? 10 : 16}px ${xs ? 8 : isMobile ? 12 : 20}px`, display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Bannière bruit adaptatif */}
          {noiseAdaptatif && !picModal && (
            <div style={{
              padding: '10px 14px', borderRadius: 12, marginBottom: 10,
              background: noiseAdaptatif === 'tres_eleve' ? `${C.red}12` : `${C.gold}12`,
              border: `1px solid ${noiseAdaptatif === 'tres_eleve' ? `${C.red}40` : `${C.gold}40`}`,
              display: 'flex', alignItems: 'center', gap: 10, animation: 'slideDown .3s ease'
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>
                {noiseAdaptatif === 'tres_eleve' ? '🔇' : '🔊'}
              </span>
              <p style={{ fontSize: 12, fontWeight: 700, margin: 0, flex: 1,
                color: noiseAdaptatif === 'tres_eleve' ? C.red : C.gold, lineHeight: 1.5 }}>
                {noiseAdaptatif === 'tres_eleve'
                  ? 'Environnement très bruyant — les consignes sont lues automatiquement'
                  : "Bruit de fond détecté — utilise le bouton 🔊 si tu n'entends pas bien"}
              </p>
              <button onClick={() => setNoiseAdaptatif(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: C.textSec, flexShrink: 0, padding: 4 }}>✕</button>
            </div>
          )}

          {/* Bannière adaptation */}
          {adaptation && (
            <div style={{
              padding: '12px 14px', borderRadius: 12, marginBottom: 14,
              background: adaptation.priority === 'haute' ? `${C.red}12` : `${C.gold}12`,
              border: `1px solid ${adaptation.priority === 'haute' ? `${C.red}40` : `${C.gold}40`}`,
              animation: 'slideDown .3s ease', display: 'flex', gap: 10, alignItems: 'flex-start'
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{adaptation.priority === 'haute' ? '⚠️' : '💡'}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: adaptation.priority === 'haute' ? C.red : C.gold, margin: '0 0 4px' }}>
                  {adaptation.message}
                </p>
                <button onClick={() => setAdaptation(null)} style={{ fontSize: 11, color: C.textSec, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                  Ignorer
                </button>
              </div>
            </div>
          )}

          {/* ── Carte question principale ── */}
          <div key={current} style={{ animation: 'slideInRight .28s ease' }}>
          <div style={{
            backgroundColor: C.surface, borderRadius: xs ? 14 : isMobile ? 18 : 22,
            padding: xs ? '14px 12px' : isMobile ? '18px 16px' : '30px 32px',
            boxShadow: answerFlash === 'correct' ? `0 0 0 4px ${C.emerald}45,0 0 28px ${C.emerald}25`
                     : answerFlash === 'wrong'   ? `0 0 0 4px ${C.red}45`
                     : '0 3px 20px rgba(107,58,42,0.09)',
            border: `1px solid ${answerFlash === 'correct' ? C.emerald+'60' : answerFlash === 'wrong' ? C.red+'60' : C.brownPale}`,
            animation: answerFlash === 'correct' ? 'flashCorrect .65s ease'
                     : answerFlash === 'wrong'   ? 'shake .4s ease, flashWrong .65s ease'
                     : undefined,
            transition: 'box-shadow .3s ease, border-color .3s ease',
          }}>
            {/* Méta badges + Alisha */}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, flexWrap:'wrap' }}>
              {/* Alisha réactive */}
              <Suspense fallback={<span style={{ fontSize:22 }}>{mascot}</span>}>
                <div style={{ flexShrink: 0, marginBottom: -4 }}>
                  <Alisha state={alishaState} size={52} />
                </div>
              </Suspense>
              {/* Bulle contextuelle */}
              {alishaBubble && (
                <div style={{
                  background:    '#FFF7ED',
                  border:       '1.5px solid #F97316',
                  borderRadius:  10,
                  padding:      '5px 11px',
                  fontSize:      11,
                  fontWeight:    700,
                  color:        '#9A3412',
                  maxWidth:      180,
                  lineHeight:    1.4,
                  animation:    'slideDown .25s ease',
                }}>
                  {alishaBubble}
                </div>
              )}
              {/* Streak badge */}
              {streak >= 2 && !resultat && (
                <div style={{ display:'flex', alignItems:'center', gap:3, background:'#FEF3C7', borderRadius:20, padding:'2px 9px', border:'1.5px solid #FDE68A', animation:'streakPop .35s cubic-bezier(.22,1,.36,1)' }}>
                  <span style={{ fontSize:13, animation:'pulse 1.2s infinite' }}>🔥</span>
                  <span style={{ fontSize:10, fontWeight:800, color:'#92400E' }}>{streak} série</span>
                </div>
              )}
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:11, color:C.textSec, fontWeight:600, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  Question {current + 1} sur {exercices.length}
                  {(ex.kcs?.[0] || ex.competence_evaluee) && ` · ${ex.kcs?.[0] || ex.competence_evaluee}`}
                </p>
              </div>
              <span style={{ backgroundColor:ds.bg, color:ds.color, padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
                {ds.icon} {ds.label}
              </span>
              {!resultat && (
                <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color: questionElapsed > 60 ? C.orange : C.textSec, fontWeight:700 }}>
                  <Clock size={11}/>{questionElapsed}s
                </span>
              )}
              <span style={{ fontSize:12, color:C.gold, fontWeight:900, background:C.brownPale, padding:'3px 10px', borderRadius:20 }}>
                ★ {ex.points}
              </span>
            </div>

            {/* Énoncé / Situation APC */}
            {isAPC && apcData ? (
              <div style={{ marginBottom: 20 }}>
                <div style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: 14, padding: isMobile ? '14px' : '18px 20px', marginBottom: 10 }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: .5, margin: '0 0 8px' }}>📋 Situation-problème</p>
                  <p style={{ margin: 0, fontSize: isMobile ? 13 : 14, color: '#1E3A5F', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{apcData.contexte}</p>
                </div>
                {apcData.ressources && (
                  <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px', marginBottom: 8, display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 13, flexShrink: 0 }}>📚</span>
                    <p style={{ margin: 0, fontSize: 12, color: '#166534', lineHeight: 1.7 }}><strong>Ressources :</strong> {apcData.ressources}</p>
                  </div>
                )}
                <div style={{ background: C.brownPale, borderRadius: 12, padding: isMobile ? '12px 14px' : '14px 18px', borderLeft: `4px solid ${C.brown}`, position: 'relative' }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: C.brown, textTransform: 'uppercase', letterSpacing: .5, margin: '0 0 6px' }}>🎯 Consigne</p>
                  <p style={{ margin: 0, fontSize: isMobile ? 13 : 14, fontWeight: 600, color: C.text, lineHeight: 1.8, whiteSpace: 'pre-wrap', paddingRight: 36 }}>{apcData.consigne}</p>
                  <button onClick={() => speaking ? stopTts() : tts(apcData.contexte + '\n' + apcData.consigne)}
                    style={{ position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: '50%', background: speaking ? C.red : C.brown, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                    {speaking ? '⏹' : '🔊'}
                  </button>
                </div>
                {apcData.criteres && (
                  <div style={{ marginTop: 8, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '8px 14px' }}>
                    <p style={{ margin: 0, fontSize: 11, color: '#92400E', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      <strong>Critères d'évaluation :</strong> {apcData.criteres}
                    </p>
                  </div>
                )}
              </div>
            ) : !isMultiBlank ? (
              <div style={{
                backgroundColor: C.brownPale, borderRadius: 14,
                padding: isMobile ? '14px 16px' : '18px 22px',
                marginBottom: isIdentification ? 10 : 20, borderLeft: `4px solid ${C.brown}`,
                position: 'relative'
              }}>
                <RichText text={ex.enonce} style={{ fontSize: isMobile ? 14 : 15, fontWeight: 600, paddingRight: 36 }}/>
                <button onClick={() => speaking ? stopTts() : tts(ex.enonce)}
                  title={speaking ? 'Arrêter la lecture' : 'Lire l\'énoncé'}
                  style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: '50%', background: speaking ? C.red : C.brown, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, transition: 'background .2s', boxShadow: speaking ? `0 0 0 3px ${C.red}30` : 'none', animation: speaking ? 'pulse 1.5s infinite' : 'none' }}>
                  {speaking ? '⏹' : '🔊'}
                </button>
              </div>
            ) : null}

            {/* Image schéma (identification) */}
            {isIdentification && identImgUrl && (
              <div style={{ marginBottom: 16, textAlign: 'center' }}>
                <img src={identImgUrl} alt="Schéma à identifier"
                  style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 12, border: `2px solid #BFDBFE`, boxShadow: '0 4px 16px rgba(0,0,0,.1)', display: 'block', margin: '0 auto' }} />
                <p style={{ fontSize: 11, color: C.textSec, margin: '6px 0 0', fontStyle: 'italic' }}>Observe bien ce schéma avant de répondre</p>
              </div>
            )}

            {/* ── Vrai / Faux ── */}
            {isVraiFaux && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                {ex.options.map((opt, i) => {
                  const isV  = opt === 'Vrai'
                  const isSel = reponse === opt
                  const isOk  = !!resultat && opt === resultat.reponse_correcte
                  const isKo  = !!resultat && isSel && !resultat.correct
                  return (
                    <button key={i} onClick={() => !resultat && setReponse(opt)} style={{
                      padding: isMobile ? '22px 10px' : '30px 16px',
                      borderRadius:20, cursor: resultat ? 'default' : 'pointer',
                      border: `3px solid ${isOk ? C.emerald : isKo ? C.red : isSel ? C.brown : C.brownPale}`,
                      background: isOk ? C.emeraldPale : isKo ? '#FEE2E2' : isSel ? C.brownPale : C.surface,
                      transition:'all .18s ease',
                      transform: isSel && !resultat ? 'scale(1.05)' : 'scale(1)',
                      boxShadow: isSel && !resultat ? `0 8px 24px ${C.brown}30` : 'none',
                      display:'flex', flexDirection:'column', alignItems:'center', gap:10,
                      animation: isOk ? 'popIn .35s ease' : undefined,
                    }}>
                      <span style={{ fontSize: isMobile ? 40 : 52 }}>{isV ? '✅' : '❌'}</span>
                      <span style={{ fontSize: isMobile ? 17 : 20, fontWeight:900,
                        color: isOk ? C.emerald : isKo ? C.red : isSel ? C.brown : C.text }}>
                        {opt}
                      </span>
                      {isOk && <CheckCircle size={20} color={C.emerald}/>}
                      {isKo && <XCircle     size={20} color={C.red}/>}
                    </button>
                  )
                })}
              </div>
            )}

            {/* ── QCM standard + Identification ── */}
            {ex.type === 'qcm' && !isVraiFaux && (
              <div style={{ display:'flex', flexDirection:'column', gap: isMobile ? 8 : 10, marginBottom:16 }}>
                {identChoices.map((opt, i) => (
                  <ExerciceOption key={i}
                    lettre={String.fromCharCode(65 + i)} texte={opt}
                    selected={reponse === opt}
                    correct={!!resultat && opt === resultat.reponse_correcte}
                    incorrect={!!resultat && reponse === opt && !resultat.correct}
                    onClick={() => !resultat && setReponse(opt)}/>
                ))}
              </div>
            )}

            {/* ── Texte à trous — multi-blancs ── */}
            {ex.type === 'texte_trou' && isMultiBlank && (
              <div style={{ marginBottom:16 }}>
                {/* Instruction + TTS (remplace le bloc énoncé général) */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 8 }}>
                  <p style={{ fontSize:11, fontWeight:800, color: activeBlank !== null ? C.brown : C.textSec, textTransform:'uppercase', letterSpacing:.6, margin:0, transition:'color .2s', flex:1 }}>
                    {resultat
                      ? 'Résultat'
                      : activeBlank !== null
                        ? `→ Trou ${activeBlank + 1} sélectionné — choisis un mot`
                        : 'Clique un trou, puis un mot pour le remplir'}
                  </p>
                  <button onClick={() => speaking ? stopTts() : tts(ex.enonce)}
                    title={speaking ? 'Arrêter' : 'Lire l\'énoncé'}
                    style={{ width:28, height:28, borderRadius:'50%', background: speaking ? C.red : C.brown, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, flexShrink:0 }}>
                    {speaking ? '⏹' : '🔊'}
                  </button>
                </div>

                {/* Phrase avec slots inline */}
                <div style={{ background: C.brownPale, borderRadius: 12, padding: isMobile ? '12px 14px' : '14px 18px', marginBottom: 14, lineHeight: 2.8, fontSize: isMobile ? 14 : 15, fontWeight: 600, color: C.text }}>
                  {multiParts.map((part, i) => {
                    const correctArr = (() => { try { return JSON.parse(resultat?.reponse_correcte || '[]') } catch { return [] } })()
                    const filled = (blanks.length === multiNbBlanks ? blanks[i] : null) ?? null
                    const isActive      = !resultat && activeBlank === i
                    const isCorrectSlot = resultat && filled?.toLowerCase() === (correctArr[i] || '').toLowerCase()
                    const isWrongSlot   = resultat && filled !== null && !isCorrectSlot
                    return (
                      <span key={i}>
                        {part}
                        {i < multiNbBlanks && (
                          <span
                            onClick={() => {
                              if (resultat) return
                              // Cliquer sur un trou : l'activer (et le vider si déjà rempli)
                              const nb = blanks.length === multiNbBlanks ? [...blanks] : Array(multiNbBlanks).fill(null)
                              if (activeBlank === i) {
                                // Désélectionner
                                setActiveBlank(null)
                              } else {
                                // Sélectionner ce trou (le vider pour permettre re-sélection)
                                nb[i] = null
                                const allFilled = nb.slice(0, multiNbBlanks).every(b => b !== null)
                                setBlanks(nb)
                                setReponse(allFilled ? JSON.stringify(nb.slice(0, multiNbBlanks)) : null)
                                setActiveBlank(i)
                              }
                            }}
                            style={{
                              display: 'inline-block', minWidth: 80, padding: '3px 12px', margin: '0 3px',
                              borderRadius: 8, textAlign: 'center', fontWeight: 800,
                              border: resultat
                                ? `2px solid ${isCorrectSlot ? C.emerald : C.red}`
                                : isActive
                                  ? `2.5px solid ${C.brown}`
                                  : `2px dashed ${filled ? C.brown : C.brownLight}`,
                              background: resultat
                                ? (isCorrectSlot ? C.emeraldPale : '#FEE2E2')
                                : isActive
                                  ? C.brown
                                  : (filled ? C.brownPale : 'transparent'),
                              color: resultat
                                ? (isCorrectSlot ? C.emerald : C.red)
                                : isActive
                                  ? 'white'
                                  : (filled ? C.brown : C.textSec),
                              cursor: resultat ? 'default' : 'pointer',
                              fontStyle: filled ? 'normal' : 'italic', fontSize: 13,
                              boxShadow: isActive ? `0 0 0 3px ${C.brown}30` : 'none',
                              transition: 'all .15s',
                            }}>
                            {filled ?? `trou ${i+1}`}
                          </span>
                        )}
                      </span>
                    )
                  })}
                </div>

                {/* Réponses correctes après résultat */}
                {resultat && !resultat.correct && (() => {
                  try {
                    const arr = JSON.parse(resultat.reponse_correcte)
                    if (Array.isArray(arr)) return (
                      <p style={{ fontSize: 12, color: C.emerald, fontWeight: 600, margin: '0 0 10px' }}>
                        ✅ Réponses : {arr.join(' · ')}
                      </p>
                    )
                  } catch {}
                  return null
                })()}

                {/* Banque de mots */}
                {!resultat && ex.options?.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {ex.options.map((opt, i) => {
                      // Un mot est "placé" seulement dans le trou qui le contient (pas les autres)
                      const placedInSlot = blanks.length === multiNbBlanks
                        ? blanks.findIndex((b, idx) => idx !== activeBlank && b === opt)
                        : -1
                      const isPlaced = placedInSlot !== -1
                      return (
                        <button key={i} onClick={() => {
                          // Cliquer un mot : le placer dans le trou actif
                          const targetSlot = activeBlank !== null
                            ? activeBlank
                            : (blanks.length === multiNbBlanks
                                ? blanks.findIndex((b, idx) => idx < multiNbBlanks && b === null)
                                : 0)
                          if (targetSlot === -1) return
                          const nb = blanks.length === multiNbBlanks ? [...blanks] : Array(multiNbBlanks).fill(null)
                          nb[targetSlot] = opt
                          const allFilled = nb.slice(0, multiNbBlanks).every(b => b !== null)
                          setBlanks(nb)
                          setReponse(allFilled ? JSON.stringify(nb.slice(0, multiNbBlanks)) : null)
                          // Passer automatiquement au prochain trou vide
                          const nextEmpty = nb.findIndex((b, idx) => idx < multiNbBlanks && b === null)
                          setActiveBlank(nextEmpty !== -1 ? nextEmpty : null)
                        }} style={{
                          padding:'9px 18px', borderRadius:24,
                          background: isPlaced ? '#E5E7EB' : (activeBlank !== null ? C.brown + '15' : C.surface),
                          color: isPlaced ? '#9CA3AF' : C.text,
                          border:`2px solid ${isPlaced ? '#D1D5DB' : (activeBlank !== null ? C.brown : C.brownPale)}`,
                          fontSize:14, fontWeight:700, cursor: isPlaced ? 'default' : 'pointer',
                          opacity: isPlaced ? 0.5 : 1,
                          textDecoration: isPlaced ? 'line-through' : 'none',
                          transition:'all .15s',
                        }}>
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Saisie libre multi-blancs (sans banque de mots) */}
                {!resultat && !ex.options?.length && (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {Array.from({ length: multiNbBlanks }, (_, i) => (
                      <input key={i} type="text"
                        placeholder={`Trou ${i+1}…`}
                        value={(blanks.length === multiNbBlanks ? blanks[i] : '') || ''}
                        onChange={e => {
                          const nb = blanks.length === multiNbBlanks ? [...blanks] : Array(multiNbBlanks).fill('')
                          nb[i] = e.target.value
                          const allFilled = nb.slice(0, multiNbBlanks).every(b => b && b.trim())
                          setBlanks(nb); setReponse(allFilled ? JSON.stringify(nb.slice(0, multiNbBlanks)) : null)
                        }}
                        style={{ width:'100%', padding:'11px 14px', border:`1.5px solid ${activeBlank === i ? C.brown : C.brownLight}`, borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box', backgroundColor:C.surface, fontWeight:600 }}
                        onFocus={() => setActiveBlank(i)} onBlur={() => setActiveBlank(null)}/>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Texte à trous simple (1 trou) ── */}
            {ex.type === 'texte_trou' && !isMultiBlank && (
              <div style={{ marginBottom:16 }}>
                {ex.options?.length > 0 ? (
                  <>
                    {!resultat && (
                      <>
                        <p style={{ fontSize:11, fontWeight:800, color:C.textSec, textTransform:'uppercase', letterSpacing:.6, margin:'0 0 10px' }}>
                          Sélectionne le bon mot :
                        </p>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
                          {ex.options.map((opt, i) => (
                            <button key={i} onClick={() => setReponse(opt)} style={{
                              padding:'11px 22px', borderRadius:24,
                              background: reponse === opt
                                ? `linear-gradient(135deg,${C.brown},${C.brownLight})`
                                : C.surface,
                              color: reponse === opt ? 'white' : C.text,
                              border:`2px solid ${reponse === opt ? C.brown : C.brownPale}`,
                              fontSize:15, fontWeight:700, cursor:'pointer', transition:'all .15s',
                              boxShadow: reponse === opt ? `0 4px 16px ${C.brown}35` : 'none',
                              transform: reponse === opt ? 'scale(1.06)' : 'scale(1)',
                              animation: reponse === opt ? 'popIn .2s ease' : undefined,
                            }}>
                              {opt}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    {resultat && (
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ fontSize:12, color:C.textSec, fontWeight:600 }}>Ta réponse :</span>
                        <span style={{ padding:'7px 18px', borderRadius:22,
                          background: resultat.correct ? C.emeraldPale : '#FEE2E2',
                          color: resultat.correct ? C.emerald : C.red,
                          fontSize:14, fontWeight:800,
                          border:`2px solid ${resultat.correct ? C.emerald : C.red}30` }}>
                          {reponse}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <input type="text" placeholder="Complète le texte…"
                    value={reponse || ''} onChange={e => setReponse(e.target.value)} disabled={!!resultat}
                    style={{ width:'100%', padding:'13px 16px', border:`1.5px solid ${resultat ? C.brownPale : C.brownLight}`, borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box', backgroundColor:C.surface, fontWeight:600, transition:'border .2s' }}/>
                )}
              </div>
            )}

            {/* ── Réponse libre / APC ── */}
            {ex.type === 'reponse_libre' && (
              <div style={{ marginBottom:16 }}>
                {isAPC && <p style={{ fontSize: 12, fontWeight: 700, color: C.brown, margin: '0 0 8px' }}>✍️ Ta production :</p>}
                <textarea rows={isAPC ? 7 : 4}
                  placeholder={isAPC ? "Développe ta réponse en répondant à chaque point de la consigne…" : "Écris ta réponse complète ici…"}
                  value={reponse || ''} onChange={e => setReponse(e.target.value)} disabled={!!resultat}
                  style={{ width:'100%', padding:'13px 16px', border:`1.5px solid ${C.brownPale}`, borderRadius:10, fontSize:14, outline:'none', resize:'vertical', boxSizing:'border-box', backgroundColor:C.surface, fontFamily:'inherit', lineHeight:1.7 }}/>
                {!resultat && reponse && (
                  <p style={{ fontSize:11, color:C.textSec, margin:'4px 0 0', textAlign:'right' }}>
                    {reponse.trim().split(/\s+/).length} mot(s)
                  </p>
                )}
              </div>
            )}

            {/* Feedback résultat — En attente (réponse libre) */}
            {resultat?.en_attente && (
              <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 14, padding: '14px 16px', marginBottom: 16, animation: 'slideDown .3s ease' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>⏳</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 800, color: '#92400E' }}>
                      Réponse soumise — en attente de correction
                    </p>
                    <p style={{ margin: '0 0 10px', fontSize: 13, color: '#78350F', lineHeight: 1.6 }}>
                      {resultat.msg}
                    </p>
                    {/* Réponse modèle pour auto-évaluation */}
                    <div style={{ background: '#FEF9C3', borderRadius: 10, padding: '10px 14px', borderLeft: '4px solid #EAB308' }}>
                      <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 800, color: '#713F12', textTransform: 'uppercase', letterSpacing: .5 }}>
                        📋 Réponse modèle (auto-évaluation)
                      </p>
                      <p style={{ margin: 0, fontSize: 13, color: '#1A1207', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                        {resultat.reponse_correcte}
                      </p>
                    </div>
                    {resultat.explication && (
                      <p style={{ margin: '8px 0 0', fontSize: 12, color: '#92400E', lineHeight: 1.6 }}>
                        💡 {resultat.explication}
                      </p>
                    )}
                    {/* Feedback enseignant si déjà évalué */}
                    {resultat.commentaire_enseignant && (
                      <div style={{ marginTop: 10, background: C.emeraldPale, borderRadius: 10, padding: '8px 12px', border: `1px solid ${C.emerald}30` }}>
                        <p style={{ margin: 0, fontSize: 12, color: C.emerald, fontWeight: 700 }}>
                          ✅ Commentaire enseignant : {resultat.commentaire_enseignant}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Feedback résultat — Correct / Incorrect */}
            {resultat && !resultat.en_attente && (
              <div style={{
                backgroundColor: resultat.correct ? C.emeraldPale : '#FEE2E2',
                borderRadius: 14, padding: '14px 16px', marginBottom: 16,
                border: `1px solid ${resultat.correct ? C.emerald : C.red}30`,
                animation: resultat.correct ? 'slideDown .3s ease' : 'shake .4s ease, slideDown .3s ease'
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  {resultat.correct
                    ? <CheckCircle size={18} color={C.emerald} style={{ flexShrink: 0, marginTop: 2 }}/>
                    : <XCircle     size={18} color={C.red}     style={{ flexShrink: 0, marginTop: 2 }}/>}
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 5px', fontSize: 14, fontWeight: 800, color: resultat.correct ? C.emerald : C.red, animation:'popIn .3s ease' }}>
                      {resultat.msg || (resultat.correct ? 'Bravo ! 🎉' : 'Pas cette fois…')}
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: C.text, lineHeight: 1.6 }}>{resultat.explication}</p>
                    {!resultat.correct && (
                      <p style={{ fontSize: 13, color: C.emerald, margin: '7px 0 0' }}>
                        <strong>Bonne réponse :</strong> {resultat.reponse_correcte}
                      </p>
                    )}
                    {/* BKT mastery bar */}
                    {resultat.bkt && (
                      <div style={{ marginTop: 10, padding: '8px 12px', background: `${resultat.bkt.color}12`, borderRadius: 10, border: `1px solid ${resultat.bkt.color}30` }}>
                        <p style={{ fontSize: 10, color: C.textSec, margin: '0 0 5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4 }}>
                          Maîtrise — {resultat.bkt.competence}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 5, background: '#E5E7EB', borderRadius: 5, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 5, width: `${resultat.bkt.pourcentage}%`, background: resultat.bkt.color, transition: 'width 1s ease' }}/>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 900, color: resultat.bkt.color, flexShrink: 0 }}>{resultat.bkt.pourcentage}%</span>
                          <span style={{ fontSize: 10, color: C.textSec, flexShrink: 0 }}>{resultat.bkt.label}</span>
                        </div>
                      </div>
                    )}

                    {/* Extrait de cours Alisha — BKT < 0.4 */}
                    {ressourceAide && !resultat.correct && (
                      <div style={{
                        marginTop: 10, borderRadius: 12, overflow: 'hidden',
                        border: `1px solid ${C.brownLight}40`, animation: 'slideDown .3s ease'
                      }}>
                        <div style={{ background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16 }}>📖</span>
                          <span style={{ fontSize: 11, fontWeight: 800, color: 'white', flex: 1 }}>
                            Révise ce point : {ressourceAide.titre}
                          </span>
                          <button onClick={() => setRessourceAide(null)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: 14, padding: 2 }}>✕</button>
                        </div>
                        <div style={{ background: C.brownPale, padding: '10px 12px' }}>
                          <p style={{ margin: '0 0 8px', fontSize: 12, color: C.text, lineHeight: 1.7, fontStyle: 'italic' }}>
                            {ressourceAide.extrait}
                          </p>
                          {ressourceAide.points_cles?.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {ressourceAide.points_cles.map((pt, i) => (
                                <span key={i} style={{ background: `${C.brown}18`, color: C.brown, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>
                                  {pt}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Bouton Tuteur IA */}
                    {!resultat.correct && (
                      <div style={{ marginTop: 12 }}>
                        {!explicationIA && (
                          <button onClick={demanderExplication} disabled={loadingIA} style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            padding: '9px 16px',
                            background: loadingIA ? '#E5E7EB' : `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
                            color: loadingIA ? C.textSec : 'white',
                            border: 'none', borderRadius: 10,
                            fontSize: 12, fontWeight: 700, cursor: loadingIA ? 'wait' : 'pointer',
                            minHeight: 38
                          }}>
                            {loadingIA
                              ? <><Spinner size={12} color="white" /> Réflexion…</>
                              : <>💡 Expliquer autrement</>}
                          </button>
                        )}
                        {explicationIA && (
                          <div style={{
                            marginTop: 10,
                            background: `linear-gradient(135deg, ${C.brownPale}, #FFFBEB)`,
                            borderRadius: 14, padding: '14px 16px',
                            border: `1px solid ${C.gold}40`,
                            animation: 'slideDown .3s ease'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 10 }}>
                              <Suspense fallback={<span style={{ fontSize: 20 }}>🧠</span>}>
                                <Alisha state="speaking" size={44} />
                              </Suspense>
                              <div style={{ flex: 1 }}>
                                <span style={{ fontSize: 11, fontWeight: 800, color: C.brown, display: 'block' }}>Alisha explique</span>
                                <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7, margin: '4px 0 0' }}>{explicationIA}</p>
                              </div>
                            </div>
                            <button onClick={() => setExplicationIA(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: C.textSec, textDecoration: 'underline', padding: 0 }}>
                              Fermer
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Indice */}
            {!resultat && (
              <div style={{ marginBottom: 14 }}>
                {indices === 0 ? (
                  <button onClick={() => { setIndices(1); sendEvent('help_requested', { level: 1 }) }} style={{
                    backgroundColor: 'transparent',
                    border: `1.5px dashed ${C.brownLight}`,
                    borderRadius: 9, padding: '8px 14px', cursor: 'pointer',
                    color: C.brownLight, fontSize: 12, fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 6, minHeight: 38
                  }}>
                    <Lightbulb size={13}/> Voir un indice
                  </button>
                ) : (
                  <div style={{ backgroundColor: '#FFFBEB', borderRadius: 12, padding: 14, border: '1px solid #FDE68A50', animation: 'slideDown .3s ease' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                      <Lightbulb size={14} color={C.orange}/>
                      <span style={{ fontSize: 12, fontWeight: 800, color: C.orange }}>Indice {indices}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: C.text, lineHeight: 1.6 }}>
                      {indices === 1 ? ex.indice_1 : ex.indice_2}
                    </p>
                    {indices === 1 && ex.indice_2 && (
                      <button onClick={() => { setIndices(2); sendEvent('help_requested', { level: 2 }) }} style={{
                        marginTop: 8, backgroundColor: 'transparent', border: `1px dashed ${C.orange}`,
                        borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                        color: C.orange, fontSize: 11, fontWeight: 700, minHeight: 32
                      }}>
                        Indice 2
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Bouton action principal */}
            {!resultat ? (
              <button onClick={soumettre} disabled={!reponse || submitting} style={{
                width: '100%', padding: '16px',
                background: reponse && !submitting
                  ? `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`
                  : '#E5E7EB',
                color: reponse && !submitting ? 'white' : C.textSec,
                border: 'none', borderRadius: 14,
                fontSize: isMobile ? 14 : 15, fontWeight: 800,
                cursor: reponse && !submitting ? 'pointer' : 'not-allowed',
                boxShadow: reponse && !submitting ? `0 6px 22px ${C.brown}40` : 'none',
                transition: 'all .2s ease', minHeight: 54,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                animation: reponse && !submitting ? 'pulse 2s infinite' : undefined,
              }}>
                {submitting
                  ? <><Spinner size={14} color={C.textSec}/> Vérification…</>
                  : <>{reponse ? 'Valider' : 'Choisir…'}</>}
              </button>
            ) : (
              <button onClick={suivant} style={{
                width: '100%', padding: '16px',
                background: `linear-gradient(135deg, ${C.emerald}, #0A7A5E)`,
                color: 'white', border: 'none', borderRadius: 14,
                fontSize: isMobile ? 14 : 15, fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: `0 6px 22px ${C.emerald}40`, minHeight: 54,
                animation: 'popIn .3s ease',
              }}>
                {current + 1 >= exercices.length ? 'Terminer' : 'Suivant'}
                <ChevronRight size={16}/>
              </button>
            )}
          </div>
          </div>{/* end key={current} slide wrapper */}

          {/* ── Mini stats mobiles sous la carte ── */}
          {isMobile && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
              {[
                { icon: <CheckCircle size={13}/>, label: 'Réussis', value: `${scores.filter(s => s > 0).length}/${scores.length || 0}`, color: C.emerald },
                { icon: <Target size={13}/>,      label: 'Points',  value: `${totalPts}`,                                                color: C.brown },
                { icon: <Clock size={13}/>,       label: 'Temps',   value: `${elapsedMin}min`,                                           color: C.textSec },
              ].map(s => (
                <div key={s.label} style={{ backgroundColor: C.surface, borderRadius: 12, padding: '10px 8px', textAlign: 'center', border: `1px solid ${C.brownPale}`, boxShadow: '0 1px 6px rgba(107,58,42,0.06)' }}>
                  <div style={{ color: s.color, display: 'flex', justifyContent: 'center', marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: C.textSec, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Panneau IA desktop / tablet ── */}
        {!isMobile && (
          <div style={{ width: tablet ? 210 : 220, flexShrink: 0 }}>
            <PanneauIA isOverlay={false}/>
          </div>
        )}
      </div>
    </div>
  )
}