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
  Copy, CheckCircle, ChevronRight, Brain
} from 'lucide-react'

const C = {
  brown:       '#6B3A2A', brownLight:  '#C4865A',
  emerald:     '#0D9373', bg:          '#FAF7F4',
  surface:     '#FFFFFF', text:        '#1A1207',
  textSec:     '#6B5744', brownPale:   '#F5EDE5',
  emeraldPale: '#E6F5F0', red:         '#DC2626',
  orange:      '#F59E0B', gold:        '#D4A853',
}

const ProgressBar = ({ value, color = C.emerald, h = 6 }) => (
  <div style={{ height: h, backgroundColor: '#E5E7EB', borderRadius: h, overflow: 'hidden' }}>
    <div style={{ height: '100%', width: `${Math.min(100, value)}%`, backgroundColor: color, borderRadius: h, transition: 'width .6s ease' }}/>
  </div>
)

const StatCard = ({ label, value, subtitle, color, Icon }) => (
  <div style={{
    backgroundColor: C.surface, borderRadius: 16, padding: '20px 22px',
    boxShadow: '0 2px 12px rgba(107,58,42,0.08)', border: `1px solid ${C.brownPale}`,
    display: 'flex', flexDirection: 'column', gap: 8,
    position: 'relative', overflow: 'hidden', transition: 'all .2s ease',
  }}>
    <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', backgroundColor: `${color}12` }}/>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: C.textSec, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5 }}>{label}</span>
      {Icon && (
        <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} color={color}/>
        </div>
      )}
    </div>
    <span style={{ fontSize: 30, fontWeight: 900, color: C.text, lineHeight: 1 }}>{value}</span>
    {subtitle && <span style={{ fontSize: 12, color: C.textSec, fontWeight: 600 }}>{subtitle}</span>}
  </div>
)

const BKTLevel = (p) => {
  if (p >= 95) return { label: 'Maîtrisé',      color: C.emerald }
  if (p >= 70) return { label: 'En bonne voie', color: '#2563eb' }
  if (p >= 40) return { label: 'En progrès',    color: C.orange  }
  return              { label: 'À renforcer',    color: C.red     }
}

const BKTRadarChart = ({ competences }) => {
  const data = Object.entries(competences).map(([comp, val]) => ({
    subject: comp.length > 22 ? comp.substring(0, 22) + '…' : comp,
    A: val.pourcentage, fullName: comp
  }))
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={data}>
        <PolarGrid stroke="#E5E7EB"/>
        <PolarAngleAxis dataKey="subject" tick={{ fill: C.textSec, fontSize: 11, fontWeight: 700 }}/>
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false}/>
        <Radar name="Maîtrise" dataKey="A" stroke={C.brown} fill={C.brown} fillOpacity={0.22} strokeWidth={2} dot={{ r: 4, fill: C.brown }}/>
        <Tooltip formatter={(v, _, props) => [`${v}%`, props.payload.fullName]} contentStyle={{ backgroundColor: C.surface, border: `1px solid ${C.brownPale}`, borderRadius: 8, fontSize: 12 }}/>
      </RadarChart>
    </ResponsiveContainer>
  )
}

export default function Dashboard() {
  const { user }  = useSelector(s => s.auth)
  const navigate  = useNavigate()

  // ── États ───────────────────────────────────────────────────────
  const [matieres,    setMatieres]    = useState([])
  const [familles,    setFamilles]    = useState([])
  const [progression, setProgression] = useState(null)
  const [bktData,     setBktData]     = useState(null)
  const [recommandee, setRecommandee] = useState(null)   // ← UA recommandée BKT
  const [loading,     setLoading]     = useState(true)
  const [copied,      setCopied]      = useState(false)

  // ── Chargement ──────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/api/cours/matieres')
        setMatieres(data)
        if (data[0]?.modules[0]) {
          const mid = data[0].modules[0].id
          const { data: fam } = await api.get(`/api/cours/modules/${mid}/familles`)
          setFamilles(fam)
        }
        const { data: prog } = await api.get(`/api/cours/progression/${user.id}`)
        setProgression(prog)
        const { data: bkt } = await api.get(`/api/bkt/apprenant/${user.id}`)
        setBktData(bkt)

        // ← Récupère la recommandation BKT
        try {
          const { data: reco } = await api.get(`/api/cours/ua/recommandee/${user.id}`)
          setRecommandee(reco?.recommandee || null)
        } catch {
          // Endpoint optionnel — ne bloque pas le chargement
        }
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
    setCopied(true)
    toast.success('Code copié !')
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Chargement ──────────────────────────────────────────────────
  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: C.bg }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', border: `3px solid ${C.brownPale}`, borderTopColor: C.brown, margin: '0 auto 16px', animation: 'spin 1s linear infinite' }}/>
        <p style={{ color: C.textSec, fontSize: 14, fontWeight: 600 }}>Chargement de ton espace…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  const matiere = matieres[0]

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '28px' }}>

      {/* ── Hero header ── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.brown} 0%, ${C.brownLight} 100%)`,
        borderRadius: 20, padding: '28px 32px', marginBottom: 28,
        position: 'relative', overflow: 'hidden', color: 'white'
      }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.06, pointerEvents: 'none' }}>
          <defs>
            <pattern id="adinkra-dash" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="12" fill="none" stroke="white" strokeWidth="1.5"/>
              <circle cx="30" cy="30" r="6"  fill="none" stroke="white" strokeWidth="1.5"/>
              <line x1="30" y1="18" x2="30" y2="12" stroke="white" strokeWidth="1.5"/>
              <line x1="18" y1="30" x2="12" y2="30" stroke="white" strokeWidth="1.5"/>
              <line x1="42" y1="30" x2="48" y2="30" stroke="white" strokeWidth="1.5"/>
              <line x1="30" y1="42" x2="30" y2="48" stroke="white" strokeWidth="1.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#adinkra-dash)"/>
        </svg>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, position: 'relative' }}>
          <div>
            <p style={{ opacity: .75, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Bon retour,</p>
            <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 6, lineHeight: 1.1 }}>
              {user?.prenom} {user?.nom} 👋
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                🎓 {user?.niveau || 'Niveau non défini'}
              </span>
              {matiere && (
                <span style={{ background: 'rgba(255,255,255,0.15)', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  {matiere.nom}
                </span>
              )}
            </div>
          </div>

          {user?.code_invitation && (
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: '14px 18px', border: '1px solid rgba(255,255,255,0.25)', minWidth: 200 }}>
              <p style={{ fontSize: 10, fontWeight: 700, opacity: .7, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .8 }}>
                Ton code tuteur
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: 3 }}>{user.code_invitation}</span>
                <button onClick={copyCode} style={{ background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center' }}>
                  {copied ? <CheckCircle size={14}/> : <Copy size={14}/>}
                </button>
              </div>
              <p style={{ fontSize: 10, opacity: .6, marginTop: 6 }}>Partage ce code à ton enseignant</p>
            </div>
          )}
        </div>

        {progression && (
          <div style={{ marginTop: 24, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 8, opacity: .85 }}>
              <span>Progression globale</span>
              <span>{progression.pourcentage}%</span>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,.25)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 4, background: 'white', width: `${progression.pourcentage}%`, transition: 'width .8s ease' }}/>
            </div>
            <p style={{ fontSize: 11, opacity: .65, marginTop: 6 }}>
              {progression.exercices_reussis} / {progression.total_exercices} exercices réussis · {progression.score_total} points
            </p>
          </div>
        )}
      </div>

      {/* ── Stat cards ── */}
      {progression && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }}>
          <StatCard label="Score total"       value={`${progression.score_total} pts`}    subtitle="Points accumulés"              color={C.brown}      Icon={Award}/>
          <StatCard label="Exercices réussis" value={progression.exercices_reussis}        subtitle={`sur ${progression.total_exercices} au total`} color={C.emerald} Icon={Target}/>
          <StatCard label="Compétences"       value={bktData?.nb_competences_maitrisees||0} subtitle="maîtrisées (≥95%)"           color={C.gold}       Icon={Brain}/>
          <StatCard label="Cours disponibles" value={familles.reduce((a,f)=>a+f.unites.length,0)} subtitle={`niveau ${user?.niveau||''}`} color={C.brownLight} Icon={BookOpen}/>
        </div>
      )}

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>

        {/* ── Colonne principale ── */}
        <div style={{ flex: 1, minWidth: 300 }}>

          {/* ── Carte UA recommandée par BKT ── */}
          {recommandee && (
            <div style={{
              background: `linear-gradient(135deg, ${C.emeraldPale}, ${C.brownPale})`,
              borderRadius: 16, padding: '18px 22px', marginBottom: 24,
              border: `1px solid ${C.emerald}30`,
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', flexWrap: 'wrap', gap: 14
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: `linear-gradient(135deg, ${C.emerald}, #0A7A5E)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
                }}>
                  ⭐
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: C.emerald, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 3 }}>
                    Prochaine leçon recommandée par l'IA
                  </p>
                  <p style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 2 }}>
                    {recommandee.titre}
                  </p>
                  <p style={{ fontSize: 11, color: C.textSec }}>
                    {recommandee.reference_ue} · Maîtrise actuelle : {Math.round(recommandee.score_bkt * 100)}%
                  </p>
                </div>
              </div>
              <button onClick={() => navigate(`/cours/${recommandee.ua_id}`)} style={{
                padding: '10px 20px',
                background: `linear-gradient(135deg, ${C.emerald}, #0A7A5E)`,
                color: 'white', border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: `0 4px 14px ${C.emerald}40`
              }}>
                Commencer <ChevronRight size={14}/>
              </button>
            </div>
          )}

          {/* ── BKT Radar ── */}
          {bktData && Object.keys(bktData.competences).length > 0 && (
            <div style={{ backgroundColor: C.surface, borderRadius: 20, padding: '22px 24px', boxShadow: '0 2px 12px rgba(107,58,42,0.08)', border: `1px solid ${C.brownPale}`, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 800, color: C.brown, marginBottom: 2 }}>Maîtrise par compétence</h2>
                  <p style={{ fontSize: 12, color: C.textSec }}>Algorithme BKT — Corbett & Anderson (1994)</p>
                </div>
                <span style={{ background: C.brownPale, color: C.brown, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                  {bktData.nb_competences_maitrisees} maîtrisée(s)
                </span>
              </div>
              <BKTRadarChart competences={bktData.competences}/>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginTop: 16 }}>
                {Object.entries(bktData.competences).map(([comp, val]) => {
                  const lvl = BKTLevel(val.pourcentage)
                  return (
                    <div key={comp} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: C.brownPale, borderRadius: 8, borderLeft: `3px solid ${lvl.color}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>{comp}</p>
                        <p style={{ fontSize: 11, color: lvl.color, fontWeight: 700 }}>{val.pourcentage}% — {lvl.label}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Liste des cours ── */}
          {familles.map(famille => (
            <div key={famille.id} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ height: 2, flex: 1, background: `linear-gradient(90deg, ${C.brownLight}, transparent)` }}/>
                <h2 style={{ fontSize: 11, fontWeight: 800, color: C.brownLight, textTransform: 'uppercase', letterSpacing: 1.2, whiteSpace: 'nowrap' }}>
                  {famille.titre}
                </h2>
                <div style={{ height: 2, flex: 1, background: `linear-gradient(90deg, transparent, ${C.brownLight})` }}/>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                {famille.unites.map(ua => {
                  const exReussis = progression?.details?.filter(d => d.correct).length || 0
                  const pct = ua.nb_exercices > 0 ? Math.round(exReussis / ua.nb_exercices * 100) : 0
                  const statut = pct === 100 ? 'Terminé' : pct > 0 ? 'En cours' : 'Non commencé'
                  const statutColor = pct === 100 ? C.emerald : pct > 0 ? C.orange : C.textSec
                  const isRecommandee = recommandee?.ua_id === ua.id

                  return (
                    <div key={ua.id}
                      onClick={() => navigate(`/cours/${ua.id}`)}
                      style={{
                        backgroundColor: C.surface, borderRadius: 16, padding: '18px 20px',
                        cursor: 'pointer', transition: 'all .2s ease',
                        boxShadow: isRecommandee ? `0 4px 20px ${C.emerald}25` : '0 2px 10px rgba(107,58,42,0.07)',
                        border: isRecommandee ? `2px solid ${C.emerald}50` : `1px solid ${C.brownPale}`,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(107,58,42,0.16)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = isRecommandee ? `0 4px 20px ${C.emerald}25` : '0 2px 10px rgba(107,58,42,0.07)' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <span style={{ background: C.brownPale, color: C.brown, padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>
                          {ua.reference_ue}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isRecommandee && <span style={{ fontSize: 10, color: C.emerald, fontWeight: 800 }}>⭐ Recommandé</span>}
                          <span style={{ fontSize: 10, fontWeight: 700, color: statutColor }}>{statut}</span>
                        </div>
                      </div>
                      <h3 style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 10, lineHeight: 1.4 }}>{ua.titre}</h3>
                      <div style={{ marginBottom: 14 }}>
                        {ua.competences?.slice(0, 2).map((c, i) => (
                          <p key={i} style={{ fontSize: 11, color: C.textSec, paddingLeft: 10, borderLeft: `2px solid ${C.brownLight}60`, marginBottom: 4, lineHeight: 1.4 }}>{c}</p>
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textSec, marginBottom: 10 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11}/> {ua.duree_estimee} min</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><BookOpen size={11}/> {ua.nb_exercices} exercices</span>
                      </div>
                      <ProgressBar value={pct} color={pct === 100 ? C.emerald : C.brown}/>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        <span style={{ fontSize: 10, color: C.textSec }}>
                          {pct === 100 ? '✓ Terminé' : pct > 0 ? `${pct}% complété` : 'Non commencé'}
                        </span>
                        <ChevronRight size={14} color={C.brownLight}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── Sidebar droite ── */}
        <div style={{ width: 260, flexShrink: 0 }}>

          {/* Motivation */}
          <div style={{ background: `linear-gradient(135deg, ${C.gold}20, ${C.brownPale})`, borderRadius: 16, padding: '18px 20px', marginBottom: 16, border: `1px solid ${C.gold}40` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Flame size={20} color={C.gold}/>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: C.brown }}>Continue comme ça !</h3>
            </div>
            <p style={{ fontSize: 12, color: C.textSec, lineHeight: 1.6 }}>
              Tu as réussi{' '}
              <strong style={{ color: C.brown }}>{progression?.exercices_reussis || 0} exercice(s)</strong>{' '}
              sur {progression?.total_exercices || 0}. Continue pour maîtriser toutes les compétences.
            </p>
          </div>

          {/* BKT détail */}
          {bktData && Object.keys(bktData.competences).length > 0 && (
            <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: '18px 20px', marginBottom: 16, boxShadow: '0 2px 10px rgba(107,58,42,0.07)', border: `1px solid ${C.brownPale}` }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, color: C.brown, marginBottom: 14 }}>Détail des compétences</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(bktData.competences).map(([comp, val]) => {
                  const lvl = BKTLevel(val.pourcentage)
                  return (
                    <div key={comp}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
                        <span style={{ color: C.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{comp}</span>
                        <span style={{ color: lvl.color, fontWeight: 700, flexShrink: 0 }}>{val.pourcentage}%</span>
                      </div>
                      <ProgressBar value={val.pourcentage} color={lvl.color} h={5}/>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Prochain cours */}
          {recommandee ? (
            <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: '18px 20px', boxShadow: '0 2px 10px rgba(107,58,42,0.07)', border: `1px solid ${C.emerald}30` }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, color: C.emerald, marginBottom: 12 }}>
                ⭐ Recommandé par l'IA
              </h3>
              <span style={{ background: C.brownPale, color: C.brown, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, marginBottom: 8, display: 'inline-block' }}>
                {recommandee.reference_ue}
              </span>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '8px 0 4px', lineHeight: 1.4 }}>
                {recommandee.titre}
              </p>
              <p style={{ fontSize: 11, color: C.textSec, marginBottom: 14 }}>
                Maîtrise BKT : {Math.round(recommandee.score_bkt * 100)}%
              </p>
              <button onClick={() => navigate(`/cours/${recommandee.ua_id}`)} style={{
                width: '100%', padding: '10px',
                background: `linear-gradient(135deg, ${C.emerald}, #0A7A5E)`,
                color: 'white', border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
              }}>
                Commencer <ChevronRight size={14}/>
              </button>
            </div>
          ) : familles[0]?.unites[0] && (
            <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: '18px 20px', boxShadow: '0 2px 10px rgba(107,58,42,0.07)', border: `1px solid ${C.brownPale}` }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, color: C.brown, marginBottom: 12 }}>Prochain cours</h3>
              {(() => {
                const ua = familles[0].unites[0]
                return (
                  <div>
                    <span style={{ background: C.brownPale, color: C.brown, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, marginBottom: 8, display: 'inline-block' }}>
                      {ua.reference_ue}
                    </span>
                    <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8, lineHeight: 1.4 }}>{ua.titre}</p>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.textSec, marginBottom: 14 }}>
                      <span><Clock size={11}/> {ua.duree_estimee} min</span>
                      <span><BookOpen size={11}/> {ua.nb_exercices} exos</span>
                    </div>
                    <button onClick={() => navigate(`/cours/${ua.id}`)} style={{
                      width: '100%', padding: '10px',
                      background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
                      color: 'white', border: 'none', borderRadius: 10,
                      fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                    }}>
                      Commencer <ChevronRight size={14}/>
                    </button>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}