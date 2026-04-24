import { useEffect, useState, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  Users, TrendingUp, AlertTriangle, Activity,
  RefreshCw, CheckCircle, Plus, ChevronRight
} from 'lucide-react'

// ── Thème ─────────────────────────────────────────────────────────
const C = {
  brown:       '#6B3A2A', brownLight:  '#C4865A',
  emerald:     '#0D9373', bg:          '#FAF7F4',
  surface:     '#FFFFFF', text:        '#1A1207',
  textSec:     '#6B5744', brownPale:   '#F5EDE5',
  emeraldPale: '#E6F5F0', red:         '#DC2626',
  orange:      '#F59E0B', gold:        '#D4A853',
}

const engColor = s => s >= 0.7 ? C.emerald : s >= 0.4 ? C.orange : C.red
const engLabel = s => s >= 0.7 ? '🟢 Engagé' : s >= 0.4 ? '🟡 Modéré' : '🔴 Décroché'

// ── Composants utilitaires ────────────────────────────────────────
const ProgressBar = ({ value, color = C.emerald, h = 6 }) => (
  <div style={{ height: h, backgroundColor: '#E5E7EB', borderRadius: h, overflow: 'hidden' }}>
    <div style={{ height: '100%', width: `${Math.min(100, value)}%`, backgroundColor: color, borderRadius: h, transition: 'width .6s ease' }}/>
  </div>
)

const Dot = ({ score }) => (
  <span style={{
    display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
    backgroundColor: engColor(score),
    boxShadow: `0 0 0 3px ${engColor(score)}30`,
    animation: 'pulse 2s infinite'
  }}/>
)

const StatCard = ({ label, value, subtitle, color, Icon, trend }) => (
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
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
      <span style={{ fontSize: 30, fontWeight: 900, color: C.text, lineHeight: 1 }}>{value}</span>
      {trend && <TrendingUp size={16} color={C.emerald} style={{ marginBottom: 3 }}/>}
    </div>
    {subtitle && <span style={{ fontSize: 12, color: C.textSec, fontWeight: 600 }}>{subtitle}</span>}
  </div>
)

// ── Dashboard Enseignant ──────────────────────────────────────────
export default function DashboardProf() {
  const { user }     = useSelector(s => s.auth)
  const navigate     = useNavigate()
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [codeInput, setCodeInput] = useState('')
  const [linked, setLinked]       = useState([])
  const [linking, setLinking]     = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const { data: res } = await api.get(`/api/cours/dashboard/enseignant?enseignant_id=${user.id}`)
      setData(res)
      setLastUpdate(new Date())
    } catch {
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

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

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: C.bg }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: `3px solid ${C.brownPale}`, borderTopColor: C.brown, margin: '0 auto 12px', animation: 'spin 1s linear infinite' }}/>
        <p style={{ color: C.textSec, fontSize: 14, fontWeight: 600 }}>Chargement du tableau de bord…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const { apprenants, stats_classe, exercices_difficiles } = data
  const alertCount = stats_classe.nb_decrocheurs

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '28px' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes slideRight{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}`}</style>

      {/* ── En-tête ── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.brown} 0%, ${C.brownLight} 100%)`,
        borderRadius: 20, padding: '24px 32px', marginBottom: 28,
        position: 'relative', overflow: 'hidden', color: 'white'
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
            <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 6 }}>
              {user?.prenom} {user?.nom} 👨‍🏫
            </h1>
            <p style={{ opacity: .75, fontSize: 14 }}>
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

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        <StatCard label="Apprenants suivis"  value={apprenants.length}                            subtitle="total actifs"                           color={C.brown}   Icon={Users}/>
        <StatCard label="Engagement moyen"   value={`${Math.round(stats_classe.score_moyen*100)}%`} subtitle="sur les sessions actives"            color={C.emerald} Icon={TrendingUp} trend/>
        <StatCard label="En décrochage"      value={alertCount}                                   subtitle={alertCount>0?'⚠ Attention requise':'Tout va bien'} color={alertCount>0?C.red:C.emerald} Icon={AlertTriangle}/>
        <StatCard label="Sessions actives"   value={apprenants.filter(a=>a.derniere_session).length} subtitle="ont une session récente"            color={C.orange}  Icon={Activity}/>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* ── Liste apprenants ── */}
        <div style={{ flex: 1, minWidth: 400 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: C.brown }}>
              Engagement en temps réel
            </h2>
            {alertCount > 0 && (
              <span style={{ backgroundColor: '#FEE2E2', color: C.red, fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 20 }}>
                ⚠ {alertCount} alerte{alertCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {apprenants.map(apprenant => {
              const score = apprenant.engagement.score
              const pct   = apprenant.progression.pourcentage
              const initiales = `${apprenant.prenom[0]}${apprenant.nom[0]}`
              const colors = [C.brown, C.emerald, C.brownLight, C.orange]
              const avatarColor = colors[apprenant.user_id.charCodeAt(0) % colors.length]

              return (
                <div key={apprenant.user_id} style={{
                  backgroundColor: C.surface, borderRadius: 16, padding: '16px 20px',
                  boxShadow: score < 0.4 ? `0 2px 12px ${C.red}15` : '0 2px 10px rgba(107,58,42,0.07)',
                  border: score < 0.4 ? `1px solid ${C.red}30` : `1px solid ${C.brownPale}`,
                  display: 'grid', gridTemplateColumns: '2fr 1fr 2fr 1fr',
                  gap: 16, alignItems: 'center',
                  animation: 'slideRight .3s ease'
                }}>
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

                  {/* Niveau */}
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.textSec, whiteSpace: 'nowrap' }}>
                    {apprenant.niveau || 'N/A'}
                  </span>

                  {/* Progression */}
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

                  {/* Engagement */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Dot score={score}/>
                      <span style={{ fontSize: 14, fontWeight: 900, color: engColor(score) }}>
                        {Math.round(score * 100)}%
                      </span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: engColor(score) }}>
                      {engLabel(score)}
                    </span>
                    {score < 0.4 && (
                      <span style={{ backgroundColor: '#FEE2E2', color: C.red, fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20 }}>
                        ⚠ Décrochage
                      </span>
                    )}
                  </div>
                </div>
              )
            })}

            {apprenants.length === 0 && (
              <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: 32, textAlign: 'center', border: `1px solid ${C.brownPale}` }}>
                <p style={{ color: C.textSec, fontSize: 14, fontWeight: 600 }}>
                  Aucun apprenant suivi pour l'instant.
                </p>
                <p style={{ color: C.textSec, fontSize: 12, marginTop: 8 }}>
                  Utilisez le panneau "Lier un apprenant" pour commencer.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Panneau droit ── */}
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

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
              background: codeInput.trim() ? `linear-gradient(135deg, ${C.brown}, ${C.brownLight})` : '#E5E7EB',
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

          {/* Légende */}
          <div style={{ backgroundColor: C.brownPale, borderRadius: 16, padding: 18 }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: C.brown, marginBottom: 12 }}>Légende engagement</h3>
            {[
              { color: C.emerald, label: 'Engagé',  desc: 'Score ≥ 70%' },
              { color: C.orange,  label: 'Modéré',  desc: 'Score 40–70%' },
              { color: C.red,     label: 'Décroché', desc: 'Score < 40%' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: l.color, flexShrink: 0, boxShadow: `0 0 0 3px ${l.color}30` }}/>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: C.text, margin: 0 }}>{l.label}</p>
                  <p style={{ fontSize: 10, color: C.textSec, margin: 0 }}>{l.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Navigation rapide */}
          <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: 18, border: `1px solid ${C.brownPale}` }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: C.brown, marginBottom: 12 }}>Navigation rapide</h3>
            {[
              { label: 'Gestion des cours', path: '/admin', icon: '📚' },
            ].map(item => (
              <button key={item.path} onClick={() => navigate(item.path)} style={{
                width: '100%', backgroundColor: C.brownPale,
                border: `1px solid ${C.brownPale}`,
                borderRadius: 10, padding: '10px 14px', marginBottom: 8,
                display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer', textAlign: 'left', transition: 'all .2s ease'
              }}>
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{item.label}</span>
                <ChevronRight size={14} color={C.textSec} style={{ marginLeft: 'auto' }}/>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}