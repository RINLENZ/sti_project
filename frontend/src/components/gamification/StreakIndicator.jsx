/**
 * StreakIndicator — affiche le nombre de jours consécutifs 🔥
 * Utilisable de façon autonome ou intégré dans XPBar.
 * Se connecte au même endpoint que XPBar.
 */
import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTheme } from '../../styles/theme.jsx'
import api from '../../services/api'

export default function StreakIndicator({ size = 'md', showLabel = true }) {
  const { C } = useTheme()
  const { user } = useSelector(s => s.auth)
  const [streak, setStreak] = useState(null)

  useEffect(() => {
    if (!user?.id || user.role !== 'apprenant') return
    api.get(`/api/gamification/stats/${user.id}`)
      .then(r => setStreak(r.data.streak_jours))
      .catch(() => {})
  }, [user?.id])

  if (streak === null || !user || user.role !== 'apprenant') return null
  if (streak === 0) return null

  const fontSize = size === 'lg' ? 22 : size === 'sm' ? 12 : 16
  const pad      = size === 'lg' ? '6px 14px' : size === 'sm' ? '2px 8px' : '4px 10px'

  return (
    <div style={{
      display:      'inline-flex',
      alignItems:   'center',
      gap:          5,
      background:   `${C.accent}18`,
      border:       `1.5px solid ${C.accent}35`,
      borderRadius: 20,
      padding:      pad,
    }}>
      <span style={{ fontSize: fontSize + 2 }}>🔥</span>
      <span style={{ fontSize, fontWeight: 900, color: C.accent, lineHeight: 1 }}>
        {streak}
      </span>
      {showLabel && (
        <span style={{ fontSize: fontSize - 4, fontWeight: 600, color: C.textSec }}>
          {streak === 1 ? 'jour' : 'jours'}
        </span>
      )}
    </div>
  )
}
