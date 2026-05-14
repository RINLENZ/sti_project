import { useTheme } from '../styles/theme.jsx'
import { radius, space, type, weight } from './tokens'

// ─── Badge ────────────────────────────────────────────────────────────────────
/**
 * Badge de statut ou d'étiquette.
 *
 * @prop {'default'|'success'|'warning'|'error'|'info'|'gold'} variant
 * @prop {'sm'|'md'} size
 * @prop {boolean} dot      — affiche un point pulsant à gauche
 * @prop {React.ReactNode} icon — icône à gauche (remplace le dot)
 */
export function Badge({
  variant  = 'default',
  size     = 'md',
  dot      = false,
  icon,
  children,
  style: extraStyle,
}) {
  const { C } = useTheme()

  // Couleurs par variante
  const VARIANTS = {
    default: { bg: C.brownGhost,  color: C.textSec,  border: C.border,             dot: C.textMuted  },
    success: { bg: C.emeraldPale, color: C.emerald,   border: `${C.emerald}30`,     dot: C.emerald    },
    warning: { bg: '#FFFBEB',     color: '#D97706',   border: '#FDE68A',            dot: '#F59E0B'    },
    error:   { bg: C.redPale,     color: C.red,       border: `${C.red}25`,         dot: C.red        },
    info:    { bg: C.bluePale,    color: C.blue,      border: `${C.blue}30`,        dot: C.blue       },
    gold:    { bg: C.goldPale,    color: C.gold,      border: `${C.gold}35`,        dot: C.gold       },
  }

  const SIZE = {
    sm: { fontSize: type['2xs'], px: space[2],     py: 3,         gap: space[1], dotSize: 5  },
    md: { fontSize: type.xs,    px: space[3],     py: 4,         gap: space[1], dotSize: 6  },
  }

  const v = VARIANTS[variant] || VARIANTS.default
  const s = SIZE[size] || SIZE.md

  return (
    <span style={{
      display:        'inline-flex',
      alignItems:     'center',
      gap:             s.gap,
      padding:        `${s.py}px ${s.px}px`,
      borderRadius:    radius.pill,
      background:      v.bg,
      color:           v.color,
      border:         `1px solid ${v.border}`,
      fontSize:        s.fontSize,
      fontWeight:      weight.bold,
      lineHeight:      1,
      whiteSpace:      'nowrap',
      userSelect:      'none',
      ...extraStyle,
    }}>
      {/* Dot pulsant */}
      {dot && !icon && (
        <span style={{
          width:           s.dotSize,
          height:          s.dotSize,
          borderRadius:    '50%',
          background:      v.dot,
          flexShrink:      0,
          animation:       'pulse 2s ease infinite',
        }} aria-hidden="true" />
      )}

      {/* Icône */}
      {icon && !dot && (
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }} aria-hidden="true">
          {icon}
        </span>
      )}

      {children}
    </span>
  )
}

// ─── Pill — même chose mais plus arrondi et sans border ───────────────────────
/**
 * Pilule de catégorie ou de tag. Fond coloré, sans bordure.
 *
 * @prop {string} color  — couleur CSS directe (ex: '#0D9373')
 * @prop {'sm'|'md'} size
 */
export function Pill({ color, size = 'md', children, style: extraStyle }) {
  const { C } = useTheme()
  const col = color ?? C.brown

  const SIZE = {
    sm: { fontSize: type['2xs'], px: space[2], py: 3  },
    md: { fontSize: type.xs,    px: space[3], py: 5  },
  }
  const s = SIZE[size] || SIZE.md

  // Couleur de texte dérivée : si fond sombre → blanc, sinon ton foncé
  const textColor = isColorDark(col) ? '#FFFFFF' : col

  return (
    <span style={{
      display:      'inline-flex',
      alignItems:   'center',
      padding:     `${s.py}px ${s.px}px`,
      borderRadius:  radius.pill,
      background:   `${col}18`,
      color:         col,
      fontSize:      s.fontSize,
      fontWeight:    weight.bold,
      lineHeight:    1,
      whiteSpace:    'nowrap',
      userSelect:    'none',
      ...extraStyle,
    }}>
      {children}
    </span>
  )
}

// ─── CountBadge — badge numérique (ex: notifications) ─────────────────────────
/**
 * Petit badge numérique superposé sur une icône.
 * Utiliser en positionnement absolu sur le parent.
 *
 * @prop {number} count
 * @prop {number} max   — seuil d'affichage "9+" (défaut: 9)
 */
export function CountBadge({ count, max = 9 }) {
  if (!count || count <= 0) return null

  return (
    <span
      aria-label={`${count} notification${count > 1 ? 's' : ''}`}
      style={{
        position:       'absolute',
        top:            -5,
        right:          -6,
        minWidth:       16,
        height:         16,
        borderRadius:   radius.pill,
        background:     '#EF4444',
        color:          '#FFFFFF',
        fontSize:        9,
        fontWeight:      weight.black,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '0 4px',
        border:         '1.5px solid rgba(0,0,0,0.15)',
        lineHeight:      1,
      }}
    >
      {count > max ? `${max}+` : count}
    </span>
  )
}

// ─── StatusDot — indicateur de statut coloré ──────────────────────────────────
/**
 * Point de statut (en ligne, hors ligne, en cours…).
 *
 * @prop {'online'|'idle'|'offline'|'error'} status
 * @prop {'sm'|'md'|'lg'} size
 * @prop {boolean} pulse — anime le point si true
 */
export function StatusDot({ status = 'online', size = 'md', pulse = false }) {
  const COLORS = {
    online:  '#22C55E',
    idle:    '#F59E0B',
    offline: '#9CA3AF',
    error:   '#EF4444',
  }

  const SIZES = { sm: 6, md: 8, lg: 10 }
  const d = SIZES[size] || SIZES.md
  const col = COLORS[status] || COLORS.offline

  return (
    <span
      aria-label={status}
      style={{
        display:      'inline-block',
        width:         d,
        height:        d,
        borderRadius: '50%',
        background:    col,
        flexShrink:    0,
        animation:     pulse ? 'pulse 2s ease infinite' : 'none',
        boxShadow:     pulse ? `0 0 0 2px ${col}40` : 'none',
      }}
    />
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isColorDark(hex) {
  try {
    const h = hex.replace('#', '')
    const r = parseInt(h.substring(0, 2), 16)
    const g = parseInt(h.substring(2, 4), 16)
    const b = parseInt(h.substring(4, 6), 16)
    return (r * 299 + g * 587 + b * 114) / 1000 < 128
  } catch {
    return false
  }
}
