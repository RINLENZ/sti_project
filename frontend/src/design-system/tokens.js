// ─── Design Tokens — SenSia Design System ────────────────────────────────────
// Source unique pour l'espacement, les rayons, les ombres, le mouvement.
// Les couleurs restent dans useTheme() / theme.jsx.
// Usage : import { space, radius, shadow, motion, type, weight } from './tokens'

// Espacement — multiples de 4px
export const space = {
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  8:  32,
  10: 40,
  12: 48,
  16: 64,
}

// Border-radius — 5 valeurs, pas plus
export const radius = {
  sm:   6,
  md:   12,
  lg:   20,
  xl:   28,
  pill: 9999,
}

// Ombres — légères, cohérentes
export const shadow = {
  none: 'none',
  sm:   '0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.05)',
  md:   '0 4px 16px rgba(0,0,0,0.09), 0 2px 6px rgba(0,0,0,0.05)',
  lg:   '0 12px 36px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)',
  xl:   '0 24px 64px rgba(0,0,0,0.16), 0 8px 20px rgba(0,0,0,0.08)',
}

// Ombres colorées — pour les boutons primaires (à composer avec la couleur)
export const shadowColored = (hex, alpha = 0.32) =>
  `0 4px 18px ${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`

// Motion — easing + durée
export const motion = {
  // Durées
  fast:   150,
  mid:    240,
  slow:   380,

  // Easings CSS
  easeOut:   'cubic-bezier(0.0, 0.0, 0.2, 1)',
  easeIn:    'cubic-bezier(0.4, 0.0, 1, 1)',
  easeInOut: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  spring:    'cubic-bezier(0.34, 1.56, 0.64, 1)',

  // Transitions complètes prêtes à l'emploi
  fast_out:   '150ms cubic-bezier(0.0, 0.0, 0.2, 1)',
  mid_out:    '240ms cubic-bezier(0.0, 0.0, 0.2, 1)',
  slow_out:   '380ms cubic-bezier(0.0, 0.0, 0.2, 1)',
  mid_spring: '280ms cubic-bezier(0.34, 1.56, 0.64, 1)',
}

// Échelle typographique — tailles en px
export const type = {
  '2xs':  10,
  xs:     11,
  sm:     12,
  base:   14,
  md:     15,
  lg:     17,
  xl:     20,
  '2xl':  24,
  '3xl':  30,
  '4xl':  36,
}

// Graisses de fonte
export const weight = {
  normal:    400,
  medium:    500,
  semibold:  600,
  bold:      700,
  extrabold: 800,
  black:     900,
}

// Line-heights
export const leading = {
  tight:  1.2,
  snug:   1.35,
  normal: 1.5,
  relaxed: 1.7,
}

// Z-index — couches nommées
export const z = {
  base:    0,
  raised:  10,
  overlay: 100,
  modal:   200,
  toast:   300,
  tooltip: 400,
}

// Tailles d'icônes normalisées (px)
export const iconSize = {
  xs:  12,
  sm:  14,
  md:  16,
  lg:  20,
  xl:  24,
}
