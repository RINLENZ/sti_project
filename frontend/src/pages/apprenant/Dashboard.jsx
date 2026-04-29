import { useSelector } from 'react-redux'
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  BookOpen, Clock, Target, Award, Flame, Copy, CheckCircle,
  ChevronRight, Brain, Star, ChevronDown, Lock, PlayCircle,
  CheckCircle2, Zap, BarChart2, TrendingUp, Sparkles
} from 'lucide-react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Tooltip
} from 'recharts'
import { C, useTheme  } from '../../styles/theme'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { SkDashboard } from '../../components/Skeleton'

/* ─── Design tokens ──────────────────────────────────────────── */
const D = {
  bg:          '#0D0F14',
  surface:     '#13161E',
  surfaceUp:   '#191D28',
  glass:       'rgba(255,255,255,0.04)',
  glassHov:    'rgba(255,255,255,0.07)',
  border:      'rgba(255,255,255,0.07)',
  borderBright:'rgba(255,255,255,0.13)',
  teal:        '#2DD4BF',
  tealDark:    '#0D9488',
  tealPale:    'rgba(45,212,191,0.1)',
  gold:        '#F59E0B',
  goldPale:    'rgba(245,158,11,0.1)',
  indigo:      '#818CF8',
  indigoPale:  'rgba(129,140,248,0.1)',
  rose:        '#FB7185',
  rosePale:    'rgba(251,113,133,0.1)',
  text:        '#F1F5F9',
  textSec:     '#94A3B8',
  textMuted:   '#475569',
  radius:      16,
  radiusSm:    10,
}

const font = `'DM Sans', 'Plus Jakarta Sans', system-ui, sans-serif`

/* ─── Helpers ──────────────────────────────────────────────────── */
const BKTLevel = p => {
  if (p >= 95) return { label: 'Maîtrisé',      color: D.teal,   bg: D.tealPale   }
  if (p >= 70) return { label: 'En bonne voie', color: D.indigo, bg: D.indigoPale }
  if (p >= 40) return { label: 'En progrès',    color: D.gold,   bg: D.goldPale   }
  return              { label: 'À renforcer',    color: D.rose,   bg: D.rosePale   }
}

const UAStatus = pct => {
  if (pct === 100) return { icon: CheckCircle2, color: D.teal,    label: 'Terminé'      }
  if (pct > 0)     return { icon: PlayCircle,   color: D.gold,    label: 'En cours'     }
  return                  { icon: Lock,          color: D.textMuted, label: 'Non commencé' }
}

/* ─── Sub-components ─────────────────────────────────────────── */

const ProgressBar = ({ value, color = D.teal, h = 4, bg = 'rgba(255,255,255,0.06)' }) => (
  <div style={{ height: h, backgroundColor: bg, borderRadius: h, overflow: 'hidden' }}>
    <div style={{
      height: '100%',
      width: `${Math.min(100, Math.max(0, value))}%`,
      background: `linear-gradient(90deg, ${color}cc, ${color})`,
      borderRadius: h,
      transition: 'width .8s cubic-bezier(.4,0,.2,1)',
      boxShadow: `0 0 8px ${color}60`,
    }} />
  </div>
)

const StatCard = ({ label, value, subtitle, color, Icon, xs }) => {
  const { C } = useTheme()
  return (
  <div style={{
    background: D.surfaceUp,
    borderRadius: D.radius,
    padding: xs ? '16px' : '20px',
    border: `1px solid ${D.border}`,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    position: 'relative',
    overflow: 'hidden',
    fontFamily: font,
    transition: 'border-color .2s, transform .2s',
  }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = D.borderBright; e.currentTarget.style.transform = 'translateY(-2px)' }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.transform = 'none' }}
  >
    <div style={{
      position: 'absolute', top: 0, right: 0,
      width: 80, height: 80, borderRadius: '0 0 0 80px',
      background: `radial-gradient(circle at top right, ${color}18, transparent 70%)`,
      pointerEvents: 'none',
    }} />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <span style={{ fontSize: 10, color: D.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
      {Icon && (
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: `${color}18`,
          border: `1px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={14} color={color} />
        </div>
      )}
    </div>
    <span style={{ fontSize: xs ? 22 : 28, fontWeight: 800, color: D.text, lineHeight: 1, letterSpacing: -1 }}>{value}</span>
    {subtitle && <span style={{ fontSize: 11, color: D.textMuted }}>{subtitle}</span>}
  </div>
)
}

/* ── UA compact card ── */
const UACard = ({ ua, pct, isReco, onClick }) => {
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
        padding: '10px 12px', borderRadius: D.radiusSm, cursor: 'pointer',
        background: hov ? D.glassHov : isReco ? D.tealPale : D.glass,
        border: `1px solid ${isReco ? D.teal + '40' : hov ? D.borderBright : D.border}`,
        transition: 'all .18s ease',
        transform: hov ? 'translateX(3px)' : 'none',
        fontFamily: font,
      }}
    >
      <StatusIcon size={14} color={st.color} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
          {isReco && <Sparkles size={9} color={D.teal} />}
          <span style={{ fontSize: 9, fontWeight: 700, color: D.teal, textTransform: 'uppercase', letterSpacing: .6 }}>{ua.reference_ue}</span>
        </div>
        <p style={{ fontSize: 12, fontWeight: 600, color: D.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ua.titre}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 3 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: D.textMuted }}>
            <Clock size={9} />{ua.duree_estimee}min
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: D.textMuted }}>
            <BookOpen size={9} />{ua.nb_exercices} exos
          </span>
        </div>
        {pct > 0 && pct < 100 && (
          <div style={{ marginTop: 5 }}>
            <ProgressBar value={pct} color={D.gold} h={2} />
          </div>
        )}
      </div>
      <button
        onClick={e => { e.stopPropagation(); onClick() }}
        style={{
          flexShrink: 0, padding: '5px 11px',
          background: pct === 100 ? D.tealPale
            : isReco ? `linear-gradient(135deg, ${D.teal}, ${D.tealDark})`
            : `linear-gradient(135deg, ${D.indigo}cc, ${D.indigo})`,
          color: pct === 100 ? D.teal : 'white',
          border: `1px solid ${pct === 100 ? D.teal + '40' : 'transparent'}`,
          borderRadius: 7, fontSize: 10, fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
          whiteSpace: 'nowrap',
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
  const [open, setOpen] = useState(defaultOpen)
  const doneFam = (famille.unites || []).filter(ua => {
    const ex = (progression?.details || []).filter(d => d.correct && String(d.ua_id) === String(ua.id)).length
    return ua.nb_exercices > 0 && ex >= ua.nb_exercices
  }).length
  const totalFam = (famille.unites || []).length

  return (
    <div style={{ marginBottom: 4, fontFamily: font }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 8px', background: 'none', border: 'none', cursor: 'pointer',
          borderRadius: 8, fontFamily: font,
        }}
      >
        <ChevronDown size={12} color={D.textMuted} style={{ transform: open ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform .2s ease', flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: D.textSec, textAlign: 'left', flex: 1 }}>{famille.titre}</span>
        <span style={{ fontSize: 10, color: D.textMuted }}>
          {doneFam}/{totalFam}
        </span>
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '2px 4px 4px 18px' }}>
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
  const [open, setOpen] = useState(hasStarted)
  const progressColor = pctModule === 100 ? D.teal : pctModule > 0 ? D.gold : D.textMuted

  return (
    <div style={{
      background: D.surfaceUp,
      borderRadius: D.radius,
      border: `1px solid ${D.border}`,
      overflow: 'hidden',
      marginBottom: 8,
      fontFamily: font,
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: font,
          transition: 'background .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = D.glass}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `linear-gradient(135deg, ${D.indigo}40, ${D.teal}40)`,
          border: `1px solid ${D.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
        }}>📘</div>

        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: D.text, margin: '0 0 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {module?.titre || `Module ${module?.numero || ''}`}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, maxWidth: 140 }}>
              <ProgressBar value={pctModule} color={progressColor} h={3} />
            </div>
            <span style={{ fontSize: 10, color: D.textMuted, flexShrink: 0 }}>
              {doneUA}/{totalUA} UA · {pctModule}%
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {pctModule === 100 && (
            <span style={{ background: D.tealPale, color: D.teal, fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 20, border: `1px solid ${D.teal}30` }}>
              ✓ Terminé
            </span>
          )}
          <ChevronDown size={14} color={D.textMuted} style={{ transform: open ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform .2s ease' }} />
        </div>
      </button>

      {open && (
        <div style={{ padding: '4px 12px 12px', borderTop: `1px solid ${D.border}` }}>
          {familles.length === 0 ? (
            <p style={{ fontSize: 12, color: D.textMuted, fontStyle: 'italic', padding: '10px 4px' }}>
              Contenu en cours de préparation.
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

/* ── Sidebar BKT ── */
const SidebarBKT = ({ bktData }) => {
  if (!bktData || !Object.keys(bktData.competences).length) return null
  const top3 = Object.entries(bktData.competences)
    .sort((a, b) => b[1].pourcentage - a[1].pourcentage)
    .slice(0, 3)

  return (
    <div style={{
      background: D.surfaceUp,
      borderRadius: D.radius,
      padding: '18px',
      marginBottom: 12,
      border: `1px solid ${D.border}`,
      fontFamily: font,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: D.indigoPale, border: `1px solid ${D.indigo}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BarChart2 size={13} color={D.indigo} />
        </div>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: D.text, margin: 0 }}>Top compétences</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {top3.map(([comp, val], i) => {
          const lvl = BKTLevel(val.pourcentage)
          return (
            <div key={comp}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 5,
                    background: `${lvl.color}20`, color: lvl.color,
                    fontSize: 9, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>{i + 1}</span>
                  <span style={{ fontSize: 11, color: D.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comp}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: lvl.color, flexShrink: 0, marginLeft: 6 }}>{val.pourcentage}%</span>
              </div>
              <ProgressBar value={val.pourcentage} color={lvl.color} h={3} />
            </div>
          )
        })}
      </div>
      {bktData.nb_competences_maitrisees > 0 && (
        <div style={{ marginTop: 12, padding: '8px 10px', background: D.tealPale, borderRadius: 8, border: `1px solid ${D.teal}30`, display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={12} color={D.teal} />
          <span style={{ fontSize: 10, color: D.teal, fontWeight: 700 }}>{bktData.nb_competences_maitrisees} compétence(s) maîtrisée(s)</span>
        </div>
      )}
    </div>
  )
}

/* ── Next badge ── */
const NextBadge = ({ bktData }) => {
  if (!bktData) return null
  const next = Object.entries(bktData.competences)
    .filter(([, v]) => v.pourcentage < 95)
    .sort((a, b) => b[1].pourcentage - a[1].pourcentage)[0]
  if (!next) return null
  const [comp, val] = next
  const gap = 95 - val.pourcentage

  return (
    <div style={{
      background: `linear-gradient(135deg, ${D.goldPale}, rgba(245,158,11,0.05))`,
      borderRadius: D.radius,
      padding: '16px 18px',
      border: `1px solid ${D.gold}30`,
      fontFamily: font,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: D.goldPale, border: `1px solid ${D.gold}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={13} color={D.gold} />
        </div>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: D.text, margin: 0 }}>Prochain badge</h3>
      </div>
      <p style={{ fontSize: 12, color: D.text, fontWeight: 700, marginBottom: 6, lineHeight: 1.4 }}>{comp}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: D.textMuted, marginBottom: 8 }}>
        <span>Maîtrise actuelle : {val.pourcentage}%</span>
        <span style={{ color: D.gold, fontWeight: 700 }}>+{gap}% requis</span>
      </div>
      <ProgressBar value={val.pourcentage} color={D.gold} h={4} bg={`${D.gold}20`} />
    </div>
  )
}

/* ─── Dashboard principal ──────────────────────────────────────── */
export default function Dashboard() {
  const { user }  = useSelector(s => s.auth)
  const navigate  = useNavigate()
  const { xs, mobile, desktop } = useBreakpoint()

  const [matieres,        setMatieres]        = useState([])
  const [modulesFamilles, setModulesFamilles] = useState([])
  const [matActive,       setMatActive]       = useState(null)
  const [progression,     setProgression]     = useState(null)
  const [bktData,         setBktData]         = useState(null)
  const [recommandee,     setRecommandee]     = useState(null)
  const [loading,         setLoading]         = useState(true)
  const [copied,          setCopied]          = useState(false)

  const loadModulesPourMatiere = useCallback(async (mat) => {
    const grouped = []
    for (const mod of (mat.modules || [])) {
      const famList = []
      try {
        const { data: fam } = await api.get(`/api/cours/modules/${mod.id}/familles?user_id=${user.id}`)
        famList.push(...fam)
      } catch {}
      grouped.push({ module: mod, familles: famList })
    }
    setModulesFamilles(grouped)
  }, [user.id])

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get(`/api/cours/matieres${user.niveau_id ? '?niveau_id=' + user.niveau_id : ''}`)
        setMatieres(data)
        if (data.length > 0) { setMatActive(data[0]); await loadModulesPourMatiere(data[0]) }
        const { data: prog } = await api.get(`/api/cours/progression/${user.id}`)
        setProgression(prog)
        const { data: bkt } = await api.get(`/api/bkt/apprenant/${user.id}`)
        setBktData(bkt)
        try {
          const { data: reco } = await api.get(`/api/cours/ua/recommandee/${user.id}`)
          setRecommandee(reco?.recommandee || null)
        } catch {}
      } catch { toast.error('Erreur de chargement') }
      finally { setLoading(false) }
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

  const pad = xs ? 14 : mobile ? 18 : 28
  const totalUA = modulesFamilles.reduce((a, mf) => a + mf.familles.reduce((b, f) => b + (f.unites || []).length, 0), 0)

  /* ── HERO ── */
  const Hero = (
    <div style={{
      position: 'relative',
      borderRadius: xs ? 18 : 22,
      padding: xs ? '22px 18px' : mobile ? '26px 22px' : '32px 36px',
      marginBottom: xs ? 14 : 20,
      overflow: 'hidden',
      fontFamily: font,
      background: `linear-gradient(135deg, #0D1B2A 0%, #0F2136 40%, #0A1628 100%)`,
      border: `1px solid ${D.borderBright}`,
    }}>
      {/* Glow orbs */}
      <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: `radial-gradient(circle, ${D.teal}25 0%, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -40, left: -40, width: 160, height: 160, borderRadius: '50%', background: `radial-gradient(circle, ${D.indigo}20 0%, transparent 70%)`, pointerEvents: 'none' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, position: 'relative' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, color: D.teal, fontWeight: 600, marginBottom: 4, letterSpacing: .5 }}>Bon retour 👋</p>
          <h1 style={{
            fontSize: xs ? 22 : mobile ? 26 : 32,
            fontWeight: 800,
            color: D.text,
            marginBottom: 10,
            lineHeight: 1.1,
            letterSpacing: -1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {user?.prenom} {user?.nom}
          </h1>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.08)',
            border: `1px solid rgba(255,255,255,0.12)`,
            padding: '5px 12px', borderRadius: 20,
            fontSize: 11, fontWeight: 600, color: D.textSec,
          }}>
            🎓 {user?.niveau_label || 'Niveau non défini'}
          </span>
        </div>

        {user?.code_invitation && !xs && (
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(12px)',
            borderRadius: 14,
            padding: '14px 18px',
            border: `1px solid ${D.borderBright}`,
            flexShrink: 0,
          }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: D.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Code tuteur</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: mobile ? 16 : 20, fontWeight: 800, color: D.text, letterSpacing: 4 }}>{user.code_invitation}</span>
              <button onClick={copyCode} style={{
                background: copied ? D.tealPale : 'rgba(255,255,255,0.1)',
                border: `1px solid ${copied ? D.teal + '50' : 'rgba(255,255,255,0.15)'}`,
                borderRadius: 7, padding: '6px 8px', cursor: 'pointer',
                color: copied ? D.teal : D.textSec, display: 'flex', transition: 'all .2s',
              }}>
                {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {xs && user?.code_invitation && (
        <div style={{
          marginTop: 12,
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 10, padding: '10px 12px',
          border: `1px solid ${D.borderBright}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <p style={{ fontSize: 9, color: D.textMuted, marginBottom: 2, fontWeight: 600 }}>Code tuteur</p>
            <span style={{ fontSize: 16, fontWeight: 800, color: D.text, letterSpacing: 3 }}>{user.code_invitation}</span>
          </div>
          <button onClick={copyCode} style={{
            background: 'rgba(255,255,255,0.08)', border: `1px solid ${D.border}`,
            borderRadius: 8, padding: '8px', cursor: 'pointer', color: D.textSec, display: 'flex',
          }}>
            {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
          </button>
        </div>
      )}

      {progression && (
        <div style={{ marginTop: 18, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 6, color: D.textSec }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <TrendingUp size={12} color={D.teal} /> Progression globale
            </span>
            <span style={{ color: D.teal, fontWeight: 700 }}>{progression.pourcentage}%</span>
          </div>
          <ProgressBar value={progression.pourcentage} color={D.teal} h={6} bg="rgba(255,255,255,0.08)" />
          <p style={{ fontSize: 10, color: D.textMuted, marginTop: 6 }}>
            {progression.exercices_reussis} / {progression.total_exercices} exercices · {progression.score_total} pts
          </p>
        </div>
      )}
    </div>
  )

  /* ── STAT CARDS ── */
  const StatCards = progression && (
    <div style={{
      display: 'grid',
      gridTemplateColumns: xs ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
      gap: xs ? 8 : 10,
      marginBottom: xs ? 14 : 20,
    }}>
      <StatCard label="Score"    value={`${progression.score_total}`}            subtitle="points cumulés"                   color={D.teal}   Icon={Award}    xs={xs} />
      <StatCard label="Réussis"  value={progression.exercices_reussis}            subtitle={`/ ${progression.total_exercices} exos`} color={D.indigo} Icon={Target}  xs={xs} />
      <StatCard label="Maîtrisé" value={bktData?.nb_competences_maitrisees || 0} subtitle="compétences ≥ 95%"                color={D.gold}   Icon={Brain}    xs={xs} />
      <StatCard label="Cours"    value={totalUA}                                  subtitle="unités d'apprentissage"           color={D.rose}   Icon={BookOpen} xs={xs} />
    </div>
  )

  /* ── UA RECOMMANDÉE ── */
  const RecoCard = recommandee && (
    <div style={{
      background: `linear-gradient(135deg, rgba(45,212,191,0.08), rgba(45,212,191,0.03))`,
      borderRadius: D.radius,
      padding: xs ? '14px' : '16px 20px',
      marginBottom: xs ? 12 : 16,
      border: `1px solid ${D.teal}35`,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14,
      flexWrap: xs ? 'wrap' : 'nowrap',
      fontFamily: font,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: `linear-gradient(135deg, ${D.teal}, ${D.tealDark})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 4px 16px ${D.teal}40`,
        }}>
          <Sparkles size={18} color="white" />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: D.teal, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Recommandé par l'IA</p>
          <p style={{ fontSize: xs ? 12 : 13, fontWeight: 700, color: D.text, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {recommandee.titre}
          </p>
          <p style={{ fontSize: 10, color: D.textMuted }}>Maîtrise BKT : {Math.round(recommandee.score_bkt * 100)}%</p>
        </div>
      </div>
      <button
        onClick={() => navigate(`/cours/${recommandee.ua_id}`)}
        style={{
          padding: xs ? '9px 16px' : '10px 20px',
          background: `linear-gradient(135deg, ${D.teal}, ${D.tealDark})`,
          color: '#0D1117', border: 'none', borderRadius: 10,
          fontSize: 12, fontWeight: 800,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          boxShadow: `0 4px 18px ${D.teal}45`,
          width: xs ? '100%' : 'auto', justifyContent: 'center', flexShrink: 0,
          letterSpacing: -.2,
        }}
      >
        Commencer <ChevronRight size={13} />
      </button>
    </div>
  )

  /* ── LISTE MODULES ── */
  const CoursList = (
    <div>
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
        <div style={{ textAlign: 'center', padding: '48px 20px', color: D.textMuted, fontFamily: font }}>
          <BookOpen size={36} color={D.textMuted} style={{ margin: '0 auto 12px', opacity: .4 }} />
          <p style={{ fontSize: 13, fontWeight: 600 }}>Aucun cours disponible pour ce niveau</p>
        </div>
      )}
    </div>
  )

  /* ── SIDEBAR DESKTOP ── */
  const Sidebar = !mobile && (
    <div style={{ width: 250, flexShrink: 0, minWidth: 0, fontFamily: font }}>
      {recommandee ? (
        <div style={{
          background: `linear-gradient(135deg, ${D.tealPale}, rgba(45,212,191,0.04))`,
          borderRadius: D.radius, padding: '18px',
          marginBottom: 12,
          border: `1px solid ${D.teal}30`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Sparkles size={13} color={D.teal} />
            <h3 style={{ fontSize: 11, fontWeight: 700, color: D.teal, margin: 0, textTransform: 'uppercase', letterSpacing: .8 }}>Recommandé IA</h3>
          </div>
          <span style={{ background: D.glass, color: D.textSec, padding: '2px 8px', borderRadius: 20, fontSize: 9, fontWeight: 700, display: 'inline-block', marginBottom: 8, border: `1px solid ${D.border}` }}>
            {recommandee.reference_ue}
          </span>
          <p style={{ fontSize: 12, fontWeight: 700, color: D.text, margin: '0 0 4px', lineHeight: 1.4 }}>{recommandee.titre}</p>
          <p style={{ fontSize: 10, color: D.textMuted, marginBottom: 12 }}>BKT : {Math.round(recommandee.score_bkt * 100)}%</p>
          <button
            onClick={() => navigate(`/cours/${recommandee.ua_id}`)}
            style={{ width: '100%', padding: '9px', background: `linear-gradient(135deg, ${D.teal}, ${D.tealDark})`, color: '#0D1117', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, boxShadow: `0 3px 12px ${D.teal}40` }}
          >
            Commencer <ChevronRight size={12} />
          </button>
        </div>
      ) : (
        <div style={{ background: D.surfaceUp, borderRadius: D.radius, padding: '18px', marginBottom: 12, border: `1px solid ${D.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <Flame size={14} color={D.gold} />
            <h3 style={{ fontSize: 12, fontWeight: 700, color: D.text, margin: 0 }}>Continue comme ça !</h3>
          </div>
          <p style={{ fontSize: 11, color: D.textSec, lineHeight: 1.7, margin: 0 }}>
            <strong style={{ color: D.gold }}>{progression?.exercices_reussis || 0}</strong> exercice(s) réussi(s) sur {progression?.total_exercices || 0}.
          </p>
        </div>
      )}

      <SidebarBKT bktData={bktData} />
      <NextBadge bktData={bktData} />
    </div>
  )

  /* ── RENDER ── */
  return (
    <div style={{
      background: D.bg,
      minHeight: '100vh',
      padding: `${pad}px`,
      boxSizing: 'border-box',
      maxWidth: '100vw',
      overflowX: 'hidden',
      fontFamily: font,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        button:focus-visible { outline: 2px solid ${D.teal}; outline-offset: 2px; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <div style={{ animation: 'fadeUp .4s ease' }}>{Hero}</div>
      <div style={{ animation: 'fadeUp .45s ease' }}>{StatCards}</div>

      <div style={{ display: 'flex', gap: mobile ? 0 : 20, flexDirection: mobile ? 'column' : 'row', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0, width: '100%', animation: 'fadeUp .5s ease' }}>
          {RecoCard}

          {/* Section header + matière tabs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${D.indigo}20`, border: `1px solid ${D.indigo}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookOpen size={13} color={D.indigo} />
              </div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: D.text, margin: 0 }}>Mes cours</h2>
              <span style={{ fontSize: 10, color: D.textMuted, background: D.glass, border: `1px solid ${D.border}`, padding: '2px 8px', borderRadius: 20 }}>
                {modulesFamilles.length} module{modulesFamilles.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {matieres.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
              {matieres.map(mat => {
                const active = matActive?.id === mat.id
                return (
                  <button key={mat.id} onClick={() => selectMatiere(mat)} style={{
                    padding: '6px 14px', borderRadius: 20,
                    border: `1px solid ${active ? D.teal + '60' : D.border}`,
                    background: active ? D.tealPale : D.glass,
                    color: active ? D.teal : D.textSec,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    whiteSpace: 'nowrap', transition: 'all .2s',
                    fontFamily: font,
                  }}>
                    {mat.icone || '📚'} {mat.nom}
                  </button>
                )
              })}
            </div>
          )}

          {/* BKT Radar */}
          {bktData && Object.keys(bktData.competences).length > 0 && (
            <div style={{ background: D.surfaceUp, borderRadius: D.radius, padding: '18px', marginBottom: 14, border: `1px solid ${D.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: `${D.indigo}20`, border: `1px solid ${D.indigo}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Brain size={13} color={D.indigo} />
                </div>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: D.text, margin: 0 }}>Maîtrise par compétence</h3>
                <span style={{ fontSize: 10, color: D.textMuted, background: D.glass, border: `1px solid ${D.border}`, padding: '2px 7px', borderRadius: 20 }}>BKT</span>
              </div>
              <ResponsiveContainer width="100%" height={mobile ? 180 : 220}>
                <RadarChart
                  data={Object.entries(bktData.competences).map(([comp, val]) => ({
                    subject: comp.length > 14 ? comp.substring(0, 14) + '…' : comp,
                    A: val.pourcentage, fullName: comp,
                  }))}
                  margin={{ top: 10, right: 20, bottom: 10, left: 20 }}
                >
                  <PolarGrid stroke="rgba(255,255,255,0.06)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: D.textSec, fontSize: mobile ? 9 : 10, fontWeight: 600, fontFamily: font }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="A" stroke={D.teal} fill={D.teal} fillOpacity={0.15} strokeWidth={2} dot={{ r: 3, fill: D.teal }} />
                  <Tooltip
                    formatter={(v, _, p) => [`${v}%`, p.payload.fullName]}
                    contentStyle={{ backgroundColor: D.surfaceUp, border: `1px solid ${D.border}`, borderRadius: 10, fontSize: 11, fontFamily: font, color: D.text }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {CoursList}

          {mobile && progression && (
            <div style={{ background: `linear-gradient(135deg, ${D.goldPale}, rgba(245,158,11,0.03))`, borderRadius: 12, padding: '12px 14px', marginTop: 12, border: `1px solid ${D.gold}30`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Flame size={18} color={D.gold} style={{ flexShrink: 0 }} />
              <p style={{ fontSize: 11, color: D.textSec, lineHeight: 1.6, margin: 0 }}>
                <strong style={{ color: D.gold }}>{progression.exercices_reussis}</strong> exercice(s) réussi(s) sur {progression.total_exercices}. Continue !
              </p>
            </div>
          )}
        </div>

        <div style={{ animation: 'fadeUp .55s ease', width: !mobile ? 250 : '100%', flexShrink: 0 }}>
          {Sidebar}
        </div>
      </div>
    </div>
  )
}