import { useEffect, useState } from 'react'
import { useTheme } from '../styles/theme.jsx'
import { radius, motion, type, weight, space } from './tokens'

// ─── ProgressRail ─────────────────────────────────────────────────────────────
/**
 * Barre de progression animée.
 *
 * @prop {number}  value       — valeur 0–100
 * @prop {number}  height      — épaisseur en px (défaut: 6)
 * @prop {string}  color       — couleur CSS de la barre (défaut: C.brown)
 * @prop {string}  bgColor     — couleur CSS du fond (défaut: C.border)
 * @prop {boolean} showLabel   — affiche "XX%" à droite
 * @prop {boolean} animate     — entrée animée depuis 0 (défaut: true)
 * @prop {'pill'|'square'} cap — forme des extrémités (défaut: pill)
 */
export function ProgressRail({
  value     = 0,
  height    = 6,
  color,
  bgColor,
  showLabel = false,
  animate   = true,
  cap       = 'pill',
  style: extraStyle,
  'aria-label': ariaLabel,
}) {
  const { C } = useTheme()
  const [displayed, setDisplayed] = useState(animate ? 0 : value)

  useEffect(() => {
    if (!animate) { setDisplayed(value); return }
    const id = requestAnimationFrame(() => setDisplayed(value))
    return () => cancelAnimationFrame(id)
  }, [value, animate])

  const pct    = Math.min(100, Math.max(0, displayed))
  const col    = color   ?? C.brown
  const bgCol  = bgColor ?? C.border
  const r      = cap === 'pill' ? height : 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space[2], ...extraStyle }}>
      <div
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel}
        style={{
          flex:         1,
          height:        height,
          background:    bgCol,
          borderRadius:  r,
          overflow:      'hidden',
          position:      'relative',
        }}
      >
        <div style={{
          position:     'absolute',
          inset:        '0 auto 0 0',
          width:        `${pct}%`,
          background:    col,
          borderRadius:  r,
          transition:   `width ${motion.slow_out}`,
        }} />
      </div>

      {showLabel && (
        <span style={{
          fontSize:   type.xs,
          fontWeight: weight.bold,
          color:       col,
          flexShrink:  0,
          minWidth:    30,
          textAlign:  'right',
        }}>
          {Math.round(value)}%
        </span>
      )}
    </div>
  )
}

// ─── ProgressRailLabeled — avec labels début/fin ───────────────────────────────
/**
 * Barre de progression avec label à gauche et pourcentage à droite.
 *
 * @prop {string} label    — texte à gauche
 * @prop {number} value    — 0–100
 * @prop {string} color    — couleur de la barre
 */
export function ProgressRailLabeled({ label, value, color, sublabel, style: extraStyle }) {
  const { C } = useTheme()
  const col = color ?? C.brown

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[1], ...extraStyle }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: type.sm, fontWeight: weight.semibold, color: C.textSec }}>
          {label}
        </span>
        <span style={{ fontSize: type.xs, fontWeight: weight.bold, color: col }}>
          {Math.round(value)}%
        </span>
      </div>

      <ProgressRail value={value} color={col} height={5} />

      {sublabel && (
        <span style={{ fontSize: type['2xs'], color: C.textMuted }}>
          {sublabel}
        </span>
      )}
    </div>
  )
}

// ─── SessionRail — barre de progression top de session ────────────────────────
/**
 * Barre fine sticky en haut de la page Session.
 * Affiche la progression exercice N / total + timer.
 *
 * @prop {number} current  — index exercice courant (0-based)
 * @prop {number} total    — nombre total d'exercices
 * @prop {string} timer    — string formaté "04:32" (optionnel)
 * @prop {string} color    — couleur de la barre (défaut: C.brown)
 */
export function SessionRail({ current, total, timer, color, style: extraStyle }) {
  const { C } = useTheme()
  const pct = total > 0 ? (current / total) * 100 : 0
  const col = color ?? C.brown

  return (
    <div style={{
      display:    'flex',
      alignItems: 'center',
      gap:         space[3],
      ...extraStyle,
    }}>
      {/* Barre */}
      <ProgressRail
        value={pct}
        color={col}
        height={4}
        animate={false}
        aria-label={`Exercice ${current} sur ${total}`}
        style={{ flex: 1 }}
      />

      {/* Compteur */}
      <span style={{
        fontSize:   type.xs,
        fontWeight: weight.bold,
        color:      C.textSec,
        flexShrink: 0,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {current}/{total}
      </span>

      {/* Timer */}
      {timer && (
        <span style={{
          fontSize:   type.xs,
          fontWeight: weight.bold,
          color:      C.textMuted,
          flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
          display:    'flex',
          alignItems: 'center',
          gap:         space[1],
        }}>
          <ClockIcon size={11} color={C.textMuted} />
          {timer}
        </span>
      )}
    </div>
  )
}

// ─── StepRail — indicateur d'étapes (onboarding, formulaire wizard) ───────────
/**
 * Indicateur d'étapes horizontal.
 *
 * @prop {number} total    — nombre d'étapes
 * @prop {number} current  — étape courante (1-based)
 * @prop {string} color    — couleur des étapes actives/complètes
 */
export function StepRail({ total, current, color, style: extraStyle }) {
  const { C } = useTheme()
  const col = color ?? C.brown

  return (
    <div style={{
      display:    'flex',
      alignItems: 'center',
      gap:         space[2],
      ...extraStyle,
    }}>
      {Array.from({ length: total }, (_, i) => {
        const step   = i + 1
        const done   = step < current
        const active = step === current

        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1, gap: space[2] }}>
            {/* Cercle numéroté */}
            <div style={{
              width:          22, height: 22,
              borderRadius:   '50%',
              flexShrink:     0,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              background:     done ? col : active ? col : C.border,
              border:         active ? `2px solid ${col}` : '2px solid transparent',
              transition:    `all ${motion.mid_out}`,
            }}>
              {done ? (
                <CheckIcon size={11} color="#fff" />
              ) : (
                <span style={{
                  fontSize:   9,
                  fontWeight: weight.black,
                  color:      active ? '#fff' : C.textMuted,
                  lineHeight: 1,
                }}>
                  {step}
                </span>
              )}
            </div>

            {/* Trait de connexion (sauf après la dernière étape) */}
            {i < total - 1 && (
              <div style={{
                flex:       1,
                height:     2,
                background: done ? col : C.border,
                borderRadius: radius.pill,
                transition: `background ${motion.mid_out}`,
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Mini icônes inline ────────────────────────────────────────────────────────
function ClockIcon({ size = 12, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <circle cx={12} cy={12} r={10} />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function CheckIcon({ size = 12, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
