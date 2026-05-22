/**
 * AlishaAnimations.js — Variants Framer Motion pour tous les états d'Alisha
 */

export const spring       = { type: 'spring', stiffness: 280, damping: 22 }
export const springBouncy = { type: 'spring', stiffness: 380, damping: 16 }
export const springSoft   = { type: 'spring', stiffness: 160, damping: 28 }

export const bodyVariants = {
  idle: {
    y: [0, -6, 0], rotate: [0, 0.5, -0.5, 0],
    transition: { duration: 3.5, repeat: Infinity, ease: 'easeInOut' },
  },
  thinking: {
    y: [0, -3, 0], rotate: [-2, -3, -2],
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
  speaking: {
    y: [0, -3, 0, -2, 0], rotate: [0, 0.8, 0, -0.8, 0],
    transition: { duration: 0.6, repeat: Infinity, ease: 'easeInOut' },
  },
  correct: {
    y: [0, -20, -8, -14, 0], rotate: [0, -4, 4, -2, 0], scale: [1, 1.06, 1.02, 1.04, 1],
    transition: { duration: 0.7, ease: [0.34, 1.56, 0.64, 1], times: [0, 0.3, 0.5, 0.7, 1] },
  },
  wrong: {
    x: [0, -8, 8, -6, 6, -3, 3, 0], rotate: [0, -2, 2, -1.5, 1.5, 0],
    transition: { duration: 0.5, ease: 'easeInOut' },
  },
  question: {
    y: [0, -4, 0], rotate: [0, 4, 3, 4, 0],
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
  welcome: {
    y: [0, -16, -6, 0], scale: [0.85, 1.08, 1.02, 1], rotate: [0, 3, -1, 0],
    transition: { duration: 0.65, ease: [0.34, 1.56, 0.64, 1] },
  },
  loading: {
    y: [0, -2, 0], transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
  },
  celebration: {
    y: [0, -28, -12, -22, 0], rotate: [0, -6, 6, -3, 0], scale: [1, 1.1, 1.04, 1.07, 1],
    transition: { duration: 0.8, ease: [0.34, 1.56, 0.64, 1], times: [0, 0.25, 0.5, 0.75, 1] },
  },
  hint: {
    y: [0, -5, 0], rotate: [0, 6, 5, 6, 0],
    transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
  },
  confused: {
    y: [0, -2, 0], rotate: [-4, -6, -4],
    transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
  },
  listening: {
    y: [0, -4, 0], rotate: [0, 3, 2, 3, 0],
    transition: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
  },
  typing: {
    y: [0, -2, 0], rotate: [-3, -4, -3],
    transition: { duration: 1, repeat: Infinity, ease: 'easeInOut' },
  },
  excited: {
    y: [0, -18, -6, -14, 0], rotate: [0, 5, -5, 3, 0], scale: [1, 1.08, 1.03, 1.06, 1],
    transition: { duration: 0.55, ease: [0.34, 1.56, 0.64, 1], times: [0, 0.25, 0.5, 0.75, 1], repeat: 2 },
  },
  focus: {
    y: [0, -3, 0], rotate: [-1, -2, -1],
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
  },
  sleep: {
    y: [0, -2, 0], rotate: [-8, -10, -8],
    transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
  },
  networkError: {
    x: [0, -4, 4, -3, 3, 0], rotate: [0, -1, 1, 0],
    transition: { duration: 0.4, ease: 'easeInOut', repeat: 3 },
  },
}

// Lip sync — cycle de bouches pour state 'speaking'
export const lipSyncCycle = [
  'M -23 0 Q 0 4 23 0',   // closed
  'M -23 0 Q 0 16 23 0',  // open wide
  'M -23 0 Q 0 4 23 0',   // closed
  'M -23 0 Q 0 11 23 0',  // open medium
  'M -23 0 Q 0 16 23 0',  // open wide
  'M -23 0 Q 0 4 23 0',   // closed
  'M -23 0 Q 0 11 23 0',  // open medium
  'M -23 0 Q 0 4 23 0',   // closed
]

// Formes de bouche par état (translate(90, 135) dans le SVG)
export const MOUTH_SHAPES = {
  closed:  'M -23 0 Q 0 4 23 0',
  smile:   'M -23 0 Q 0 19 23 0',
  small:   'M -14 0 Q 0 9 14 0',
  wide:    'M -25 0 Q 0 24 25 0',
  sad:     'M -20 7 Q 0 0 20 7',
  empathy: 'M -16 4 Q 0 12 16 4',
}

export const bubbleVariants = {
  initial: { opacity: 0, y: 10, scale: 0.92 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { ...springBouncy, delay: 0.1 } },
  exit:    { opacity: 0, y: -6, scale: 0.94, transition: { duration: 0.18 } },
}
