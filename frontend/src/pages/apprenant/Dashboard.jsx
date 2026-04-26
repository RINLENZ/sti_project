import { useSelector } from 'react-redux'
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  BookOpen, Clock, Target, Award, Flame, Copy, CheckCircle,
  ChevronRight, Brain, Star, ChevronDown, Lock, PlayCircle,
  CheckCircle2, Zap, BarChart2
} from 'lucide-react'

/* ─── Palette ──────────────────────────────────────────────────── */
const C = {
  brown:        '#6B3A2A',
  brownLight:   '#C4865A',
  brownPale:    '#F5EDE5',
  brownMid:     '#A05C38',
  brownDark:    '#3D1F13',
  emerald:      '#0D9373',
  emeraldDark:  '#0A7A5E',
  emeraldPale:  '#E6F5F0',
  bg:           '#FAF7F4',
  surface:      '#FFFFFF',
  surfaceAlt:   '#FDF9F6',
  text:         '#1A1207',
  textSec:      '#6B5744',
  textMuted:    '#9C7E6A',
  red:          '#DC2626',
  orange:       '#F59E0B',
  gold:         '#D4A853',
  goldPale:     '#FBF3E0',
  border:       '#EDE3DA',
}

/* ─── Breakpoints ──────────────────────────────────────────────── */
function useBreakpoint() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)
  useEffect(() => {
    const h = () => setW(window.innerWidth)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return { w, xs: w < 480, mobile: w < 768, desktop: w >= 1024 }
}

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

const ProgressBar = ({ value, color = C.emerald, h = 5, bg = C.border }) => (
  <div style={{ height: h, backgroundColor: bg, borderRadius: h, overflow: 'hidden' }}>
    <div style={{
      height: '100%', width: `${Math.min(100, Math.max(0, value))}%`,
      backgroundColor: color, borderRadius: h, transition: 'width .7s cubic-bezier(.4,0,.2,1)'
    }} />
  </div>
)

const StatCard = ({ label, value, subtitle, color, Icon, xs }) => (
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

/* ── Sidebar BKT top 3 ── */
const SidebarBKT = ({ bktData }) => {
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

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: C.bg }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid ${C.brownPale}`, borderTopColor: C.brown, margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: C.textSec, fontSize: 13, fontWeight: 600 }}>Chargement…</p>
      </div>
    </div>
  )

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
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 5, opacity: .85 }}>
            <span>Progression globale</span>
            <span>{progression.pourcentage}%</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,.2)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 4, background: 'white', width: `${progression.pourcentage}%`, transition: 'width .9s cubic-bezier(.4,0,.2,1)' }} />
          </div>
          <p style={{ fontSize: 10, opacity: .55, marginTop: 4 }}>
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
      {recommandee ? (
        <div style={{
          backgroundColor: C.surface, borderRadius: 14, padding: '16px 18px', marginBottom: 14,
          boxShadow: '0 2px 10px rgba(107,58,42,0.07)', border: `1.5px solid ${C.emerald}25`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Star size={13} color={C.emerald} fill={C.emerald} />
            <h3 style={{ fontSize: 11, fontWeight: 800, color: C.emerald, margin: 0 }}>Recommandé IA</h3>
          </div>
          <span style={{ background: C.brownPale, color: C.brown, padding: '2px 7px', borderRadius: 20, fontSize: 9, fontWeight: 700, display: 'inline-block', marginBottom: 7 }}>
            {recommandee.reference_ue}
          </span>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.text, margin: '0 0 4px', lineHeight: 1.4 }}>{recommandee.titre}</p>
          <p style={{ fontSize: 10, color: C.textMuted, marginBottom: 11 }}>BKT : {Math.round(recommandee.score_bkt * 100)}%</p>
          <button
            onClick={() => navigate(`/cours/${recommandee.ua_id}`)}
            style={{ width: '100%', padding: '8px', background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDark})`, color: 'white', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, boxShadow: `0 3px 10px ${C.emerald}35` }}
          >
            Commencer <ChevronRight size={12} />
          </button>
        </div>
      ) : (
        <div style={{ background: `linear-gradient(135deg, ${C.goldPale}, ${C.brownPale})`, borderRadius: 14, padding: '15px 17px', marginBottom: 14, border: `1px solid ${C.gold}35` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <Flame size={14} color={C.gold} />
            <h3 style={{ fontSize: 12, fontWeight: 800, color: C.brown, margin: 0 }}>Continue comme ça !</h3>
          </div>
          <p style={{ fontSize: 11, color: C.textSec, lineHeight: 1.6, margin: 0 }}>
            <strong style={{ color: C.brown }}>{progression?.exercices_reussis || 0}</strong> exercice(s) réussi(s) sur {progression?.total_exercices || 0}.
          </p>
        </div>
      )}

      <SidebarBKT bktData={bktData} />
      <NextBadge bktData={bktData} />
    </div>
  )

  /* ── RENDER ── */
  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: `${pad}px`, boxSizing: 'border-box', maxWidth: '100vw', overflowX: 'hidden' }}>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes fadeUp  { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        * { box-sizing: border-box; margin: 0; }
        button:focus-visible { outline: 2px solid ${C.emerald}; outline-offset: 2px; }
      `}</style>

      {Hero}
      {StatCards}

      <div style={{ display: 'flex', gap: mobile ? 0 : 18, flexDirection: mobile ? 'column' : 'row', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
          {RecoCard}

          {/* Sélecteur matière si plusieurs */}
          {matieres.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
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

          {/* Titre section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <BookOpen size={14} color={C.brown} />
            <h2 style={{ fontSize: 13, fontWeight: 800, color: C.brown, margin: 0 }}>Mes cours</h2>
            <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>
              {modulesFamilles.length} module{modulesFamilles.length > 1 ? 's' : ''}
            </span>
          </div>

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
        </div>

        {Sidebar}
      </div>
    </div>
  )
}