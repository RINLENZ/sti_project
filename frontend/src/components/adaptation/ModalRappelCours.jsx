import { useEffect } from 'react'
import { useTheme } from '../../styles/theme.jsx'

export default function ModalRappelCours({ adaptation, onDismiss }) {
  const { C } = useTheme()
  const lienCours = adaptation.params?.lien_cours
  const isRemediation = adaptation.action === 'modal_remediation'

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onDismiss('escape') }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isRemediation ? 'Remédiation' : 'Rappel du cours'}
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss('backdrop') }}
      style={{
        position: 'fixed', inset: 0, zIndex: 8000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.surface, borderRadius: 20,
          padding: '28px 24px', maxWidth: 420, width: '100%',
          border: `1.5px solid ${C.gold}35`,
          boxShadow: '0 12px 48px rgba(0,0,0,0.18)',
          animation: 'adaptSlideUp .3s ease',
          position: 'relative',
        }}
      >
        <button
          onClick={() => onDismiss('close')}
          aria-label="Fermer"
          style={{
            position: 'absolute', top: 14, right: 14,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 17, color: C.textMuted, padding: 4, lineHeight: 1,
          }}
        >✕</button>

        <div style={{ marginBottom: lienCours ? 16 : 24 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>
            {isRemediation ? '📚' : '💡'}
          </div>
          <h2 style={{ margin: '0 0 8px', color: C.brown, fontSize: 17, fontWeight: 800 }}>
            {isRemediation ? 'Un point à revoir' : 'Rappel important'}
          </h2>
          <p style={{ margin: 0, color: C.textSec, fontSize: 13, lineHeight: 1.6 }}>
            {adaptation.message}
          </p>
        </div>

        {lienCours && (
          <div style={{
            background: C.brownPale, borderRadius: 12,
            padding: '12px 14px', marginBottom: 20,
            border: `1px solid ${C.brownLight}30`,
          }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, color: C.textSec, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4 }}>
              📖 Extrait de cours
            </p>
            <p style={{ margin: 0, fontSize: 12, color: C.textMuted, fontStyle: 'italic', lineHeight: 1.5 }}>
              {lienCours}
            </p>
          </div>
        )}

        <button
          onClick={() => onDismiss('compris')}
          style={{
            width: '100%', padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${C.brown}, ${C.brownMid})`,
            color: 'white', fontWeight: 700, fontSize: 13,
          }}
        >
          J&apos;ai compris, on continue
        </button>
      </div>
      <style>{`@keyframes adaptSlideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}
