import { useSelector } from 'react-redux'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Tooltip
} from 'recharts'
import {
  BookOpen, Clock, Target, Award, Flame,
  Copy, CheckCircle, ChevronRight, Brain, Star, ChevronDown
} from 'lucide-react'

/* ── Palette ── */
const C = {
  brown:       '#6B3A2A', brownLight:  '#C4865A',
  emerald:     '#0D9373', bg:          '#FAF7F4',
  surface:     '#FFFFFF', text:        '#1A1207',
  textSec:     '#6B5744', brownPale:   '#F5EDE5',
  emeraldPale: '#E6F5F0', red:         '#DC2626',
  orange:      '#F59E0B', gold:        '#D4A853',
}

/* ── Breakpoints ── */
const BP = { sm: 480, md: 768, lg: 1024 }

function useBreakpoint() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)
  useEffect(() => {
    const h = () => setW(window.innerWidth)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return { w, xs: w < BP.sm, mobile: w < BP.md, tablet: w >= BP.md && w < BP.lg, desktop: w >= BP.lg }
}

/* ── Composants ── */
const ProgressBar = ({ value, color = C.emerald, h = 6 }) => (
  <div style={{ height: h, backgroundColor: '#E5E7EB', borderRadius: h, overflow: 'hidden', flexShrink: 0 }}>
    <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color, borderRadius: h, transition: 'width .6s ease' }} />
  </div>
)

const StatCard = ({ label, value, subtitle, color, Icon, xs }) => (
  <div style={{
    backgroundColor: C.surface, borderRadius: xs ? 12 : 16,
    padding: xs ? '12px 14px' : '16px 18px',
    boxShadow: '0 2px 12px rgba(107,58,42,0.08)',
    border: `1px solid ${C.brownPale}`,
    display: 'flex', flexDirection: 'column', gap: 4,
    position: 'relative', overflow: 'hidden', minWidth: 0,
  }}>
    <div style={{ position: 'absolute', top: -12, right: -12, width: 56, height: 56, borderRadius: '50%', backgroundColor: `${color}12`, pointerEvents: 'none' }} />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 9, color: C.textSec, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4, lineHeight: 1.3 }}>{label}</span>
      {Icon && (
        <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={14} color={color} />
        </div>
      )}
    </div>
    <span style={{ fontSize: xs ? 20 : 24, fontWeight: 900, color: C.text, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    {subtitle && <span style={{ fontSize: 10, color: C.textSec, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</span>}
  </div>
)

const BKTLevel = (p) => {
  if (p >= 95) return { label: 'Maîtrisé',      color: C.emerald }
  if (p >= 70) return { label: 'En bonne voie', color: '#2563eb' }
  if (p >= 40) return { label: 'En progrès',    color: C.orange  }
  return              { label: 'À renforcer',    color: C.red     }
}

const BKTRadarChart = ({ competences, mobile }) => {
  const maxLen = mobile ? 12 : 18
  const data = Object.entries(competences).map(([comp, val]) => ({
    subject: comp.length > maxLen ? comp.substring(0, maxLen) + '…' : comp,
    A: val.pourcentage,
    fullName: comp,
  }))
  return (
    <ResponsiveContainer width="100%" height={mobile ? 180 : 230}>
      <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <PolarGrid stroke="#E5E7EB" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: C.textSec, fontSize: mobile ? 9 : 11, fontWeight: 700 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar name="Maîtrise" dataKey="A" stroke={C.brown} fill={C.brown} fillOpacity={0.22} strokeWidth={2} dot={{ r: 3, fill: C.brown }} />
        <Tooltip
          formatter={(v, _, props) => [`${v}%`, props.payload.fullName]}
          contentStyle={{ backgroundColor: C.surface, border: `1px solid ${C.brownPale}`, borderRadius: 8, fontSize: 11 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}

/* ── CollapsibleSection ── */
const CollapsibleSection = ({ title, subtitle, badge, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ backgroundColor: C.surface, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(107,58,42,0.08)', border: `1px solid ${C.brownPale}`, marginBottom: 16 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', gap: 8 }}
      >
        <div style={{ textAlign: 'left', minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: C.brown, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
          {subtitle && <p style={{ fontSize: 10, color: C.textSec, margin: '2px 0 0' }}>{subtitle}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {badge && (
            <span style={{ background: C.brownPale, color: C.brown, padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{badge}</span>
          )}
          <ChevronDown size={16} color={C.brownLight} style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .25s ease' }} />
        </div>
      </button>
      {open && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  )
}

/* ── Dashboard principal ── */
export default function Dashboard() {
  const { user }  = useSelector(s => s.auth)
  const navigate  = useNavigate()
  const { w, xs, mobile, desktop } = useBreakpoint()

  const [matieres,    setMatieres]    = useState([])
  const [familles,    setFamilles]    = useState([])
  const [progression, setProgression] = useState(null)
  const [bktData,     setBktData]     = useState(null)
  const [recommandee, setRecommandee] = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [copied,      setCopied]      = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get(`/api/cours/matieres${user.niveau_id ? '?niveau_id=' + user.niveau_id : ''}`)
        setMatieres(data)
        if (data[0]?.modules[0]) {
          const mid = data[0].modules[0].id
          const { data: fam } = await api.get(`/api/cours/modules/${mid}/familles`)
          setFamilles(fam)
        }
        const { data: prog } = await api.get(`/api/cours/progression/${user.id}`)
        setProgression(prog)
        const { data: bkt }  = await api.get(`/api/bkt/apprenant/${user.id}`)
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
  }, [user.id])

  function copyCode() {
    navigator.clipboard.writeText(user?.code_invitation || '')
    setCopied(true); toast.success('Code copié !')
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: C.bg }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: `3px solid ${C.brownPale}`, borderTopColor: C.brown, margin: '0 auto 14px', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: C.textSec, fontSize: 13, fontWeight: 600 }}>Chargement…</p>
      </div>
    </div>
  )

  const matiere = matieres[0]
  const pad = xs ? 12 : mobile ? 16 : 24

  /* ── HERO ── */
  const Hero = (
    <div style={{
      background: `linear-gradient(135deg, ${C.brown} 0%, ${C.brownLight} 100%)`,
      borderRadius: xs ? 16 : 20, padding: xs ? '18px 16px' : mobile ? '20px 18px' : '26px 30px',
      marginBottom: xs ? 14 : mobile ? 16 : 22,
      position: 'relative', overflow: 'hidden', color: 'white',
      animation: 'fadeIn .4s ease',
    }}>
      {/* Motif adinkra */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: .06, pointerEvents: 'none' }}>
        <defs>
          <pattern id="adk" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
            <circle cx="30" cy="30" r="12" fill="none" stroke="white" strokeWidth="1.5" />
            <circle cx="30" cy="30" r="6"  fill="none" stroke="white" strokeWidth="1.5" />
            <line x1="30" y1="18" x2="30" y2="12" stroke="white" strokeWidth="1.5" />
            <line x1="18" y1="30" x2="12" y2="30" stroke="white" strokeWidth="1.5" />
            <line x1="42" y1="30" x2="48" y2="30" stroke="white" strokeWidth="1.5" />
            <line x1="30" y1="42" x2="30" y2="48" stroke="white" strokeWidth="1.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#adk)" />
      </svg>

      {/* Ligne principale */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, position: 'relative' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ opacity: .75, fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Bon retour,</p>
          <h1 style={{ fontSize: xs ? 18 : mobile ? 20 : 24, fontWeight: 900, marginBottom: 8, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.prenom} {user?.nom} 👋
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 20, fontSize: xs ? 10 : 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
              🎓 {user?.niveau_label || 'Niveau non défini'}
            </span>
            {matiere && !xs && (
              <span style={{ background: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {matiere.nom}
              </span>
            )}
          </div>
        </div>

        {/* Code invitation — desktop uniquement ici */}
        {user?.code_invitation && !mobile && (
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 16px', border: '1px solid rgba(255,255,255,0.25)', flexShrink: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 700, opacity: .7, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .8 }}>Code tuteur</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: 3 }}>{user.code_invitation}</span>
              <button onClick={copyCode} style={{ background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: 7, padding: '5px 7px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center' }}>
                {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
              </button>
            </div>
            <p style={{ fontSize: 9, opacity: .6, marginTop: 4 }}>Partage à ton enseignant</p>
          </div>
        )}
      </div>

      {/* Code invitation mobile — sous le nom */}
      {user?.code_invitation && mobile && (
        <div style={{ marginTop: 12, position: 'relative', background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 9, opacity: .7, marginBottom: 2, fontWeight: 700 }}>Code tuteur</p>
            <span style={{ fontSize: xs ? 15 : 17, fontWeight: 900, letterSpacing: 2 }}>{user.code_invitation}</span>
          </div>
          <button onClick={copyCode} style={{ background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: 7, padding: '7px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center' }}>
            {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
          </button>
        </div>
      )}

      {/* Barre progression */}
      {progression && (
        <div style={{ marginTop: 14, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 5, opacity: .85 }}>
            <span>Progression globale</span>
            <span>{progression.pourcentage}%</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,.25)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 4, background: 'white', width: `${progression.pourcentage}%`, transition: 'width .8s ease' }} />
          </div>
          <p style={{ fontSize: 10, opacity: .6, marginTop: 4 }}>
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
      gap: xs ? 8 : mobile ? 10 : 12,
      marginBottom: xs ? 14 : mobile ? 16 : 22,
    }}>
      <StatCard label="Score"    value={`${progression.score_total}pts`}        subtitle="Points cumulés"                   color={C.brown}      Icon={Award}    xs={xs} />
      <StatCard label="Réussis"  value={progression.exercices_reussis}           subtitle={`/ ${progression.total_exercices}`} color={C.emerald}  Icon={Target}   xs={xs} />
      <StatCard label="Maîtrisé" value={bktData?.nb_competences_maitrisees || 0} subtitle="compétences ≥95%"                color={C.gold}       Icon={Brain}    xs={xs} />
      <StatCard label="Cours"    value={familles.reduce((a, f) => a + f.unites.length, 0)} subtitle="disponibles"            color={C.brownLight} Icon={BookOpen} xs={xs} />
    </div>
  )

  /* ── UA RECOMMANDÉE ── */
  const RecoCard = recommandee && (
    <div style={{
      background: `linear-gradient(135deg, ${C.emeraldPale}, ${C.brownPale})`,
      borderRadius: 14, padding: xs ? '14px 14px' : '16px 20px',
      marginBottom: xs ? 12 : 16,
      border: `1px solid ${C.emerald}30`,
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', gap: 12,
      animation: 'fadeIn .5s ease',
      flexWrap: xs ? 'wrap' : 'nowrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: `linear-gradient(135deg, ${C.emerald}, #0A7A5E)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Star size={17} color="white" fill="white" />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: C.emerald, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 2 }}>Recommandé par l'IA</p>
          <p style={{ fontSize: xs ? 12 : 13, fontWeight: 800, color: C.text, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {recommandee.titre}
          </p>
          <p style={{ fontSize: 10, color: C.textSec }}>BKT : {Math.round(recommandee.score_bkt * 100)}%</p>
        </div>
      </div>
      <button
        onClick={() => navigate(`/cours/${recommandee.ua_id}`)}
        style={{
          padding: xs ? '8px 14px' : '9px 16px',
          background: `linear-gradient(135deg, ${C.emerald}, #0A7A5E)`,
          color: 'white', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 800,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
          boxShadow: `0 4px 14px ${C.emerald}40`, whiteSpace: 'nowrap', flexShrink: 0,
          width: xs ? '100%' : 'auto', justifyContent: xs ? 'center' : 'flex-start',
        }}
      >
        Commencer <ChevronRight size={13} />
      </button>
    </div>
  )

  /* ── BKT SECTION ── */
  const BKTSection = bktData && Object.keys(bktData.competences).length > 0 && (
    <CollapsibleSection
      title="Maîtrise par compétence"
      subtitle="BKT — Corbett & Anderson (1994)"
      badge={`${bktData.nb_competences_maitrisees} maîtrisée(s)`}
      defaultOpen={!mobile}
    >
      <BKTRadarChart competences={bktData.competences} mobile={mobile} />
      <div style={{
        display: 'grid',
        gridTemplateColumns: xs ? '1fr' : mobile ? '1fr' : 'repeat(auto-fill, minmax(190px, 1fr))',
        gap: 8, marginTop: 12,
      }}>
        {Object.entries(bktData.competences).map(([comp, val]) => {
          const lvl = BKTLevel(val.pourcentage)
          return (
            <div key={comp} style={{ padding: '8px 10px', background: C.brownPale, borderRadius: 8, borderLeft: `3px solid ${lvl.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 6 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, margin: 0 }}>{comp}</p>
                <span style={{ fontSize: 11, color: lvl.color, fontWeight: 800, flexShrink: 0 }}>{val.pourcentage}%</span>
              </div>
              <ProgressBar value={val.pourcentage} color={lvl.color} h={4} />
            </div>
          )
        })}
      </div>
    </CollapsibleSection>
  )

  /* ── LISTE COURS ── */
  const CoursList = familles.map(famille => (
    <div key={famille.id} style={{ marginBottom: xs ? 14 : 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ height: 1.5, flex: 1, background: `linear-gradient(90deg, ${C.brownLight}, transparent)` }} />
        <h2 style={{ fontSize: 9, fontWeight: 800, color: C.brownLight, textTransform: 'uppercase', letterSpacing: 1.2, whiteSpace: 'nowrap' }}>
          {famille.titre}
        </h2>
        <div style={{ height: 1.5, flex: 1, background: `linear-gradient(90deg, transparent, ${C.brownLight})` }} />
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: xs ? '1fr' : mobile ? '1fr' : desktop ? 'repeat(auto-fill, minmax(260px, 1fr))' : 'repeat(2, 1fr)',
        gap: xs ? 8 : mobile ? 10 : 14,
      }}>
        {famille.unites.map(ua => {
          const exReussis = progression?.details?.filter(d => d.correct).length || 0
          const pct = ua.nb_exercices > 0 ? Math.round(exReussis / ua.nb_exercices * 100) : 0
          const statut = pct === 100 ? 'Terminé' : pct > 0 ? 'En cours' : 'Non commencé'
          const statutColor = pct === 100 ? C.emerald : pct > 0 ? C.orange : C.textSec
          const isReco = recommandee?.ua_id === ua.id

          return (
            <div
              key={ua.id}
              onClick={() => navigate(`/cours/${ua.id}`)}
              style={{
                backgroundColor: C.surface, borderRadius: xs ? 12 : 14,
                padding: xs ? '14px 14px' : mobile ? '14px 16px' : '16px 18px',
                cursor: 'pointer', transition: 'all .2s ease',
                boxShadow: isReco ? `0 4px 20px ${C.emerald}25` : '0 2px 10px rgba(107,58,42,0.07)',
                border: isReco ? `2px solid ${C.emerald}50` : `1px solid ${C.brownPale}`,
                minWidth: 0,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                <span style={{ background: C.brownPale, color: C.brown, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                  {ua.reference_ue}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                  {isReco && <span style={{ fontSize: 10, color: C.emerald, fontWeight: 800 }}>⭐</span>}
                  <span style={{ fontSize: 10, fontWeight: 700, color: statutColor, whiteSpace: 'nowrap' }}>{statut}</span>
                </div>
              </div>
              <h3 style={{ fontSize: xs ? 12 : 13, fontWeight: 800, color: C.text, marginBottom: 6, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {ua.titre}
              </h3>
              {!mobile && ua.competences?.slice(0, 2).map((c, i) => (
                <p key={i} style={{ fontSize: 11, color: C.textSec, paddingLeft: 8, borderLeft: `2px solid ${C.brownLight}60`, marginBottom: 3, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c}</p>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.textSec, marginBottom: 8, marginTop: mobile ? 4 : 8, gap: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}><Clock size={10} /> {ua.duree_estimee}min</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}><BookOpen size={10} /> {ua.nb_exercices} exos</span>
              </div>
              <ProgressBar value={pct} color={pct === 100 ? C.emerald : C.brown} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <span style={{ fontSize: 10, color: C.textSec }}>
                  {pct === 100 ? '✓ Terminé' : pct > 0 ? `${pct}% complété` : 'Non commencé'}
                </span>
                <ChevronRight size={12} color={C.brownLight} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  ))

  /* ── SIDEBAR DESKTOP ── */
  const Sidebar = !mobile && (
    <div style={{ width: 250, flexShrink: 0, minWidth: 0 }}>
      {/* Motivation */}
      <div style={{ background: `linear-gradient(135deg, ${C.gold}20, ${C.brownPale})`, borderRadius: 14, padding: '16px 18px', marginBottom: 14, border: `1px solid ${C.gold}40` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Flame size={16} color={C.gold} />
          <h3 style={{ fontSize: 12, fontWeight: 800, color: C.brown, margin: 0 }}>Continue comme ça !</h3>
        </div>
        <p style={{ fontSize: 11, color: C.textSec, lineHeight: 1.6, margin: 0 }}>
          Tu as réussi{' '}
          <strong style={{ color: C.brown }}>{progression?.exercices_reussis || 0} exercice(s)</strong>{' '}
          sur {progression?.total_exercices || 0}.
        </p>
      </div>

      {/* BKT sidebar */}
      {bktData && Object.keys(bktData.competences).length > 0 && (
        <div style={{ backgroundColor: C.surface, borderRadius: 14, padding: '16px 18px', marginBottom: 14, boxShadow: '0 2px 10px rgba(107,58,42,0.07)', border: `1px solid ${C.brownPale}` }}>
          <h3 style={{ fontSize: 12, fontWeight: 800, color: C.brown, marginBottom: 10 }}>Compétences</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(bktData.competences).map(([comp, val]) => {
              const lvl = BKTLevel(val.pourcentage)
              return (
                <div key={comp}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, gap: 6 }}>
                    <span style={{ fontSize: 10, color: C.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{comp}</span>
                    <span style={{ fontSize: 10, color: lvl.color, fontWeight: 700, flexShrink: 0 }}>{val.pourcentage}%</span>
                  </div>
                  <ProgressBar value={val.pourcentage} color={lvl.color} h={3} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recommandé / Prochain cours */}
      {recommandee ? (
        <div style={{ backgroundColor: C.surface, borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 10px rgba(107,58,42,0.07)', border: `1px solid ${C.emerald}30` }}>
          <h3 style={{ fontSize: 12, fontWeight: 800, color: C.emerald, marginBottom: 10 }}>⭐ Recommandé IA</h3>
          <span style={{ background: C.brownPale, color: C.brown, padding: '2px 8px', borderRadius: 20, fontSize: 9, fontWeight: 700, marginBottom: 8, display: 'inline-block' }}>
            {recommandee.reference_ue}
          </span>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.text, margin: '8px 0 4px', lineHeight: 1.4 }}>{recommandee.titre}</p>
          <p style={{ fontSize: 10, color: C.textSec, marginBottom: 12 }}>Maîtrise BKT : {Math.round(recommandee.score_bkt * 100)}%</p>
          <button
            onClick={() => navigate(`/cours/${recommandee.ua_id}`)}
            style={{ width: '100%', padding: '9px', background: `linear-gradient(135deg, ${C.emerald}, #0A7A5E)`, color: 'white', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
          >
            Commencer <ChevronRight size={13} />
          </button>
        </div>
      ) : familles[0]?.unites[0] && (() => {
        const ua = familles[0].unites[0]
        return (
          <div style={{ backgroundColor: C.surface, borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 10px rgba(107,58,42,0.07)', border: `1px solid ${C.brownPale}` }}>
            <h3 style={{ fontSize: 12, fontWeight: 800, color: C.brown, marginBottom: 10 }}>Prochain cours</h3>
            <span style={{ background: C.brownPale, color: C.brown, padding: '2px 8px', borderRadius: 20, fontSize: 9, fontWeight: 700, marginBottom: 8, display: 'inline-block' }}>{ua.reference_ue}</span>
            <p style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6, lineHeight: 1.4 }}>{ua.titre}</p>
            <div style={{ display: 'flex', gap: 10, fontSize: 10, color: C.textSec, marginBottom: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={9} /> {ua.duree_estimee}min</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><BookOpen size={9} /> {ua.nb_exercices} exos</span>
            </div>
            <button
              onClick={() => navigate(`/cours/${ua.id}`)}
              style={{ width: '100%', padding: '9px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
            >
              Commencer <ChevronRight size={13} />
            </button>
          </div>
        )
      })()}
    </div>
  )

  /* ── MOTIVATION MOBILE ── */
  const MotivationMobile = mobile && progression && (
    <div style={{ background: `linear-gradient(135deg, ${C.gold}20, ${C.brownPale})`, borderRadius: 12, padding: '12px 14px', marginTop: 4, border: `1px solid ${C.gold}40`, display: 'flex', alignItems: 'center', gap: 10 }}>
      <Flame size={18} color={C.gold} style={{ flexShrink: 0 }} />
      <p style={{ fontSize: 11, color: C.textSec, lineHeight: 1.5, margin: 0 }}>
        <strong style={{ color: C.brown }}>{progression.exercices_reussis}</strong> exercice(s) réussi(s) sur {progression.total_exercices}. Continue !
      </p>
    </div>
  )

  /* ── RENDER ── */
  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: `${pad}px`, boxSizing: 'border-box', maxWidth: '100vw', overflowX: 'hidden' }}>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes fadeIn  { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        * { box-sizing: border-box; }
      `}</style>

      {Hero}
      {StatCards}

      <div style={{ display: 'flex', gap: mobile ? 0 : 20, flexDirection: mobile ? 'column' : 'row', alignItems: 'flex-start' }}>
        {/* Colonne principale */}
        <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
          {RecoCard}
          {BKTSection}
          {CoursList}
          {MotivationMobile}
        </div>

        {/* Sidebar desktop */}
        {Sidebar}
      </div>
    </div>
  )
}