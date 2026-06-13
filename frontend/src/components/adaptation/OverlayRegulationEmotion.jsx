import { useEffect, useState } from 'react'
import { useTheme } from '../../styles/theme.jsx'

export default function OverlayRegulationEmotion({ adaptation, onDismiss }) {
  const { C } = useTheme()
  const duree = adaptation.params?.duree_sec ?? 30
  const fermableApres = adaptation.params?.fermable_apres_sec ?? 10
  const [secondsLeft, setSecondsLeft] = useState(duree)
  const [canClose, setCanClose] = useState(false)
  const [breathPhase, setBreathPhase] = useState('inspire')

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { onDismiss('auto_closed'); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [onDismiss])

  useEffect(() => {
    const t = setTimeout(() => setCanClose(true), fermableApres * 1000)
    return () => clearTimeout(t)
  }, [fermableApres])

  useEffect(() => {
    const t = setInterval(() => setBreathPhase(p => p === 'inspire' ? 'expire' : 'inspire'), 4000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && canClose) onDismiss('escape') }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canClose, onDismiss])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Exercice de respiration"
      style={{
        position: 'fixed', inset: 0, zIndex: 8500,
        background: 'rgba(13,147,115,0.15)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        background: C.surface, borderRadius: 24,
        padding: '36px 28px', maxWidth: 380, width: '100%',
        border: `1.5px solid ${C.emerald}40`,
        boxShadow: '0 12px 48px rgba(0,0,0,0.15)',
        textAlign: 'center',
        animation: 'adaptSlideUp .35s ease',
      }}>
        <h2 style={{ margin: '0 0 6px', color: C.emerald, fontSize: 17, fontWeight: 800 }}>
          Respirons ensemble
        </h2>
        <p style={{ margin: '0 0 24px', color: C.textSec, fontSize: 12, lineHeight: 1.5 }}>
          {adaptation.message}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{
            width: 110, height: 110, borderRadius: '50%',
            background: `radial-gradient(circle, ${C.emerald}25, ${C.emerald}08)`,
            border: `3px solid ${C.emerald}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: breathPhase === 'inspire' ? 'breatheIn 4s ease-in-out forwards' : 'breatheOut 4s ease-in-out forwards',
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.emerald }}>
              {breathPhase === 'inspire' ? 'Inspire...' : 'Expire...'}
            </span>
          </div>
        </div>

        <p style={{ margin: '0 0 20px', color: C.textMuted, fontSize: 11 }}>
          {canClose ? 'Tu peux reprendre quand tu es prêt' : `Disponible dans ${Math.max(0, fermableApres - (duree - secondsLeft))}s`}
        </p>

        <button
          onClick={() => canClose && onDismiss('reprendre')}
          disabled={!canClose}
          aria-label="Reprendre l'exercice"
          style={{
            padding: '12px 28px', borderRadius: 12, border: 'none',
            cursor: canClose ? 'pointer' : 'not-allowed',
            background: canClose ? `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDark})` : C.border,
            color: canClose ? 'white' : C.textMuted,
            fontWeight: 700, fontSize: 13, transition: 'all .3s ease',
            opacity: canClose ? 1 : 0.55,
          }}
        >
          Reprendre
        </button>
      </div>
      <style>{`
        @keyframes adaptSlideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes breatheIn{from{transform:scale(1)}to{transform:scale(1.6)}}
        @keyframes breatheOut{from{transform:scale(1.6)}to{transform:scale(1)}}
      `}</style>
    </div>
  )
}
