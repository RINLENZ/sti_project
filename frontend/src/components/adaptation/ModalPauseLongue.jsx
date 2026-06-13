import { useEffect, useState } from 'react'
import { useTheme } from '../../styles/theme.jsx'

function fmt(sec) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

export default function ModalPauseLongue({ adaptation, onDismiss }) {
  const { C } = useTheme()
  const pauseDuration = adaptation.params?.duree_pause_sec ?? 600
  const [accepted, setAccepted] = useState(false)
  const [timeLeft, setTimeLeft] = useState(pauseDuration)

  useEffect(() => {
    if (!accepted) return
    const t = setInterval(() => {
      setTimeLeft(s => {
        if (s <= 1) { clearInterval(t); onDismiss('pause_terminee'); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [accepted, onDismiss])

  useEffect(() => {
    if (accepted) return
    const onKey = (e) => { if (e.key === 'Escape') onDismiss('refuser') }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [accepted, onDismiss])

  if (accepted) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pause en cours"
        style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: C.bg,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 24,
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 64 }}>🌿</div>
        <h2 style={{ margin: 0, color: C.text, fontSize: 22, fontWeight: 800, textAlign: 'center' }}>
          Pause bien méritée
        </h2>
        <p style={{ margin: 0, color: C.textSec, fontSize: 14, textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
          Étire-toi, hydrate-toi. On reprend dans
        </p>
        <div style={{
          background: C.surface, border: `2px solid ${C.emerald}40`,
          borderRadius: 20, padding: '20px 40px', textAlign: 'center',
          boxShadow: `0 0 0 8px ${C.emerald}10`,
        }}>
          <div style={{ fontSize: 52, fontWeight: 900, color: C.emerald, fontVariantNumeric: 'tabular-nums', letterSpacing: -1 }}>
            {fmt(timeLeft)}
          </div>
        </div>
        <button
          onClick={() => onDismiss('reprendre_avant')}
          style={{
            padding: '11px 24px', borderRadius: 12, cursor: 'pointer',
            border: `1px solid ${C.border}`,
            background: 'transparent', color: C.textMuted, fontSize: 12, fontWeight: 600,
          }}
        >
          Reprendre maintenant
        </button>
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Proposition de pause"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss('refuser') }}
      style={{
        position: 'fixed', inset: 0, zIndex: 8500,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.surface, borderRadius: 20,
          padding: '30px 24px', maxWidth: 380, width: '100%',
          border: `1.5px solid ${C.border}`,
          boxShadow: '0 12px 48px rgba(0,0,0,0.18)',
          textAlign: 'center',
          animation: 'adaptSlideUp .3s ease',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>⏸</div>
        <h2 style={{ margin: '0 0 8px', color: C.text, fontSize: 17, fontWeight: 800 }}>
          Pause recommandée
        </h2>
        <p style={{ margin: '0 0 24px', color: C.textSec, fontSize: 13, lineHeight: 1.6 }}>
          {adaptation.message}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => setAccepted(true)}
            style={{
              padding: '13px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDark})`,
              color: 'white', fontWeight: 700, fontSize: 13,
            }}
          >
            🌿 Pause {Math.round(pauseDuration / 60)} minutes
          </button>
          <button
            onClick={() => onDismiss('refuser')}
            style={{
              padding: '11px', borderRadius: 12, cursor: 'pointer',
              border: `1px solid ${C.border}`,
              background: 'transparent', color: C.textMuted, fontSize: 12, fontWeight: 600,
            }}
          >
            Continuer sans pause
          </button>
        </div>
      </div>
      <style>{`@keyframes adaptSlideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}
