import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../styles/theme.jsx'
import Alisha from '../../components/Alisha'
import api from '../../services/api'

export default function CreerCoursLive() {
  const { C } = useTheme()
  const navigate = useNavigate()

  const [uas,       setUas]       = useState([])
  const [uaId,      setUaId]      = useState('')
  const [mode,      setMode]      = useState('enseignant')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  useEffect(() => {
    api.get('/api/live/uas').then(r => setUas(r.data || [])).catch(() => {})
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!uaId) return
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/api/live/creer', { ua_id: uaId, mode })
      // Stocke le code pour l'afficher dans le panneau pilote
      sessionStorage.setItem(`live_code_${data.id}`, data.code)
      navigate(`/live/pilot/${data.id}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight:      '100vh',
      background:      C.bg,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '32px 20px',
      gap:             28,
      fontFamily:     "'DM Sans', system-ui, sans-serif",
    }}>
      <div style={{ textAlign: 'center' }}>
        <Alisha state="welcome" size={110} />
        <h1 style={{ fontSize: 26, fontWeight: 900, color: C.brown, margin: '12px 0 4px' }}>
          Nouveau cours en live
        </h1>
        <p style={{ fontSize: 14, color: C.textSec, margin: 0 }}>
          Choisis l'unité d'apprentissage et le mode de conduite
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{
        width:          '100%',
        maxWidth:        480,
        background:      C.surface,
        borderRadius:    20,
        border:         `1.5px solid ${C.border}`,
        padding:        '28px 24px',
        display:        'flex',
        flexDirection:  'column',
        gap:             20,
        boxShadow:      `0 8px 32px ${C.brown}12`,
      }}>
        {/* Choix de l'UA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: C.textSec }}>
            Unité d'apprentissage
          </label>
          <select
            value={uaId}
            onChange={e => setUaId(e.target.value)}
            required
            style={{
              padding:      '13px 16px',
              borderRadius:  12,
              border:       `1.5px solid ${C.border}`,
              background:    C.bg,
              color:         C.text,
              fontSize:      14,
              width:        '100%',
            }}
          >
            <option value="">Sélectionner une UA…</option>
            {uas.map(ua => (
              <option key={ua.id} value={ua.id}>{ua.titre}</option>
            ))}
          </select>
        </div>

        {/* Mode de conduite */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: C.textSec }}>
            Pilote du cours
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { val: 'enseignant', label: '👨‍🏫 Moi (enseignant)', desc: 'Tu contrôles les slides et les quiz' },
              { val: 'avatar',     label: '🤖 Alisha (avatar IA)', desc: 'Alisha présente le cours automatiquement' },
            ].map(opt => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setMode(opt.val)}
                style={{
                  flex:          1,
                  padding:       '14px 12px',
                  borderRadius:   14,
                  border:        `2px solid ${mode === opt.val ? C.brown : C.border}`,
                  background:     mode === opt.val ? C.brownPale : C.surface,
                  textAlign:     'left',
                  cursor:        'pointer',
                  display:       'flex',
                  flexDirection: 'column',
                  gap:            4,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{opt.label}</span>
                <span style={{ fontSize: 12, color: C.textSec }}>{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p style={{ color: C.red, fontSize: 13, margin: 0, textAlign: 'center' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !uaId}
          style={{
            padding:      '14px',
            borderRadius:  14,
            border:       'none',
            background:   `linear-gradient(135deg, ${C.brown}, ${C.brownMid})`,
            color:        'white',
            fontWeight:    800,
            fontSize:      15,
            cursor:        loading || !uaId ? 'not-allowed' : 'pointer',
            opacity:       loading || !uaId ? 0.5 : 1,
          }}
        >
          {loading ? 'Création…' : '🚀 Lancer le cours'}
        </button>
      </form>
    </div>
  )
}
