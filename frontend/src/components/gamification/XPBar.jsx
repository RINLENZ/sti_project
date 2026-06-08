/**
 * XPBar — barre d'expérience permanente affichée en haut de l'AppLayout.
 * Affiche : niveau actuel | barre de progression XP | XP restant pour le prochain niveau.
 * Se met à jour automatiquement via l'API /api/gamification/stats.
 */
import { useEffect, useState, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../styles/theme.jsx'
import api from '../../services/api'

// XP nécessaire pour passer du niveau n au niveau n+1
function xpPourNiveau(n) {
  return 100 * Math.pow(2, n - 1)
}

// Label du niveau selon son numéro
function labelNiveau(n) {
  if (n >= 10) return 'Légende'
  if (n >= 7)  return 'Expert'
  if (n >= 5)  return 'Confirmé'
  if (n >= 3)  return 'Intermédiaire'
  return 'Débutant'
}

// Cache en mémoire pour éviter de rappeler l'API à chaque navigation
let _cache = null
let _cacheTs = 0
const CACHE_TTL = 60_000  // 1 min

export default function XPBar({ compact = false }) {
  const { C } = useTheme()
  const { user } = useSelector(s => s.auth)
  const navigate = useNavigate()
  const [stats, setStats] = useState(_cache)
  const [animating, setAnimating] = useState(false)

  const fetchStats = useCallback(async () => {
    if (!user?.id) return
    if (_cache && Date.now() - _cacheTs < CACHE_TTL) { setStats(_cache); return }
    try {
      const { data } = await api.get(`/api/gamification/stats/${user.id}`)
      _cache = data; _cacheTs = Date.now()
      setStats(data)
    } catch {}
  }, [user?.id])

  useEffect(() => { fetchStats() }, [fetchStats])

  // Expose une méthode globale pour forcer le refresh (appelée par Session après award-xp)
  useEffect(() => {
    window.__refreshXPBar = () => {
      _cache = null
      fetchStats()
      setAnimating(true)
      setTimeout(() => setAnimating(false), 1200)
    }
    return () => { delete window.__refreshXPBar }
  }, [fetchStats])

  if (!stats || !user || user.role !== 'apprenant') return null

  const { niveau, xp_dans_niveau, xp_pour_prochain, streak_jours, badges } = stats
  const pct = xp_pour_prochain > 0 ? Math.round((xp_dans_niveau / xp_pour_prochain) * 100) : 100

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} title={`Niveau ${niveau} · ${xp_dans_niveau}/${xp_pour_prochain} XP`}>
        <span style={{ fontSize: 11, fontWeight: 900, color: C.gold }}>Niv.{niveau}</span>
        <div style={{ width: 60, height: 5, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${C.gold}, ${C.accent})`, borderRadius: 3, transition: 'width .6s ease' }}/>
        </div>
        {streak_jours > 0 && (
          <span style={{ fontSize: 11, fontWeight: 800, color: C.accent }}>🔥{streak_jours}</span>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={() => navigate('/achievements')}
      title="Voir mes succès"
      style={{
        display:     'flex',
        alignItems:  'center',
        gap:         10,
        padding:     '6px 16px',
        cursor:      'pointer',
        background:  C.surface,
        borderBottom:`1px solid ${C.border}`,
        userSelect:  'none',
      }}
    >
      {/* Badge niveau */}
      <div style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
        background:  `linear-gradient(135deg, ${C.gold}, ${C.brownMid})`,
        display:     'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow:   animating ? `0 0 12px ${C.gold}80` : 'none',
        transition:  'box-shadow .4s ease',
      }}>
        <span style={{ fontSize: 13, fontWeight: 900, color: 'white' }}>{niveau}</span>
      </div>

      {/* Barre + texte */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.textSec }}>
            {labelNiveau(niveau)}
          </span>
          <span style={{ fontSize: 10, color: C.textMuted }}>
            {xp_dans_niveau} / {xp_pour_prochain} XP
          </span>
        </div>
        <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height:     '100%',
            width:      `${pct}%`,
            background: `linear-gradient(90deg, ${C.gold}, ${C.accent})`,
            borderRadius: 3,
            transition: 'width .8s cubic-bezier(.22,1,.36,1)',
            boxShadow:  animating ? `0 0 8px ${C.gold}60` : 'none',
          }}/>
        </div>
      </div>

      {/* Streak */}
      {streak_jours > 0 && (
        <div style={{
          display:    'flex', alignItems: 'center', gap: 3,
          background: `${C.accent}18`,
          border:     `1px solid ${C.accent}30`,
          borderRadius: 20, padding: '2px 8px',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 12 }}>🔥</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: C.accent }}>{streak_jours}j</span>
        </div>
      )}

      {/* Nb badges */}
      {badges?.length > 0 && (
        <div style={{
          display:    'flex', alignItems: 'center', gap: 3,
          background: `${C.gold}15`,
          border:     `1px solid ${C.gold}30`,
          borderRadius: 20, padding: '2px 8px',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11 }}>🏅</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: C.gold }}>{badges.length}</span>
        </div>
      )}
    </div>
  )
}
