/**
 * AlishaEffects.jsx — Effets visuels SVG animés via Framer Motion
 * Particules, ondes, bulles de pensée, ZZZ, erreur réseau
 */
import { motion, AnimatePresence } from 'framer-motion'
import { useMemo } from 'react'

const GOLD   = '#D4A853'
const BROWN  = '#6B3A2A'
const VIOLET = '#9B72D6'
const TEAL   = '#0D9373'
const WHITE  = '#FFFFFF'

// ── Particules ────────────────────────────────────────────────────

function useParticles(state) {
  return useMemo(() => {
    if (state === 'correct' || state === 'celebration') {
      const n = state === 'celebration' ? 14 : 8
      return Array.from({ length: n }, (_, i) => ({
        id: i,
        cx:       (i % 2 === 0 ? -1 : 1) * (20 + Math.random() * 50),
        cy:       -20 - Math.random() * 40,
        dy:       -(40 + Math.random() * 60),
        dx:       (i % 2 === 0 ? -1 : 1) * (10 + Math.random() * 30),
        rot:      Math.random() * 360,
        duration: 0.9 + Math.random() * 0.5,
        delay:    i * 0.07,
        shape:    i % 3 === 0 ? 'star' : i % 3 === 1 ? 'circle' : 'diamond',
        color:    [GOLD, TEAL, VIOLET, WHITE][i % 4],
        size:     4 + Math.random() * 5,
      }))
    }
    if (state === 'thinking' || state === 'focus') {
      return Array.from({ length: 5 }, (_, i) => ({
        id: i,
        cx: 20 + i * 12, cy: -10 - i * 8,
        dy: -(20 + i * 10), dx: 5 + i * 3,
        rot: 0,
        duration: 1.5 + i * 0.2,
        delay: i * 0.25,
        shape: 'circle',
        color: VIOLET,
        size: 4 + i * 1.5,
      }))
    }
    if (state === 'excited') {
      return Array.from({ length: 10 }, (_, i) => ({
        id: i,
        cx:       (i % 2 === 0 ? -1 : 1) * (15 + Math.random() * 55),
        cy:       -15 - Math.random() * 45,
        dy:       -(50 + Math.random() * 50),
        dx:       (i % 2 === 0 ? -1 : 1) * (15 + Math.random() * 35),
        rot:      Math.random() * 360,
        duration: 0.8 + Math.random() * 0.5,
        delay:    i * 0.06,
        shape:    i % 2 === 0 ? 'star' : 'circle',
        color:    [GOLD, TEAL, VIOLET][i % 3],
        size:     4 + Math.random() * 6,
      }))
    }
    return []
  }, [state])
}

function ParticleShape({ shape, size, color }) {
  if (shape === 'star') {
    const outer = size, inner = size * 0.45
    const pts = Array.from({ length: 10 }, (_, i) => {
      const r     = i % 2 === 0 ? outer : inner
      const angle = (i * Math.PI) / 5 - Math.PI / 2
      return `${r * Math.cos(angle)},${r * Math.sin(angle)}`
    }).join(' ')
    return <polygon points={pts} fill={color}/>
  }
  if (shape === 'diamond') {
    return <rect x={-size * 0.7} y={-size * 0.7} width={size * 1.4} height={size * 1.4}
                 fill={color} transform="rotate(45)"/>
  }
  return <circle r={size} fill={color}/>
}

export function AlishaParticles({ state, originX = 90, originY = 90 }) {
  const particles = useParticles(state)
  return (
    <AnimatePresence>
      {particles.map(p => (
        <motion.g
          key={`${state}-${p.id}`}
          style={{ x: originX + p.cx, y: originY + p.cy }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0, 1.2, 1, 0], y: p.dy, x: p.dx, rotate: p.rot }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeOut' }}
        >
          <ParticleShape shape={p.shape} size={p.size} color={p.color}/>
        </motion.g>
      ))}
    </AnimatePresence>
  )
}

// ── Ondes audio ───────────────────────────────────────────────────

export function SoundWaves({ active, color = GOLD }) {
  if (!active) return null
  return (
    <g>
      {[1, 2, 3].map(i => (
        <motion.path
          key={i}
          d={`M 0 ${-5 * i} Q ${7 * i} 0 0 ${5 * i}`}
          stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round"
          initial={{ opacity: 0, x: 0 }}
          animate={{ opacity: [0, 0.7, 0], x: [0, 7 + i * 4] }}
          transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}
    </g>
  )
}

// ── Bulles de pensée ──────────────────────────────────────────────

export function ThinkBubbles({ active }) {
  if (!active) return null
  return (
    <g>
      {[0, 1, 2].map(i => (
        <motion.circle
          key={i}
          cx={14 + i * 10} cy={-8 - i * 10}
          r={3 + i * 1.5}
          fill={GOLD} opacity={0.6}
          animate={{ opacity: [0.3, 0.9, 0.3], scale: [0.8, 1.1, 0.8] }}
          transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
        />
      ))}
    </g>
  )
}

// ── ZZZ sommeil ───────────────────────────────────────────────────

export function SleepZzz({ active }) {
  if (!active) return null
  return (
    <g>
      {['z', 'z', 'Z'].map((z, i) => (
        <motion.text
          key={i}
          x={20 + i * 12} y={-20 - i * 14}
          fontSize={8 + i * 4} fill="#8896B0" fontWeight={700} textAnchor="middle"
          initial={{ opacity: 0, y: -20 - i * 14 }}
          animate={{ opacity: [0, 0.8, 0], y: [-20 - i * 14, -40 - i * 14] }}
          transition={{ duration: 2, delay: i * 0.4, repeat: Infinity }}
        >
          {z}
        </motion.text>
      ))}
    </g>
  )
}

// ── Erreur réseau ─────────────────────────────────────────────────

export function NetworkError({ active }) {
  if (!active) return null
  return (
    <motion.g animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
      <text x={20} y={-30} fontSize={18} textAnchor="middle">📡</text>
    </motion.g>
  )
}

// ── Ombre/lueur de sol ────────────────────────────────────────────

export function AvatarShadow({ accent = GOLD }) {
  return (
    <motion.ellipse
      cx={90} cy={225} rx={48} ry={12}
      fill={accent}
      initial={{ opacity: 0.08 }}
      animate={{ opacity: [0.08, 0.16, 0.08] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      style={{ filter: 'blur(6px)' }}
    />
  )
}
