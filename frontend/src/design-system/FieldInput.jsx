import { useState, useId } from 'react'
import { useTheme } from '../styles/theme.jsx'
import { radius, space, type, weight, motion } from './tokens'

// ─── FieldInput ───────────────────────────────────────────────────────────────
/**
 * Champ de formulaire avec gestion d'état complète.
 *
 * @prop {string}  label         — label affiché au-dessus (toujours visible)
 * @prop {string}  error         — message d'erreur inline (rouge sous le champ)
 * @prop {string}  hint          — message d'aide neutre sous le champ
 * @prop {React.ReactNode} iconLeft  — icône à gauche dans le champ
 * @prop {React.ReactNode} iconRight — icône à droite (ex: toggle password)
 * @prop {'sm'|'md'|'lg'} size
 * @prop {boolean} required
 * @prop {boolean} disabled
 * @prop {string}  type          — 'text' | 'email' | 'password' | 'number' | etc.
 */
export function FieldInput({
  label,
  error,
  hint,
  iconLeft,
  iconRight,
  size     = 'md',
  required = false,
  disabled = false,
  style: extraStyle,
  inputStyle,
  id: propId,
  ...inputProps
}) {
  const { C } = useTheme()
  const [focused, setFocused] = useState(false)
  const autoId = useId()
  const id = propId || autoId

  // Hauteurs + font par taille
  const SIZE = {
    sm: { h: 36, fontSize: type.sm,   px: space[3] },
    md: { h: 42, fontSize: type.base, px: space[4] },
    lg: { h: 50, fontSize: type.md,   px: space[4] },
  }
  const s = SIZE[size] || SIZE.md

  // Couleurs de la bordure selon l'état
  const borderColor = error
    ? C.red
    : focused
    ? C.brown
    : C.border

  const borderWidth = focused || error ? 2 : 1.5

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[1], ...extraStyle }}>

      {/* Label */}
      {label && (
        <label
          htmlFor={id}
          style={{
            fontSize:   type.sm,
            fontWeight: weight.semibold,
            color:      error ? C.red : focused ? C.brown : C.textSec,
            transition: `color ${motion.fast_out}`,
            userSelect: 'none',
          }}
        >
          {label}
          {required && (
            <span aria-hidden="true" style={{ color: C.red, marginLeft: 3 }}>*</span>
          )}
        </label>
      )}

      {/* Wrapper input */}
      <div style={{
        position:     'relative',
        display:      'flex',
        alignItems:   'center',
        height:        s.h,
        borderRadius:  radius.md,
        border:       `${borderWidth}px solid ${borderColor}`,
        background:    disabled ? C.surfaceAlt : C.surface,
        transition:   [
          `border-color ${motion.fast_out}`,
          `border-width ${motion.fast_out}`,
          `box-shadow ${motion.fast_out}`,
        ].join(', '),
        boxShadow:     focused && !error
          ? `0 0 0 3px ${C.brown}18`
          : error && focused
          ? `0 0 0 3px ${C.red}18`
          : 'none',
      }}>

        {/* Icône gauche */}
        {iconLeft && (
          <span style={{
            position:       'absolute',
            left:            s.px - 4,
            display:        'flex',
            alignItems:     'center',
            color:           error ? C.red : focused ? C.brown : C.textMuted,
            pointerEvents:  'none',
            transition:     `color ${motion.fast_out}`,
            flexShrink:      0,
          }} aria-hidden="true">
            {iconLeft}
          </span>
        )}

        {/* Input natif */}
        <input
          id={id}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex:          1,
            height:        '100%',
            border:        'none',
            outline:       'none',
            background:    'transparent',
            padding:       `0 ${iconRight ? s.px + 24 : s.px}px 0 ${iconLeft ? s.px + 22 : s.px}px`,
            fontSize:       s.fontSize,
            fontWeight:     weight.medium,
            fontFamily:     'inherit',
            color:          disabled ? C.textMuted : C.text,
            cursor:         disabled ? 'not-allowed' : 'text',
            ...inputStyle,
          }}
          {...inputProps}
        />

        {/* Icône droite */}
        {iconRight && (
          <span style={{
            position:      'absolute',
            right:          s.px - 4,
            display:       'flex',
            alignItems:    'center',
            color:          C.textMuted,
            flexShrink:     0,
          }}>
            {iconRight}
          </span>
        )}
      </div>

      {/* Message d'erreur inline */}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          style={{
            fontSize:   type.xs,
            fontWeight: weight.semibold,
            color:      C.red,
            display:    'flex',
            alignItems: 'center',
            gap:        space[1],
            animation:  'slideDown 0.18s ease',
            margin:      0,
          }}
        >
          <ErrorIcon />
          {error}
        </p>
      )}

      {/* Hint neutre (masqué si erreur) */}
      {hint && !error && (
        <p
          id={`${id}-hint`}
          style={{
            fontSize:   type.xs,
            fontWeight: weight.medium,
            color:      C.textMuted,
            margin:      0,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  )
}

// ─── PasswordInput — champ mot de passe avec toggle ───────────────────────────
export function PasswordInput({ ...props }) {
  const [visible, setVisible] = useState(false)
  const { C } = useTheme()

  return (
    <FieldInput
      {...props}
      type={visible ? 'text' : 'password'}
      iconRight={
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          style={{
            background:  'none',
            border:      'none',
            cursor:      'pointer',
            padding:      4,
            color:        C.textMuted,
            display:     'flex',
            alignItems:  'center',
            borderRadius: radius.sm,
          }}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      }
    />
  )
}

// ─── Icônes inline légères (pas de dépendance lucide-react) ───────────────────
function ErrorIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx={6} cy={6} r={5.5} stroke="currentColor" strokeWidth={1.5} />
      <path d="M6 3.5v3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={6} cy={8.5} r={0.75} fill="currentColor" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx={12} cy={12} r={3} />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1={1} y1={1} x2={23} y2={23} />
    </svg>
  )
}

// ─── Textarea ─────────────────────────────────────────────────────────────────
/**
 * Version textarea de FieldInput, même API label/error/hint.
 */
export function FieldTextarea({
  label,
  error,
  hint,
  rows = 4,
  required = false,
  disabled = false,
  style: extraStyle,
  id: propId,
  ...textareaProps
}) {
  const { C } = useTheme()
  const [focused, setFocused] = useState(false)
  const autoId = useId()
  const id = propId || autoId

  const borderColor = error ? C.red : focused ? C.brown : C.border
  const borderWidth = focused || error ? 2 : 1.5

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[1], ...extraStyle }}>
      {label && (
        <label htmlFor={id} style={{
          fontSize:   type.sm,
          fontWeight: weight.semibold,
          color:      error ? C.red : focused ? C.brown : C.textSec,
          transition: `color ${motion.fast_out}`,
          userSelect: 'none',
        }}>
          {label}
          {required && <span aria-hidden="true" style={{ color: C.red, marginLeft: 3 }}>*</span>}
        </label>
      )}

      <textarea
        id={id}
        rows={rows}
        disabled={disabled}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          border:       `${borderWidth}px solid ${borderColor}`,
          borderRadius:  radius.md,
          background:    disabled ? C.surfaceAlt : C.surface,
          padding:      `${space[3]}px ${space[4]}px`,
          fontSize:      type.base,
          fontWeight:    weight.medium,
          fontFamily:    'inherit',
          color:         disabled ? C.textMuted : C.text,
          resize:        'vertical',
          outline:       'none',
          lineHeight:    1.7,
          boxShadow:     focused && !error ? `0 0 0 3px ${C.brown}18` : 'none',
          transition:   `border-color ${motion.fast_out}, box-shadow ${motion.fast_out}`,
          cursor:        disabled ? 'not-allowed' : 'text',
        }}
        {...textareaProps}
      />

      {error && (
        <p id={`${id}-error`} role="alert" style={{ fontSize: type.xs, fontWeight: weight.semibold, color: C.red, display: 'flex', alignItems: 'center', gap: space[1], animation: 'slideDown 0.18s ease', margin: 0 }}>
          <ErrorIcon /> {error}
        </p>
      )}

      {hint && !error && (
        <p id={`${id}-hint`} style={{ fontSize: type.xs, fontWeight: weight.medium, color: C.textMuted, margin: 0 }}>
          {hint}
        </p>
      )}
    </div>
  )
}
