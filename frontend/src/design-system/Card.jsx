import { useState } from 'react'
import { useTheme } from '../styles/theme.jsx'
import { radius, shadow, space, motion } from './tokens'

// ─── Card ─────────────────────────────────────────────────────────────────────
/**
 * Conteneur de carte unifié.
 *
 * @prop {'default'|'elevated'|'flat'|'bordered'} variant
 * @prop {'none'|'sm'|'md'|'lg'} padding
 * @prop {boolean} hoverable    — ajoute un lift au survol
 * @prop {boolean} interactive  — curseur pointer + lift au survol (pour cartes cliquables)
 * @prop {string}  accentColor  — affiche une barre colorée à gauche (ex: C.emerald)
 * @prop {React.ReactNode} header  — contenu dans la zone header (séparé du body)
 * @prop {React.ReactNode} footer  — contenu dans la zone footer (séparé du body)
 */
export function Card({
  variant     = 'default',
  padding     = 'md',
  hoverable   = false,
  interactive = false,
  accentColor,
  header,
  footer,
  children,
  onClick,
  style: extraStyle,
  ...rest
}) {
  const { C } = useTheme()
  const [hovered, setHovered] = useState(false)

  const isClickable = interactive || !!onClick

  // Padding map
  const PAD = { none: 0, sm: space[3], md: space[4], lg: space[6] }
  const pad = PAD[padding] ?? PAD.md

  // Styles par variante
  const variants = {
    default:  { bg: C.surface,    border: `1px solid ${C.border}`,     boxShadow: shadow.sm   },
    elevated: { bg: C.surface,    border: `1px solid ${C.border}`,     boxShadow: shadow.md   },
    flat:     { bg: C.surfaceAlt, border: 'none',                       boxShadow: shadow.none },
    bordered: { bg: C.surface,    border: `2px solid ${C.border}`,     boxShadow: shadow.none },
  }

  const v = variants[variant] || variants.default

  const hoverBoxShadow = hoverable || isClickable
    ? shadow.md
    : v.boxShadow

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable && onClick
        ? e => { if (e.key === 'Enter' || e.key === ' ') onClick(e) }
        : undefined
      }
      style={{
        display:      'flex',
        flexDirection: 'column',
        background:    v.bg,
        border:        v.border,
        borderRadius:  radius.lg,
        boxShadow:     hovered && (hoverable || isClickable) ? hoverBoxShadow : v.boxShadow,
        transform:     hovered && (hoverable || isClickable) ? 'translateY(-2px)' : 'translateY(0)',
        transition:    [
          `box-shadow ${motion.fast_out}`,
          `transform  ${motion.fast_out}`,
          `background ${motion.fast_out}`,
        ].join(', '),
        cursor:        isClickable ? 'pointer' : 'default',
        overflow:      'hidden',
        position:      'relative',
        outline:       'none',
        ...extraStyle,
      }}
      {...rest}
    >
      {/* Barre d'accent gauche */}
      {accentColor && (
        <div style={{
          position:    'absolute',
          left:         0, top: 0, bottom: 0,
          width:        3,
          background:   accentColor,
          borderRadius: `${radius.lg}px 0 0 ${radius.lg}px`,
        }} aria-hidden="true" />
      )}

      {/* Zone header */}
      {header && (
        <div style={{
          padding:       `${space[3]}px ${pad}px`,
          borderBottom: `1px solid ${C.border}`,
          flexShrink:    0,
          paddingLeft:   accentColor ? pad + 8 : pad,
        }}>
          {header}
        </div>
      )}

      {/* Corps principal */}
      {children !== undefined && (
        <div style={{
          padding:     pad,
          paddingLeft: accentColor ? pad + 8 : pad,
          flex:        1,
        }}>
          {children}
        </div>
      )}

      {/* Zone footer */}
      {footer && (
        <div style={{
          padding:      `${space[3]}px ${pad}px`,
          borderTop:   `1px solid ${C.border}`,
          flexShrink:   0,
          paddingLeft:  accentColor ? pad + 8 : pad,
        }}>
          {footer}
        </div>
      )}
    </div>
  )
}

// ─── StatCard — carte chiffre clé ─────────────────────────────────────────────
/**
 * Carte métrique compacte : icône + valeur + label.
 *
 * @prop {React.ElementType} icon  — composant lucide-react
 * @prop {string} label
 * @prop {string|number} value
 * @prop {string} subtitle
 * @prop {string} color   — couleur de l'icône et de l'accent
 */
export function StatCard({ icon: Icon, label, value, subtitle, color, style: extraStyle }) {
  const { C } = useTheme()

  return (
    <Card variant="default" padding="none" style={{ overflow: 'hidden', ...extraStyle }}>
      <div style={{
        padding:  `${space[3]}px ${space[4]}px`,
        display:  'flex',
        flexDirection: 'column',
        gap:      space[1],
        position: 'relative',
      }}>
        {/* Disque décoratif en bas à droite */}
        <div style={{
          position:        'absolute',
          bottom:          -18, right: -18,
          width:           72, height: 72,
          borderRadius:    '50%',
          background:      `${color ?? C.brown}12`,
          pointerEvents:   'none',
        }} aria-hidden="true" />

        {/* Ligne icône + label */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            fontSize:      10,
            fontWeight:    700,
            color:         C.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}>
            {label}
          </span>
          {Icon && (
            <div style={{
              width:          26, height: 26,
              borderRadius:   radius.sm,
              background:     `${color ?? C.brown}15`,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              flexShrink:     0,
            }}>
              <Icon size={13} color={color ?? C.brown} />
            </div>
          )}
        </div>

        {/* Valeur */}
        <span style={{
          fontSize:      22,
          fontWeight:    900,
          color:         C.text,
          lineHeight:    1,
          letterSpacing: -0.5,
          overflow:      'hidden',
          textOverflow:  'ellipsis',
          whiteSpace:    'nowrap',
        }}>
          {value}
        </span>

        {/* Sous-titre */}
        {subtitle && (
          <span style={{
            fontSize:     10,
            fontWeight:   500,
            color:        C.textMuted,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {subtitle}
          </span>
        )}
      </div>
    </Card>
  )
}
