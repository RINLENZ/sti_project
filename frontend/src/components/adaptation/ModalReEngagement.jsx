import { useTheme } from '../../styles/theme.jsx'

const CHOICE_LABELS = {
  continuer:   'Continuer quand même',
  pause_short: 'Pause de 5 minutes',
  abandon:     'Terminer la session',
}

export default function ModalReEngagement({ adaptation, onDismiss }) {
  const { C } = useTheme()
  const choix = adaptation.params?.choix || ['continuer', 'pause_short', 'abandon']

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Alerte d'engagement"
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        background: C.surface, borderRadius: 20,
        padding: '32px 28px', maxWidth: 400, width: '100%',
        border: `2px solid ${C.red}60`,
        boxShadow: `0 0 0 4px ${C.red}20, 0 20px 60px rgba(0,0,0,0.4)`,
        animation: 'adaptSlideUp .3s ease',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>😟</div>
          <h2 style={{ margin: '0 0 8px', color: C.red, fontSize: 18, fontWeight: 800 }}>
            On dirait que tu décroches
          </h2>
          <p style={{ margin: 0, color: C.textSec, fontSize: 13, lineHeight: 1.6 }}>
            {adaptation.message}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
          {choix.map((c, i) => (
            <button
              key={c}
              onClick={() => onDismiss(c)}
              style={{
                padding: '13px 16px', borderRadius: 12, cursor: 'pointer',
                fontWeight: 700, fontSize: 13, transition: 'opacity .15s',
                background: i === 0
                  ? `linear-gradient(135deg, ${C.red}, #B91C1C)`
                  : i === 1 ? C.goldPale : 'transparent',
                color: i === 0 ? 'white' : i === 1 ? C.gold : C.textMuted,
                border: i !== 0 ? `1px solid ${i === 1 ? C.gold + '40' : C.border}` : 'none',
              }}
            >
              {CHOICE_LABELS[c] || c}
            </button>
          ))}
        </div>
      </div>
      <style>{`@keyframes adaptSlideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}
