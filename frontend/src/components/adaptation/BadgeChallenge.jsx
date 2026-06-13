import { useState } from 'react'
import { useTheme } from '../../styles/theme.jsx'

export default function BadgeChallenge({ adaptation, onDismiss }) {
  const { C } = useTheme()
  const [visible, setVisible] = useState(true)

  if (!visible) return null

  const handleDismiss = (type) => { setVisible(false); onDismiss(type) }

  return (
    <>
      <div
        role="complementary"
        aria-label="Exercice bonus"
        style={{
          position: 'fixed', bottom: 80, right: 20, zIndex: 8700,
          background: `linear-gradient(135deg, ${C.goldPale}, ${C.surface})`,
          border: `1.5px solid ${C.gold}50`,
          borderRadius: 16, padding: '14px 16px',
          boxShadow: '0 6px 28px rgba(0,0,0,0.12)',
          maxWidth: 280, display: 'flex', gap: 10, alignItems: 'flex-start',
          animation: 'adaptBadgeIn .4s ease',
        }}
      >
        <span style={{ fontSize: 28, flexShrink: 0 }}>⭐</span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 800, color: C.gold }}>
            Exercice bonus !
          </p>
          <p style={{ margin: '0 0 10px', fontSize: 11, color: C.textSec, lineHeight: 1.4 }}>
            {adaptation.message}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => handleDismiss('accepter')}
              style={{
                padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: C.gold, color: 'white', fontSize: 11, fontWeight: 700,
              }}
            >
              Relever le défi
            </button>
            <button
              onClick={() => handleDismiss('ignorer')}
              style={{
                padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${C.border}`,
                background: 'transparent', color: C.textMuted, fontSize: 11,
              }}
            >
              Ignorer
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes adaptBadgeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </>
  )
}
