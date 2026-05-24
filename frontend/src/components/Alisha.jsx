/**
 * Alisha v2 — mascotte SVG animée de Sensia.
 * Personnage africain, couleurs Sensia. Animations via Framer Motion.
 *
 * Props :
 *   state  : voir STATES dans AlishaStates.js (17 états)
 *   size   : number (largeur px, défaut 200)
 *   label  : string | null — texte sous l'avatar
 */
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  bodyVariants, lipSyncCycle, MOUTH_SHAPES,
} from './AlishaAnimations'
import {
  AlishaParticles, SoundWaves, ThinkBubbles, SleepZzz, NetworkError, AvatarShadow,
} from './AlishaEffects'
import { STATE_ACCENT } from './AlishaStates'

// ── Sourcils selon état ───────────────────────────────────────────

function Brows({ state }) {
  const sad      = state === 'wrong' || state === 'confused' || state === 'networkError'
  const raised   = state === 'correct' || state === 'celebration' || state === 'excited' || state === 'welcome'
  const furrowed = state === 'thinking' || state === 'focus' || state === 'typing' || state === 'sleep'

  if (sad) return (
    <>
      <path d="M 52 74 Q 66 80 80 76" stroke="#1C0A00" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <path d="M 100 76 Q 114 80 128 74" stroke="#1C0A00" strokeWidth="4" fill="none" strokeLinecap="round"/>
    </>
  )
  if (raised) return (
    <>
      <path d="M 52 68 Q 66 61 80 65" stroke="#1C0A00" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <path d="M 100 65 Q 114 61 128 68" stroke="#1C0A00" strokeWidth="4" fill="none" strokeLinecap="round"/>
    </>
  )
  if (furrowed) return (
    <>
      <path d="M 52 72 Q 66 65 80 69" stroke="#1C0A00" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <path d="M 100 66 Q 114 63 128 71" stroke="#1C0A00" strokeWidth="4" fill="none" strokeLinecap="round"/>
    </>
  )
  return (
    <>
      <path d="M 52 73 Q 66 66 80 70" stroke="#1C0A00" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <path d="M 100 70 Q 114 66 128 73" stroke="#1C0A00" strokeWidth="4" fill="none" strokeLinecap="round"/>
    </>
  )
}

// ── Yeux selon état ───────────────────────────────────────────────

function Eyes({ state, blink }) {
  const sleeping = state === 'sleep'
  const happy    = blink || state === 'correct' || state === 'celebration' || state === 'excited'
  const sad      = state === 'wrong'

  // Fond oculaire
  return (
    <>
      <ellipse cx="66"  cy="94" rx="15" ry="17" fill="white" stroke="#D8C0A0" strokeWidth="1.5"/>
      <ellipse cx="114" cy="94" rx="15" ry="17" fill="white" stroke="#D8C0A0" strokeWidth="1.5"/>

      {sleeping ? (
        // Yeux fermés - ligne droite somnolente
        <>
          <path d="M 51 94 L 81 94" stroke="#1C0A00" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
          <path d="M 99 94 L 129 94" stroke="#1C0A00" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        </>
      ) : happy ? (
        // Yeux en croissant joyeux (^‿^)
        <>
          <path d="M 51 94 Q 66 83 81 94" stroke="#1C0A00" strokeWidth="4" fill="none" strokeLinecap="round"/>
          <path d="M 99 94 Q 114 83 129 94" stroke="#1C0A00" strokeWidth="4" fill="none" strokeLinecap="round"/>
        </>
      ) : sad ? (
        // Yeux tristes
        <>
          <circle cx="66"  cy="97" r="10"   fill="#3D2000"/>
          <circle cx="114" cy="97" r="10"   fill="#3D2000"/>
          <circle cx="67"  cy="95" r="6"    fill="#050200"/>
          <circle cx="115" cy="95" r="6"    fill="#050200"/>
          <circle cx="70"  cy="91" r="3"    fill="white"/>
          <circle cx="118" cy="91" r="3"    fill="white"/>
          <circle cx="63"  cy="99" r="1.5"  fill="white" opacity="0.55"/>
          <circle cx="111" cy="99" r="1.5"  fill="white" opacity="0.55"/>
        </>
      ) : (
        // Yeux normaux grands et expressifs
        <>
          <circle cx="66"  cy="95" r="10.5" fill="#3D2000"/>
          <circle cx="114" cy="95" r="10.5" fill="#3D2000"/>
          <circle cx="67"  cy="93" r="6"    fill="#050200"/>
          <circle cx="115" cy="93" r="6"    fill="#050200"/>
          <circle cx="70"  cy="89" r="3.5"  fill="white"/>
          <circle cx="118" cy="89" r="3.5"  fill="white"/>
          <circle cx="63"  cy="99" r="1.8"  fill="white" opacity="0.5"/>
          <circle cx="111" cy="99" r="1.8"  fill="white" opacity="0.5"/>
        </>
      )}
    </>
  )
}

// ── Bouche selon état ─────────────────────────────────────────────

const OPEN_FRAMES = new Set([1, 3, 4, 6])

function Mouth({ state, mouthFrame }) {
  const bigSmile = state === 'correct' || state === 'celebration' || state === 'excited'
  const sadState = state === 'wrong'

  if (bigSmile) return (
    <>
      <path d="M 60 132 Q 90 160 120 132" stroke="#6B2A0A" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M 65 134 Q 90 156 115 134 L 90 134 Z" fill="#B33A30"/>
      <ellipse cx="90" cy="147" rx="17" ry="9" fill="#C44D44"/>
      <rect x="73" y="133" width="34" height="9" rx="4" fill="white" opacity="0.92"/>
      <ellipse cx="90" cy="151" rx="11" ry="4" fill="#F4A0A0" opacity="0.4"/>
    </>
  )

  if (sadState) return (
    <>
      <path d="M 67 142 Q 90 129 113 142" stroke="#6B2A0A" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
      <ellipse cx="52"  cy="112" rx="3.5" ry="4.5" fill="#90CAF9" opacity="0.85"/>
      <path d="M 50 116 Q 49 124 52 128" stroke="#90CAF9" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6"/>
    </>
  )

  const getMouthShape = () => {
    if (state === 'speaking')                    return lipSyncCycle[mouthFrame % lipSyncCycle.length]
    if (state === 'thinking' || state === 'focus' || state === 'typing') return MOUTH_SHAPES.small
    if (state === 'confused' || state === 'networkError') return MOUTH_SHAPES.empathy
    if (state === 'sleep')                       return MOUTH_SHAPES.small
    return MOUTH_SHAPES.smile
  }

  const isOpen = state === 'speaking' && OPEN_FRAMES.has(mouthFrame % 8)

  return (
    <g transform="translate(90, 135)">
      {isOpen && <ellipse cx="0" cy="9" rx="18" ry="9" fill="#C44D44"/>}
      {isOpen && <ellipse cx="0" cy="14" rx="11" ry="4" fill="#F4A0A0" opacity="0.35"/>}
      <motion.path
        animate={{ d: getMouthShape() }}
        transition={{ duration: state === 'speaking' ? 0.12 : 0.25, ease: 'easeInOut' }}
        stroke="#6B2A0A" strokeWidth="3.5" fill="none" strokeLinecap="round"
        initial={{ d: MOUTH_SHAPES.smile }}
      />
      {isOpen && <rect x="-14" y="0" width="28" height="7" rx="3.5" fill="white" opacity="0.92"/>}
    </g>
  )
}

// ── Décos d'état ──────────────────────────────────────────────────

function StateDecos({ state }) {
  if (state === 'question' || state === 'hint') return (
    <text x="132" y="66" fontSize="28" fontWeight="900"
          fill="#D4A853" fontFamily="system-ui"
          style={{ filter: 'drop-shadow(0 2px 6px rgba(212,168,83,0.5))' }}>
      {state === 'hint' ? '💡' : '?'}
    </text>
  )
  if (state === 'wrong') return (
    <>
      <text x="12"  y="92" fontSize="20" fill="#EF4444" fontWeight="900" opacity="0.85">✗</text>
      <text x="146" y="84" fontSize="15" fill="#EF4444" fontWeight="900" opacity="0.60">✗</text>
    </>
  )
  if (state === 'loading') return (
    <motion.circle
      cx="132" cy="60" r="6"
      fill="none" stroke="#D4A853" strokeWidth="2.5"
      strokeDasharray="22 10"
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      style={{ transformOrigin: '132px 60px' }}
    />
  )
  return null
}

// ── Composant principal ───────────────────────────────────────────

export default function Alisha({ state = 'idle', size = 200, label = null }) {
  const [blink,      setBlink]      = useState(false)
  const [mouthFrame, setMouthFrame] = useState(0)
  const blinkRef = useRef(null)
  const speakRef = useRef(null)

  // Clignement aléatoire
  useEffect(() => {
    const schedule = () => {
      blinkRef.current = setTimeout(() => {
        setBlink(true)
        setTimeout(() => { setBlink(false); schedule() }, 120)
      }, 2500 + Math.random() * 2000)
    }
    schedule()
    return () => clearTimeout(blinkRef.current)
  }, [])

  // Lip sync
  useEffect(() => {
    if (state === 'speaking') {
      speakRef.current = setInterval(() => setMouthFrame(f => f + 1), 150)
    } else {
      clearInterval(speakRef.current)
      setMouthFrame(0)
    }
    return () => clearInterval(speakRef.current)
  }, [state])

  const accent  = STATE_ACCENT[state] || '#D4A853'
  const anim    = bodyVariants[state] || bodyVariants.idle
  const aspect  = 230 / 180

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 6, userSelect: 'none' }}>
      <motion.div
        style={{ width: size, height: size * aspect, transformOrigin: 'center bottom', willChange: 'transform' }}
        animate={anim}
      >
        <svg viewBox="0 0 180 230" width={size} height={size * aspect} xmlns="http://www.w3.org/2000/svg">

          {/* ── Ombre sol ── */}
          <AvatarShadow accent={accent}/>

          {/* ── Particules ── */}
          <AlishaParticles state={state} originX={90} originY={90}/>

          {/* ══════════════════════════════
              CHEVEUX — Afro naturel
          ══════════════════════════════ */}
          <ellipse cx="90"  cy="80" rx="58" ry="56" fill="#1C0A00"/>
          <circle  cx="42"  cy="68" r="27"           fill="#1C0A00"/>
          <circle  cx="138" cy="68" r="27"           fill="#1C0A00"/>
          <ellipse cx="90"  cy="32" rx="34" ry="24"  fill="#1C0A00"/>
          {/* Reflets */}
          <ellipse cx="68"  cy="44" rx="11" ry="5.5" fill="#2E1200" opacity="0.55" transform="rotate(-18,68,44)"/>
          <ellipse cx="116" cy="42" rx="9"  ry="5"   fill="#2E1200" opacity="0.45" transform="rotate(18,116,42)"/>
          {/* Mèches */}
          <path d="M 50 44 Q 46 60 40 74"  stroke="#3A1800" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.5"/>
          <path d="M 130 44 Q 134 60 140 74" stroke="#3A1800" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.5"/>
          <path d="M 76 22 Q 72 34 68 46"  stroke="#3A1800" strokeWidth="2"   fill="none" strokeLinecap="round" opacity="0.4"/>
          <path d="M 104 22 Q 108 34 112 46" stroke="#3A1800" strokeWidth="2"   fill="none" strokeLinecap="round" opacity="0.4"/>

          {/* ══════════════════════════════
              VISAGE
          ══════════════════════════════ */}
          <ellipse cx="90" cy="100" rx="50" ry="56" fill="#C68642" stroke="#9A5A28" strokeWidth="2.5"/>

          {/* Oreilles */}
          <ellipse cx="40"  cy="100" rx="9" ry="13" fill="#B87332" stroke="#9A5A28" strokeWidth="2"/>
          <ellipse cx="140" cy="100" rx="9" ry="13" fill="#B87332" stroke="#9A5A28" strokeWidth="2"/>
          <ellipse cx="40"  cy="100" rx="5" ry="8"  fill="#A06228"/>
          <ellipse cx="140" cy="100" rx="5" ry="8"  fill="#A06228"/>

          {/* Sourcils */}
          <Brows state={state}/>

          {/* Yeux */}
          <Eyes state={state} blink={blink}/>

          {/* Nez */}
          <ellipse cx="90" cy="116" rx="5.5" ry="3.5" fill="#A06228" opacity="0.6"/>

          {/* Joues */}
          <ellipse cx="52"  cy="117" rx="13" ry="8" fill="#E8956D" opacity="0.28"/>
          <ellipse cx="128" cy="117" rx="13" ry="8" fill="#E8956D" opacity="0.28"/>

          {/* Bouche */}
          <Mouth state={state} mouthFrame={mouthFrame}/>

          {/* ── Effets contextuels ── */}
          <StateDecos state={state}/>

          {/* Ondes audio (speaking) */}
          <g transform="translate(128, 95)">
            <SoundWaves active={state === 'speaking'} color={accent}/>
          </g>

          {/* Bulles pensée (thinking) */}
          <g transform="translate(110, 60)">
            <ThinkBubbles active={state === 'thinking' || state === 'focus'}/>
          </g>

          {/* ZZZ (sleep) */}
          <g transform="translate(100, 70)">
            <SleepZzz active={state === 'sleep'}/>
          </g>

          {/* Erreur réseau */}
          <g transform="translate(110, 60)">
            <NetworkError active={state === 'networkError'}/>
          </g>

          {/* ══════════════════════════════
              COU
          ══════════════════════════════ */}
          <rect x="75" y="153" width="30" height="18" rx="9" fill="#B87332"/>

          {/* ══════════════════════════════
              CORPS — tenue Sensia
          ══════════════════════════════ */}
          {/* Bras */}
          <path d="M 44 178 Q 22 190 26 208"  stroke="#C68642" strokeWidth="18" fill="none" strokeLinecap="round"/>
          <path d="M 136 178 Q 158 190 154 208" stroke="#C68642" strokeWidth="18" fill="none" strokeLinecap="round"/>

          {/* Corps */}
          <rect x="36" y="166" width="108" height="60" rx="30" fill="#6B3A2A" stroke="#4A2412" strokeWidth="2"/>
          {/* Bande or */}
          <rect x="72" y="166" width="36" height="60" fill="#D4A853"/>
          {/* Masque col */}
          <rect x="36" y="166" width="108" height="26" rx="30" fill="#6B3A2A"/>
          <rect x="36" y="180" width="108" height="12"         fill="#6B3A2A"/>
          {/* Col V */}
          <path d="M 72 175 Q 90 192 108 175" stroke="#D4A853" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          {/* Reflet corps */}
          <ellipse cx="65" cy="175" rx="11" ry="5.5" fill="#8B4A2E" opacity="0.35" transform="rotate(-15,65,175)"/>
          {/* Logo */}
          <text x="82" y="204" fontSize="10" fontWeight="900" fill="#6B3A2A" fontFamily="system-ui" opacity="0.65">S∿</text>

          {/* Mains */}
          <circle cx="26"  cy="210" r="13" fill="#C68642" stroke="#9A5A28" strokeWidth="2"/>
          <circle cx="154" cy="210" r="13" fill="#C68642" stroke="#9A5A28" strokeWidth="2"/>
          <ellipse cx="16"  cy="204" rx="5.5" ry="4" fill="#B87332"/>
          <ellipse cx="36"  cy="204" rx="5.5" ry="4" fill="#B87332"/>
          <ellipse cx="144" cy="204" rx="5.5" ry="4" fill="#B87332"/>
          <ellipse cx="164" cy="204" rx="5.5" ry="4" fill="#B87332"/>

        </svg>
      </motion.div>

      {/* Label */}
      {label !== null && (
        <div style={{
          fontSize:      13,
          fontWeight:    800,
          color:         '#D4A853',
          fontFamily:    "'DM Sans', system-ui, sans-serif",
          letterSpacing: '.04em',
          textShadow:    '0 1px 8px rgba(212,168,83,0.3)',
        }}>
          {label || 'Alisha'}
        </div>
      )}
    </div>
  )
}
