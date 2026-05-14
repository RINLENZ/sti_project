import { useState } from 'react'
import { useTheme } from '../styles/theme.jsx'
import { radius, shadow, shadowColored, motion, space, type, weight } from './tokens'

// ─── Spinner inline ───────────────────────────────────────────────────────────
function BtnSpinner({ color }) {
  return (
    <svg
      width={14} height={14}
      viewBox="0 0 14 14"
      style={{ animation: 'spin 0.75s linear infinite', flexShrink: 0 }}
      aria-hidden="true"
    >
      <circle cx={7} cy={7} r={5.5} fill="none" stroke={color} strokeWidth={2} strokeOpacity={0.25} />
      <path d="M7 1.5 A5.5 5.5 0 0 1 12.5 7" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </svg>
  )
}

// ─── Tailles ──────────────────────────────────────────────────────────────────
const SIZE = {
  sm: { h: 32,  px: space[3], fontSize: type.sm,   gap: space[1], iconSize: 13, radius: radius.md  },
  md: { h: 40,  px: space[4], fontSize: type.base,  gap: space[2], iconSize: 15, radius: radius.md  },
  lg: { h: 48,  px: space[6], fontSize: type.md,   gap: space[2], iconSize: 17, radius: radius.lg  },
}

// ─── Button ───────────────────────────────────────────────────────────────────
/**
 * Composant bouton unifié.
 *
 * @prop {'primary'|'secondary'|'ghost'|'danger'} variant
 * @prop {'sm'|'md'|'lg'} size
 * @prop {boolean} loading
 * @prop {boolean} disabled
 * @prop {boolean} fullWidth
 * @prop {React.ReactNode} iconLeft  — icône à gauche du label
 * @prop {React.ReactNode} iconRight — icône à droite du label
 */
export function Button({
  variant = 'primary',
  size    = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  iconLeft,
  iconRight,
  children,
  onClick,
  type: htmlType = 'button',
  style: extraStyle,
  ...rest
}) {
  const { C } = useTheme()
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  const s = SIZE[size] || SIZE.md
  const isDisabled = disabled || loading

  // ── Couleurs par variante ─────────────────────────────────────────
  const variants = {
    primary: {
      bg:        `linear-gradient(160deg, ${C.brown} 0%, ${C.brownMid} 100%)`,
      bgHover:   `linear-gradient(160deg, ${C.brownMid} 0%, ${C.brownLight} 100%)`,
      color:     '#FFFFFF',
      border:    'transparent',
      boxShadow: hovered && !isDisabled ? shadowColored(C.brown, 0.35) : shadow.sm,
    },
    secondary: {
      bg:        'transparent',
      bgHover:   C.brownPale,
      color:     C.brown,
      border:    C.brown,
      boxShadow: shadow.none,
    },
    ghost: {
      bg:        'transparent',
      bgHover:   C.brownGhost,
      color:     C.textSec,
      border:    'transparent',
      boxShadow: shadow.none,
    },
    danger: {
      bg:        `linear-gradient(160deg, ${C.red} 0%, #B91C1C 100%)`,
      bgHover:   `linear-gradient(160deg, #EF4444 0%, ${C.red} 100%)`,
      color:     '#FFFFFF',
      border:    'transparent',
      boxShadow: hovered && !isDisabled ? shadowColored(C.red, 0.30) : shadow.sm,
    },
  }

  const v = variants[variant] || variants.primary
  const currentBg = hovered && !isDisabled ? v.bgHover : v.bg

  return (
    <button
      type={htmlType}
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      aria-busy={loading}
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        justifyContent: 'center',
        gap:             s.gap,
        height:          s.h,
        padding:        `0 ${s.px}px`,
        width:           fullWidth ? '100%' : 'auto',
        background:      isDisabled ? C.border : currentBg,
        color:           isDisabled ? C.textMuted : v.color,
        border:         `1.5px solid ${isDisabled ? 'transparent' : v.border}`,
        borderRadius:    s.radius,
        fontSize:        s.fontSize,
        fontWeight:      weight.bold,
        fontFamily:      'inherit',
        cursor:          isDisabled ? 'not-allowed' : 'pointer',
        boxShadow:       isDisabled ? shadow.none : v.boxShadow,
        transition:      [
          `background ${motion.fast_out}`,
          `box-shadow ${motion.fast_out}`,
          `transform ${motion.fast_out}`,
          `color ${motion.fast_out}`,
        ].join(', '),
        transform:       pressed && !isDisabled ? 'scale(0.97)' : 'scale(1)',
        whiteSpace:      'nowrap',
        userSelect:      'none',
        outline:         'none',
        ...extraStyle,
      }}
      {...rest}
    >
      {loading
        ? <BtnSpinner color={isDisabled ? C.textMuted : v.color} />
        : iconLeft && <span style={{ display: 'flex', alignItems: 'center', fontSize: s.iconSize }} aria-hidden="true">{iconLeft}</span>
      }

      {children && (
        <span style={{ opacity: loading ? 0.6 : 1 }}>
          {children}
        </span>
      )}

      {!loading && iconRight && (
        <span style={{ display: 'flex', alignItems: 'center', fontSize: s.iconSize }} aria-hidden="true">
          {iconRight}
        </span>
      )}
    </button>
  )
}

// ─── IconButton — bouton icône seule ─────────────────────────────────────────
/**
 * Bouton carré avec uniquement une icône.
 * Toujours accompagné d'un aria-label pour l'accessibilité.
 *
 * @prop {'primary'|'secondary'|'ghost'|'danger'} variant
 * @prop {'sm'|'md'|'lg'} size
 */
export function IconButton({
  variant = 'ghost',
  size    = 'md',
  icon,
  'aria-label': ariaLabel,
  disabled = false,
  loading  = false,
  onClick,
  style: extraStyle,
  ...rest
}) {
  const { C } = useTheme()
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  const s    = SIZE[size] || SIZE.md
  const isDisabled = disabled || loading

  const variants = {
    primary:   { bg: C.brown,     bgHover: C.brownMid,  color: '#fff',      border: 'transparent' },
    secondary: { bg: 'transparent', bgHover: C.brownPale, color: C.brown,   border: C.brown       },
    ghost:     { bg: 'transparent', bgHover: C.brownGhost, color: C.textSec, border: 'transparent' },
    danger:    { bg: C.red,       bgHover: '#EF4444',   color: '#fff',      border: 'transparent' },
  }

  const v = variants[variant] || variants.ghost

  return (
    <button
      type="button"
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      aria-label={ariaLabel}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        justifyContent: 'center',
        width:           s.h,
        height:          s.h,
        padding:         0,
        background:      isDisabled ? C.border : (hovered ? v.bgHover : v.bg),
        color:           isDisabled ? C.textMuted : v.color,
        border:         `1.5px solid ${isDisabled ? 'transparent' : v.border}`,
        borderRadius:    radius.md,
        cursor:          isDisabled ? 'not-allowed' : 'pointer',
        transition:      `all ${motion.fast_out}`,
        transform:       pressed && !isDisabled ? 'scale(0.92)' : 'scale(1)',
        flexShrink:      0,
        outline:         'none',
        ...extraStyle,
      }}
      {...rest}
    >
      {loading
        ? <BtnSpinner color={isDisabled ? C.textMuted : v.color} />
        : icon
      }
    </button>
  )
}
