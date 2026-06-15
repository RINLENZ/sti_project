/**
 * Toast custom de déblocage d'un symbole Adinkra (identité Bogolan).
 * Usage : import { notifyAdinkraBadge } from '.../badgeToast'
 *         notifyAdinkraBadge('sankofa')
 */
import toast from 'react-hot-toast'
import { useTheme } from '../../styles/theme.jsx'
import { AdinkraSymbol } from './AdinkraSymbols.jsx'
import { BADGES_BY_ID } from '../../constants/adinkraBadges'

function AdinkraBadgeToast({ badge, t }) {
  const { C } = useTheme()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: `linear-gradient(135deg, ${C.bogolanSurface}, ${C.bogolanTerre}10)`,
      border: `1.5px solid ${C.bogolanTerre}45`, borderRadius: 16,
      padding: '12px 16px', boxShadow: `0 12px 34px ${C.bogolanTerre}33`,
      maxWidth: 340, fontFamily: "'DM Sans', system-ui, sans-serif",
      animation: `${t.visible ? 'slideInRight' : 'slideOutLeft'} .3s cubic-bezier(.22,1,.36,1) both`,
    }}>
      <div style={{ flexShrink: 0, background: `${C.bogolanTerre}14`, borderRadius: 12, padding: 8 }}>
        <AdinkraSymbol id={badge.id} size={40} color={C.bogolanTerre} animate />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: C.bogolanOcre, textTransform: 'uppercase', letterSpacing: .6 }}>
          ✨ Symbole débloqué
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 900, color: C.bogolanTerre, lineHeight: 1.1 }}>
          {badge.nom}
        </p>
        <p style={{ margin: '3px 0 0', fontSize: 11, color: C.bogolanTextSec, lineHeight: 1.45,
          overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {badge.description}
        </p>
      </div>
    </div>
  )
}

export function notifyAdinkraBadge(badgeId) {
  const badge = BADGES_BY_ID[badgeId]
  if (!badge) return
  toast.custom((t) => <AdinkraBadgeToast badge={badge} t={t} />, { duration: 4500 })
}
