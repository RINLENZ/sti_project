import { useEffect, useState } from 'react'
import { useTheme } from '../../styles/theme.jsx'
import api from '../../services/api'

export default function ModalRappelCours({ adaptation, onDismiss, uaId }) {
  const { C } = useTheme()
  const lienCours = adaptation.params?.lien_cours
  const isRemediation = adaptation.action === 'modal_remediation'
  const [extrait, setExtrait] = useState(null)   // { titre, extrait, points_cles } réel

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onDismiss('escape') }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  // Récupère le VRAI extrait de cours (le backend n'envoie qu'un drapeau lien_cours)
  useEffect(() => {
    if (!lienCours || !uaId) return
    const comp = adaptation.params?.macro_kc || adaptation.params?.competence || ''
    api.get(`/api/cours/ua/${uaId}/ressource-aide`, { params: { competence: comp } })
      .then(({ data }) => { if (data?.titre) setExtrait(data) })
      .catch(() => {})
  }, [lienCours, uaId, adaptation.params])

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

        {lienCours && extrait && (
          <div style={{
            background: C.brownPale, borderRadius: 12,
            padding: '12px 14px', marginBottom: 20,
            border: `1px solid ${C.brownLight}30`,
          }}>
            <p style={{ margin: '0 0 6px', fontSize: 11, color: C.brown, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .4 }}>
              📖 {extrait.titre || 'Extrait de cours'}
            </p>
            <p style={{ margin: 0, fontSize: 12.5, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {extrait.extrait}
            </p>
            {extrait.points_cles?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                {extrait.points_cles.map((pt, i) => (
                  <span key={i} style={{ background: `${C.brown}18`, color: C.brown, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>
                    {pt}
                  </span>
                ))}
              </div>
            )}
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
