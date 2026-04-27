import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  Camera, Lightbulb, CheckCircle, XCircle,
  ChevronRight, Home, ArrowLeft, Zap, Mic,
  X, Activity, Clock, Target, Award
} from 'lucide-react'

import { C } from '../../styles/theme'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { Spinner } from '../../components/Skeleton'

/* ── Engagement helpers ──────────────────────────────────────── */
const engColor = s =>
  s >= 0.80 ? C.emerald : s >= 0.60 ? '#2563eb' :
  s >= 0.40 ? C.orange  : s >= 0.20 ? C.red : '#7F1D1D'

const engLabel = s =>
  s >= 0.80 ? 'Élevé' : s >= 0.60 ? 'Modéré' :
  s >= 0.40 ? 'Faible' : s >= 0.20 ? 'Ennui' : 'Décroché'

const ETATS = {
  engagement_eleve:  { label: '😊 Engagé',     color: C.emerald    },
  engagement_modere: { label: '🙂 Modéré',      color: '#2563eb'    },
  engagement_faible: { label: '😐 Peu engagé',  color: C.orange     },
  confusion:         { label: '🤔 Confusion',   color: C.orange     },
  frustration:       { label: '😤 Frustration', color: C.red        },
  ennui:             { label: '😴 Ennui',        color: C.textSec    },
  neutre:            { label: '😐 Neutre',       color: C.brownLight },
  decrochage:        { label: '⚠️ Décroché',    color: '#7F1D1D'    },
}

/* ── Emotion detection ───────────────────────────────────────── */
function detecterEmotion(lm, ear, yaw, pitch) {
  const sourire = (lm[0].y - lm[61].y + lm[0].y - lm[291].y) / 2
  const joie = sourire > 0.015
  const hBouche = Math.abs(lm[13].y - lm[14].y)
  const lBouche = Math.abs(lm[61].x - lm[291].x)
  const mar = lBouche > 0 ? hBouche / lBouche : 0
  const sourcilsLeves = (lm[9].y - lm[70].y + lm[9].y - lm[300].y) / 2 > 0.06
  const sourcilsFronced = Math.abs(lm[21].x - lm[22].x) < 0.025
  if (ear < 0.22 && Math.abs(pitch) > 12) return 'ennui'
  if (mar > 0.45 && sourcilsLeves) return 'confusion'
  if (joie) return 'engagement_eleve'
  if (sourcilsFronced && Math.abs(yaw) < 20) return 'frustration'
  if (Math.abs(yaw) > 25) return 'engagement_faible'
  return 'neutre'
}

/* ── Gauge component ─────────────────────────────────────────── */
const MiniGauge = ({ score, emotion, compact = false }) => {
  const color = engColor(score)
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
  let bg = C.surface, border = `1.5px solid ${C.brownPale}`, textColor = C.text
  let lBg = '#E5E7EB', lColor = C.textSec
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
      <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5, flex: 1 }}>{texte}</span>
      {correct   && <CheckCircle size={17} color={C.emerald} style={{ flexShrink: 0 }}/>}
      {incorrect && <XCircle     size={17} color={C.red}     style={{ flexShrink: 0 }}/>}
    </button>
  )
}

/* ── Confetti ────────────────────────────────────────────────── */
const Confetti = () => {
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    color: [C.brown, C.brownLight, C.emerald, C.gold, '#FCD34D', '#EC4899'][i % 6],
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 2}s`,
    duration: `${2.5 + Math.random() * 2}s`,
    size: Math.random() * 10 + 5,
  }))
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 999 }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: 'absolute', top: 0, left: p.left,
          width: p.size, height: p.size, backgroundColor: p.color,
          borderRadius: p.size / 4,
          animation: `confettiFall ${p.duration} ${p.delay} ease-in both`
        }}/>
      ))}
    </div>
  )
}

/* ── Toast caméra mobile ─────────────────────────────────────── */
const CameraBanner = ({ onActivate, onDismiss }) => (
  <div style={{
    position: 'fixed', bottom: 90, left: 12, right: 12, zIndex: 300,
    backgroundColor: C.surface, borderRadius: 16,
    boxShadow: '0 8px 32px rgba(107,58,42,0.18)',
    border: `1.5px solid ${C.brown}30`,
    padding: '14px 16px',
    display: 'flex', alignItems: 'center', gap: 12,
    animation: 'slideUp .35s cubic-bezier(.22,1,.36,1)'
  }}>
    {/* Icône animée */}
    <div style={{
      width: 42, height: 42, borderRadius: 12, flexShrink: 0,
      background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 4px 14px ${C.brown}40`
    }}>
      <Camera size={18} color="white"/>
    </div>

    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: '0 0 2px' }}>
        Activer l'analyse IA
      </p>
      <p style={{ fontSize: 11, color: C.textSec, margin: 0, lineHeight: 1.4 }}>
        Caméra + micro pour un suivi personnalisé
      </p>
    </div>

    <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
      <button onClick={onActivate} style={{
        padding: '8px 14px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
        color: 'white', border: 'none', borderRadius: 10,
        fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', minHeight: 36
      }}>
        Activer
      </button>
      <button onClick={onDismiss} style={{
        width: 36, height: 36, background: C.brownPale, border: 'none',
        borderRadius: 10, cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        <X size={14} color={C.textSec}/>
      </button>
    </div>
  </div>
)


// LECON READER

function LeconReader({ ua, ressources, onStart }) {
  const [idx, setIdx] = useState(0)
  const res = ressources[idx]

  const typeLabel = {
    lecon:   { icon: '📖', label: 'Leçon',   color: '#6B3A2A' },
    tp:      { icon: '🔬', label: 'TP',      color: '#0D9373' },
    resume:  { icon: '📋', label: 'Résumé',  color: '#2563EB' },
    video:   { icon: '🎬', label: 'Vidéo',   color: '#7C3AED' },
  }[res?.type] || { icon: '📄', label: 'Ressource', color: '#6B3A2A' }

  return (
    <div style={{
      minHeight: '100vh', background: '#FAF7F4',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #3D1F13, #6B3A2A)',
        padding: '20px 24px', color: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 11, opacity: .7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5 }}>
            {ua?.reference_ue} · {ua?.titre}
          </span>
        </div>
        {/* Navigation ressources */}
        {ressources.length > 1 && (
          <div style={{ display: 'flex', gap: 6 }}>
            {ressources.map((r, i) => {
              const t = { lecon: '📖', tp: '🔬', resume: '📋', video: '🎬' }[r.type] || '📄'
              return (
                <button key={r.id} onClick={() => setIdx(i)} style={{
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
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1A1207', margin: 0 }}>{res?.titre}</h2>
          </div>
        </div>

        {/* Situation problème */}
        {ua?.situation_probleme && (
          <div style={{ background: 'linear-gradient(135deg, #E6F5F0, #F5EDE5)', borderRadius: 14, padding: '14px 18px', marginBottom: 20, border: '1px solid #0D937330' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#0D9373', textTransform: 'uppercase', letterSpacing: .5, margin: '0 0 6px' }}>🎯 Situation problème</p>
            <p style={{ fontSize: 13, color: '#1A1207', lineHeight: 1.7, margin: 0 }}>{ua.situation_probleme}</p>
          </div>
        )}

        {/* Contenu principal — rendu Markdown simplifié */}
        <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '24px 28px', border: '1px solid #F5EDE5', boxShadow: '0 2px 16px rgba(107,58,42,0.07)', marginBottom: 20 }}>
          <MarkdownRenderer content={res?.contenu || ''} />
        </div>

        {/* Points clés */}
        {res?.points_cles && res.points_cles.length > 0 && (
          <div style={{ background: '#FEF3C7', borderRadius: 14, padding: '16px 18px', marginBottom: 24, border: '1px solid #D97706' }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: .5, margin: '0 0 10px' }}>⭐ Points clés à retenir</p>
            {res.points_cles.map((pt, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <span style={{ color: '#D97706', fontWeight: 900, flexShrink: 0, marginTop: 1 }}>→</span>
                <p style={{ fontSize: 13, color: '#1A1207', margin: 0, lineHeight: 1.6 }}>{pt}</p>
              </div>
            ))}
          </div>
        )}

        {/* Compétences */}
        {ua?.competences && ua.competences.length > 0 && (
          <div style={{ background: '#F0FDF4', borderRadius: 12, padding: '14px 18px', marginBottom: 24, border: '1px solid #BBF7D0' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', letterSpacing: .5, margin: '0 0 8px' }}>🎓 Compétences visées</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ua.competences.map((c, i) => (
                <span key={i} style={{ background: '#DCFCE7', color: '#15803D', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{c}</span>
              ))}
            </div>
          </div>
        )}

        {/* Navigation + bouton démarrer */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {idx > 0 && (
            <button onClick={() => setIdx(i => i - 1)} style={{ padding: '12px 20px', background: '#F5EDE5', color: '#6B3A2A', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              ← Précédent
            </button>
          )}
          {idx < ressources.length - 1 ? (
            <button onClick={() => setIdx(i => i + 1)} style={{ flex: 1, padding: '14px', background: 'linear-gradient(135deg, #6B3A2A, #C4865A)', color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              Ressource suivante → ({idx + 2}/{ressources.length})
            </button>
          ) : (
            <button onClick={onStart} style={{ flex: 1, padding: '14px', background: 'linear-gradient(135deg, #0D9373, #0A7A5E)', color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 20px rgba(13,147,115,0.4)' }}>
              ✅ J'ai compris — Commencer les exercices !
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Rendu Markdown simplifié ─────────────────────────────────────
function MarkdownRenderer({ content }) {
  if (!content) return <p style={{ color: '#6B5744', fontStyle: 'italic' }}>Aucun contenu.</p>

  const lines = content.split('\n')
  const elements = []
  let codeBlock = []
  let inCode = false

  lines.forEach((line, i) => {
    if (line.startsWith('```')) {
      if (inCode) {
        elements.push(
          <pre key={i} style={{ background: '#1A1207', color: '#E2D8C8', padding: '16px', borderRadius: 10, overflowX: 'auto', fontSize: 13, lineHeight: 1.6, margin: '12px 0', fontFamily: 'monospace' }}>
            <code>{codeBlock.join('\n')}</code>
          </pre>
        )
        codeBlock = []; inCode = false
      } else { inCode = true }
      return
    }
    if (inCode) { codeBlock.push(line); return }

    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} style={{ fontSize: 15, fontWeight: 800, color: '#6B3A2A', margin: '20px 0 8px', borderLeft: '3px solid #C4865A', paddingLeft: 10 }}>{line.slice(4)}</h3>)
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} style={{ fontSize: 17, fontWeight: 800, color: '#3D1F13', margin: '24px 0 10px', paddingBottom: 6, borderBottom: '2px solid #F5EDE5' }}>{line.slice(3)}</h2>)
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} style={{ fontSize: 20, fontWeight: 900, color: '#3D1F13', margin: '0 0 16px' }}>{line.slice(2)}</h1>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <span style={{ color: '#C4865A', fontWeight: 900, flexShrink: 0 }}>•</span>
          <p style={{ fontSize: 14, color: '#1A1207', margin: 0, lineHeight: 1.7 }}>{renderInline(line.slice(2))}</p>
        </div>
      )
    } else if (/^\d+\. /.test(line)) {
      const num = line.match(/^(\d+)\. /)[1]
      elements.push(
        <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
          <span style={{ background: '#6B3A2A', color: 'white', width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0, marginTop: 2 }}>{num}</span>
          <p style={{ fontSize: 14, color: '#1A1207', margin: 0, lineHeight: 1.7 }}>{renderInline(line.replace(/^\d+\. /, ''))}</p>
        </div>
      )
    } else if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={i} style={{ borderLeft: '4px solid #D4A853', paddingLeft: 14, margin: '10px 0', background: '#FEF9E7', borderRadius: '0 8px 8px 0', padding: '10px 14px' }}>
          <p style={{ fontSize: 13, color: '#1A1207', margin: 0, fontStyle: 'italic', lineHeight: 1.6 }}>{line.slice(2)}</p>
        </blockquote>
      )
    } else if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: 8 }} />)
    } else {
      elements.push(<p key={i} style={{ fontSize: 14, color: '#1A1207', lineHeight: 1.8, margin: '0 0 6px' }}>{renderInline(line)}</p>)
    }
  })

  return <div>{elements}</div>
}

function renderInline(text) {
  // **gras** et `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 800, color: '#3D1F13' }}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} style={{ background: '#F5EDE5', color: '#6B3A2A', padding: '1px 6px', borderRadius: 5, fontSize: 13, fontFamily: 'monospace', fontWeight: 700 }}>{part.slice(1, -1)}</code>
    }
    return part
  })
}


/* ═══════════════════════════════════════════════════════════════ */
export default function Session() {
  const { uaId }   = useParams()
  const navigate   = useNavigate()
  const { user }   = useSelector(s => s.auth)
  const { mobile: isMobile, tablet } = useBreakpoint()
  const sessionIdRef = useRef(null)

  const [ua, setUA]               = useState(null)
  const [exercices, setExercices] = useState([])
  const [current, setCurrent]     = useState(0)
  const [reponse, setReponse]     = useState(null)
  const [resultat, setResultat]   = useState(null)
  const [indices, setIndices]     = useState(0)
  const [termine, setTermine]     = useState(false)
  const [scores, setScores]       = useState([])
  const [startTime]               = useState(Date.now())
  const [questionTime, setQuestionTime] = useState(Date.now())
  const [confetti, setConfetti]   = useState(false)
  const [adaptation, setAdaptation] = useState(null)
  const [showPanel, setShowPanel] = useState(false)
  const [showCameraBanner, setShowCameraBanner] = useState(false)

  const [engagementScore, setEngagementScore] = useState(0.85)
  const [emotion, setEmotion]   = useState('neutre')
  const [cameraActive, setCameraActive] = useState(false)
  const [audioActive,  setAudioActive]  = useState(false)
  const [niveauBruit,  setNiveauBruit]  = useState(0)
  const [bruitPerturb, setBruitPerturb] = useState(false)
  const [explicationIA, setExplicationIA] = useState(null)
  const [loadingIA,     setLoadingIA]     = useState(false)
  const [ressources, setRessources] = useState([])
  const [phase,      setPhase]      = useState('lecon')
  const [elapsedMin, setElapsedMin]       = useState(0)

  const videoRef    = useRef(null)
  const canvasRef   = useRef(null)
  const displayRef  = useRef(null)
  const faceMeshRef = useRef(null)
  const lastSendRef = useRef(0)
  const audioContextRef  = useRef(null)
  const analyserRef      = useRef(null)
  const audioIntervalRef = useRef(null)

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
setExercices(uaData.exercices || [])
const resos = uaData.ressources || []
setRessources(resos)
if (resos.length === 0) setPhase('exercices')
        const { data: sess } = await api.post('/api/cours/session/creer', { user_id: user.id, ua_id: uaId })
        sessionIdRef.current = sess.session_id
      } catch { toast.error('Erreur de chargement') }
    }
    init()
  }, [uaId, user.id])

  useEffect(() => {
    let timer = null
    function reset() {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const sid = sessionIdRef.current
        if (sid) api.post('/api/interaction', { session_id: sid, user_id: user.id, type: 'idle', data: { duration_seconds: 120 } }).catch(() => {})
      }, 120000)
    }
    const evts = ['mousedown', 'mousemove', 'keydown', 'scroll', 'click', 'touchstart']
    evts.forEach(e => window.addEventListener(e, reset)); reset()
    return () => { clearTimeout(timer); evts.forEach(e => window.removeEventListener(e, reset)) }
  }, [user.id])

  useEffect(() => () => {
    if (audioIntervalRef.current) clearInterval(audioIntervalRef.current)
    if (audioContextRef.current) audioContextRef.current.close()
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

  async function startCamera() {
    setShowCameraBanner(false)
    let attempts = 0
    while ((!window.FaceMesh || !window.Camera) && attempts < 10) {
      await new Promise(r => setTimeout(r, 500)); attempts++
    }
    if (!window.FaceMesh || !window.Camera) { toast.error('MediaPipe non disponible'); return }
    try {
      const fm = new window.FaceMesh({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` })
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
      audioIntervalRef.current = setInterval(() => {
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        const rms     = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length)
        const db      = Math.round(rms)
        const perturb = db > 60
        setNiveauBruit(db); setBruitPerturb(perturb)
        sendEvent('audio_analysis', { rms_level: db, db_normalise: Math.round(db / 1.28), bruit_perturb: perturb, contexte: perturb ? 'bruit_eleve' : 'calme' })
      }, 3000)
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
    const canvas = canvasRef.current; const video = videoRef.current
    if (!canvas || !video || !video.videoWidth || !video.videoHeight) return
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const display = displayRef.current
    if (display) {
      display.width = canvas.width; display.height = canvas.height
      display.getContext('2d').drawImage(canvas, 0, 0)
    }
    if (!results.multiFaceLandmarks?.length) {
      const now = Date.now()
      if (now - lastSendRef.current > 5000) {
        sendEvent('facial_analysis', { visual_score: 0.0, face_detected: false, emotion: 'absent' })
        lastSendRef.current = now
      }
      return
    }
    const lm    = results.multiFaceLandmarks[0]
    const ear   = (computeEAR(lm, [362, 385, 387, 263, 373, 380]) + computeEAR(lm, [33, 160, 158, 133, 153, 144])) / 2
    const yaw   = (lm[1].x - 0.5) * 180
    const pitch = (lm[1].y - lm[152].y) * 200
    let score   = 1.0
    if (ear < 0.15) score -= 0.5; else if (ear < 0.20) score -= 0.4; else if (ear < 0.25) score -= 0.2
    if (Math.abs(yaw) > 45) score -= 0.4; else if (Math.abs(yaw) > 30) score -= 0.3; else if (Math.abs(yaw) > 15) score -= 0.1
    if (Math.abs(pitch) > 30) score -= 0.2; else if (Math.abs(pitch) > 15) score -= 0.1
    score = Math.max(0, Math.min(1, score))
    const em = detecterEmotion(lm, ear, yaw, pitch)
    setEmotion(em)
    const now = Date.now()
    if (now - lastSendRef.current > 5000) {
      sendEvent('facial_analysis', { visual_score: Math.round(score * 100) / 100, ear: Math.round(ear * 100) / 100, yaw: Math.round(yaw), pitch: Math.round(pitch), face_detected: true, emotion: em })
      lastSendRef.current = now
    }
  }

  async function soumettre() {
    if (!reponse) { toast.error('Choisis une réponse'); return }
    const ex = exercices[current]
    const tempsReponse = Math.round((Date.now() - questionTime) / 1000)
    try {
      const { data } = await api.post('/api/cours/exercice/verifier', { exercice_id: ex.id, user_id: user.id, reponse })
      setResultat(data); setScores(prev => [...prev, data.points_gagnes])
      await sendEvent('response', { exercice_id: ex.id, correct: data.correct, time_seconds: tempsReponse, emotion })
      if (data.correct) toast.success(`+${data.points_gagnes} points !`)
    } catch { toast.error('Erreur de vérification') }
  }

  function suivant() {
    if (current + 1 >= exercices.length) {
      const r = scores.filter(s => s > 0).length + (resultat?.correct ? 1 : 0)
      if (Math.round(r / exercices.length * 100) >= 80) setConfetti(true)
      if (sessionIdRef.current) api.post(`/api/cours/session/clore/${sessionIdRef.current}`).catch(() => {})
      setTermine(true)
    } else {
      setCurrent(c => c + 1); setReponse(null); setResultat(null)
      setIndices(0); setAdaptation(null); setExplicationIA(null)
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
      })
      setExplicationIA(data.explication_ia)
    } catch { toast.error('Tuteur IA indisponible') }
    finally { setLoadingIA(false) }
  }

  /* ── Chargement ──────────────────────────────────────────── */
  if (!ua || exercices.length === 0) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.bg, gap: 12 }}>
      <Spinner size={44} />
      <p style={{ color: C.textSec, fontSize: 14, fontWeight: 600 }}>Chargement…</p>
    </div>
  )

   if (phase === 'lecon' && ua) {
    return <LeconReader ua={ua} ressources={ressources} onStart={() => setPhase('exercices')} />
  }

  /* ── Fin de session ──────────────────────────────────────── */
  if (termine) {
    const total = scores.length, reussis = scores.filter(s => s > 0).length
    const pct = total > 0 ? Math.round(reussis / total * 100) : 0
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        {confetti && <Confetti/>}
        <div style={{ backgroundColor: C.surface, borderRadius: 24, padding: isMobile ? 24 : 40, boxShadow: '0 8px 48px rgba(107,58,42,0.14)', border: `1px solid ${C.brownPale}`, maxWidth: 480, width: '100%', textAlign: 'center', animation: 'fadeUp .5s ease' }}>
          <div style={{ fontSize: isMobile ? 52 : 68, marginBottom: 10 }}>{pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '💪'}</div>
          <h2 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, color: C.brown, margin: '0 0 6px' }}>Session terminée !</h2>
          <p style={{ color: C.textSec, fontSize: 13, margin: '0 0 24px' }}>{ua.titre}</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Score',   value: `${pct}%`,            color: pct >= 80 ? C.emerald : C.brownLight, icon: <Award size={14}/> },
              { label: 'Réussis', value: `${reussis}/${total}`, color: C.brown,                              icon: <CheckCircle size={14}/> },
              { label: 'Durée',   value: `${elapsedMin}min`,    color: C.textSec,                            icon: <Clock size={14}/> },
            ].map(s => (
              <div key={s.label} style={{ backgroundColor: C.brownPale, borderRadius: 14, padding: '14px 8px' }}>
                <div style={{ color: s.color, marginBottom: 4, display: 'flex', justifyContent: 'center' }}>{s.icon}</div>
                <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: C.textSec, fontWeight: 600, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ backgroundColor: C.brownPale, borderRadius: 12, padding: 14, marginBottom: 20 }}>
            <p style={{ fontSize: 11, color: C.textSec, fontWeight: 600, margin: '0 0 4px' }}>Score d'engagement final</p>
            <p style={{ fontSize: isMobile ? 18 : 22, fontWeight: 900, color: engColor(engagementScore), margin: 0 }}>
              {Math.round(engagementScore * 100)}% — {engLabel(engagementScore)}
            </p>
            <p style={{ fontSize: 10, color: C.textSec, marginTop: 4, margin: '4px 0 0' }}>α·visuel + β·audio + γ·comportemental</p>
          </div>

          <button onClick={() => navigate('/dashboard')} style={{
            width: '100%', padding: '15px',
            background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
            color: 'white', border: 'none', borderRadius: 14,
            fontSize: 15, fontWeight: 800, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: `0 4px 20px ${C.brown}40`, minHeight: 52
          }}>
            <Home size={17}/> Tableau de bord
          </button>
        </div>
      </div>
    )
  }

  const ex = exercices[current]
  const diffStyle = {
    1: { bg: C.emeraldPale, color: C.emerald,   label: 'Facile' },
    2: { bg: '#FEF3C7',     color: '#92400E',    label: 'Moyen' },
    3: { bg: '#FEE2E2',     color: C.red,        label: 'Difficile' },
  }
  const ds = diffStyle[ex.difficulte] || diffStyle[1]
  const progressPct = ((current + (resultat ? 1 : 0)) / exercices.length) * 100
  const totalPts = scores.reduce((a, b) => a + b, 0)

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
            <div style={{ position: 'absolute', bottom: 6, left: 6, backgroundColor: C.emerald, borderRadius: 20, padding: '2px 8px', fontSize: 9, fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: 'white', animation: 'pulse 1.5s infinite' }}/>LIVE
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
                <span style={{ fontSize: 9, color: C.textSec }}>{Math.round(niveauBruit / 1.28)}%</span>
              </div>
              <div style={{ height: 3, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(100, Math.round(niveauBruit / 1.28))}%`, backgroundColor: bruitPerturb ? C.red : C.emerald, transition: 'width .5s ease' }}/>
              </div>
            </div>
          )}
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

      <style>{`
        @keyframes slideUp    { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shake      { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-4px)} 40%,80%{transform:translateX(4px)} }
      `}</style>

      {/* ── Header sticky ── */}
      <div style={{
        backgroundColor: C.surface, borderBottom: `1px solid ${C.brownPale}`,
        padding: `0 ${isMobile ? 12 : 24}px`, height: 58,
        display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16,
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 2px 12px rgba(107,58,42,0.07)'
      }}>
        {/* Bouton retour */}
        <button onClick={() => navigate('/dashboard')} style={{
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
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 5, backgroundColor: '#E5E7EB', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 5, backgroundColor: C.brown, width: `${progressPct}%`, transition: 'width .4s ease' }}/>
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
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: engColor(engagementScore), animation: 'pulse 2s infinite' }}/>
              <span style={{ fontSize: 13, fontWeight: 800, color: engColor(engagementScore) }}>{Math.round(engagementScore * 100)}%</span>
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

      {/* ── Bannière caméra mobile ── */}
      {isMobile && showCameraBanner && !cameraActive && (
        <CameraBanner
          onActivate={startBoth}
          onDismiss={() => setShowCameraBanner(false)}
        />
      )}

      {/* ── Body ── */}
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: `16px ${isMobile ? 12 : 20}px`, display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Bannière adaptation */}
          {adaptation && (
            <div style={{
              padding: '12px 14px', borderRadius: 12, marginBottom: 14,
              background: adaptation.priority === 'haute' ? '#FEF2F2' : '#FFFBEB',
              border: `1px solid ${adaptation.priority === 'haute' ? '#FCA5A5' : '#FDE68A'}`,
              animation: 'slideDown .3s ease', display: 'flex', gap: 10, alignItems: 'flex-start'
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{adaptation.priority === 'haute' ? '⚠️' : '💡'}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: adaptation.priority === 'haute' ? C.red : '#92400E', margin: '0 0 4px' }}>
                  {adaptation.message}
                </p>
                <button onClick={() => setAdaptation(null)} style={{ fontSize: 11, color: C.textSec, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                  Ignorer
                </button>
              </div>
            </div>
          )}

          {/* ── Carte question principale ── */}
          <div style={{
            backgroundColor: C.surface, borderRadius: isMobile ? 18 : 22,
            padding: isMobile ? '18px 16px' : '30px 32px',
            boxShadow: '0 3px 20px rgba(107,58,42,0.09)',
            border: `1px solid ${C.brownPale}`
          }}>
            {/* Méta badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
              <span style={{ backgroundColor: ds.bg, color: ds.color, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                {ds.label}
              </span>
              <span style={{ fontSize: 12, color: C.textSec, fontWeight: 600 }}>
                Q{current + 1}/{exercices.length}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: C.brownLight, fontWeight: 800, background: C.brownPale, padding: '4px 12px', borderRadius: 20 }}>
                {ex.points} pts
              </span>
            </div>

            {/* Énoncé */}
            <div style={{
              backgroundColor: C.brownPale, borderRadius: 14,
              padding: isMobile ? '14px 16px' : '18px 22px',
              marginBottom: 20, borderLeft: `4px solid ${C.brown}`
            }}>
              <p style={{ margin: 0, fontSize: isMobile ? 14 : 15, fontWeight: 700, color: C.text, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                {ex.enonce}
              </p>
            </div>

            {/* Options QCM */}
            {ex.type === 'qcm' && ex.options && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 10, marginBottom: 16 }}>
                {ex.options.map((opt, i) => (
                  <ExerciceOption key={i}
                    lettre={String.fromCharCode(65 + i)} texte={opt}
                    selected={reponse === opt}
                    correct={!!resultat && opt === resultat.reponse_correcte}
                    incorrect={!!resultat && reponse === opt && !resultat.correct}
                    onClick={() => !resultat && setReponse(opt)}/>
                ))}
              </div>
            )}

            {/* Texte à trous */}
            {ex.type === 'texte_trou' && (
              <input type="text" placeholder="Complète le texte…"
                value={reponse || ''} onChange={e => setReponse(e.target.value)} disabled={!!resultat}
                style={{ width: '100%', padding: '13px 16px', border: `1.5px solid ${C.brownPale}`, borderRadius: 10, fontSize: 14, marginBottom: 16, outline: 'none', boxSizing: 'border-box', backgroundColor: C.surface }}/>
            )}

            {/* Réponse libre */}
            {ex.type === 'reponse_libre' && (
              <textarea rows={3} placeholder="Écris ta réponse…"
                value={reponse || ''} onChange={e => setReponse(e.target.value)} disabled={!!resultat}
                style={{ width: '100%', padding: '13px 16px', border: `1.5px solid ${C.brownPale}`, borderRadius: 10, fontSize: 14, marginBottom: 16, outline: 'none', resize: 'vertical', boxSizing: 'border-box', backgroundColor: C.surface }}/>
            )}

            {/* Feedback résultat */}
            {resultat && (
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
                    <p style={{ margin: '0 0 5px', fontSize: 14, fontWeight: 800, color: resultat.correct ? C.emerald : C.red }}>
                      {resultat.correct ? 'Excellent ! ✓' : 'Pas tout à fait…'}
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: C.text, lineHeight: 1.6 }}>{resultat.explication}</p>
                    {!resultat.correct && (
                      <p style={{ fontSize: 13, color: C.emerald, margin: '7px 0 0' }}>
                        <strong>Bonne réponse :</strong> {resultat.reponse_correcte}
                      </p>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: `linear-gradient(135deg, ${C.brown}, ${C.gold})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🧠</div>
                              <span style={{ fontSize: 11, fontWeight: 800, color: C.brown }}>Tuteur EduSmart AI</span>
                            </div>
                            <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7, margin: 0 }}>{explicationIA}</p>
                            <button onClick={() => setExplicationIA(null)} style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: C.textSec, textDecoration: 'underline', padding: 0 }}>
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
              <button onClick={soumettre} disabled={!reponse} style={{
                width: '100%', padding: '15px',
                background: reponse ? `linear-gradient(135deg, ${C.brown}, ${C.brownLight})` : '#E5E7EB',
                color: reponse ? 'white' : C.textSec,
                border: 'none', borderRadius: 12,
                fontSize: isMobile ? 14 : 15, fontWeight: 800,
                cursor: reponse ? 'pointer' : 'not-allowed',
                boxShadow: reponse ? `0 4px 18px ${C.brown}35` : 'none',
                transition: 'all .2s ease', minHeight: 52
              }}>
                Valider ma réponse
              </button>
            ) : (
              <button onClick={suivant} style={{
                width: '100%', padding: '15px',
                background: `linear-gradient(135deg, ${C.emerald}, #0A7A5E)`,
                color: 'white', border: 'none', borderRadius: 12,
                fontSize: isMobile ? 14 : 15, fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: `0 4px 18px ${C.emerald}35`, minHeight: 52
              }}>
                {current + 1 >= exercices.length ? 'Terminer 🏁' : 'Suivant'}
                <ChevronRight size={16}/>
              </button>
            )}
          </div>

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