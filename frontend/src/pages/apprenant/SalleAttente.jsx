import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../styles/theme.jsx'
import api from '../../services/api'
import Alisha from '../../components/Alisha'

export default function SalleAttente() {
  const { C } = useTheme()
  const navigate = useNavigate()

  const [code,    setCode]    = useState('')
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [joining, setJoining] = useState(false)

  async function handleSearch(e) {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (!c) return
    setError('')
    setLoading(true)
    try {
      const { data } = await api.get(`/api/live/${c}`)
      setSession(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Code introuvable')
      setSession(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin() {
    if (!session) return
    setJoining(true)
    try {
      await api.post(`/api/live/${session.id}/rejoindre`)
      navigate(`/live/session/${session.id}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Impossible de rejoindre')
      setJoining(false)
    }
  }

  return (
    <div style={{
      minHeight:     '100vh',
      background:     C.bg,
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      justifyContent:'center',
      padding:       '32px 20px',
      gap:            28,
      fontFamily:    "'DM Sans', system-ui, sans-serif",
    }}>
      {/* En-tête */}
      <div style={{ textAlign: 'center' }}>
        <Alisha state={session ? 'welcome' : 'idle'} size={120} />
        <h1 style={{ fontSize: 26, fontWeight: 900, color: C.brown, margin: '12px 0 4px' }}>
          Rejoindre un cours en live
        </h1>
        <p style={{ fontSize: 14, color: C.textSec, margin: 0 }}>
          Saisis le code fourni par ton enseignant
        </p>
      </div>

      {/* Formulaire code */}
      <form onSubmit={handleSearch} style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase().slice(0, 8))}
            placeholder="Ex: ABC123"
            maxLength={8}
            style={{
              flex:          1,
              padding:       '14px 18px',
              borderRadius:   14,
              border:        `2px solid ${error ? C.red : C.border}`,
              background:     C.surface,
              color:          C.text,
              fontSize:       20,
              fontWeight:     800,
              letterSpacing: '0.15em',
              outline:       'none',
              fontFamily:    'monospace',
              textTransform: 'uppercase',
            }}
          />
          <button
            type="submit"
            disabled={loading || !code.trim()}
            style={{
              padding:      '14px 22px',
              borderRadius:  14,
              border:       'none',
              background:   `linear-gradient(135deg, ${C.brown}, ${C.brownMid})`,
              color:        'white',
              fontWeight:    800,
              fontSize:      16,
              cursor:        'pointer',
              opacity:       loading || !code.trim() ? 0.5 : 1,
            }}
          >
            {loading ? '…' : 'OK'}
          </button>
        </div>
        {error && (
          <p style={{ color: C.red, fontSize: 13, margin: '8px 0 0', textAlign: 'center' }}>{error}</p>
        )}
      </form>

      {/* Carte session trouvée */}
      {session && (
        <div style={{
          width:         '100%',
          maxWidth:       360,
          background:     C.surface,
          borderRadius:   20,
          border:        `2px solid ${C.brownPale}`,
          padding:       '24px',
          boxShadow:     `0 8px 32px ${C.brown}18`,
          display:       'flex',
          flexDirection: 'column',
          gap:            16,
        }}>
          <div>
            <span style={{
              display:      'inline-block',
              padding:      '4px 12px',
              borderRadius:  20,
              background:    session.statut === 'actif' ? C.emeraldPale : C.goldPale,
              color:         session.statut === 'actif' ? C.emerald : C.gold,
              fontSize:      12,
              fontWeight:    700,
              marginBottom:  10,
            }}>
              {session.statut === 'attente' ? '⏳ En attente' : session.statut === 'actif' ? '🔴 En cours' : session.statut}
            </span>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>
              {session.ua?.titre}
            </h2>
            <p style={{ fontSize: 13, color: C.textSec, margin: 0 }}>
              Pilote : <strong>{session.pilote}</strong>
              {session.mode === 'avatar' && ' (Alisha)'}
            </p>
            <p style={{ fontSize: 13, color: C.textMuted, margin: '4px 0 0' }}>
              {session.participants} participant{session.participants !== 1 ? 's' : ''} connecté{session.participants !== 1 ? 's' : ''}
            </p>
          </div>

          <button
            onClick={handleJoin}
            disabled={joining || session.statut === 'termine'}
            style={{
              padding:      '14px',
              borderRadius:  14,
              border:       'none',
              background:   `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDark})`,
              color:        'white',
              fontWeight:    800,
              fontSize:      16,
              cursor:        'pointer',
              opacity:       joining ? 0.6 : 1,
            }}
          >
            {joining ? 'Connexion…' : 'Rejoindre →'}
          </button>
        </div>
      )}
    </div>
  )
}
