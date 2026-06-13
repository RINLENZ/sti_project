import { useEffect } from 'react'
import { useTheme } from '../../styles/theme.jsx'

export default function DialogOrientation({ adaptation, onDismiss }) {
  const { C } = useTheme()

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onDismiss('continuer_seul') }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Orientation"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss('continuer_seul') }}
      style={{
        position: 'fixed', inset: 0, zIndex: 8000,
        background: 'rgba(0,0,0,0.40)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.surface, borderRadius: 18,
          padding: '24px 22px', maxWidth: 340, width: '100%',
          border: `1.5px solid ${C.border}`,
          boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
          animation: 'adaptSlideUp .28s ease',
        }}
      >
        <div style={{ marginBottom: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🤔</div>
          <h3 style={{ margin: '0 0 6px', color: C.text, fontSize: 15, fontWeight: 800 }}>
            Tu sembles bloqué
          </h3>
          <p style={{ margin: 0, color: C.textSec, fontSize: 12, lineHeight: 1.5 }}>
            {adaptation.message}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => onDismiss('indice')}
            style={{
              padding: '11px', borderRadius: 11, cursor: 'pointer',
              border: `1.5px solid ${C.gold}50`,
              background: C.goldPale, color: C.gold, fontWeight: 700, fontSize: 12,
            }}
          >
            💡 Un indice
          </button>
          <button
            onClick={() => onDismiss('revoir_cours')}
            style={{
              padding: '11px', borderRadius: 11, cursor: 'pointer',
              border: `1.5px solid ${C.blue}40`,
              background: C.bluePale, color: C.blue, fontWeight: 700, fontSize: 12,
            }}
          >
            📖 Revoir le cours
          </button>
          <button
            onClick={() => onDismiss('continuer_seul')}
            style={{
              padding: '11px', borderRadius: 11, cursor: 'pointer',
              border: `1px solid ${C.border}`,
              background: 'transparent', color: C.textMuted, fontWeight: 600, fontSize: 12,
            }}
          >
            Continuer seul
          </button>
        </div>
      </div>
      <style>{`@keyframes adaptSlideUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}
