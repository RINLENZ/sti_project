import { useSelector } from 'react-redux'
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  BookOpen, Clock, Target, Award, Flame, Copy, CheckCircle,
  ChevronRight, Brain, Star, ChevronDown, Lock, PlayCircle,
  CheckCircle2, Zap, BarChart2, TrendingUp
} from 'lucide-react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Tooltip
} from 'recharts'
import { C, useTheme } from '../../styles/theme.jsx'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { SkDashboard } from '../../components/Skeleton'

/* ─── Helpers ──────────────────────────────────────────────────── */
const BKTLevel = p => {
  if (p >= 95) return { label: 'Maîtrisé',      color: C.emerald,  bg: C.emeraldPale }
  if (p >= 70) return { label: 'En bonne voie', color: '#2563eb',  bg: '#EFF6FF'     }
  if (p >= 40) return { label: 'En progrès',    color: C.orange,   bg: '#FFFBEB'     }
  return              { label: 'À renforcer',    color: C.red,      bg: '#FEF2F2'     }
}

const UAStatus = pct => {
  if (pct === 100) return { icon: CheckCircle2, color: C.emerald,     label: 'Terminé'      }
  if (pct > 0)     return { icon: PlayCircle,   color: C.brownLight,  label: 'En cours'     }
  return                  { icon: Lock,          color: C.textMuted,   label: 'Non commencé' }
}

/* ─── Sub-components ────────────────────────────────────────────── */

/* ── XP Ring SVG (hero) ── */
const XPRing = ({ pct, size = 72, stroke = 7 }) => {
  const r      = (size - stroke) / 2
  const circ   = 2 * Math.PI * r
  const offset = circ - (Math.min(100, Math.max(0, pct)) / 100) * circ
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="white" strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size > 65 ? 16 : 13, fontWeight: 900, color: 'white', lineHeight: 1 }}>{Math.round(pct)}</span>
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>%</span>
      </div>
    </div>
  )
}

/* ── Parcours visuel — strip compact ── */
const PathVisual = ({ modulesFamilles, progression }) => {
  const { C } = useTheme()
  if (!modulesFamilles.length) return null

  const nodes = modulesFamilles.map(({ module, familles }) => {
    const totalUA = familles.reduce((a, f) => a + (f.unites || []).length, 0)
    const doneUA  = familles.reduce((a, f) => a + (f.unites || []).filter(ua => {
      const ex = (progression?.details || []).filter(d => d.correct && String(d.ua_id) === String(ua.id)).length
      return ua.nb_exercices > 0 && ex >= ua.nb_exercices
    }).length, 0)
    const started = familles.some(f => (f.unites || []).some(ua =>
      (progression?.details || []).some(d => String(d.ua_id) === String(ua.id))
    ))
    const done = doneUA === totalUA && totalUA > 0
    return { module, done, started }
  })

  const doneCount = nodes.filter(n => n.done).length

  return (
    <div style={{ marginBottom: 14, animation: 'fadeUp .48s ease' }}>
      {/* Ligne titre + barre */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <TrendingUp size={12} color={C.brown} />
        <span style={{ fontSize: 11, fontWeight: 700, color: C.textSec }}>Parcours</span>
        <span style={{ fontSize: 10, color: C.textMuted }}>{doneCount}/{nodes.length}</span>
        <div style={{ flex: 1, height: 2, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${nodes.length > 0 ? (doneCount / nodes.length) * 100 : 0}%`, background: C.brown, transition: 'width .9s ease' }} />
        </div>
      </div>
      {/* Dots de modules */}
      <div style={{ overflowX: 'auto', paddingBottom: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 'max-content' }}>
          {nodes.map(({ module, done, started }, i) => (
            <div key={module.id} style={{ display: 'flex', alignItems: 'center' }}>
              <div
                title={module.titre || `Module ${module.numero}`}
                style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  background: done
                    ? `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDark})`
                    : started ? `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`
                    : C.brownGhost,
                  border: `2px solid ${done ? C.emeraldDark : started ? C.brown : C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: done || started ? 'white' : C.textMuted,
                  fontSize: done ? 13 : 11, fontWeight: 800,
                  boxShadow: done ? `0 2px 8px ${C.emerald}40` : started ? `0 2px 8px ${C.brown}30` : 'none',
                  cursor: 'default', flexShrink: 0,
                }}
              >
                {done ? '✓' : i + 1}
              </div>
              {i < nodes.length - 1 && (
                <div style={{ width: 16, height: 2, background: done ? C.emerald : C.border, flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const ProgressBar = ({ value, color, h = 5, bg }) => {
  const { C } = useTheme()
  const col = color ?? C.emerald
  const bgCol = bg ?? C.border
  return (
    <div style={{ height: h, backgroundColor: bgCol, borderRadius: h, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${Math.min(100, Math.max(0, value))}%`,
        backgroundColor: col, borderRadius: h, transition: 'width .7s cubic-bezier(.4,0,.2,1)'
      }} />
    </div>
  )
}

const StatCard = ({ label, value, subtitle, color, Icon, xs }) => {
  const { C } = useTheme()
  return (
  <div style={{
    backgroundColor: C.surface, borderRadius: xs ? 12 : 14,
    padding: xs ? '12px 13px' : '15px 17px',
    boxShadow: '0 1px 8px rgba(107,58,42,0.07)',
    border: `1px solid ${C.border}`,
    display: 'flex', flexDirection: 'column', gap: 3,
    position: 'relative', overflow: 'hidden',
  }}>
    <div style={{
      position: 'absolute', bottom: -16, right: -16,
      width: 64, height: 64, borderRadius: '50%',
      backgroundColor: `${color}10`, pointerEvents: 'none'
    }} />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5 }}>{label}</span>
      {Icon && (
        <div style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={13} color={color} />
        </div>
      )}
    </div>
    <span style={{ fontSize: xs ? 19 : 23, fontWeight: 900, color: C.text, lineHeight: 1, letterSpacing: -.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    {subtitle && <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</span>}
  </div>
  )
}

/* ── UA compact card ── */
const UACard = ({ ua, pct, isReco, onClick }) => {
  const { C } = useTheme()
  const st = UAStatus(pct)
  const StatusIcon = st.icon
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
        backgroundColor: hov ? C.brownPale : isReco ? C.emeraldPale : C.surfaceAlt,
        border: isReco ? `1.5px solid ${C.emerald}40` : `1px solid ${C.border}`,
        transition: 'all .18s ease',
        boxShadow: hov ? '0 4px 14px rgba(107,58,42,0.1)' : 'none',
        transform: hov ? 'translateY(-1px)' : 'none',
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <StatusIcon size={16} color={st.color} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
          {isReco && <span style={{ fontSize: 9 }}>⭐</span>}
          <span style={{ fontSize: 8, fontWeight: 700, color: C.brownLight, textTransform: 'uppercase', letterSpacing: .5 }}>
            {ua.reference_ue}
          </span>
        </div>
        <p style={{
          fontSize: 12, fontWeight: 700, color: C.text, margin: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3,
        }}>{ua.titre}</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: C.textMuted }}>
            <Clock size={9} />{ua.duree_estimee}min
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: C.textMuted }}>
            <BookOpen size={9} />{ua.nb_exercices} exos
          </span>
        </div>
        {pct > 0 && pct < 100 && (
          <div style={{ marginTop: 5 }}>
            <ProgressBar value={pct} color={C.brown} h={3} />
          </div>
        )}
      </div>

      <button
        onClick={e => { e.stopPropagation(); onClick() }}
        style={{
          flexShrink: 0, padding: '5px 10px',
          background: pct === 100
            ? `${C.emerald}15`
            : isReco
            ? `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDark})`
            : `linear-gradient(135deg, ${C.brown}, ${C.brownMid})`,
          color: pct === 100 ? C.emerald : 'white',
          border: 'none', borderRadius: 7, fontSize: 10, fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
          whiteSpace: 'nowrap',
          boxShadow: pct === 100 ? 'none' : '0 2px 8px rgba(107,58,42,0.2)',
        }}
      >
        {pct === 100 ? 'Revoir' : pct > 0 ? 'Continuer' : 'Commencer'}
        <ChevronRight size={10} />
      </button>
    </div>
  )
}

/* ── Famille collapsible ── */
const FamilleSection = ({ famille, progression, recommandee, navigate, defaultOpen }) => {
  const { C } = useTheme()
  const [open, setOpen] = useState(defaultOpen)
  const doneFam = (famille.unites || []).filter(ua => {
    const ex = (progression?.details || []).filter(d => d.correct && String(d.ua_id) === String(ua.id)).length
    return ua.nb_exercices > 0 && ex >= ua.nb_exercices
  }).length
  const totalFam = (famille.unites || []).length

  return (
    <div style={{ marginBottom: 6 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 8px', background: 'none', border: 'none', cursor: 'pointer',
          borderRadius: 8,
        }}
      >
        <ChevronDown size={13} color={C.brownLight} style={{ transform: open ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform .2s ease', flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: C.textSec, textAlign: 'left', flex: 1 }}>{famille.titre}</span>
        <span style={{ fontSize: 10, color: C.textMuted, flexShrink: 0 }}>
          {doneFam}/{totalFam} UA
        </span>
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '2px 4px 4px 20px' }}>
          {(famille.unites || []).map(ua => {
            const exReussis = (progression?.details || []).filter(d => d.correct && String(d.ua_id) === String(ua.id)).length
            const pct = ua.nb_exercices > 0 ? Math.round(exReussis / ua.nb_exercices * 100) : 0
            return (
              <UACard
                key={ua.id}
                ua={ua}
                pct={pct}
                isReco={recommandee?.ua_id === ua.id}
                onClick={() => navigate(`/cours/${ua.id}`)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Module accordion ── */
const ModuleAccordion = ({ module, familles, progression, recommandee, navigate }) => {
  const { C } = useTheme()
  const totalUA = familles.reduce((a, f) => a + (f.unites || []).length, 0)
  const doneUA = familles.reduce((a, f) => a + (f.unites || []).filter(ua => {
    const ex = (progression?.details || []).filter(d => d.correct && String(d.ua_id) === String(ua.id)).length
    return ua.nb_exercices > 0 && ex >= ua.nb_exercices
  }).length, 0)
  const hasStarted = familles.some(f => (f.unites || []).some(ua => {
    const ex = (progression?.details || []).filter(d => String(d.ua_id) === String(ua.id)).length
    return ex > 0
  }))
  const pctModule = totalUA > 0 ? Math.round(doneUA / totalUA * 100) : 0
  const [open, setOpen] = useState(hasStarted || familles.length > 0 && doneUA < totalUA)
  const progressColor = pctModule === 100 ? C.emerald : pctModule > 0 ? C.brown : C.border

  return (
    <div style={{
      backgroundColor: C.surface, borderRadius: 14,
      border: `1px solid ${C.border}`,
      boxShadow: '0 2px 12px rgba(107,58,42,0.06)',
      overflow: 'hidden', marginBottom: 10,
    }}>
      {/* Header module */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
          backgroundColor: open ? C.surfaceAlt : 'transparent',
          transition: 'background .15s',
        }}
      >
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: `linear-gradient(135deg, ${C.brownDark}, ${C.brown})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
        }}>
          📘
        </div>

        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          {/* FIX : utilise module.titre au lieu de module.nom */}
          <p style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {module?.titre || `Module ${module?.numero || ''}`}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, maxWidth: 120 }}>
              <ProgressBar value={pctModule} color={progressColor} h={4} />
            </div>
            <span style={{ fontSize: 10, color: C.textMuted, flexShrink: 0, fontWeight: 600 }}>
              {doneUA}/{totalUA} UA
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {pctModule === 100 && (
            <span style={{ background: C.emeraldPale, color: C.emerald, fontSize: 9, fontWeight: 800, padding: '3px 7px', borderRadius: 20 }}>
              Terminé
            </span>
          )}
          {!hasStarted && pctModule === 0 && totalUA > 0 && (
            <span style={{ background: C.brownPale, color: C.brownLight, fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 20 }}>
              Non commencé
            </span>
          )}
          <ChevronDown size={15} color={C.brownLight} style={{ transform: open ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform .2s ease' }} />
        </div>
      </button>

      {open && (
        <div style={{ padding: '8px 12px 12px', borderTop: `1px solid ${C.border}` }}>
          {familles.length === 0 ? (
            <p style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic', padding: '8px 4px' }}>
              Aucune famille de situations — contenu en cours de préparation.
            </p>
          ) : (
            familles.map((famille, idx) => (
              <FamilleSection
                key={famille.id}
                famille={famille}
                progression={progression}
                recommandee={recommandee}
                navigate={navigate}
                defaultOpen={idx === 0 && hasStarted}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Helpers date/durée ───────────────────────────────────────── */
const fmtDureeS = s => { if (!s) return '—'; const m = Math.floor(s / 60), sec = s % 60; return `${m}:${String(sec).padStart(2, '0')}` }
const fmtDate   = iso => iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'

/* ─── Définition badges (calculée à partir des stats) ──────────── */
const buildBadges = stats => [
  { id: 'premier_pas',       emoji: '🚀', label: 'Premier pas',       unlocked: stats?.nb_tentatives >= 1   },
  { id: 'studieux',          emoji: '📚', label: 'Studieux',           unlocked: stats?.nb_tentatives >= 10  },
  { id: 'assidu',            emoji: '🔥', label: 'Assidu',             unlocked: stats?.nb_tentatives >= 50  },
  { id: 'expert',            emoji: '🏆', label: 'Expert',             unlocked: stats?.nb_tentatives >= 100 },
  { id: 'premiere_maitrise', emoji: '⭐', label: '1re maîtrise',       unlocked: stats?.nb_maitrisees >= 1   },
  { id: 'multi_maitre',      emoji: '💎', label: 'Multi-maître',       unlocked: stats?.nb_maitrisees >= 5   },
  { id: 'marathonien',       emoji: '⏱️', label: 'Marathonien',        unlocked: stats?.duree_totale_minutes >= 60  },
  { id: 'infatigable',       emoji: '🌙', label: 'Infatigable',        unlocked: stats?.duree_totale_minutes >= 300 },
  { id: 'precis',            emoji: '🎯', label: 'Précis',             unlocked: stats?.taux_reussite >= 80 && stats?.nb_tentatives >= 5  },
  { id: 'perfectionniste',   emoji: '✨', label: 'Parfait',            unlocked: stats?.taux_reussite >= 95 && stats?.nb_tentatives >= 10 },
  { id: 'regulier',          emoji: '📅', label: 'Régulier',           unlocked: stats?.nb_sessions >= 5  },
  { id: 'perseverant',       emoji: '💪', label: 'Persévérant',        unlocked: stats?.nb_sessions >= 20 },
]

/* ── Sidebar BKT top 3 ── */
const SidebarBKT = ({ bktData }) => {
  const { C } = useTheme()
  if (!bktData || !Object.keys(bktData.competences).length) return null
  const top3 = Object.entries(bktData.competences)
    .sort((a, b) => b[1].pourcentage - a[1].pourcentage)
    .slice(0, 3)

  return (
    <div style={{
      backgroundColor: C.surface, borderRadius: 14,
      padding: '16px 18px', marginBottom: 14,
      boxShadow: '0 2px 10px rgba(107,58,42,0.07)',
      border: `1px solid ${C.border}`
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
        <BarChart2 size={14} color={C.brown} />
        <h3 style={{ fontSize: 12, fontWeight: 800, color: C.brown, margin: 0 }}>Top compétences</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {top3.map(([comp, val], i) => {
          const lvl = BKTLevel(val.pourcentage)
          return (
            <div key={comp}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 800, flexShrink: 0 }}>#{i + 1}</span>
                  <span style={{ fontSize: 10, color: C.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comp}</span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 800, color: lvl.color, flexShrink: 0 }}>{val.pourcentage}%</span>
              </div>
              <ProgressBar value={val.pourcentage} color={lvl.color} h={3} />
            </div>
          )
        })}
      </div>
      {bktData.nb_competences_maitrisees > 0 && (
        <p style={{ fontSize: 10, color: C.emerald, fontWeight: 700, marginTop: 10, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
          <CheckCircle2 size={11} /> {bktData.nb_competences_maitrisees} compétence(s) maîtrisée(s)
        </p>
      )}
    </div>
  )
}

/* ── Next badge ── */
const NextBadge = ({ bktData }) => {
  const { C } = useTheme()
  if (!bktData) return null
  const next = Object.entries(bktData.competences)
    .filter(([, v]) => v.pourcentage < 95)
    .sort((a, b) => b[1].pourcentage - a[1].pourcentage)[0]
  if (!next) return null
  const [comp, val] = next
  const gap = 95 - val.pourcentage

  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.goldPale}, ${C.brownPale})`,
      borderRadius: 14, padding: '14px 16px',
      border: `1px solid ${C.gold}40`,
      boxShadow: '0 2px 10px rgba(212,168,83,0.1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <Zap size={14} color={C.gold} />
        <h3 style={{ fontSize: 12, fontWeight: 800, color: C.brownMid, margin: 0 }}>Prochain badge</h3>
      </div>
      <p style={{ fontSize: 11, color: C.text, fontWeight: 700, marginBottom: 4, lineHeight: 1.4 }}>{comp}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.textMuted, marginBottom: 6 }}>
        <span>Maîtrise actuelle : {val.pourcentage}%</span>
        <span style={{ color: C.gold, fontWeight: 700 }}>encore {gap}%</span>
      </div>
      <ProgressBar value={val.pourcentage} color={C.gold} h={4} bg={`${C.gold}20`} />
    </div>
  )
}

/* ── Widget badges sidebar (accordéon) ── */
const SidebarBadges = ({ stats }) => {
  const { C } = useTheme()
  const [expanded, setExpanded] = useState(false)
  const badges   = buildBadges(stats)
  const unlocked = badges.filter(b => b.unlocked)
  const locked   = badges.filter(b => !b.unlocked)
  const total    = badges.length

  return (
    <div style={{ backgroundColor: C.surface, borderRadius: 14, padding: '14px 16px', marginBottom: 14, border: `1px solid ${C.border}`, boxShadow: '0 2px 10px rgba(107,58,42,0.07)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Award size={13} color="#D97706" />
          <h3 style={{ fontSize: 12, fontWeight: 800, color: C.brown, margin: 0 }}>Mes badges</h3>
        </div>
        <span style={{ fontSize: 10, fontWeight: 800, color: unlocked.length > 0 ? '#D97706' : C.textMuted }}>
          {unlocked.length}/{total}
        </span>
      </div>

      {/* Contenu */}
      {!stats ? (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {[0,1,2,3].map(i => <div key={i} style={{ width: 34, height: 34, borderRadius: 8, background: C.brownGhost, animation: 'pulse 1.5s infinite' }}/>)}
        </div>
      ) : unlocked.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '6px 0 2px' }}>
          <p style={{ fontSize: 22, margin: '0 0 3px' }}>🔒</p>
          <p style={{ fontSize: 10, color: C.textMuted, margin: 0 }}>Fais des exercices pour débloquer des badges !</p>
        </div>
      ) : (
        <>
          {/* Vue compacte : emojis débloqués */}
          {!expanded && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {unlocked.map(b => (
                <div key={b.id} title={b.label}
                  style={{ width: 34, height: 34, borderRadius: 8, background: '#FFF7ED', border: '1.5px solid #F59E0B40', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, transition: 'transform .15s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >{b.emoji}</div>
              ))}
              {locked.length > 0 && (
                <div style={{ width: 34, height: 34, borderRadius: 8, background: C.brownGhost, border: `1.5px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: C.textMuted }}>+{locked.length}</span>
                </div>
              )}
            </div>
          )}

          {/* Vue déroulée : tous les badges */}
          {expanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {badges.map(b => (
                <div key={b.id} style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '6px 9px', borderRadius: 9,
                  background: b.unlocked ? '#FFF7ED' : C.brownGhost,
                  border: `1.5px solid ${b.unlocked ? '#F59E0B35' : C.border}`,
                  opacity: b.unlocked ? 1 : 0.55,
                }}>
                  <span style={{ fontSize: 20, filter: b.unlocked ? 'none' : 'grayscale(1)', flexShrink: 0 }}>{b.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: b.unlocked ? '#92400E' : C.textMuted }}>{b.label}</p>
                  </div>
                  {b.unlocked && <CheckCircle2 size={12} color="#D97706" style={{ flexShrink: 0 }} />}
                </div>
              ))}
            </div>
          )}

          {/* Toggle */}
          <button
            onClick={() => setExpanded(e => !e)}
            style={{ width: '100%', marginTop: 9, padding: '5px 0', background: C.brownGhost, border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 700, color: C.brownLight, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'background .15s' }}
            onMouseEnter={e => e.currentTarget.style.background = C.brownPale}
            onMouseLeave={e => e.currentTarget.style.background = C.brownGhost}
          >
            <ChevronDown size={11} style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s' }} />
            {expanded ? 'Réduire' : `Voir tout (${locked.length} verrouillé${locked.length > 1 ? 's' : ''})`}
          </button>
        </>
      )}
    </div>
  )
}

/* ── Widget sessions sidebar (accordéon) ── */
const SidebarSessions = ({ sessions }) => {
  const { C } = useTheme()
  const [expanded, setExpanded] = useState(false)
  const PREVIEW = 3
  const affectifEmoji = { positif: '😊', neutre: '😐', negatif: '😟', frustre: '😤', confus: '🤔' }
  const visible = sessions ? (expanded ? sessions : sessions.slice(0, PREVIEW)) : []

  return (
    <div style={{ backgroundColor: C.surface, borderRadius: 14, padding: '14px 16px', border: `1px solid ${C.border}`, boxShadow: '0 2px 10px rgba(107,58,42,0.07)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <TrendingUp size={13} color="#2563EB" style={{ marginRight: 6 }} />
        <h3 style={{ fontSize: 12, fontWeight: 800, color: C.brown, margin: 0, flex: 1 }}>Sessions récentes</h3>
        {sessions && sessions.length > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted }}>{sessions.length}</span>
        )}
      </div>

      {/* Contenu */}
      {sessions === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[0,1,2].map(i => <div key={i} style={{ height: 42, borderRadius: 8, background: C.brownGhost, animation: 'pulse 1.5s infinite' }}/>)}
        </div>
      ) : sessions.length === 0 ? (
        <p style={{ fontSize: 10, color: C.textMuted, textAlign: 'center', padding: '8px 0', margin: 0 }}>Aucune session complétée pour l'instant</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {visible.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 9, background: C.brownGhost, border: `1px solid ${C.border}` }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: '#DBEAFE', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={12} color="#2563EB" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.cours_titre}</p>
                  <p style={{ margin: 0, fontSize: 9, color: C.textMuted }}>{fmtDate(s.ended_at)} · ⏱ {fmtDureeS(s.duree_secondes)}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, flexShrink: 0 }}>
                  {s.score_final !== null && (
                    <span style={{ fontSize: 11, fontWeight: 900, color: s.score_final >= 70 ? C.emerald : s.score_final >= 50 ? '#D97706' : '#DC2626' }}>
                      {s.score_final}%
                    </span>
                  )}
                  <span style={{ fontSize: 12 }}>{affectifEmoji[s.etat_affectif] || ''}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Toggle — seulement si plus de PREVIEW sessions */}
          {sessions.length > PREVIEW && (
            <button
              onClick={() => setExpanded(e => !e)}
              style={{ width: '100%', marginTop: 8, padding: '5px 0', background: C.brownGhost, border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 700, color: C.brownLight, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background = C.brownPale}
              onMouseLeave={e => e.currentTarget.style.background = C.brownGhost}
            >
              <ChevronDown size={11} style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s' }} />
              {expanded ? 'Réduire' : `Voir les ${sessions.length - PREVIEW} autres`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

/* ─── Dashboard principal ──────────────────────────────────────── */
export default function Dashboard() {
  const { C } = useTheme()
  const { user }  = useSelector(s => s.auth)
  const navigate  = useNavigate()
  const { xs, mobile, desktop } = useBreakpoint()

  const [matieres,        setMatieres]        = useState([])
  const [modulesFamilles, setModulesFamilles] = useState([])
  const [matActive,       setMatActive]       = useState(null)
  const [progression,     setProgression]     = useState(null)
  const [bktData,         setBktData]         = useState(null)
  const [recommandee,     setRecommandee]     = useState(null)
  const [stats,           setStats]           = useState(null)
  const [sessions,        setSessions]        = useState(null)
  const [loading,         setLoading]         = useState(true)
  const [copied,          setCopied]          = useState(false)

  const loadModulesPourMatiere = useCallback(async (mat) => {
    const grouped = []
    for (const mod of (mat.modules || [])) {
      const famList = []
      try {
        const { data: fam } = await api.get(
          `/api/cours/modules/${mod.id}/familles?user_id=${user.id}`
        )
        famList.push(...fam)
      } catch {}
      grouped.push({ module: mod, familles: famList })
    }
    setModulesFamilles(grouped)
  }, [user.id])

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get(
          `/api/cours/matieres${user.niveau_id ? '?niveau_id=' + user.niveau_id : ''}`
        )
        setMatieres(data)

        if (data.length > 0) {
          setMatActive(data[0])
          await loadModulesPourMatiere(data[0])
        }

        const { data: prog } = await api.get(`/api/cours/progression/${user.id}`)
        setProgression(prog)
        const { data: bkt } = await api.get(`/api/bkt/apprenant/${user.id}`)
        setBktData(bkt)
        try {
          const { data: reco } = await api.get(`/api/cours/ua/recommandee/${user.id}`)
          setRecommandee(reco?.recommandee || null)
        } catch {}
        try {
          const { data: st } = await api.get(`/api/bkt/apprenant/${user.id}/stats`)
          setStats(st)
        } catch {}
        try {
          const { data: se } = await api.get(`/api/bkt/apprenant/${user.id}/sessions?limit=8`)
          setSessions(se)
        } catch {}
      } catch {
        toast.error('Erreur de chargement')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user.id, loadModulesPourMatiere])

  async function selectMatiere(mat) {
    setMatActive(mat)
    setModulesFamilles([])
    await loadModulesPourMatiere(mat)
  }

  function copyCode() {
    navigator.clipboard.writeText(user?.code_invitation || '')
    setCopied(true); toast.success('Code copié !')
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <SkDashboard xs={xs} mobile={mobile} />

  const pad = xs ? 12 : mobile ? 16 : 24
  const totalUA = modulesFamilles.reduce((a, mf) => a + mf.familles.reduce((b, f) => b + (f.unites || []).length, 0), 0)

  /* ── HERO ── */
  const Hero = (
    <div style={{
      background: `linear-gradient(140deg, ${C.brownDark} 0%, ${C.brown} 55%, ${C.brownLight} 100%)`,
      borderRadius: xs ? 16 : 20, padding: xs ? '18px 16px' : mobile ? '20px 18px' : '24px 28px',
      marginBottom: xs ? 12 : 18, position: 'relative', overflow: 'hidden', color: 'white',
      animation: 'fadeUp .4s ease',
    }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: .05, pointerEvents: 'none' }} aria-hidden="true">
        <defs>
          <pattern id="adk" x="0" y="0" width="56" height="56" patternUnits="userSpaceOnUse">
            <circle cx="28" cy="28" r="11" fill="none" stroke="white" strokeWidth="1.5" />
            <circle cx="28" cy="28" r="5"  fill="none" stroke="white" strokeWidth="1.5" />
            <line x1="28" y1="17" x2="28" y2="11" stroke="white" strokeWidth="1.5" />
            <line x1="17" y1="28" x2="11" y2="28" stroke="white" strokeWidth="1.5" />
            <line x1="39" y1="28" x2="45" y2="28" stroke="white" strokeWidth="1.5" />
            <line x1="28" y1="39" x2="28" y2="45" stroke="white" strokeWidth="1.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#adk)" />
      </svg>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, position: 'relative' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ opacity: .7, fontSize: 11, fontWeight: 500, marginBottom: 2 }}>Bon retour,</p>
          <h1 style={{ fontSize: xs ? 18 : mobile ? 20 : 23, fontWeight: 900, marginBottom: 8, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: -.3 }}>
            {user?.prenom} {user?.nom} 👋
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(255,255,255,0.18)', padding: '3px 10px', borderRadius: 20, fontSize: xs ? 10 : 11, fontWeight: 700 }}>
              🎓 {user?.niveau_label || 'Niveau non défini'}
            </span>
          </div>
        </div>

        {user?.code_invitation && !mobile && (
          <div style={{ background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(8px)', borderRadius: 12, padding: '11px 14px', border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 700, opacity: .65, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .8 }}>Code tuteur</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: 3 }}>{user.code_invitation}</span>
              <button onClick={copyCode} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, padding: '5px 7px', cursor: 'pointer', color: 'white', display: 'flex' }}>
                {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {user?.code_invitation && mobile && (
        <div style={{ marginTop: 10, background: 'rgba(0,0,0,0.15)', borderRadius: 9, padding: '9px 11px', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 9, opacity: .65, marginBottom: 1, fontWeight: 700 }}>Code tuteur</p>
            <span style={{ fontSize: xs ? 14 : 16, fontWeight: 900, letterSpacing: 2 }}>{user.code_invitation}</span>
          </div>
          <button onClick={copyCode} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 7, padding: '7px', cursor: 'pointer', color: 'white', display: 'flex' }}>
            {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
          </button>
        </div>
      )}

      {progression && (
        <div style={{ marginTop: 14, position: 'relative' }}>
          {/* XPRing + barre */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <XPRing pct={progression.pourcentage} size={xs ? 58 : 72} stroke={7} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 5, opacity: .85 }}>
                <span>Progression globale</span>
                <span>{progression.pourcentage}%</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,.2)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, background: 'white', width: `${progression.pourcentage}%`, transition: 'width .9s cubic-bezier(.4,0,.2,1)' }} />
              </div>
            </div>
          </div>
          {/* Chips de stats — style Duolingo */}
          <div style={{ display: 'flex', gap: 7, marginTop: 11, flexWrap: 'wrap' }}>
            {[
              { Icon: Award,    val: progression.score_total,                    unit: 'pts'       },
              { Icon: Target,   val: progression.exercices_reussis,              unit: 'réussis'   },
              { Icon: Brain,    val: bktData?.nb_competences_maitrisees ?? 0,    unit: 'maîtrisés' },
              { Icon: BookOpen, val: totalUA,                                    unit: 'cours'     },
            ].map(({ Icon, val, unit }) => (
              <div key={unit} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.13)', borderRadius: 20, padding: '4px 11px' }}>
                <Icon size={11} color="rgba(255,255,255,0.7)" />
                <span style={{ fontSize: 12, fontWeight: 800, color: 'white', lineHeight: 1 }}>{val}</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  /* ── STAT CARDS ── */
  const StatCards = progression && (
    <div style={{
      display: 'grid',
      gridTemplateColumns: xs ? 'repeat(2, 1fr)' : mobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
      gap: xs ? 7 : mobile ? 9 : 11,
      marginBottom: xs ? 12 : 18,
      animation: 'fadeUp .45s ease',
    }}>
      <StatCard label="Score"    value={`${progression.score_total}pts`}         subtitle="Points cumulés"                    color={C.brown}      Icon={Award}    xs={xs} />
      <StatCard label="Réussis"  value={progression.exercices_reussis}            subtitle={`/ ${progression.total_exercices}`} color={C.emerald}   Icon={Target}   xs={xs} />
      <StatCard label="Maîtrisé" value={bktData?.nb_competences_maitrisees || 0} subtitle="compétences ≥95%"                  color={C.gold}       Icon={Brain}    xs={xs} />
      <StatCard label="Cours"    value={totalUA}                                  subtitle="unités disponibles"                color={C.brownLight} Icon={BookOpen} xs={xs} />
    </div>
  )

  /* ── UA RECOMMANDÉE ── */
  const RecoCard = recommandee && (
    <div style={{
      background: `linear-gradient(135deg, ${C.emeraldPale}, #F0FBF7)`,
      borderRadius: 13, padding: xs ? '13px' : '14px 18px',
      marginBottom: xs ? 10 : 14,
      border: `1.5px solid ${C.emerald}30`,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
      flexWrap: xs ? 'wrap' : 'nowrap',
      animation: 'fadeUp .5s ease',
      boxShadow: `0 4px 16px ${C.emerald}15`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 12px ${C.emerald}40` }}>
          <Star size={16} color="white" fill="white" />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: C.emerald, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 1 }}>Recommandé par l'IA</p>
          <p style={{ fontSize: xs ? 12 : 13, fontWeight: 800, color: C.text, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {recommandee.titre}
          </p>
          <p style={{ fontSize: 10, color: C.textMuted }}>Maîtrise BKT : {Math.round(recommandee.score_bkt * 100)}%</p>
        </div>
      </div>
      <button
        onClick={() => navigate(`/cours/${recommandee.ua_id}`)}
        style={{
          padding: xs ? '8px 14px' : '9px 16px',
          background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDark})`,
          color: 'white', border: 'none', borderRadius: 9, fontSize: 11, fontWeight: 800,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
          boxShadow: `0 4px 14px ${C.emerald}45`,
          width: xs ? '100%' : 'auto', justifyContent: 'center', flexShrink: 0,
        }}
      >
        Commencer maintenant <ChevronRight size={12} />
      </button>
    </div>
  )

  /* ── LISTE MODULES ── */
  const CoursList = (
    <div style={{ animation: 'fadeUp .55s ease' }}>
      {modulesFamilles.map(({ module, familles }) => (
        <ModuleAccordion
          key={module.id}
          module={module}
          familles={familles}
          progression={progression}
          recommandee={recommandee}
          navigate={navigate}
        />
      ))}
      {modulesFamilles.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: C.textMuted }}>
          <BookOpen size={32} color={C.border} style={{ margin: '0 auto 10px' }} />
          <p style={{ fontSize: 13, fontWeight: 600 }}>Aucun cours disponible pour ce niveau</p>
        </div>
      )}
    </div>
  )

  /* ── SIDEBAR DESKTOP ── */
  const Sidebar = !mobile && (
    <div style={{ width: 240, flexShrink: 0, minWidth: 0, animation: 'fadeUp .5s ease' }}>
      <SidebarBKT bktData={bktData} />
      <NextBadge bktData={bktData} />
      <SidebarBadges stats={stats} />
      <SidebarSessions sessions={sessions} />
    </div>
  )

  /* ── RENDER ── */
  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: `${pad}px`, boxSizing: 'border-box', maxWidth: '100vw', overflowX: 'hidden' }}>
      <style>{`
        button:focus-visible { outline: 2px solid ${C.emerald}; outline-offset: 2px; }
      `}</style>

      {Hero}

      {/* ── Activité recommandée — action immédiate ── */}
      {RecoCard}

      {/* ── Parcours — strip compact ── */}
      <PathVisual modulesFamilles={modulesFamilles} progression={progression} />

      {/* ── Titre + tabs matière — pleine largeur ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <BookOpen size={14} color={C.brown} />
        <h2 style={{ fontSize: 13, fontWeight: 800, color: C.brown, margin: 0 }}>Mes cours</h2>
        <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>
          {modulesFamilles.length} module{modulesFamilles.length > 1 ? 's' : ''}
        </span>
      </div>
      {matieres.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
          {matieres.map(mat => {
            const active = matActive?.id === mat.id
            return (
              <button key={mat.id} onClick={() => selectMatiere(mat)} style={{
                padding: '6px 14px', borderRadius: 20,
                border: `2px solid ${active ? C.brown : C.border}`,
                background: active ? C.brown : C.surface,
                color: active ? 'white' : C.textSec,
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                whiteSpace: 'nowrap', transition: 'all .2s',
                boxShadow: active ? `0 3px 10px ${C.brown}30` : 'none',
              }}>
                {mat.icone || '📚'} {mat.nom}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Two-column : démarre au niveau du radar BKT ── */}
      <div style={{ display: 'flex', gap: mobile ? 0 : 18, flexDirection: mobile ? 'column' : 'row', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
          {/* BKT Radar — maîtrise par compétence */}
          {bktData && Object.keys(bktData.competences).length > 0 && (
            <div style={{ backgroundColor: C.surface, borderRadius: 14, padding: '14px 16px', marginBottom: 14, border: `1px solid ${C.border}`, boxShadow: '0 2px 10px rgba(107,58,42,0.07)', animation: 'fadeUp .5s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                <Brain size={14} color={C.brown} />
                <h3 style={{ fontSize: 13, fontWeight: 800, color: C.brown, margin: 0 }}>Maîtrise par compétence</h3>
                {bktData.nb_competences_maitrisees > 0 && (
                  <span style={{ fontSize: 10, color: C.emerald, fontWeight: 700, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={11} /> {bktData.nb_competences_maitrisees} maîtrisée(s)
                  </span>
                )}
              </div>
              <ResponsiveContainer width="100%" height={mobile ? 180 : 220}>
                <RadarChart data={Object.entries(bktData.competences).map(([comp, val]) => ({
                  subject: comp.length > 14 ? comp.substring(0, 14) + '…' : comp,
                  A: val.pourcentage, fullName: comp,
                }))} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                  <PolarGrid stroke="#E5E7EB" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: C.textSec, fontSize: mobile ? 9 : 11, fontWeight: 700 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="A" stroke={C.brown} fill={C.brown} fillOpacity={0.22} strokeWidth={2} dot={{ r: 3, fill: C.brown }} />
                  <Tooltip formatter={(v, _, p) => [`${v}%`, p.payload.fullName]} contentStyle={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {CoursList}

          {/* Motivation mobile */}
          {mobile && progression && (
            <div style={{ background: `linear-gradient(135deg, ${C.goldPale}, ${C.brownPale})`, borderRadius: 11, padding: '11px 13px', marginTop: 12, border: `1px solid ${C.gold}35`, display: 'flex', alignItems: 'center', gap: 9 }}>
              <Flame size={17} color={C.gold} style={{ flexShrink: 0 }} />
              <p style={{ fontSize: 11, color: C.textSec, lineHeight: 1.5, margin: 0 }}>
                <strong style={{ color: C.brown }}>{progression.exercices_reussis}</strong> exercice(s) réussi(s) sur {progression.total_exercices}. Continue !
              </p>
            </div>
          )}

          {/* Badges + Sessions — version mobile (empilés) */}
          {mobile && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: xs ? 8 : 10, marginTop: xs ? 8 : 10 }}>
              <SidebarBadges stats={stats} />
              <SidebarSessions sessions={sessions} />
            </div>
          )}
        </div>

        {Sidebar}
      </div>
    </div>
  )
}