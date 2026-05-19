import { useEffect, useState } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'
import { useTheme } from '../styles/theme.jsx'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { Spinner } from '../components/Skeleton'
import {
  BrainCircuit, Database, Download, RefreshCw,
  ChevronDown, ChevronUp, TrendingUp, TrendingDown,
  Minus, Info, PlayCircle, Users, Layers, BarChart2,
} from 'lucide-react'

const DEFAULT_PARAMS = { P_init: 0.10, P_learn: 0.20, P_slip: 0.10, P_guess: 0.20 }

const PARAM_DESC = {
  P_init:  "Probabilité de maîtrise initiale avant toute interaction",
  P_learn: "Probabilité d'apprendre à chaque exercice (vitesse d'acquisition)",
  P_slip:  "Probabilité d'erreur malgré la maîtrise (inattention)",
  P_guess: "Probabilité de bonne réponse sans maîtrise (devinette)",
}

export default function TrainingPage() {
  const { C }          = useTheme()
  const { mobile, xs } = useBreakpoint()
  const pad            = xs ? 12 : mobile ? 16 : 28

  const [stats,       setStats]       = useState(null)
  const [result,      setResult]      = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [calibrating, setCalibrating] = useState(false)
  const [exporting,   setExporting]   = useState(false)
  const [showParams,  setShowParams]  = useState(true)

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    setLoading(true)
    try {
      const { data } = await api.get('/api/training/stats')
      setStats(data)
    } catch {
      toast.error('Erreur de chargement des statistiques')
    } finally {
      setLoading(false)
    }
  }

  async function runCalibration() {
    setCalibrating(true)
    setResult(null)
    try {
      const { data } = await api.post('/api/training/bkt/calibrate')
      setResult(data)
      toast.success('Calibration terminée !')
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Échec de la calibration')
    } finally {
      setCalibrating(false)
    }
  }

  async function exportData() {
    setExporting(true)
    try {
      const { data } = await api.get('/api/training/export', { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const a   = document.createElement('a')
      a.href     = url
      a.download = `sessions_training_${new Date().toISOString().slice(0, 10)}.jsonl`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
      toast.success('Export JSONL téléchargé !')
    } catch {
      toast.error("Aucune session à exporter")
    } finally {
      setExporting(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
      <Spinner/>
    </div>
  )

  const canCalibrate = stats?.pret_calibration && !calibrating

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: pad, fontFamily: "'DM Sans', system-ui, sans-serif", boxSizing: 'border-box' }}>

      {/* En-tête */}
      <div style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #1E40AF 100%)', borderRadius: xs ? 14 : 20, padding: xs ? '16px 14px' : '24px 28px', marginBottom: xs ? 16 : 24, color: 'white', animation: 'fadeUp .35s ease both' }}>
        <p style={{ opacity: .7, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Super Admin — Intelligence Adaptative</p>
        <h1 style={{ fontSize: xs ? 18 : 22, fontWeight: 900, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
          <BrainCircuit size={22}/> Entraînement du modèle
        </h1>
        <p style={{ opacity: .75, fontSize: xs ? 11 : 13 }}>
          Calibration des paramètres BKT à partir des sessions réelles — améliore la précision du suivi de maîtrise
        </p>
      </div>

      {/* Stats disponibilité données */}
      <div style={{ display: 'grid', gridTemplateColumns: xs ? '1fr 1fr' : 'repeat(3,1fr)', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'Apprenants actifs',      value: stats?.nb_apprenants   ?? 0, color: '#1D4ED8', icon: Users },
          { label: 'Sessions terminées',     value: stats?.nb_sessions     ?? 0, color: '#059669', icon: Layers },
          { label: 'Réponses aux exercices', value: stats?.nb_progressions ?? 0, color: '#7C3AED', icon: BarChart2 },
          { label: 'Mastery BKT stockées',   value: stats?.nb_bkt_mastery  ?? 0, color: C.orange,  icon: BrainCircuit },
          { label: 'Analyses engagement',    value: stats?.nb_engagements  ?? 0, color: '#0891B2', icon: Database },
          { label: 'Séquences calibrables',  value: stats?.nb_sequences_bkt ?? 0, color: stats?.pret_calibration ? '#059669' : '#EF4444', icon: TrendingUp },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} style={{ background: C.surface, borderRadius: 12, padding: '14px 16px', border: `1px solid ${C.brownPale}`, textAlign: 'center', animation: 'fadeUp .35s ease both' }}>
            <Icon size={18} color={color} style={{ marginBottom: 6 }}/>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color }}>{value}</p>
            <p style={{ margin: 0, fontSize: 10, color: C.textSec, fontWeight: 700, lineHeight: 1.3 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Avertissement si pas assez de données */}
      {!stats?.pret_calibration && (
        <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 12, padding: '14px 18px', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Info size={18} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }}/>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#92400E' }}>Données insuffisantes pour la calibration</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#78350F', lineHeight: 1.5 }}>
              Il faut au moins <strong>5 séquences</strong> (paires étudiant × compétence avec ≥ 2 réponses).
              Actuellement : {stats?.nb_sequences_bkt ?? 0} séquence(s) disponible(s).
              Encouragez les apprenants à compléter les exercices.
            </p>
          </div>
        </div>
      )}

      {/* Section paramètres actuels */}
      <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.brownPale}`, marginBottom: 24, overflow: 'hidden' }}>
        <button
          onClick={() => setShowParams(p => !p)}
          style={{ width: '100%', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>Paramètres BKT actuels (littérature)</p>
          {showParams ? <ChevronUp size={16} color={C.textSec}/> : <ChevronDown size={16} color={C.textSec}/>}
        </button>
        {showParams && (
          <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${C.brownPale}` }}>
            <p style={{ margin: '12px 0 14px', fontSize: 12, color: C.textSec }}>
              Valeurs par défaut tirées de Corbett &amp; Anderson (1994). La calibration les remplacera par des estimations sur vos données réelles.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: xs ? '1fr' : '1fr 1fr', gap: 10 }}>
              {Object.entries(DEFAULT_PARAMS).map(([key, val]) => (
                <div key={key} style={{ background: C.bg, borderRadius: 10, padding: '12px 14px', border: `1px solid ${C.brownPale}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: '#1D4ED8', fontFamily: 'monospace' }}>{key}</span>
                    <span style={{ fontSize: 16, fontWeight: 900, color: C.text }}>{val.toFixed(2)}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: C.textSec }}>{PARAM_DESC[key]}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Boutons actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        <button
          onClick={runCalibration}
          disabled={!canCalibrate}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 24px',
            background: canCalibrate ? 'linear-gradient(135deg, #1D4ED8, #1E40AF)' : C.brownPale,
            color: canCalibrate ? 'white' : C.textSec,
            border: 'none', borderRadius: 10, cursor: canCalibrate ? 'pointer' : 'default',
            fontSize: 14, fontWeight: 700,
            boxShadow: canCalibrate ? '0 4px 16px rgba(29,78,216,.3)' : 'none',
          }}
        >
          {calibrating ? <Spinner/> : <PlayCircle size={17}/>}
          {calibrating ? 'Calibration en cours…' : 'Lancer la calibration BKT'}
        </button>

        <button
          onClick={exportData}
          disabled={exporting || !stats?.nb_sessions}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 20px',
            background: stats?.nb_sessions ? 'linear-gradient(135deg, #059669, #047857)' : C.brownPale,
            color: stats?.nb_sessions ? 'white' : C.textSec,
            border: 'none', borderRadius: 10, cursor: stats?.nb_sessions ? 'pointer' : 'default',
            fontSize: 14, fontWeight: 700,
          }}
        >
          {exporting ? <Spinner/> : <Download size={15}/>}
          {exporting ? 'Export…' : `Exporter sessions JSONL (${stats?.nb_sessions ?? 0})`}
        </button>

        <button
          onClick={loadStats}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px', background: C.surface, border: `1px solid ${C.brownPale}`, borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.textSec }}
        >
          <RefreshCw size={14}/> Actualiser
        </button>
      </div>

      {/* Résultats calibration */}
      {result && (
        <div style={{ background: C.surface, borderRadius: 16, border: `2px solid #1D4ED8`, overflow: 'hidden', marginBottom: 24, animation: 'fadeUp .4s ease both' }}>
          <div style={{ background: 'linear-gradient(135deg, #1D4ED8, #1E40AF)', padding: '16px 20px', color: 'white' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BrainCircuit size={16}/> Résultats de la calibration EM
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 12, opacity: .8 }}>
              {result.n_sequences} séquences · {result.n_observations} réponses · {result.iterations} itérations
            </p>
          </div>

          {/* Paramètres calibrés vs défaut */}
          <div style={{ padding: '20px', borderBottom: `1px solid ${C.brownPale}` }}>
            <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 800, color: C.text }}>Paramètres calibrés vs valeurs initiales</p>
            <div style={{ display: 'grid', gridTemplateColumns: xs ? '1fr' : '1fr 1fr', gap: 10 }}>
              {Object.entries(result.delta).map(([key, delta]) => {
                const fitted  = result[key]
                const def_val = DEFAULT_PARAMS[key]
                const pct_chg = Math.round(Math.abs(delta) / def_val * 100)
                const color   = Math.abs(delta) < 0.02 ? C.textSec : delta > 0 ? '#059669' : '#EF4444'
                const Icon    = Math.abs(delta) < 0.02 ? Minus : delta > 0 ? TrendingUp : TrendingDown

                return (
                  <div key={key} style={{ background: C.bg, borderRadius: 10, padding: '14px 16px', border: `1px solid ${Math.abs(delta) > 0.05 ? color : C.brownPale}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 900, color: '#1D4ED8', fontFamily: 'monospace' }}>{key}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Icon size={13} color={color}/>
                        <span style={{ fontSize: 11, fontWeight: 700, color }}>{delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)} pp</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 11, color: C.textSec }}>Défaut</p>
                        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.textSec }}>{def_val.toFixed(2)}</p>
                      </div>
                      <div style={{ fontSize: 18, color: C.textSec }}>→</div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontSize: 11, color: C.text }}>Calibré</p>
                        <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#1D4ED8' }}>{fitted.toFixed(4)}</p>
                      </div>
                    </div>
                    {pct_chg >= 5 && (
                      <p style={{ margin: '6px 0 0', fontSize: 10, color, fontWeight: 700 }}>
                        Variation : {pct_chg}% {Math.abs(delta) > 0.1 ? '— significatif' : ''}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Log-vraisemblance */}
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.brownPale}`, display: 'flex', gap: 32 }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: C.textSec, fontWeight: 600 }}>Log-vraisemblance finale</p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.text, fontFamily: 'monospace' }}>
                {result.log_likelihood.toLocaleString('fr-FR')}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: C.textSec, fontWeight: 600 }}>Convergence</p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#059669' }}>
                {result.iterations} itération{result.iterations > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Interprétations pédagogiques */}
          {result.interpretations?.length > 0 && (
            <div style={{ padding: '16px 20px' }}>
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: C.text }}>Interprétations pédagogiques</p>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.interpretations.map((msg, i) => (
                  <li key={i} style={{ fontSize: 13, color: C.textSec, lineHeight: 1.5 }}>{msg}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Snippet pour copier les params calibrés */}
          <div style={{ margin: '0 20px 20px', background: '#1E293B', borderRadius: 10, padding: '14px 16px' }}>
            <p style={{ margin: '0 0 8px', fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>
              Code à copier dans <code style={{ color: '#7DD3FC' }}>bkt_service.py</code> pour appliquer :
            </p>
            <pre style={{ margin: 0, fontSize: 12, color: '#F8FAFC', fontFamily: 'monospace', lineHeight: 1.7, overflowX: 'auto' }}>{
`DEFAULT_PARAMS = {
    "P_init":  ${result.P_init},
    "P_learn": ${result.P_learn},
    "P_slip":  ${result.P_slip},
    "P_guess": ${result.P_guess},
}`
            }</pre>
          </div>
        </div>
      )}

      {/* Guide pipeline ML */}
      <div style={{ background: `${C.brown}08`, borderRadius: 14, padding: '16px 20px', marginBottom: 24, border: `1px solid ${C.brownPale}` }}>
        <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: C.brown }}>Pipeline d'amélioration continue</p>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: C.textSec, lineHeight: 2.1 }}>
          <li>Les apprenants répondent aux exercices → les réponses s'accumulent dans <code>progressions</code></li>
          <li>Le BKT met à jour P(maîtrise) après chaque réponse avec les params actuels</li>
          <li>Lancer la calibration EM ici → obtenir des params plus précis pour cette population</li>
          <li>Copier les nouveaux params dans <code>bkt_service.py → DEFAULT_PARAMS</code></li>
          <li>Exporter les sessions JSONL pour entraîner un modèle de prédiction d'engagement</li>
          <li>Redéployer le backend → le tuteur adaptatif gagne en précision</li>
        </ol>
      </div>

      {/* Format JSONL */}
      <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.brownPale}`, padding: '16px 20px' }}>
        <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: C.text }}>Format du fichier JSONL exporté</p>
        <pre style={{ margin: 0, fontSize: 11, color: C.textSec, fontFamily: 'monospace', lineHeight: 1.7, overflowX: 'auto', background: C.bg, padding: 12, borderRadius: 8 }}>{
`{
  "session_id": "...",
  "student_id": "...",
  "cours_id":   "...",
  "features": {
    "duree_secondes":   420,
    "nb_interactions":  18,
    "engagement_moyen": 0.72,
    "etat_affectif":    "engagement_eleve"
  },
  "bkt_state": [{ "competence": "...", "p_mastery": 0.84, ... }],
  "outcome": {
    "score_exercices":  0.80,
    "score_engagement": 0.72
  }
}`
        }</pre>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
    </div>
  )
}
