import { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  Camera, Lightbulb, CheckCircle, XCircle,
  ChevronRight, Home, ArrowLeft, Zap, Mic,
  X, Activity, Clock, Target, Award, Volume2, VolumeX,
  GripVertical, ChevronUp, ChevronDown
} from 'lucide-react'

import { useTheme } from '../../styles/theme.jsx'
import { AdinkraSymbol } from '../../components/adinkra/AdinkraSymbols.jsx'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { Spinner } from '../../components/Skeleton'
import RichText, { RichTextInline } from '../../components/RichText'
import { StaticContent } from '../../components/RichContent'
import { useEmotionOnnx, preloadEmotionModel } from '../../hooks/useEmotionOnnx'
import { useKWSModel } from '../../hooks/useKWSModel'
import { MODELS_READY, EMOTION_MODEL_READY } from '../../config/models'
import { clearCache } from '../../services/cache'
import useAlishaVoice from '../../hooks/useAlishaVoice'
import useAlishaController from '../../hooks/useAlishaController'
import { useSound } from '../../hooks/useSound'
import { AdaptationOrchestrator, useAdaptation } from '../../components/adaptation/index.js'

const Alisha = lazy(() => import('../../components/Alisha'))

/* ── Remappage palette ancienne → Bogolan (clair + sombre) ──────
   Évite de réécrire des centaines de styles : on remappe les tokens
   historiques (brown/emerald/gold/blue…) vers la palette Bogolan,
   en conservant tous les styles inline existants. */
function bogolanize(C) {
  return {
    ...C,
    brown:       C.bogolanTerre,
    brownDark:   C.bogolanText,
    brownMid:    C.bogolanOcre,
    brownLight:  C.bogolanOcre,
    brownPale:   `${C.bogolanTerre}14`,
    brownGhost:  `${C.bogolanTerre}0A`,
    emerald:     C.bogolanVert,
    emeraldDark: '#3C6749',
    emeraldPale: `${C.bogolanVert}1A`,
    gold:        C.bogolanOcre,
    goldPale:    `${C.bogolanOcre}1A`,
    orange:      C.bogolanOcre,
    accent:      C.bogolanOcre,
    blue:        C.bogolanIndigo,
    bluePale:    `${C.bogolanIndigo}16`,
    purple:      C.bogolanIndigo,
    purplePale:  `${C.bogolanIndigo}16`,
    red:         '#C0563A',
    redPale:     'rgba(192,86,58,0.12)',
    bg:          C.bogolanBg,
    surface:     C.bogolanSurface,
    surfaceAlt:  `${C.bogolanTerre}0A`,
    text:        C.bogolanText,
    textSec:     C.bogolanTextSec,
    textMuted:   C.bogolanTextSec,
    border:      C.bogolanBorder,
  }
}

/* ── Engagement helpers ──────────────────────────────────────── */
const engColor = (s, C) =>
  s >= 0.80 ? C.emerald : s >= 0.60 ? C.blue :
  s >= 0.40 ? C.orange  : s >= 0.20 ? C.red : C.red

const engLabel = s =>
  s >= 0.80 ? 'Élevé' : s >= 0.60 ? 'Modéré' :
  s >= 0.40 ? 'Faible' : s >= 0.20 ? 'Ennui' : 'Décroché'

// getETATS(C) — dynamique : s'adapte au mode clair/sombre via les tokens du thème
function getETATS(C) {
  return {
    engagement_eleve:  { label: '😊 Engagé',     color: C.emerald    },
    engagement_modere: { label: '🙂 Modéré',      color: C.blue       },
    engagement_faible: { label: '😐 Peu engagé',  color: C.orange     },
    confusion:         { label: '🤔 Confusion',   color: C.orange     },
    frustration:       { label: '😤 Frustration', color: C.red        },
    ennui:             { label: '😴 Ennui',        color: C.textSec    },
    neutre:            { label: '😐 Neutre',       color: C.brownLight },
    decrochage:        { label: '⚠️ Décroché',    color: C.red        },
  }
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
  const { C: _Craw } = useTheme(); const C = bogolanize(_Craw)
  const ETATS = getETATS(C)   // dynamique — suit le thème courant
  const color = engColor(score, C)
  const em = ETATS[emotion] || ETATS.neutre

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: `conic-gradient(${color} ${score * 360}deg, ${C.border} 0deg)`,
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
const ExerciceOption = ({ lettre, texte, selected, correct, incorrect, answered, onClick }) => {
  const { C: _Craw } = useTheme(); const C = bogolanize(_Craw)
  const [hov, setHov] = useState(false)
  const interactive = !answered
  // États visuels
  let bg = C.surface, border = `1.5px solid ${C.border}`, textColor = C.text
  let lBg = `${C.bogolanTerre}1A`, lColor = C.bogolanTerre
  let dim = false
  if (selected && !correct && !incorrect) {
    bg = `${C.bogolanTerre}12`; border = `2px solid ${C.bogolanTerre}`
    textColor = C.bogolanTerre; lBg = C.bogolanTerre; lColor = 'white'
  }
  if (correct)   { bg = `${C.bogolanVert}1A`; border = `2px solid ${C.bogolanVert}`; textColor = C.bogolanVert; lBg = C.bogolanVert; lColor = 'white' }
  if (incorrect) { bg = C.redPale;            border = `2px solid ${C.red}`;        textColor = C.red;          lBg = C.red;        lColor = 'white' }
  if (answered && !correct && !incorrect && !selected) dim = true  // options écartées

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => interactive && setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', padding: '13px 15px', backgroundColor: bg,
        border: interactive && hov && !selected ? `2px solid ${C.bogolanTerre}66` : border,
        borderRadius: 14, cursor: interactive ? 'pointer' : 'default',
        textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
        transition: 'all .16s ease', color: textColor, minHeight: 52,
        transform: interactive && hov ? 'translateY(-2px)' : 'none',
        boxShadow: interactive && hov ? `0 6px 16px ${C.bogolanTerre}1F` : 'none',
        opacity: dim ? 0.5 : 1,
        textDecoration: incorrect ? 'line-through' : 'none',
      }}
    >
      <span style={{
        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
        backgroundColor: lBg, color: lColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 900
      }}>{lettre}</span>
      <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5, flex: 1 }}><RichTextInline text={texte}/></span>
      {correct   && <CheckCircle size={18} color={C.bogolanVert} style={{ flexShrink: 0, animation: 'popIn .3s ease' }}/>}
      {incorrect && <XCircle     size={18} color={C.red}         style={{ flexShrink: 0, animation: 'popIn .3s ease' }}/>}
    </button>
  )
}

/* ── Confetti ────────────────────────────────────────────────── */
const CONFETTI_COLORS = ['#6B3A2A', '#C4865A', '#0D9373', '#D4A853', '#FCD34D', '#EC4899', '#60A5FA', '#A78BFA', '#34D399', '#F87171']
const CONFETTI_PIECES = Array.from({ length: 28 }, (_, i) => {
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

/* ── Dialog Alisha — choix caméra / audio ────────────────────── */
const AlishaPermissionDialog = ({ onChoice, C, xs }) => {
  const CHOICES = [
    { id: 'both',   icon: '🎥', label: 'Caméra + Audio',    color: C.brown,   gradient: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})` },
    { id: 'camera', icon: '📷', label: 'Caméra seulement',  color: C.blue,    gradient: `linear-gradient(135deg, ${C.blue}, #3B82F6)` },
    { id: 'audio',  icon: '🎤', label: 'Audio seulement',   color: C.emerald, gradient: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDark})` },
    { id: 'none',   icon: '✕',  label: 'Non merci',         color: C.textSec, gradient: 'none' },
  ]

  return (
    <>
      {/* Fond semi-transparent léger — ne bloque pas la vue */}
      <div onClick={() => onChoice('none')} style={{
        position: 'fixed', inset: 0, zIndex: 299,
        background: 'rgba(0,0,0,.25)',
        animation: 'fadeIn .2s ease',
      }}/>

      {/* Bottom sheet compact — monte du bas */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 300,
        background: C.surface,
        borderRadius: '20px 20px 0 0',
        padding: xs ? '16px 16px 28px' : '18px 24px 28px',
        boxShadow: '0 -8px 32px rgba(0,0,0,.25)',
        border: `1px solid ${C.border}`,
        borderBottom: 'none',
        animation: 'slideUp .3s cubic-bezier(.2,.8,.4,1)',
        maxWidth: 560,
        margin: '0 auto',
      }}>
        {/* Poignée */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 14px' }}/>

        {/* En-tête compact : Alisha inline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <Suspense fallback={null}>
            <Alisha state="welcome" size={44}/>
          </Suspense>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 900, color: C.brown }}>
              Activer l'analyse IA ?
            </p>
            <p style={{ margin: 0, fontSize: 11, color: C.textSec, lineHeight: 1.4 }}>
              Je surveille ton attention pour adapter les exercices.
            </p>
          </div>
        </div>

        {/* Boutons en grille 2×2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {CHOICES.map(c => (
            <button
              key={c.id}
              onClick={() => onChoice(c.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px',
                background: c.id === 'none' ? C.bg : c.gradient,
                border: `1.5px solid ${c.id === 'none' ? C.border : 'transparent'}`,
                borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                boxShadow: c.id !== 'none' ? `0 3px 12px ${c.color}25` : 'none',
                transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '.88' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>{c.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0, fontSize: 12, fontWeight: 800,
                  color: c.id === 'none' ? C.textSec : 'white',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {c.label}
                </p>
                <p style={{
                  margin: 0, fontSize: 11,
                  color: c.id === 'none' ? C.textMuted : 'rgba(255,255,255,.75)',
                  lineHeight: 1.3,
                }}>
                  {c.desc}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}


// LECON READER

function LeconReader({ ua, ressources, onStart, onResourceView }) {
  const { C: _Craw } = useTheme(); const C = bogolanize(_Craw)
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
    resume:  { icon: '📋', label: 'Résumé',   color: C.blue   },
    video:   { icon: '🎬', label: 'Vidéo',    color: C.purple },
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

        {/* U4 — Alisha accueil leçon : uniquement sur la première ressource */}
        {idx === 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 22 }}>
            <Suspense fallback={null}>
              <Alisha state="welcome" size={56} />
            </Suspense>
            <div style={{
              background: C.surface, border: `1.5px solid ${C.brownPale}`,
              borderRadius: '14px 14px 14px 0', padding: '10px 14px',
              fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.5, maxWidth: 260,
              boxShadow: '0 2px 10px rgba(107,58,42,0.07)',
            }}>
              Lis attentivement cette leçon — je t'attendrai pour les exercices ! 📖✨
            </div>
          </div>
        )}

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

        {/* Contenu principal — StaticContent (même renderer que CoursDetail) */}
        <div style={{ background: C.surface, borderRadius: 16, padding: '24px 28px', border: `1px solid ${C.border}`, boxShadow: '0 2px 16px rgba(107,58,42,0.07)', marginBottom: 20 }}>
          <StaticContent data={{ contenu: res?.contenu || '' }} C={C} />
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
            <button onClick={() => { logAndGo(idx); onStart() }} style={{ flex: 1, padding: '14px', background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDark})`, color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 4px 20px ${C.emerald}40` }}>
              Commencer →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}



/* ── Sons de feedback + fanfare de fin ───────────────────────────
   Web Audio API synthétisé — aucune dépendance externe          */

// Normalisation front-end pour comparaison des réponses (accents, casse)
function _normaliserFront(s) {
  if (s == null) return ''
  return String(s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Fanfare jouée dès que la session se termine, indépendamment du TTS.
// ≥80% : accord majeur montant joyeux. <80% : mélodie d'encouragement.
function playEndFanfare(pct) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (pct >= 80) {
      // Accord majeur ascendant + note de couronne
      [[523, 0, 'sine', .28], [659, .14, 'sine', .25], [784, .28, 'sine', .22],
       [1047, .44, 'sine', .30], [1319, .56, 'triangle', .22]].forEach(([freq, t, type, vol]) => {
        const osc = ctx.createOscillator(), g = ctx.createGain()
        osc.type = type; osc.frequency.value = freq
        g.gain.setValueAtTime(0, ctx.currentTime + t)
        g.gain.linearRampToValueAtTime(vol, ctx.currentTime + t + .06)
        g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + t + .55)
        osc.connect(g); g.connect(ctx.destination)
        osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + .6)
      })
    } else {
      // Mélodie encourageante (3 notes montantes douces)
      [[440, 0], [523, .22], [587, .44]].forEach(([freq, t]) => {
        const osc = ctx.createOscillator(), g = ctx.createGain()
        osc.type = 'sine'; osc.frequency.value = freq
        g.gain.setValueAtTime(0, ctx.currentTime + t)
        g.gain.linearRampToValueAtTime(.18, ctx.currentTime + t + .05)
        g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + t + .45)
        osc.connect(g); g.connect(ctx.destination)
        osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + .5)
      })
    }
  } catch {}
}

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

/* ── Sélection vocale déléguée à useAlishaVoice ─────────────────
   La sélection locale (getBestFrenchVoice + voiceschanged) a été
   supprimée : elle entrait en conflit avec le lockedRef du hook
   et causait des changements de voix aléatoires en ligne.
   Tout TTS passe maintenant par l'API unifiée tts() ↓             */

/* ═══════════════════════════════════════════════════════════════ */
export default function Session() {
  const { C: _Craw } = useTheme(); const C = bogolanize(_Craw)
  const ETATS = getETATS(C)   // recalculé à chaque render — suit le thème courant
  const { playSound } = useSound()
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
  const [ordreUser, setOrdreUser] = useState([])          // ordre_elements
  const [corrPairs, setCorrPairs] = useState({})          // correspondance {gauche: droite}
  const [selectedGauche, setSelectedGauche] = useState(null) // correspondance — sélection en cours
  const [droitesMelangees, setDroitesMelangees] = useState([]) // correspondance — colonne droite mélangée
  const [resultat, setResultat]   = useState(null)
  const [indices, setIndices]     = useState(0)
  const [termine, setTermine]     = useState(false)
  // Son de feedback doux à la correction (réussite / erreur)
  const lastSoundRef = useRef(null)
  useEffect(() => {
    if (!resultat) { lastSoundRef.current = null; return }
    const sig = `${current}:${resultat.correct}`
    if (lastSoundRef.current === sig) return
    lastSoundRef.current = sig
    playSound(resultat.correct ? 'success' : 'error')
  }, [resultat, current, playSound])
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
  // Auto-lecture de l'énoncé à chaque nouvelle question — OFF par défaut
  const [autoRead,       setAutoRead]       = useState(
    () => localStorage.getItem('alisha_auto_read') === 'on'
  )
  const [noiseAdaptatif, setNoiseAdaptatif] = useState(null)  // null|'eleve'|'tres_eleve'
  const [picModal,       setPicModal]       = useState(false)
  const [vadSpeech,      setVadSpeech]      = useState(false) // parole active détectée
  const [answerFlash,    setAnswerFlash]    = useState(null)  // null|'correct'|'wrong'
  const [feedbackMsg,    setFeedbackMsg]    = useState('')    // message aléatoire de feedback
  const [bktHistory,     setBktHistory]     = useState({})   // { compétence: {pourcentage,color,label} } — accumulé à chaque réponse
  const [isLeaving,      setIsLeaving]      = useState(false) // true pendant la sortie animée de la carte question

  const videoRef         = useRef(null)
  const canvasRef          = useRef(null)
  const displayRef         = useRef(null)
  const faceMeshRef        = useRef(null)
  const cameraStartingRef  = useRef(false)   // guard anti double-appel startCamera()
  const lastSendRef        = useRef(0)
  const earBufferRef     = useRef([])
  const termineeRef      = useRef(false)
  const cnnEmotionRef    = useRef({ emotion: null, probs: null })  // dernière détection CNN (face-api.js ou ONNX)
  const triedExercices   = useRef(new Set())                       // first_attempt tracking
  // Métriques pour le moteur d'adaptation
  const nbResponsesRef   = useRef(0)
  const erreursRef       = useRef(0)
  const consErrMacroRef  = useRef(0)
  const lastMacroRef     = useRef(null)
  const reussitesMacroRef= useRef(0)
  const recentTimesRef   = useRef([])
  const engHistRef       = useRef([])
  const lowEngStreakRef   = useRef(0)

  // ── Modèles ONNX africains ───────────────────────────────────────
  const { predict: predictEmotionOnnx } = useEmotionOnnx()
  const { lastKeyword }                 = useKWSModel(audioActive)
  const { speak: _alishaSpeak, stop: _stopAlisha, edgeVoice, setPreferredVoice, edgeAvailable, systemVoiceName } = useAlishaVoice()

  const alishaCtrl = useAlishaController({
    speakFn:      _alishaSpeak,
    stopFn:       _stopAlisha,
    engagement:   { score: engagementScore, emotion },
    bkt:          resultat?.bkt ?? null,
    streak,
    studentName:  user?.prenom ?? null,
    answerFlash,
    loadingIA,
    explicationIA,
  })
  const { currentAdaptation, evaluate, dismiss } = useAdaptation()
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
    // Réponses TTS aux commandes vocales
    if (lastKeyword.keyword === 'aide') {
      tts('Je t\'envoie une explication.')
    }
    if (lastKeyword.keyword === 'repeter') {
      // Annonce puis relit effectivement l'énoncé (après ~2s pour laisser finir la phrase)
      const _enonce = exercices[current]?.enonce
      tts('Je répète la question.')
      if (_enonce) setTimeout(() => tts(_enonce), 2000)
    }
    if (lastKeyword.keyword === 'lentement') {
      // Relit l'énoncé à vitesse réduite 0.65 (au lieu de juste dire "D'accord")
      const _enonce = exercices[current]?.enonce
      tts('D\'accord, je vais plus lentement.')
      if (_enonce) setTimeout(() => tts(_enonce, 0.65), 2200)
    }
  }, [lastKeyword])

  /* Afficher le dialog caméra 4s après le chargement (tous appareils) */
  useEffect(() => {
    if (cameraActive || audioActive) return
    const t = setTimeout(() => setShowCameraBanner(true), 4000)
    return () => clearTimeout(t)
  }, [cameraActive, audioActive])

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

  // Initialise les états des nouveaux types à chaque changement d'exercice
  useEffect(() => {
    const ex = exercices[current]
    if (!ex) return
    if (ex.type === 'ordre_elements' && Array.isArray(ex.options) && ex.options.length) {
      setOrdreUser([...ex.options])
      setReponse(JSON.stringify(ex.options))
    } else if (ex.type === 'correspondance' && Array.isArray(ex.options) && ex.options.length) {
      setCorrPairs({})
      setSelectedGauche(null)
      setReponse(null)
      const droites = ex.options.filter((_, i) => i % 2 !== 0)
      const shuffled = [...droites]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      setDroitesMelangees(shuffled)
    }
  }, [current, exercices])

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

  // ── TTS unifié — délègue à useAlishaVoice (voix verrouillée, stable en ligne) ──
  // Plus de getBestFrenchVoice ni de voiceschanged local : tout passe par le hook.
  const tts = useCallback((text, rate) => {
    if (!text) return
    _alishaSpeak(text, {
      rate:    rate ?? ttsRate,
      onStart: () => setSpeaking(true),
      onEnd:   () => setSpeaking(false),
      onError: () => setSpeaking(false),
    })
  }, [_alishaSpeak, ttsRate])

  const stopTts = useCallback(() => {
    _stopAlisha()
    setSpeaking(false)
  }, [_stopAlisha])

  // Auto-lecture de l'énoncé quand le bruit devient perturbateur
  useEffect(() => {
    if (bruitPerturb && phase === 'exercices' && !resultat) {
      const enonce = exercices[current]?.enonce
      if (enonce) tts(enonce)
    }
  }, [bruitPerturb]) // eslint-disable-line react-hooks/exhaustive-deps

  // U1 — Auto-lecture de l'énoncé à chaque nouvelle question (accessibilité)
  // Délai 900ms : laisse l'animation slideInRight se terminer avant de parler
  useEffect(() => {
    if (phase !== 'exercices' || !autoRead) return
    const ex = exercices[current]
    if (!ex?.enonce) return
    // Pour les exercices APC (JSON encodé), lire contexte + consigne
    const textToRead = ex.enonce.startsWith('__APC__')
      ? (() => {
          try { const d = JSON.parse(ex.enonce.slice(7)); return (d.contexte || '') + '. ' + (d.consigne || '') }
          catch { return ex.enonce }
        })()
      : ex.enonce
    const t = setTimeout(() => tts(textToRead), 900)
    return () => clearTimeout(t)
  }, [current, phase]) // eslint-disable-line react-hooks/exhaustive-deps

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
    // Fanfare immédiate (Web Audio, ne dépend pas du backend)
    playEndFanfare(pct)
    // Stocke les deux timeouts pour les annuler si l'utilisateur quitte avant leur déclenchement
    const ttsId = setTimeout(() => alishaCtrl.triggerEvent('session_complete', { pct }), 600)
    let startTs = null
    const anim = (ts) => {
      if (!startTs) startTs = ts
      const prog = Math.min((ts - startTs) / 1400, 1)
      const eased = 1 - Math.pow(1 - prog, 3)
      setDisplayPct(Math.round(eased * pct))
      if (prog < 1) requestAnimationFrame(anim)
    }
    const id = setTimeout(() => requestAnimationFrame(anim), 250)
    return () => { clearTimeout(id); clearTimeout(ttsId) }
  }, [termine])

  async function startCamera() {
    // Guard : empêche les appels concurrents (re-render, bouton double-clic)
    // qui créeraient plusieurs instances FaceMesh et téléchargeraient les
    // packed assets plusieurs fois → crash lors d'une connexion instable.
    if (cameraActive || cameraStartingRef.current) return
    cameraStartingRef.current = true

    setShowCameraBanner(false)

    // ── Détection réseau lent (3G/2G africain) ────────────────────
    // Sur réseau lent, MediaPipe WASM (~10 MB) prendrait 40-80s → on réduit la résolution
    // et on n'utilise pas refineLandmarks (économise ~30% du temps de traitement)
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    const slowNet = conn && (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g'
                             || conn.downlink < 1.5)
    const camW = slowNet ? 160 : 320
    const camH = slowNet ? 120 : 240

    let attempts = 0
    while ((!window.FaceMesh || !window.Camera) && attempts < 10) {
      await new Promise(r => setTimeout(r, 500)); attempts++
    }
    if (!window.FaceMesh || !window.Camera) { toast.error('MediaPipe non disponible'); return }
    try {
      // Fichiers MediaPipe depuis public/mediapipe/face_mesh/ (Netlify + dev, sans détour proxy)
      const fm = new window.FaceMesh({ locateFile: f => `/mediapipe/face_mesh/${f}` })
      fm.setOptions({
        maxNumFaces:           1,
        refineLandmarks:       !slowNet,  // désactivé sur réseau lent (−30% CPU)
        minDetectionConfidence: slowNet ? 0.6 : 0.5,
        minTrackingConfidence:  slowNet ? 0.6 : 0.5,
      })
      fm.onResults(onFaceResults)
      faceMeshRef.current = fm
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: camW, height: camH, frameRate: slowNet ? 10 : 24 }
      })
      videoRef.current.srcObject = stream
      const cam = new window.Camera(videoRef.current, {
        onFrame: async () => {
          if (!faceMeshRef.current || !videoRef.current) return
          if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) return
          try { await faceMeshRef.current.send({ image: videoRef.current }) } catch {}
        },
        width: camW, height: camH,
      })
      await cam.start()
      await new Promise(r => setTimeout(r, slowNet ? 500 : 1000))
      setCameraActive(true)
      toast.success(slowNet ? 'Caméra activée (mode économique) ✓' : 'Analyse visuelle activée ✓')

      // Précharge ONNX 4s après MediaPipe — évite la compétition WASM
      setTimeout(preloadEmotionModel, 4000)

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
    finally { cameraStartingRef.current = false }
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
      const { data } = await api.post('/api/cours/exercice/verifier', {
        exercice_id: ex.id, user_id: user.id, reponse,
        session_id: sid,   // lie la progression à la session → jointure directe engagement DKT
      })
      const msg = pickRandom(data.correct ? MSG_CORRECT : MSG_WRONG)
      setResultat({ ...data, msg })
      // Accumule la progression BKT par compétence pour l'affichage fin de session
      if (data.bkt?.competence) {
        setBktHistory(prev => ({
          ...prev,
          [data.bkt.competence]: { pourcentage: data.bkt.pourcentage, color: data.bkt.color, label: data.bkt.label },
        }))
      }
      setFeedbackMsg(msg)
      setScores(prev => [...prev, data.points_gagnes])
      playFeedback(data.correct)
      setAnswerFlash(data.correct ? 'correct' : 'wrong')
      alishaCtrl.triggerEvent(data.correct ? 'correct' : 'wrong', {
        bkt:       data.bkt ?? null,
        streak:    data.correct ? streak + 1 : 0,
        hintsUsed: indices,
      })
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

      // ── Métriques adaptation ────────────────────────────────────
      nbResponsesRef.current += 1
      if (!data.correct) erreursRef.current += 1
      const _exMacro = ex.kcs?.[0] ?? ex.competence_evaluee ?? null
      if (data.correct) {
        consErrMacroRef.current = 0
        reussitesMacroRef.current = _exMacro === lastMacroRef.current ? reussitesMacroRef.current + 1 : 1
      } else {
        consErrMacroRef.current = _exMacro === lastMacroRef.current ? consErrMacroRef.current + 1 : 1
        reussitesMacroRef.current = 0
      }
      lastMacroRef.current = _exMacro
      const _rt = recentTimesRef.current; _rt.push(tempsReponse); if (_rt.length > 5) _rt.shift()
      const _eh = engHistRef.current; _eh.push(engagementScore); if (_eh.length > 5) _eh.shift()
      if (engagementScore < 0.4) lowEngStreakRef.current += 1; else lowEngStreakRef.current = 0
      const _nextEx = exercices[current + 1]
      evaluate({
        session_id: sid,
        engagement: { fused: engagementScore, etat: emotion },
        metrics: {
          duree_session_sec:               Math.round((Date.now() - startTime) / 1000),
          nb_responses:                    nbResponsesRef.current,
          nb_correct:                      scores.filter(s => s > 0).length + (data.correct ? 1 : 0),
          erreurs_consecutives_macro_kc:   consErrMacroRef.current,
          erreurs_session:                 erreursRef.current,
          reussites_consecutives:          data.correct ? streak + 1 : 0,
          reussites_consecutives_macro_kc: reussitesMacroRef.current,
          low_engagement_streak:           lowEngStreakRef.current,
          temps_reponses_recents:          [...recentTimesRef.current],
          temps_moyen_profil:              recentTimesRef.current.length > 0
            ? Math.round(recentTimesRef.current.reduce((a, b) => a + b, 0) / recentTimesRef.current.length)
            : 60,
          engagement_recent_5:             [...engHistRef.current],
        },
        current_macro_kc:  _exMacro ?? undefined,
        current_exercise:  _nextEx ? { id: _nextEx.id, difficulte: _nextEx.difficulte ?? 1, macro_kc: _nextEx.kcs?.[0] ?? _nextEx.competence_evaluee ?? undefined } : undefined,
      }).catch(() => {})

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
    // U3 — Animation de sortie avant de charger la question suivante
    setIsLeaving(true)
    setTimeout(() => {
      setIsLeaving(false)
      if (current + 1 >= exercices.length) {
        const r = scores.filter(s => s > 0).length
        if (exercices.length > 0 && Math.round(r / exercices.length * 100) >= 50) setConfetti(true)
        if (sessionIdRef.current) {
          termineeRef.current = true
          api.post(`/api/cours/session/clore/${sessionIdRef.current}`).catch(() => {})
        }
        clearCache('dashboard_' + user.id)
        // Marque le défi du jour comme accompli
        localStorage.setItem(`sti_defi_${new Date().toDateString()}`, 'done')
        const nb = exercices.length
        const xpGagnes = 20 + (r * 10) + (nb > 0 && r / nb >= 0.8 ? 50 : 0) + (nb > 0 && r === nb ? 50 : 0)
        api.post('/api/gamification/award-xp', { user_id: user.id, xp_gagnes: xpGagnes, session_terminee: true, nb_exercices: nb, nb_corrects: r }).catch(() => {}).then(() => window.__refreshXPBar?.())
        setTermine(true)
      } else {
        setCurrent(c => c + 1); setReponse(null); setResultat(null); setBlanks([]); setActiveBlank(null)
        setOrdreUser([]); setCorrPairs({}); setSelectedGauche(null); setDroitesMelangees([])
        setIndices(0); setAdaptation(null); setExplicationIA(null); setIaHistory([]); setRessourceAide(null)
        setAnswerFlash(null); setFeedbackMsg('')
        setQuestionTime(Date.now())
      }
    }, 240)
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
    const grade = pct >= 90 ? { emoji: '🏆', label: 'Excellent !',       bg: `linear-gradient(135deg,${C.gold},${C.brownMid})`,   anim: 'goldGlow 2s ease infinite' }
                : pct >= 70 ? { emoji: '🌟', label: 'Très bien !',        bg: `linear-gradient(135deg,${C.emerald},${C.emeraldDark})`, anim: undefined }
                : pct >= 50 ? { emoji: '👍', label: 'Bien joué !',        bg: `linear-gradient(135deg,${C.brown},${C.brownLight})`,    anim: undefined }
                :             { emoji: '💪', label: 'Continue comme ça !', bg: `linear-gradient(135deg,${C.purple},${C.purple}CC)`,    anim: undefined }

    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto', position: 'relative' }}>
        {confetti && <Confetti/>}
        {/* Filigrane Adinkra (reflet) */}
        <div aria-hidden="true" style={{ position: 'fixed', right: -50, bottom: -40, opacity: 0.05, pointerEvents: 'none', zIndex: 0, transform: 'rotate(-8deg)' }}>
          <AdinkraSymbol id="adinkrahene" size={isMobile ? 300 : 480} color={C.bogolanTerre} />
        </div>
        <div style={{ maxWidth: 520, width: '100%', animation: 'fadeUp .5s ease', position: 'relative', zIndex: 1 }}>

          {/* ── Carte principale ── */}
          <div style={{ backgroundColor: C.surface, borderRadius: 24, padding: isMobile ? '24px 20px' : '36px 40px', boxShadow: '0 8px 48px rgba(107,58,42,0.14)', border: `1px solid ${C.brownPale}`, textAlign: 'center', marginBottom: 14 }}>

            {/* ── Hero : Alisha remplace l'emoji ── */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ animation: 'trophyPop .65s cubic-bezier(.22,1,.36,1) .1s both' }}>
                <Suspense fallback={<div style={{ width: 110, height: 130 }} />}>
                  <Alisha
                    state={pct >= 90 ? 'excited' : pct >= 70 ? 'correct' : pct >= 50 ? 'welcome' : 'idle'}
                    size={isMobile ? 90 : 110}
                  />
                </Suspense>
              </div>
              <span style={{
                background: grade.bg, color: 'white',
                fontWeight: 900, fontSize: isMobile ? 15 : 17,
                padding: '6px 22px', borderRadius: 30,
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                animation: grade.anim || 'scaleIn .4s ease .35s both',
                display: 'inline-block',
              }}>{grade.emoji} {grade.label}</span>
              <p style={{ color: C.textSec, fontSize: 12, margin: 0 }}>{ua.titre}</p>
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
                      background: s > 0 ? C.emeraldPale : C.redPale,
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
                  background: `linear-gradient(135deg, ${C.red}, ${C.red}CC)`,
                  color: 'white', border: 'none', borderRadius: 14,
                  fontSize: isMobile ? 13 : 14, fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48,
                  boxShadow: `0 4px 16px ${C.red}59`
                }}>
                  🔁 Revoir les {rateesIds.length} question{rateesIds.length > 1 ? 's' : ''} ratée{rateesIds.length > 1 ? 's' : ''}
                </button>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button onClick={() => navigate(`/cours/${uaId}`, { state: { from: 'session' } })} style={{
                  padding: '13px', background: C.brownPale,
                  color: C.brown, border: `1.5px solid ${C.brownLight}40`,
                  borderRadius: 14, fontSize: isMobile ? 13 : 14, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48
                }}>
                  <ArrowLeft size={15}/> Retour au cours
                </button>
                <button onClick={() => { setTermine(false); setCurrent(0); setReponse(null); setResultat(null); setScores([]); setIndices(0); setAdaptation(null); setExplicationIA(null); setConfetti(false); setStreak(0); setDisplayPct(0); setBlanks([]); setActiveBlank(null); setOrdreUser([]); setCorrPairs({}); setSelectedGauche(null); setDroitesMelangees([]); setBktHistory({}); setIsLeaving(false) }} style={{
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
    2: { bg: C.goldPale,    color: C.brownDark,  label: 'Moyen',     icon: '🟡' },
    3: { bg: C.redPale,     color: C.red,        label: 'Difficile', icon: '🔴' },
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
  const isOrdreElements  = ex.type === 'ordre_elements'
  const isCorrespondance = ex.type === 'correspondance'
  const isIdentErreur    = ex.type === 'identification_erreur'
  const corrGauches      = isCorrespondance ? (ex.options || []).filter((_, i) => i % 2 === 0) : []
  const MASCOT = {
    engagement_eleve:'🦁', engagement_modere:'🐘', engagement_faible:'🐢',
    confusion:'🤔', frustration:'🐆', ennui:'😴', neutre:'🦉', decrochage:'⚠️',
  }
  const mascot = MASCOT[emotion] || '🦉'

  // ── État Alisha — délégué au contrôleur (BKT + engagement + diversifiers) ──
  const { alishaState, alishaBubble } = alishaCtrl

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
                <div style={{ backgroundColor: C.purple, borderRadius: 20, padding: '2px 8px', fontSize: 9, fontWeight: 800, color: 'white' }}>
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
            <button onClick={startAudio} style={{ padding: '9px', background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDark})`, color: 'white', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 38 }}>
              <Mic size={13}/> Activer le micro
            </button>
          ) : (
            <div style={{ backgroundColor: bruitPerturb ? C.redPale : C.emeraldPale, borderRadius: 9, padding: '7px 10px', border: `1px solid ${bruitPerturb ? C.red : C.emerald}30` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: bruitPerturb ? C.red : C.emerald }}>
                  {bruitPerturb ? '🔊 Bruit élevé' : '🎤 Ambiance calme'}
                </span>
                <span style={{ fontSize: 9, color: C.textSec }}>{Math.min(100, Math.round(niveauBruit * 100 / 128))}%</span>
              </div>
              <div style={{ height: 3, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(100, Math.round(niveauBruit * 100 / 128))}%`, backgroundColor: bruitPerturb ? C.red : C.emerald, transition: 'width .5s ease' }}/>
              </div>
              {/* Indicateur VAD */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: vadSpeech ? C.emerald : C.border,
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: .5, margin: 0 }}>Lecture vocale</p>
            <button
              onClick={() => {
                const next = !autoRead
                setAutoRead(next)
                localStorage.setItem('alisha_auto_read', next ? 'on' : 'off')
                if (!next) stopTts()
              }}
              title={autoRead ? "Désactiver la lecture automatique des questions" : "Activer la lecture automatique des questions"}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, border: `1px solid ${autoRead ? C.brown : C.border}`, background: autoRead ? C.brownPale : 'transparent', cursor: 'pointer', fontSize: 9, fontWeight: 800, color: autoRead ? C.brown : C.textMuted, transition: 'all .15s' }}>
              <span style={{ width: 18, height: 10, borderRadius: 5, background: autoRead ? C.brown : C.border, display: 'inline-block', position: 'relative', transition: 'background .15s', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: 1, left: autoRead ? 9 : 1, width: 8, height: 8, borderRadius: '50%', background: 'white', transition: 'left .15s', display: 'block' }}/>
              </span>
              Auto
            </button>
          </div>
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
          {/* Sélecteur voix Alisha — toujours visible */}
          <div style={{ display: 'flex', gap: 4, marginTop: 7, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: C.textMuted, alignSelf: 'center', margin: 0, whiteSpace: 'nowrap' }}>Voix :</p>
            {[
              { id: 'denise',   label: 'Denise', disabled: false },
              { id: 'vivienne', label: 'Henri',  disabled: false },
              { id: 'system',   label: systemVoiceName ? '💻 Sys' : '💻 Sys', disabled: !window.speechSynthesis },
            ].map(v => (
              <button key={v.id} onClick={() => !v.disabled && setPreferredVoice(v.id)}
                title={v.id === 'denise' ? 'Denise (Neural FR)' : v.id === 'vivienne' ? 'Henri (Neural FR)' : `Voix système${systemVoiceName ? ` : ${systemVoiceName}` : ''}`}
                style={{ padding: '4px 6px', borderRadius: 6, border: `1px solid ${edgeVoice === v.id ? C.brown : C.border}`, cursor: v.disabled ? 'default' : 'pointer', fontSize: 10, fontWeight: edgeVoice === v.id ? 800 : 600, background: edgeVoice === v.id ? C.brownPale : 'transparent', color: edgeVoice === v.id ? C.brown : v.disabled ? C.border : C.textMuted, opacity: v.disabled ? 0.4 : 1, transition: 'all .15s' }}>
                {v.label}
              </button>
            ))}
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
    <div style={{ minHeight: '100vh', background: C.bg, position: 'relative' }}>
      {/* Filigrane Adinkra en fond (reflet, faible opacité) */}
      <div aria-hidden="true" style={{ position: 'fixed', right: isMobile ? -60 : -40, bottom: isMobile ? 40 : -30, opacity: 0.045, pointerEvents: 'none', zIndex: 0, transform: 'rotate(-8deg)' }}>
        <AdinkraSymbol id="adinkrahene" size={isMobile ? 280 : 460} color={C.bogolanTerre} />
      </div>
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
        <button onClick={() => navigate(`/cours/${uaId}`, { state: { from: 'session' } })} style={{
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
                    : i === current ? C.brown : C.border,
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

      {/* ── Dialog Alisha — choix caméra/audio (tous appareils) ── */}
      {showCameraBanner && !cameraActive && !audioActive && (
        <AlishaPermissionDialog
          C={C}
          xs={xs}
          onChoice={async (choice) => {
            setShowCameraBanner(false)
            if (choice === 'both')   await startBoth()
            if (choice === 'camera') await startCamera()
            if (choice === 'audio')  await startAudio()
            // 'none' → ferme juste le dialog
          }}
        />
      )}

      {/* ── Body ── */}
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: `${xs ? 10 : 16}px ${xs ? 8 : isMobile ? 12 : 20}px`, display: 'flex', gap: 20, alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
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

          {/* Moteur d'adaptation comportementale */}
          <AdaptationOrchestrator
            adaptation={currentAdaptation}
            onDismiss={(actionType) => dismiss(actionType)}
          />

          {/* ── Carte question principale ── */}
          {/* U3 — slideOutLeft à la sortie, slideInRight à l'entrée */}
          <div key={current} style={{ animation: isLeaving ? 'slideOutLeft .24s ease forwards' : 'slideInRight .28s ease' }}>
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
              {/* U2 — Alisha réactive (size augmenté pour meilleure visibilité) */}
              <Suspense fallback={<span style={{ fontSize:26 }}>{mascot}</span>}>
                <div style={{ flexShrink: 0, marginBottom: -8 }}>
                  <Alisha state={alishaState} size={64} />
                </div>
              </Suspense>
              {/* Bulle contextuelle */}
              {alishaBubble && (
                <div style={{
                  background:    C.goldPale,
                  border:       `1.5px solid ${C.accent}`,
                  borderRadius:  10,
                  padding:      '5px 11px',
                  fontSize:      11,
                  fontWeight:    700,
                  color:        C.brownDark,
                  maxWidth:      180,
                  lineHeight:    1.4,
                  animation:    'slideDown .25s ease',
                }}>
                  {alishaBubble}
                </div>
              )}
              {/* Streak badge */}
              {streak >= 2 && !resultat && (
                <div style={{ display:'flex', alignItems:'center', gap:3, background:C.goldPale, borderRadius:20, padding:'2px 9px', border:`1.5px solid ${C.gold}60`, animation:'streakPop .35s cubic-bezier(.22,1,.36,1)' }}>
                  <span style={{ fontSize:13, animation:'pulse 1.2s infinite' }}>🔥</span>
                  <span style={{ fontSize:10, fontWeight:800, color:C.brownDark }}>{streak} série</span>
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
                <div style={{ background: C.bluePale, border: `1.5px solid ${C.blue}40`, borderRadius: 14, padding: isMobile ? '14px' : '18px 20px', marginBottom: 10 }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: C.blue, textTransform: 'uppercase', letterSpacing: .5, margin: '0 0 8px' }}>📋 Situation-problème</p>
                  <p style={{ margin: 0, fontSize: isMobile ? 13 : 14, color: C.text, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{apcData.contexte}</p>
                </div>
                {apcData.ressources && (
                  <div style={{ background: C.emeraldPale, border: `1px solid ${C.emerald}40`, borderRadius: 10, padding: '10px 14px', marginBottom: 8, display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 13, flexShrink: 0 }}>📚</span>
                    <p style={{ margin: 0, fontSize: 12, color: C.emerald, lineHeight: 1.7 }}><strong>Ressources :</strong> {apcData.ressources}</p>
                  </div>
                )}
                <div style={{ background: C.brownPale, borderRadius: 12, padding: isMobile ? '12px 14px' : '14px 18px', borderLeft: `4px solid ${C.brown}`, position: 'relative' }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: C.brown, textTransform: 'uppercase', letterSpacing: .5, margin: '0 0 6px' }}>🎯 Consigne</p>
                  <p style={{ margin: 0, fontSize: isMobile ? 13 : 14, fontWeight: 600, color: C.text, lineHeight: 1.8, whiteSpace: 'pre-wrap', paddingRight: 36 }}>{apcData.consigne}</p>
                  <button onClick={() => speaking ? stopTts() : tts(apcData.contexte + '\n' + apcData.consigne)}
                    style={{ position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: '50%', background: speaking ? C.red : C.brown, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                    {speaking ? <VolumeX size={14} color="white"/> : <Volume2 size={14} color="white"/>}
                  </button>
                </div>
                {apcData.criteres && (
                  <div style={{ marginTop: 8, background: C.goldPale, border: `1px solid ${C.gold}50`, borderRadius: 10, padding: '8px 14px' }}>
                    <p style={{ margin: 0, fontSize: 11, color: C.brownDark, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
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
                  {speaking ? <VolumeX size={14} color="white"/> : <Volume2 size={14} color="white"/>}
                </button>
              </div>
            ) : null}

            {/* Image schéma (identification) */}
            {isIdentification && identImgUrl && (
              <div style={{ marginBottom: 16, textAlign: 'center' }}>
                <img src={identImgUrl} alt="Schéma à identifier"
                  style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 12, border: `2px solid ${C.blue}40`, boxShadow: '0 4px 16px rgba(0,0,0,.1)', display: 'block', margin: '0 auto' }} />
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
                  const accent = isOk ? C.bogolanVert : isKo ? C.red : isSel ? C.bogolanTerre : C.bogolanTextSec
                  const Icon   = isV ? CheckCircle : XCircle
                  return (
                    <button key={i} onClick={() => !resultat && setReponse(opt)} style={{
                      padding: isMobile ? '20px 10px' : '28px 16px',
                      borderRadius:18, cursor: resultat ? 'default' : 'pointer',
                      border: `2.5px solid ${isOk ? C.bogolanVert : isKo ? C.red : isSel ? C.bogolanTerre : C.border}`,
                      background: isOk ? `${C.bogolanVert}1A` : isKo ? C.redPale : isSel ? `${C.bogolanTerre}12` : C.surface,
                      transition:'all .18s ease',
                      transform: isSel && !resultat ? 'scale(1.04)' : 'scale(1)',
                      boxShadow: isSel && !resultat ? `0 8px 22px ${C.bogolanTerre}2E` : 'none',
                      display:'flex', flexDirection:'column', alignItems:'center', gap:10,
                      animation: isOk ? 'popIn .35s ease' : undefined,
                    }}>
                      <span style={{
                        width: isMobile ? 50 : 62, height: isMobile ? 50 : 62, borderRadius:'50%',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        background: (isOk || isKo || isSel) ? accent : `${C.bogolanTextSec}1A`,
                        color: (isOk || isKo || isSel) ? 'white' : accent,
                        transition:'all .18s ease',
                      }}>
                        <Icon size={isMobile ? 26 : 34} />
                      </span>
                      <span style={{ fontSize: isMobile ? 17 : 20, fontWeight:900, color: accent }}>
                        {opt}
                      </span>
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
                    answered={!!resultat}
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
                    {speaking ? <VolumeX size={14} color="white"/> : <Volume2 size={14} color="white"/>}
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
                                ? (isCorrectSlot ? C.emeraldPale : C.redPale)
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
                          background: isPlaced ? C.border : (activeBlank !== null ? C.brown + '15' : C.surface),
                          color: isPlaced ? C.textSec : C.text,
                          border:`2px solid ${isPlaced ? C.border : (activeBlank !== null ? C.brown : C.brownPale)}`,
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
                          background: resultat.correct ? C.emeraldPale : C.redPale,
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

            {/* ── Ordre des éléments ── */}
            {isOrdreElements && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: .6, margin: '0 0 10px' }}>
                  {resultat ? 'Ordre soumis' : 'Remets ces étapes dans l\'ordre correct :'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ordreUser.map((item, i) => {
                    const correctOrder = (() => { try { return JSON.parse(resultat?.reponse_correcte || '[]') } catch { return [] } })()
                    const isCorrect = !!resultat && _normaliserFront(item) === _normaliserFront(correctOrder[i])
                    return (
                      <div key={item + i} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: resultat ? (isCorrect ? `${C.bogolanVert}1A` : C.redPale) : C.surface,
                        border: `2px solid ${resultat ? (isCorrect ? C.bogolanVert : C.red) + '66' : C.border}`,
                        borderRadius: 14, padding: '10px 12px', transition: 'all .2s',
                        boxShadow: resultat ? 'none' : `0 2px 8px ${C.bogolanTerre}10`,
                      }}>
                        {!resultat && <GripVertical size={16} color={C.bogolanTextSec} style={{ flexShrink: 0, opacity: .6 }} />}
                        <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: resultat ? (isCorrect ? C.bogolanVert : C.red) : `linear-gradient(135deg, ${C.bogolanTerre}, ${C.bogolanOcre})`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>{i + 1}</span>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: resultat ? (isCorrect ? C.bogolanVert : C.red) : C.text, lineHeight: 1.4 }}>{item}</span>
                        {!resultat && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
                            <button aria-label="Monter" onClick={() => {
                              if (i === 0) return
                              const arr = [...ordreUser];
                              [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]
                              setOrdreUser(arr); setReponse(JSON.stringify(arr))
                            }} disabled={i === 0} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 22, borderRadius: 7, background: i === 0 ? 'transparent' : `${C.bogolanTerre}14`, border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: C.bogolanTerre, opacity: i === 0 ? 0.25 : 1 }}><ChevronUp size={15} /></button>
                            <button aria-label="Descendre" onClick={() => {
                              if (i === ordreUser.length - 1) return
                              const arr = [...ordreUser];
                              [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
                              setOrdreUser(arr); setReponse(JSON.stringify(arr))
                            }} disabled={i === ordreUser.length - 1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 22, borderRadius: 7, background: i === ordreUser.length - 1 ? 'transparent' : `${C.bogolanTerre}14`, border: 'none', cursor: i === ordreUser.length - 1 ? 'default' : 'pointer', color: C.bogolanTerre, opacity: i === ordreUser.length - 1 ? 0.25 : 1 }}><ChevronDown size={15} /></button>
                          </div>
                        )}
                        {resultat && (isCorrect
                          ? <CheckCircle size={16} color={C.bogolanVert} style={{ flexShrink: 0 }}/>
                          : <XCircle    size={16} color={C.red}     style={{ flexShrink: 0 }}/>)}
                      </div>
                    )
                  })}
                </div>
                {resultat && !resultat.correct && (() => {
                  const arr = (() => { try { return JSON.parse(resultat.reponse_correcte) } catch { return [] } })()
                  return arr.length ? (
                    <div style={{ marginTop: 10, background: C.emeraldPale, borderRadius: 10, padding: '8px 14px', border: `1px solid ${C.emerald}30` }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.emerald }}>
                        ✅ Ordre correct : {arr.join(' → ')}
                      </p>
                    </div>
                  ) : null
                })()}
              </div>
            )}

            {/* ── Correspondance ── */}
            {isCorrespondance && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: .6, margin: '0 0 12px' }}>
                  {resultat ? 'Résultat' : 'Relie chaque élément à sa correspondance :'}
                </p>
                {selectedGauche && !resultat && (
                  <p style={{ fontSize: 12, color: C.brown, fontWeight: 700, margin: '0 0 8px', background: C.brownPale, padding: '6px 12px', borderRadius: 8 }}>
                    « {selectedGauche} » sélectionné — clique sur sa correspondance →
                  </p>
                )}
                <div style={{ display: 'flex', gap: isMobile ? 8 : 12 }}>
                  {/* Colonne gauche */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {corrGauches.map((gauche) => {
                      const paired = corrPairs[gauche]
                      const isSel = selectedGauche === gauche
                      const correctPairs = (() => { try { return JSON.parse(resultat?.reponse_correcte || '[]') } catch { return [] } })()
                      const correctDroite = correctPairs.find(p => p[0] === gauche)?.[1]
                      const isOk = !!resultat && paired && _normaliserFront(paired) === _normaliserFront(correctDroite)
                      const isKo = !!resultat && paired && !isOk
                      return (
                        <button key={gauche} onClick={() => {
                          if (resultat) return
                          setSelectedGauche(isSel ? null : gauche)
                        }} style={{
                          padding: '9px 12px', borderRadius: 10, textAlign: 'left',
                          background: resultat ? (isOk ? C.emeraldPale : isKo ? C.redPale : C.surface) : (isSel ? C.brown : paired ? C.brownPale : C.surface),
                          color: resultat ? (isOk ? C.emerald : isKo ? C.red : C.text) : (isSel ? 'white' : C.text),
                          border: `2px solid ${resultat ? (isOk ? C.emerald : isKo ? C.red : C.brownPale) + '80' : (isSel ? C.brown : paired ? C.brown + '50' : C.brownPale)}`,
                          fontSize: isMobile ? 12 : 13, fontWeight: 700, cursor: resultat ? 'default' : 'pointer',
                          transition: 'all .15s', lineHeight: 1.4,
                        }}>
                          {gauche}
                          {paired && !resultat && <span style={{ fontSize: 10, color: isSel ? 'rgba(255,255,255,.7)' : C.textSec, marginLeft: 4 }}>↔ {paired}</span>}
                          {resultat && (isOk ? <CheckCircle size={14} color={C.emerald} style={{ marginLeft: 4, verticalAlign: 'middle' }}/> : isKo ? <XCircle size={14} color={C.red} style={{ marginLeft: 4, verticalAlign: 'middle' }}/> : null)}
                        </button>
                      )
                    })}
                  </div>
                  {/* Colonne droite (mélangée) */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {droitesMelangees.map((droite) => {
                      const alreadyUsed = Object.values(corrPairs).includes(droite)
                      const correctPairs = (() => { try { return JSON.parse(resultat?.reponse_correcte || '[]') } catch { return [] } })()
                      const expectedGauche = correctPairs.find(p => p[1] === droite)?.[0]
                      const actualGauche = Object.entries(corrPairs).find(([, d]) => d === droite)?.[0]
                      const isOk = !!resultat && expectedGauche && actualGauche && _normaliserFront(actualGauche) === _normaliserFront(expectedGauche)
                      const isKo = !!resultat && actualGauche && !isOk
                      const isUnmatched = !!resultat && !actualGauche
                      return (
                        <button key={droite} onClick={() => {
                          if (resultat || !selectedGauche) return
                          const newPairs = { ...corrPairs, [selectedGauche]: droite }
                          setCorrPairs(newPairs)
                          setSelectedGauche(null)
                          const allPaired = corrGauches.every(g => newPairs[g])
                          setReponse(allPaired ? JSON.stringify(Object.entries(newPairs)) : null)
                        }} style={{
                          padding: '9px 12px', borderRadius: 10, textAlign: 'left',
                          background: resultat ? (isOk ? C.emeraldPale : isKo ? C.redPale : C.surface) : (alreadyUsed ? C.brownPale : selectedGauche ? C.brown + '12' : C.surface),
                          color: resultat ? (isOk ? C.emerald : isKo ? C.red : C.textSec) : C.text,
                          border: `2px solid ${resultat ? (isOk ? C.emerald : isKo ? C.red : C.brownPale) + '80' : (selectedGauche ? C.brown : C.brownPale)}`,
                          fontSize: isMobile ? 12 : 13, fontWeight: 700,
                          cursor: resultat ? 'default' : (selectedGauche ? 'pointer' : 'default'),
                          opacity: !resultat && !selectedGauche && alreadyUsed ? 0.5 : isUnmatched ? 0.6 : 1,
                          textDecoration: !resultat && alreadyUsed ? 'line-through' : 'none',
                          transition: 'all .15s', lineHeight: 1.4,
                        }}>
                          {droite}
                          {resultat && (isOk ? <CheckCircle size={14} color={C.emerald} style={{ marginLeft: 4, verticalAlign: 'middle' }}/> : isKo ? <XCircle size={14} color={C.red} style={{ marginLeft: 4, verticalAlign: 'middle' }}/> : null)}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {!reponse && !resultat && corrGauches.length > 0 && (
                  <p style={{ fontSize: 11, color: C.textSec, margin: '8px 0 0' }}>
                    {Object.keys(corrPairs).length}/{corrGauches.length} paires faites
                  </p>
                )}
              </div>
            )}

            {/* ── Identification d'erreur ── */}
            {isIdentErreur && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: .6, margin: '0 0 10px' }}>
                  {resultat ? 'Résultat' : 'Identifie l\'étape incorrecte :'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(ex.options || []).map((step, i) => {
                    const isSel = reponse === step
                    const isTheError = !!resultat && _normaliserFront(step) === _normaliserFront(resultat.reponse_correcte)
                    const userWasWrong = !!resultat && !resultat.correct && isSel
                    return (
                      <button key={i} onClick={() => !resultat && setReponse(step)} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '11px 14px', borderRadius: 12, textAlign: 'left',
                        background: resultat
                          ? (isTheError ? C.redPale : C.surface)
                          : (isSel ? C.red + '18' : C.surface),
                        border: `2px solid ${resultat
                          ? (isTheError ? C.red + '80' : C.brownPale + '50')
                          : (isSel ? C.red : C.brownPale)}`,
                        cursor: resultat ? 'default' : 'pointer',
                        opacity: resultat && !isTheError && !userWasWrong ? 0.5 : 1,
                        transition: 'all .15s',
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 900, color: C.textSec, minWidth: 56, flexShrink: 0, marginTop: 1 }}>Étape {i + 1}</span>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: isTheError && resultat ? C.red : C.text, lineHeight: 1.5 }}>{step}</span>
                        {resultat && isTheError && <XCircle size={16} color={C.red} style={{ flexShrink: 0 }}/>}
                        {userWasWrong && !isTheError && <XCircle size={16} color={C.red + '80'} style={{ flexShrink: 0 }}/>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Feedback résultat — En attente (réponse libre) */}
            {resultat?.en_attente && (
              <div style={{ background: C.goldPale, border: `1.5px solid ${C.gold}50`, borderRadius: 14, padding: '14px 16px', marginBottom: 16, animation: 'slideDown .3s ease' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>⏳</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 800, color: C.brownDark }}>
                      Réponse soumise — en attente de correction
                    </p>
                    <p style={{ margin: '0 0 10px', fontSize: 13, color: C.brownDark, lineHeight: 1.6 }}>
                      {resultat.msg}
                    </p>
                    {/* Réponse modèle pour auto-évaluation */}
                    <div style={{ background: C.goldPale, borderRadius: 10, padding: '10px 14px', borderLeft: `4px solid ${C.gold}` }}>
                      <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 800, color: C.brownDark, textTransform: 'uppercase', letterSpacing: .5 }}>
                        📋 Réponse modèle (auto-évaluation)
                      </p>
                      <p style={{ margin: 0, fontSize: 13, color: C.text, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                        {resultat.reponse_correcte}
                      </p>
                    </div>
                    {resultat.explication && (
                      <p style={{ margin: '8px 0 0', fontSize: 12, color: C.brownDark, lineHeight: 1.6 }}>
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
                backgroundColor: resultat.correct ? C.emeraldPale : C.redPale,
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
                          <div style={{ flex: 1, height: 5, background: C.border, borderRadius: 5, overflow: 'hidden' }}>
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
                            background: loadingIA ? C.border : `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
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
                            background: `linear-gradient(135deg, ${C.brownPale}, ${C.goldPale})`,
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
                                <RichText text={explicationIA} style={{ fontSize: 13, lineHeight: 1.7, margin: '4px 0 0' }} />
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
                  <div style={{ backgroundColor: C.goldPale, borderRadius: 12, padding: 14, border: `1px solid ${C.gold}30`, animation: 'slideDown .3s ease' }}>
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
                  : C.border,
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
                background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDark})`,
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