import { useEffect, useState, useCallback, useRef } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { getCache, setCache } from '../../services/cache'
import toast from 'react-hot-toast'
import {
  Users, TrendingUp, AlertTriangle, Activity,
  RefreshCw, CheckCircle, Plus, Edit2, Check, X,
  FileText, ShieldAlert, ClipboardList
} from 'lucide-react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { useTheme } from '../../styles/theme.jsx'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { SkList, Spinner } from '../../components/Skeleton'

const engColor = (s, C) => s >= 0.7 ? C.emerald : s >= 0.4 ? C.orange : C.red
const engLabel = s => s >= 0.7 ? '🟢 Engagé' : s >= 0.4 ? '🟡 Modéré' : '🔴 Décroché'

// ── Composants utilitaires ────────────────────────────────────────
const ProgressBar = ({ value, color, h = 6 }) => {
  const { C } = useTheme()
  const c = color ?? C.emerald
  return (
    <div style={{ height: h, backgroundColor: C.border, borderRadius: h, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, value)}%`, backgroundColor: c, borderRadius: h, transition: 'width .6s ease' }}/>
    </div>
  )
}

const Dot = ({ score }) => {
  const { C } = useTheme()
  return (
    <span style={{
      display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
      backgroundColor: engColor(score, C),
      boxShadow: `0 0 0 3px ${engColor(score, C)}30`,
      animation: 'pulse 2s infinite'
    }}/>
  )
}


function EpreuvesWidget({ navigate, C }) {
  const { user }    = useSelector(s => s.auth)
  const [eps, setEps] = useState([])

  useEffect(() => {
    api.get('/api/examens/').then(({ data }) => setEps(data)).catch(() => {})
  }, [user.id])

  const publiees  = eps.filter(e => e.statut === 'publie')
  const brouillon = eps.filter(e => e.statut === 'brouillon')

  return (
    <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: 18, marginBottom: 16, border: `1px solid ${C.brownPale}`, boxShadow: '0 2px 10px rgba(107,58,42,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <ClipboardList size={14} color={C.brown}/>
          <h3 style={{ fontSize: 13, fontWeight: 800, color: C.brown, margin: 0 }}>Mes épreuves</h3>
        </div>
        <button onClick={() => navigate('/prof/examens')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, color: C.brownLight }}>Gérer →</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: eps.length > 0 ? 12 : 0 }}>
        {[
          { label: 'Publiées',   value: publiees.length,  color: C.emerald },
          { label: 'Brouillons', value: brouillon.length, color: C.orange  },
        ].map(s => (
          <div key={s.label} style={{ background: C.brownPale, borderRadius: 9, padding: '9px', textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 900, color: s.color, margin: 0 }}>{s.value}</p>
            <p style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, margin: 0 }}>{s.label}</p>
          </div>
        ))}
      </div>
      {publiees.slice(0, 3).map(ep => (
        <div key={ep.id} onClick={() => navigate('/prof/examens')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 9, cursor: 'pointer', marginBottom: 4, background: C.bg, border: `1px solid ${C.border}`, transition: 'all .15s' }}
          onMouseEnter={e => e.currentTarget.style.background = C.brownPale}
          onMouseLeave={e => e.currentTarget.style.background = C.bg}
        >
          <FileText size={12} color={C.brown} style={{ flexShrink: 0 }}/>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.titre}</p>
          <span style={{ fontSize: 9, fontWeight: 700, color: C.emerald, background: `${C.emerald}15`, padding: '1px 6px', borderRadius: 10, flexShrink: 0 }}>
            {ep.nb_reponses || 0} copie{(ep.nb_reponses || 0) !== 1 ? 's' : ''}
          </span>
        </div>
      ))}
      {eps.length === 0 && (
        <p style={{ fontSize: 11, color: C.textMuted, textAlign: 'center', padding: '8px 0' }}>Aucune épreuve créée</p>
      )}

      {/* Nav rapide */}
      <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 12, display: 'flex', gap: 6 }}>
        {[
          { label: 'Cours',       path: '/admin',       icon: '📚' },
          { label: 'Corrections', path: '/corrections', icon: '✏️' },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)} style={{
            flex: 1, background: C.brownPale, border: 'none', borderRadius: 9,
            padding: '8px 6px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 3, cursor: 'pointer', transition: 'background .15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = C.bg}
            onMouseLeave={e => e.currentTarget.style.background = C.brownPale}
          >
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: C.brown }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function BKTModal({ apprenant, onClose }) {
  const { C } = useTheme()
  const [bkt, setBkt]           = useState(null)
  const [history, setHistory]   = useState(null)
  const [epreuves, setEpreuves] = useState(null)
  const [tab, setTab]           = useState('radar')

  useEffect(() => {
    api.get(`/api/bkt/apprenant/${apprenant.user_id}`)
      .then(({ data }) => setBkt(data))
      .catch(() => {})
    api.get(`/api/cours/sessions/historique/${apprenant.user_id}?limit=20`)
      .then(({ data }) => setHistory(data))
      .catch(() => setHistory([]))
    api.get(`/api/examens/apprenant/${apprenant.user_id}/resultats`)
      .then(({ data }) => setEpreuves(data))
      .catch(() => setEpreuves([]))
  }, [apprenant.user_id])

  const data = bkt ? Object.entries(bkt.competences).map(([comp, val]) => ({
    subject: comp.length > 16 ? comp.substring(0, 16) + '…' : comp,
    A: val.pourcentage, fullName: comp,
  })) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>

      {/* ── Header + onglets (fixes) ── */}
      <div style={{ padding: '20px 24px 12px', flexShrink: 0, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: C.brown, margin: 0 }}>
              🧠 {apprenant.prenom} {apprenant.nom}
            </h2>
            <p style={{ fontSize: 11, color: C.textSec, margin: '4px 0 0' }}>
              {bkt?.nb_competences_maitrisees || 0} compétence(s) maîtrisée(s)
            </p>
          </div>
          <button onClick={onClose} style={{ background: C.brownPale, border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.brown }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 4, background: C.border, padding: 4, borderRadius: 10 }}>
          {[
            { key: 'radar',    label: '🎯 Compétences' },
            { key: 'history',  label: '📈 Engagement'  },
            { key: 'epreuves', label: '📋 Épreuves'    },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: '8px', border: 'none', borderRadius: 7,
              cursor: 'pointer', fontSize: 12, fontWeight: tab === t.key ? 800 : 500,
              background: tab === t.key ? C.surface : 'transparent',
              color: tab === t.key ? C.brown : C.textSec,
              boxShadow: tab === t.key ? '0 2px 8px rgba(107,58,42,0.12)' : 'none',
              transition: 'all .15s',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenu scrollable ── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '16px 24px 20px', scrollbarWidth: 'thin', scrollbarColor: `${C.brownPale} transparent` }}>

      {/* Tab: Compétences BKT */}
      {tab === 'radar' && (
        !bkt ? (
          <div style={{ textAlign: 'center', padding: 40, display: 'flex', justifyContent: 'center' }}>
            <Spinner />
          </div>
        ) : data.length === 0 ? (
          <p style={{ textAlign: 'center', color: C.textSec, fontSize: 13, padding: '32px 0' }}>
            Aucune compétence — cet apprenant n'a pas encore fait d'exercices.
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke={C.border} />
                <PolarAngleAxis dataKey="subject" tick={{ fill: C.textSec, fontSize: 10, fontWeight: 700 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="A" stroke={C.brown} fill={C.brown} fillOpacity={0.22} strokeWidth={2} dot={{ r: 3, fill: C.brown }} />
                <Tooltip formatter={(v, _, p) => [`${v}%`, p.payload.fullName]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              </RadarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
              {Object.entries(bkt.competences).map(([comp, val]) => {
                const color = val.pourcentage >= 95 ? C.emerald : val.pourcentage >= 70 ? '#2563EB' : val.pourcentage >= 40 ? C.orange : C.red
                return (
                  <div key={comp} style={{ padding: '6px 10px', background: C.brownPale, borderRadius: 8, borderLeft: `3px solid ${color}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comp}</span>
                      <span style={{ fontSize: 11, color, fontWeight: 800, flexShrink: 0, marginLeft: 8 }}>{val.pourcentage}%</span>
                    </div>
                    <div style={{ height: 4, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${val.pourcentage}%`, background: color, borderRadius: 4, transition: 'width .6s ease' }} />
                    </div>
                    <p style={{ fontSize: 10, color: C.textSec, margin: '3px 0 0' }}>
                      {val.nb_correct}/{val.nb_tentatives} réussis · {val.label}
                    </p>
                  </div>
                )
              })}
            </div>
          </>
        )
      )}

      {/* Tab: Historique engagement */}
      {tab === 'history' && (
        history === null ? (
          <div style={{ textAlign: 'center', padding: 40, display: 'flex', justifyContent: 'center' }}>
            <Spinner />
          </div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>📊</p>
            <p style={{ color: C.textSec, fontSize: 13, fontWeight: 600 }}>Aucune session terminée pour l'instant.</p>
            <p style={{ color: C.textSec, fontSize: 11, marginTop: 4 }}>Les données apparaîtront après la première session complète.</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[
                { label: 'Sessions', value: history.length, color: C.brown },
                { label: 'Engagement moy.', value: `${Math.round(history.reduce((s,h) => s + h.engagement, 0) / history.length)}%`, color: C.emerald },
                { label: 'Score moy.', value: `${Math.round(history.reduce((s,h) => s + h.score_exercices, 0) / history.length)}%`, color: C.orange },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: C.brownPale, borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                  <p style={{ fontSize: 15, fontWeight: 900, color: s.color, margin: 0 }}>{s.value}</p>
                  <p style={{ fontSize: 9, color: C.textSec, fontWeight: 700, margin: 0 }}>{s.label}</p>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={history} margin={{ top: 5, right: 8, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.textSec }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: C.textSec }} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${C.brownPale}` }}
                  formatter={(v, name) => [`${v}%`, name === 'engagement' ? 'Engagement' : 'Score exercices']}
                />
                <Line type="monotone" dataKey="engagement" stroke={C.emerald} strokeWidth={2} dot={{ r: 3, fill: C.emerald }} name="engagement" />
                <Line type="monotone" dataKey="score_exercices" stroke={C.brown} strokeWidth={2} dot={{ r: 3, fill: C.brown }} strokeDasharray="4 2" name="score_exercices" />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: C.textSec }}>
                <div style={{ width: 16, height: 2, background: C.emerald, borderRadius: 1 }} /> Engagement
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: C.textSec }}>
                <div style={{ width: 16, height: 2, background: C.brown, borderRadius: 1, borderTop: '2px dashed ' + C.brown }} /> Score exercices
              </span>
            </div>
          </>
        )
      )}

      {/* Tab: Épreuves */}
      {tab === 'epreuves' && (
        epreuves === null ? (
          <div style={{ textAlign: 'center', padding: 40, display: 'flex', justifyContent: 'center' }}><Spinner /></div>
        ) : epreuves.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>📋</p>
            <p style={{ color: C.textSec, fontSize: 13, fontWeight: 600 }}>Aucune épreuve publiée.</p>
          </div>
        ) : (
          <>
            {(() => {
              const soumises = epreuves.filter(e => e.soumis && e.score_total != null)
              const moy = soumises.length > 0 ? soumises.reduce((a,e) => a + e.score_total, 0) / soumises.length : null
              return (
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {[
                    { label: 'Passées',  value: soumises.length,                                                         color: C.emerald },
                    { label: 'À faire',  value: epreuves.filter(e => !e.soumis && e.statut_ep === 'publie').length,      color: C.orange  },
                    { label: 'Moyenne',  value: moy != null ? `${moy.toFixed(1)}/20` : '—',                              color: '#2563eb' },
                  ].map(s => (
                    <div key={s.label} style={{ flex: 1, background: C.brownPale, borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                      <p style={{ fontSize: 15, fontWeight: 900, color: s.color, margin: 0 }}>{s.value}</p>
                      <p style={{ fontSize: 9, color: C.textSec, fontWeight: 700, margin: 0 }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              )
            })()}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {epreuves.map(ep => (
                <div key={ep.epreuve_id} style={{
                  padding: '10px 12px', borderRadius: 10,
                  background: ep.soumis ? `${C.emerald}08` : C.brownPale,
                  border: `1px solid ${ep.soumis ? C.emerald + '30' : C.border}`,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: ep.soumis ? `${C.emerald}18` : `${C.brown}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {ep.soumis ? <CheckCircle size={15} color={C.emerald}/> : <FileText size={15} color={C.brown}/>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.titre}</p>
                    <p style={{ margin: 0, fontSize: 10, color: C.textMuted }}>
                      {ep.classe_label || ep.type_epreuve}
                      {ep.submitted_at && ` · ${new Date(ep.submitted_at).toLocaleDateString('fr-FR')}`}
                    </p>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    {ep.soumis && ep.score_total != null ? (
                      <>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: ep.score_total >= 10 ? C.emerald : C.red }}>{ep.score_total.toFixed(1)}</p>
                        <p style={{ margin: 0, fontSize: 9, color: C.textMuted }}>/20</p>
                      </>
                    ) : ep.statut_ep === 'publie' ? (
                      <span style={{ fontSize: 9, fontWeight: 700, color: C.orange, background: `${C.orange}15`, padding: '2px 6px', borderRadius: 10 }}>À faire</span>
                    ) : (
                      <span style={{ fontSize: 9, fontWeight: 700, color: C.textMuted }}>—</span>
                    )}
                    {ep.soumis && ep.nb_incidents > 0 && (
                      <ShieldAlert size={11} color="#EF4444" style={{ display: 'block', margin: '2px auto 0' }} title={`${ep.nb_incidents} incident(s)`}/>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      )}
      </div>
    </div>
  )
}

// ── Dashboard Enseignant ──────────────────────────────────────────
export default function DashboardProf() {
  const { C }        = useTheme()
  const { user }     = useSelector(s => s.auth)
  const navigate     = useNavigate()
  const [data, setData]           = useState({ apprenants: [], stats_classe: { nb_apprenants: 0, score_moyen: 0, nb_decrocheurs: 0, niveau_global: 'aucun' }, exercices_difficiles: [] })
  const [loading, setLoading]     = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [codeInput, setCodeInput] = useState('')
  const [linked, setLinked]       = useState([])
  const [linking, setLinking]     = useState(false)
  const [selectedApprenant, setSelectedApprenant] = useState(null)
  const [sortBy,     setSortBy]     = useState('engagement_desc')
  const [filterEng,  setFilterEng]  = useState('all')
  const [referentiel, setReferentiel]     = useState([])       // cycles [{ cycle_id, niveaux, filieres }]
  const [editNiveauFor, setEditNiveauFor] = useState(null)   // apprenant_id en cours d'édition
  const [niveauPick, setNiveauPick]       = useState('')     // niveau_id sélectionné
  const [filierePick, setFilierePick]     = useState('')     // filiere_id sélectionné

  const allNiveaux = referentiel.flatMap(c => c.niveaux.map(n => ({ ...n, cycle_id: c.cycle_id })))
  const filieresPourNiveau = (() => {
    const choisi = allNiveaux.find(n => n.id === niveauPick)
    if (!choisi) return []
    return referentiel.find(c => c.cycle_id === choisi.cycle_id)?.filieres || []
  })()

  const prevScoresRef = useRef({})

  const fetchData = useCallback(async () => {
    const cacheKey = `dashboard_prof_${user.id}`
    const cached = getCache(cacheKey)
    if (cached && loading) {
      setData(cached)
      setLastUpdate(new Date(cached._cachedAt))
      setLoading(false)
    }
    try {
      const { data: res } = await api.get(`/api/cours/dashboard/enseignant?enseignant_id=${user.id}`)

      // Alerte décrochage : notifie si un apprenant passe sous 0.4 pour la première fois
      const prevScores = prevScoresRef.current
      for (const a of (res.apprenants || [])) {
        const prev = prevScores[a.user_id]
        const curr = a.engagement.score
        if (prev !== undefined && prev >= 0.4 && curr < 0.4) {
          toast.error(`⚠️ ${a.prenom} ${a.nom} est en décrochage !`, { duration: 6000 })
        }
        prevScores[a.user_id] = curr
      }

      setCache(cacheKey, { ...res, _cachedAt: Date.now() }, 2 * 60 * 1000)
      setData(res)
      setLastUpdate(new Date())
    } catch {
      if (!cached) toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    api.get('/api/tuteur/referentiel')
      .then(({ data }) => setReferentiel(data))
      .catch(() => {})
  }, [])

  async function saveNiveau(apprenantId) {
    if (!niveauPick) return
    const nChoisi = allNiveaux.find(n => n.id === niveauPick)
    const fChoisi = filieresPourNiveau.find(f => f.id === filierePick)
    if (!nChoisi) return
    try {
      await api.put(`/api/tuteur/apprenant/${apprenantId}/niveau`, {
        niveau_id:     nChoisi.id,
        niveau_label:  nChoisi.nom,
        filiere_id:    fChoisi?.id   || null,
        filiere_label: fChoisi?.nom  || null,
      })
      const label = fChoisi ? `${nChoisi.nom} — ${fChoisi.nom}` : nChoisi.nom
      toast.success(`Classe mise à jour : ${label}`)
      setEditNiveauFor(null)
      fetchData()
    } catch {
      toast.error('Impossible de modifier la classe')
    }
  }

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchData])

  async function lierApprenant() {
    if (!codeInput.trim()) return
    setLinking(true)
    try {
      const { data: res } = await api.post(
        `/auth/tuteur/lier?code=${codeInput.trim().toUpperCase()}&tuteur_id=${user.id}`
      )
      toast.success(`${res.apprenant} lié avec succès !`)
      setLinked(prev => [...prev, { nom: res.apprenant, id: res.apprenant_id }])
      setCodeInput('')
      fetchData()
    } catch {
      toast.error('Code invalide ou apprenant introuvable')
    } finally {
      setLinking(false)
    }
  }

  const { mobile, xs } = useBreakpoint()
  const pad = xs ? 12 : mobile ? 16 : 28

  if (loading) return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: pad, boxSizing: 'border-box' }}>
      <div style={{ background: `linear-gradient(135deg, ${C.brownDark}, ${C.brown})`, borderRadius: xs ? 16 : 20, height: 120, marginBottom: 24 }} />
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ background: C.surface, borderRadius: 16, height: 90, border: `1px solid ${C.brownPale}` }} />
        ))}
      </div>
      <SkList count={3} gap={12} />
    </div>
  )

  const { apprenants, stats_classe, exercices_difficiles } = data
  const alertCount = stats_classe.nb_decrocheurs

  const apprenantsFiltres = apprenants
    .filter(a => {
      const s = a.engagement.score
      if (filterEng === 'engage')   return s >= 0.7
      if (filterEng === 'modere')   return s >= 0.4 && s < 0.7
      if (filterEng === 'decroche') return s < 0.4
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'engagement_desc') return b.engagement.score - a.engagement.score
      if (sortBy === 'engagement_asc')  return a.engagement.score - b.engagement.score
      if (sortBy === 'nom')             return a.nom.localeCompare(b.nom)
      if (sortBy === 'progression')     return b.progression.pourcentage - a.progression.pourcentage
      return 0
    })

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: `${pad}px`, boxSizing: 'border-box' }}>

      {/* ── En-tête ── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.brown} 0%, ${C.brownLight} 100%)`,
        borderRadius: xs ? 16 : 20, padding: xs ? '16px 14px' : mobile ? '20px 20px' : '24px 32px', marginBottom: xs ? 18 : 28,
        position: 'relative', overflow: 'hidden', color: 'white',
        animation: 'fadeUp .35s ease both',
      }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.06, pointerEvents: 'none' }}>
          <defs>
            <pattern id="adinkra-prof" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="12" fill="none" stroke="white" strokeWidth="1.5"/>
              <circle cx="30" cy="30" r="6" fill="none" stroke="white" strokeWidth="1.5"/>
              <line x1="30" y1="18" x2="30" y2="12" stroke="white" strokeWidth="1.5"/>
              <line x1="18" y1="30" x2="12" y2="30" stroke="white" strokeWidth="1.5"/>
              <line x1="42" y1="30" x2="48" y2="30" stroke="white" strokeWidth="1.5"/>
              <line x1="30" y1="42" x2="30" y2="48" stroke="white" strokeWidth="1.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#adinkra-prof)"/>
        </svg>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, position: 'relative' }}>
          <div>
            <p style={{ opacity: .75, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Tableau de bord</p>
            <h1 style={{ fontSize: xs ? 18 : 24, fontWeight: 900, marginBottom: 6 }}>
              {user?.prenom} {user?.nom} 👨‍🏫
            </h1>
            <p style={{ opacity: .75, fontSize: xs ? 12 : 14 }}>
              {apprenants.length} apprenant(s) suivi(s) · Engagement moyen {Math.round(stats_classe.score_moyen * 100)}%
            </p>
          </div>

          {/* Contrôles actualisation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {lastUpdate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.15)', padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                <RefreshCw size={12} color="white"/>
                <span>MAJ: {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: 'rgba(255,255,255,.15)', padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} style={{ cursor: 'pointer' }}/>
              Auto 10s
            </label>
            <button onClick={fetchData} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: 'white', padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={12}/> Actualiser
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats compactes ── */}
      <div style={{ display: 'flex', gap: xs ? 8 : 10, marginBottom: xs ? 16 : 24, flexWrap: 'wrap', animation: 'fadeUp .35s .06s ease both' }}>
        {[
          { label: 'Apprenants', value: apprenants.length,                                        subtitle: 'suivis',    color: C.brown,                              Icon: Users        },
          { label: 'Engagement', value: `${Math.round(stats_classe.score_moyen*100)}%`,           subtitle: 'moyen',     color: C.emerald,                            Icon: TrendingUp   },
          { label: 'Décrochage', value: alertCount,                                               subtitle: alertCount > 0 ? '⚠ attention' : 'aucun', color: alertCount > 0 ? C.red : C.emerald, Icon: AlertTriangle },
          { label: 'Sessions',   value: apprenants.filter(a => a.derniere_session).length,        subtitle: 'récentes',  color: C.orange,                             Icon: Activity     },
        ].map(s => (
          <div key={s.label} style={{
            flex: '1 1 130px',
            backgroundColor: C.surface, borderRadius: 12,
            padding: xs ? '10px 12px' : '12px 16px',
            border: `1px solid ${C.brownPale}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.Icon size={16} color={s.color}/>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: xs ? 16 : 19, fontWeight: 900, color: C.text, lineHeight: 1.1 }}>{s.value}</p>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* ── Liste apprenants ── */}
        <div style={{ flex: 1, minWidth: mobile ? 0 : 400 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ fontSize: mobile ? 16 : 18, fontWeight: 900, color: C.brown }}>
              Engagement en temps réel
            </h2>
            {alertCount > 0 && (
              <span style={{ backgroundColor: C.redPale, color: C.red, fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 20 }}>
                ⚠ {alertCount} alerte{alertCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* ── Barre filtre + tri ── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Filtres engagement */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[
                { key: 'all',      label: `Tous (${apprenants.length})`,                                           bg: C.brownPale,   color: C.brown   },
                { key: 'engage',   label: `🟢 ${apprenants.filter(a => a.engagement.score >= 0.7).length}`,        bg: `${C.emerald}15`, color: C.emerald },
                { key: 'modere',   label: `🟡 ${apprenants.filter(a => a.engagement.score >= 0.4 && a.engagement.score < 0.7).length}`, bg: `${C.orange}15`, color: C.orange },
                { key: 'decroche', label: `🔴 ${apprenants.filter(a => a.engagement.score < 0.4).length}`,         bg: `${C.red}15`,  color: C.red     },
              ].map(f => (
                <button key={f.key} onClick={() => setFilterEng(f.key)} style={{
                  padding: '5px 11px', borderRadius: 20, border: `1.5px solid ${filterEng === f.key ? f.color : 'transparent'}`,
                  background: filterEng === f.key ? f.bg : C.surface,
                  color: filterEng === f.key ? f.color : C.textSec,
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
                }}>{f.label}</button>
              ))}
            </div>

            {/* Séparateur */}
            <div style={{ width: 1, height: 20, background: C.border, flexShrink: 0 }}/>

            {/* Tri */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[
                { key: 'engagement_desc', label: '↓ Engagement' },
                { key: 'engagement_asc',  label: '↑ Engagement' },
                { key: 'nom',             label: 'A–Z'           },
                { key: 'progression',     label: '↓ Score'       },
              ].map(s => (
                <button key={s.key} onClick={() => setSortBy(s.key)} style={{
                  padding: '5px 11px', borderRadius: 20,
                  border: `1.5px solid ${sortBy === s.key ? C.brown : 'transparent'}`,
                  background: sortBy === s.key ? C.brownPale : C.surface,
                  color: sortBy === s.key ? C.brown : C.textSec,
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
                }}>{s.label}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {apprenantsFiltres.map(apprenant => {
              const score = apprenant.engagement.score
              const pct   = apprenant.progression.pourcentage
              const initiales = `${apprenant.prenom[0]}${apprenant.nom[0]}`
              const colors = [C.brown, C.emerald, C.brownLight, C.orange]
              const avatarColor = colors[apprenant.user_id.charCodeAt(0) % colors.length]
              const isAlert = score < 0.4

              return (
                <div
                  key={apprenant.user_id}
                  onClick={() => setSelectedApprenant(apprenant)}
                  style={{
                    backgroundColor: C.surface, borderRadius: 16,
                    padding: mobile ? '14px' : '16px 20px',
                    boxShadow: isAlert ? `0 2px 12px ${C.red}15` : '0 2px 10px rgba(107,58,42,0.07)',
                    border: isAlert ? `1px solid ${C.red}30` : `1px solid ${C.brownPale}`,
                    display: 'grid',
                    gridTemplateColumns: mobile ? '1fr auto' : '2fr 1fr 2fr auto',
                    gridTemplateRows: mobile ? 'auto auto' : '1fr',
                    gap: mobile ? '10px 12px' : 16,
                    alignItems: 'center',
                    animation: 'slideRight .3s ease',
                    cursor: 'pointer',
                    transition: 'box-shadow .2s',
                  }}
                >
                  {/* Identité */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: avatarColor, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, flexShrink: 0 }}>
                      {initiales}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.text }}>
                        {apprenant.prenom} {apprenant.nom}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: C.textSec }}>{apprenant.email}</p>
                    </div>
                  </div>

                  {/* Niveau + Filière — éditables par l'enseignant */}
                  <div onClick={e => e.stopPropagation()}>
                    {editNiveauFor === apprenant.user_id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {/* Sélecteur niveau */}
                        <select
                          autoFocus
                          value={niveauPick}
                          onChange={e => { setNiveauPick(e.target.value); setFilierePick('') }}
                          style={{ fontSize: 11, fontWeight: 700, color: C.brown, border: `1.5px solid ${C.brownLight}`, borderRadius: 7, padding: '3px 6px', outline: 'none', background: C.surface, maxWidth: 130, cursor: 'pointer' }}
                        >
                          <option value="">— niveau —</option>
                          {referentiel.map(c => (
                            <optgroup key={c.cycle_id} label={c.cycle_nom}>
                              {c.niveaux.map(n => (
                                <option key={n.id} value={n.id}>{n.nom}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        {/* Sélecteur filière — si le cycle en a */}
                        {filieresPourNiveau.length > 0 && (
                          <select
                            value={filierePick}
                            onChange={e => setFilierePick(e.target.value)}
                            style={{ fontSize: 11, fontWeight: 700, color: C.emerald, border: `1.5px solid ${C.emerald}`, borderRadius: 7, padding: '3px 6px', outline: 'none', background: '#E6F5F0', maxWidth: 130, cursor: 'pointer' }}
                          >
                            <option value="">— filière —</option>
                            {filieresPourNiveau.map(f => (
                              <option key={f.id} value={f.id}>{f.nom}</option>
                            ))}
                          </select>
                        )}
                        {/* Boutons valider/annuler */}
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => saveNiveau(apprenant.user_id)} style={{ background: C.emerald, border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: 'white' }}>
                            <Check size={10} /> OK
                          </button>
                          <button onClick={() => { setEditNiveauFor(null); setNiveauPick(''); setFilierePick('') }} style={{ background: '#FEE2E2', border: 'none', borderRadius: 6, padding: '4px 5px', cursor: 'pointer', display: 'flex' }}>
                            <X size={10} color={C.red} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 700, color: C.textSec, margin: 0, whiteSpace: 'nowrap' }}>
                            {apprenant.niveau || 'N/A'}
                          </p>
                          {apprenant.filiere_label && (
                            <p style={{ fontSize: 10, color: C.emerald, fontWeight: 600, margin: 0 }}>
                              {apprenant.filiere_label}
                            </p>
                          )}
                        </div>
                        {referentiel.length > 0 && (
                          <button
                            title="Modifier la classe"
                            onClick={() => { setEditNiveauFor(apprenant.user_id); setNiveauPick(''); setFilierePick('') }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', opacity: 0.45, transition: 'opacity .15s' }}
                            onMouseEnter={e => e.currentTarget.style.opacity = 1}
                            onMouseLeave={e => e.currentTarget.style.opacity = 0.45}
                          >
                            <Edit2 size={11} color={C.brown} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Progression — pleine largeur sur mobile */}
                  {!mobile && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 11, color: C.textSec }}>Exercices</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: C.brown }}>{pct}%</span>
                      </div>
                      <ProgressBar value={pct} color={C.brown} h={5}/>
                      <p style={{ fontSize: 10, color: C.textSec, marginTop: 3 }}>
                        {apprenant.progression.exercices_reussis}/{apprenant.progression.total_exercices} · {apprenant.progression.score_total} pts
                      </p>
                    </div>
                  )}

                  {/* Engagement */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Dot score={score}/>
                      <span style={{ fontSize: mobile ? 13 : 14, fontWeight: 900, color: engColor(score, C) }}>
                        {Math.round(score * 100)}%
                      </span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: engColor(score, C) }}>
                      {engLabel(score)}
                    </span>
                    {isAlert && (
                      <span style={{ backgroundColor: C.redPale, color: C.red, fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20 }}>
                        ⚠ Décrochage
                      </span>
                    )}
                  </div>

                  {/* Progression mobile — deuxième ligne */}
                  {mobile && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: C.textSec }}>Exercices réussis</span>
                        <span style={{ fontSize: 11, fontWeight: 800, color: C.brown }}>{pct}%</span>
                      </div>
                      <ProgressBar value={pct} color={C.brown} h={4}/>
                      <p style={{ fontSize: 10, color: C.textSec, marginTop: 3 }}>
                        {apprenant.progression.exercices_reussis}/{apprenant.progression.total_exercices} · {apprenant.progression.score_total} pts
                      </p>
                    </div>
                  )}
                </div>
              )
            })}

            {apprenantsFiltres.length === 0 && (
              <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: 32, textAlign: 'center', border: `1px solid ${C.brownPale}` }}>
                <p style={{ color: C.textSec, fontSize: 14, fontWeight: 600 }}>
                  {apprenants.length === 0
                    ? "Aucun apprenant suivi pour l'instant."
                    : 'Aucun apprenant dans ce filtre.'}
                </p>
                {apprenants.length === 0 && (
                  <p style={{ color: C.textSec, fontSize: 12, marginTop: 8 }}>
                    Utilisez le panneau "Lier un apprenant" pour commencer.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Panneau droit ── */}
        <div style={{ width: mobile ? '100%' : 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Lier un apprenant */}
          <div style={{ backgroundColor: C.surface, borderRadius: 18, padding: 22, boxShadow: '0 2px 12px rgba(107,58,42,0.08)', border: `1px solid ${C.brownPale}` }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: C.brown, marginBottom: 14 }}>
              🔗 Lier un apprenant
            </h3>
            <p style={{ fontSize: 12, color: C.textSec, marginBottom: 12, lineHeight: 1.5 }}>
              Entre le code d'invitation de l'apprenant pour suivre sa progression.
            </p>
            <input
              value={codeInput}
              onChange={e => setCodeInput(e.target.value.toUpperCase())}
              placeholder="Code ex: RYJGJBAC"
              style={{
                width: '100%', padding: '10px 12px',
                backgroundColor: C.brownPale,
                border: `1px solid ${C.brownLight}40`,
                borderRadius: 8, fontSize: 13, fontWeight: 700,
                color: C.text, outline: 'none',
                fontFamily: 'monospace', letterSpacing: 2,
                marginBottom: 10
              }}
            />
            <button onClick={lierApprenant} disabled={linking || !codeInput.trim()} style={{
              width: '100%', padding: '11px',
              background: codeInput.trim() ? `linear-gradient(135deg, ${C.brown}, ${C.brownLight})` : C.border,
              color: codeInput.trim() ? 'white' : C.textSec,
              border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 700,
              cursor: codeInput.trim() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
            }}>
              <Plus size={14}/> {linking ? 'Liaison…' : 'Lier cet apprenant'}
            </button>

            {linked.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: C.textSec, marginBottom: 10, textTransform: 'uppercase', letterSpacing: .6 }}>
                  Apprenants liés ({linked.length})
                </p>
                {linked.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: C.brown, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>
                      {a.nom?.[0]}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{a.nom}</span>
                    <CheckCircle size={14} color={C.emerald} style={{ marginLeft: 'auto', flexShrink: 0 }}/>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Exercices problématiques */}
          {exercices_difficiles?.length > 0 && (
            <div style={{ backgroundColor: C.surface, borderRadius: 18, padding: 22, boxShadow: '0 2px 12px rgba(107,58,42,0.08)', border: `1px solid ${C.brownPale}` }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: C.brown, marginBottom: 16 }}>
                🔥 Exercices problématiques
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {exercices_difficiles.map((ex, i) => (
                  <div key={i} style={{ backgroundColor: C.brownPale, borderRadius: 12, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.text, flex: 1, lineHeight: 1.3 }}>
                        {ex.titre}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 900, color: ex.taux_echec > 60 ? C.red : C.orange, marginLeft: 8, flexShrink: 0 }}>
                        {ex.taux_echec}%
                      </span>
                    </div>
                    <p style={{ fontSize: 10, color: C.textSec, marginBottom: 8 }}>
                      {ex.total_tentatives} tentatives · taux d'échec
                    </p>
                    <ProgressBar value={ex.taux_echec} color={ex.taux_echec > 60 ? C.red : C.orange} h={5}/>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Widget épreuves + nav intégrée */}
          <EpreuvesWidget navigate={navigate} C={C} />
        </div>
      </div>

      {/* MODAL - Placé ici, après tout le contenu principal */}
      {selectedApprenant && (
        <div
          onClick={() => setSelectedApprenant(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(26,18,7,.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 24, backdropFilter: 'blur(3px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: C.surface, borderRadius: 20, maxWidth: 560, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,.4)' }}
          >
            <BKTModal apprenant={selectedApprenant} onClose={() => setSelectedApprenant(null)} />
          </div>
        </div>
      )}
    </div>
  )
}