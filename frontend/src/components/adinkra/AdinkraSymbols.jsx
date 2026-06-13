/**
 * AdinkraSymbols.jsx — 10 symboles Adinkra authentiques en SVG vectoriel
 * ========================================================================
 *
 * Chaque symbole est dessiné géométriquement (pas d'emoji, pas de bitmap),
 * ce qui permet :
 *   - une identité visuelle culturellement située (vs emojis génériques)
 *   - l'animation de tracé progressif (le symbole se "dessine")
 *   - une mise à l'échelle parfaite (vectoriel)
 *   - le theming dynamique (couleur via prop)
 *
 * Les symboles correspondent aux 10 badges définis côté backend
 * (app/routers/gamification.py — BADGES_DEF).
 *
 * Référence culturelle : symboles Adinkra du peuple Akan (Ghana/Côte d'Ivoire).
 * Chaque symbole porte une signification proverbiale.
 */
import { useId } from 'react'

/**
 * Composant générique qui enveloppe un symbole Adinkra.
 * Gère la couleur, la taille, et l'animation de tracé optionnelle.
 */
function AdinkraWrapper({ children, size = 64, color = '#6B3A2A', animate = false, label }) {
  const animClass = animate ? 'adinkra-draw' : ''
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      stroke={color}
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={label || 'Symbole Adinkra'}
      className={animClass}
      style={{ display: 'block' }}
    >
      {children}
    </svg>
  )
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  Les 10 symboles                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝

/** Nyame Nti — "Par la grâce de Dieu". Motif étoilé rayonnant. */
export function NyameNti(props) {
  return (
    <AdinkraWrapper {...props} label="Nyame Nti">
      <circle cx="50" cy="50" r="10" fill={props.color || '#6B3A2A'} stroke="none" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180
        const x1 = 50 + Math.cos(rad) * 16
        const y1 = 50 + Math.sin(rad) * 16
        const x2 = 50 + Math.cos(rad) * 38
        const y2 = 50 + Math.sin(rad) * 38
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} />
      })}
      {[22, 67, 112, 157, 202, 247, 292, 337].map((deg) => {
        const rad = (deg * Math.PI) / 180
        const x = 50 + Math.cos(rad) * 30
        const y = 50 + Math.sin(rad) * 30
        return <circle key={deg} cx={x} cy={y} r="3" fill={props.color || '#6B3A2A'} stroke="none" />
      })}
    </AdinkraWrapper>
  )
}

/** Sankofa — "Reviens chercher". Oiseau stylisé tête tournée vers l'arrière. */
export function Sankofa(props) {
  return (
    <AdinkraWrapper {...props} label="Sankofa">
      {/* Corps en spirale-cœur de l'oiseau */}
      <path d="M50 78 C30 78 22 60 30 45 C36 33 52 33 56 45 C58 52 52 58 46 56 C42 55 42 49 46 48" />
      {/* Tête tournée vers l'arrière + bec cherchant l'œuf */}
      <path d="M50 78 C70 78 78 60 70 45 C64 33 50 35 48 44" />
      <circle cx="50" cy="68" r="4" fill={props.color || '#6B3A2A'} stroke="none" />
    </AdinkraWrapper>
  )
}

/** Gye Nyame — "Sauf Dieu". Double spirale, le symbole le plus connu. */
export function GyeNyame(props) {
  return (
    <AdinkraWrapper {...props} label="Gye Nyame">
      <path d="M50 22 C50 35 50 42 50 50 C50 62 40 68 32 62 C26 57 28 47 38 47 C44 47 46 53 43 56" />
      <path d="M50 78 C50 65 50 58 50 50 C50 38 60 32 68 38 C74 43 72 53 62 53 C56 53 54 47 57 44" />
    </AdinkraWrapper>
  )
}

/** Akoma — "Le cœur". Patience et tolérance. */
export function Akoma(props) {
  return (
    <AdinkraWrapper {...props} label="Akoma">
      <path d="M50 76 C30 60 24 44 32 34 C38 26 48 28 50 38 C52 28 62 26 68 34 C76 44 70 60 50 76 Z" />
      <circle cx="50" cy="48" r="4" fill={props.color || '#6B3A2A'} stroke="none" />
    </AdinkraWrapper>
  )
}

/** Dwennimmen — "Cornes de bélier". Force dans l'humilité. */
export function Dwennimmen(props) {
  return (
    <AdinkraWrapper {...props} label="Dwennimmen">
      <path d="M30 30 C18 38 18 54 30 56 C40 57 40 46 33 45" />
      <path d="M70 30 C82 38 82 54 70 56 C60 57 60 46 67 45" />
      <path d="M30 30 C40 24 46 30 50 38 C54 30 60 24 70 30" />
      <path d="M50 38 L50 70" />
      <path d="M40 62 L60 62" />
    </AdinkraWrapper>
  )
}

/** Aya — "La fougère". Endurance et ingéniosité. */
export function Aya(props) {
  return (
    <AdinkraWrapper {...props} label="Aya">
      <line x1="50" y1="20" x2="50" y2="80" />
      {[28, 38, 48, 58, 68].map((y, i) => {
        const len = 18 - i * 1.5
        return (
          <g key={y}>
            <line x1="50" y1={y} x2={50 - len} y2={y - 6} />
            <line x1="50" y1={y} x2={50 + len} y2={y - 6} />
          </g>
        )
      })}
    </AdinkraWrapper>
  )
}

/** Bese Saka — "Sac de noix de cola". Abondance et richesse. */
export function BeseSaka(props) {
  return (
    <AdinkraWrapper {...props} label="Bese Saka">
      <path d="M50 24 C36 24 28 36 30 50 C32 64 40 76 50 76 C60 76 68 64 70 50 C72 36 64 24 50 24 Z" />
      <line x1="50" y1="24" x2="50" y2="76" />
      <line x1="32" y1="42" x2="68" y2="42" />
      <line x1="30" y1="58" x2="70" y2="58" />
    </AdinkraWrapper>
  )
}

/** Kramo Bone — distinction entre le bien et le mal. Vigilance. */
export function KramoBone(props) {
  return (
    <AdinkraWrapper {...props} label="Kramo Bone">
      <circle cx="35" cy="50" r="16" />
      <circle cx="65" cy="50" r="16" />
      <circle cx="35" cy="50" r="5" fill={props.color || '#6B3A2A'} stroke="none" />
      <circle cx="65" cy="50" r="5" fill={props.color || '#6B3A2A'} stroke="none" />
    </AdinkraWrapper>
  )
}

/** Sunsum — "L'âme". L'esprit et l'éveil spirituel. */
export function Sunsum(props) {
  return (
    <AdinkraWrapper {...props} label="Sunsum">
      <path d="M50 22 L58 42 L78 42 L62 55 L68 76 L50 63 L32 76 L38 55 L22 42 L42 42 Z" />
      <circle cx="50" cy="50" r="6" />
    </AdinkraWrapper>
  )
}

/** Adinkrahene — "Chef des Adinkra". Cercles concentriques, le leadership. */
export function Adinkrahene(props) {
  return (
    <AdinkraWrapper {...props} label="Adinkrahene">
      <circle cx="50" cy="50" r="30" />
      <circle cx="50" cy="50" r="20" />
      <circle cx="50" cy="50" r="10" />
      <circle cx="50" cy="50" r="2.5" fill={props.color || '#6B3A2A'} stroke="none" />
    </AdinkraWrapper>
  )
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  Mapping id → composant (pour usage dynamique)                    ║
// ╚══════════════════════════════════════════════════════════════════╝

export const ADINKRA_COMPONENTS = {
  nyame_nti:   NyameNti,
  sankofa:     Sankofa,
  gye_nyame:   GyeNyame,
  akoma:       Akoma,
  dwennimmen:  Dwennimmen,
  aya:         Aya,
  bese_saka:   BeseSaka,
  kramo_bone:  KramoBone,
  sunsum:      Sunsum,
  adinkrahene: Adinkrahene,
}

/**
 * Composant dynamique : rend le bon symbole Adinkra à partir de son id.
 * Usage : <AdinkraSymbol id="sankofa" size={48} color="#C4865A" animate />
 */
export function AdinkraSymbol({ id, ...props }) {
  const Component = ADINKRA_COMPONENTS[id]
  if (!Component) return null
  return <Component {...props} />
}

/**
 * Styles CSS d'animation de tracé. À injecter une fois (ex: dans index.css
 * ou via un <style> global). Inclus ici pour référence.
 */
export const ADINKRA_DRAW_CSS = `
.adinkra-draw path,
.adinkra-draw line,
.adinkra-draw circle {
  stroke-dasharray: 300;
  stroke-dashoffset: 300;
  animation: adinkra-trace 1.2s ease forwards;
}
@keyframes adinkra-trace {
  to { stroke-dashoffset: 0; }
}
`

export default AdinkraSymbol
