import { useEffect } from 'react'
import { useTheme } from '../../styles/theme.jsx'

export default function ToastNotification({ adaptation, onDismiss }) {
  const { C } = useTheme()
  const duree = (adaptation.params?.duree_sec ?? 4) * 1000
  const isRecognition = adaptation.action === 'toast_reconnaissance'

  useEffect(() => {
    const t = setTimeout(() => onDismiss('auto_closed'), duree)
    return () => clearTimeout(t)
  }, [duree, onDismiss])

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 8800,
          background: isRecognition
            ? `linear-gradient(135deg, ${C.emeraldPale}, ${C.surface})`
            : C.goldPale,
          border: `1px solid ${isRecognition ? C.emerald + '45' : C.gold + '55'}`,
          borderRadius: 16, padding: '14px 16px',
          boxShadow: '0 6px 28px rgba(0,0,0,0.12)',
          maxWidth: 300, display: 'flex', gap: 12, alignItems: 'flex-start',
          animation: 'adaptToastIn .3s ease',
        }}
      >
        <span style={{ fontSize: 22, flexShrink: 0 }}>
          {isRecognition ? '⭐' : '🎉'}
        </span>
        <p style={{
          flex: 1, margin: 0, fontSize: 13, fontWeight: 700,
          color: isRecognition ? C.emerald : C.gold,
          lineHeight: 1.4,
        }}>
          {adaptation.message}
        </p>
        <button
          onClick={() => onDismiss('close')}
          aria-label="Fermer"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, color: C.textMuted, flexShrink: 0, padding: 2, lineHeight: 1,
          }}
        >✕</button>
      </div>
      <style>{`@keyframes adaptToastIn{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}`}</style>
    </>
  )
}
