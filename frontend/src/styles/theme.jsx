import { createContext, useContext, useState, useEffect } from 'react'

// ── Palette Bogolan (textiles ouest-africains) ───────────────────
// Identité visuelle du dashboard apprenant refondu (étape 5.2).
// Couleurs fixes (indépendantes du dark mode) — terre, ocre, indigo.
export const BOGOLAN = {
  bogolanBg:      '#FAF5EB',  // ivoire chaud — fond global
  bogolanSurface: '#FFFFFF',
  bogolanTerre:   '#8B4513',  // terre brûlée — accent primaire
  bogolanVert:    '#4A7C59',  // vert mousse — succès (non Duolingo)
  bogolanOcre:    '#C77B3C',  // ocre — attention
  bogolanIndigo:  '#1E4D6B',  // indigo — évolution
  bogolanText:    '#2C1810',  // brun très foncé
  bogolanTextSec: '#6B5744',
  bogolanBorder:  '#EDE3D2',  // bordures / séparateurs (discrets)
  bogolanLocked:  '#CBBFA8',  // symbole Adinkra verrouillé
}

// ── Palette Bogolan sombre (mêmes rôles, tons chauds nocturnes) ──
export const BOGOLAN_DARK = {
  bogolanBg:      '#1B130B',  // brun-noir chaud
  bogolanSurface: '#251A10',  // surface chaude sombre
  bogolanTerre:   '#D2925E',  // terracotta clair (accent lisible sur sombre)
  bogolanVert:    '#6FA67E',  // vert mousse clair
  bogolanOcre:    '#E0A05A',  // ocre clair
  bogolanIndigo:  '#5E96BC',  // indigo clair
  bogolanText:    '#F2E7D8',  // crème chaud
  bogolanTextSec: '#B59C82',
  bogolanBorder:  '#3A2B1C',
  bogolanLocked:  '#5A4A38',
}

// ── Palette claire (identique à theme.js) ─────────────────────────
export const C_LIGHT = {
  brown:        '#6B3A2A',
  brownDark:    '#3D1F13',
  brownMid:     '#A05C38',
  brownLight:   '#C4865A',
  brownPale:    '#F5EDE5',
  brownGhost:   '#F9F2EC',

  emerald:      '#0D9373',
  emeraldDark:  '#0A7A5E',
  emeraldPale:  '#E6F5F0',

  bg:           '#FAF7F4',
  surface:      '#FFFFFF',
  surfaceAlt:   '#FDF9F6',

  text:         '#1A1207',
  textSec:      '#6B5744',
  textMuted:    '#7A5E4E',

  red:          '#DC2626',
  redPale:      '#FEF2F2',
  orange:       '#F59E0B',
  accent:       '#F97316',   // orange vif — exercices, streak
  blue:         '#2563EB',
  bluePale:     '#DBEAFE',
  purple:       '#8B5CF6',   // violet — ressources, BKT delta
  purplePale:   '#EDE9FE',

  gold:         '#D4A853',
  goldPale:     '#FBF3E0',

  border:       '#EDE3DA',

  sidebarBg:    '#1A0F0A',
  sidebarBorder:'rgba(255,255,255,0.08)',

  ...BOGOLAN,
}

// ── Palette sombre (tons café / crème) ───────────────────────────
export const C_DARK = {
  brown:        '#C4865A',
  brownDark:    '#E8C09A',
  brownMid:     '#D4945A',
  brownLight:   '#E8B084',
  brownPale:    '#2E1A0E',
  brownGhost:   '#221408',

  emerald:      '#10B98A',
  emeraldDark:  '#0D9373',
  emeraldPale:  '#0D2E25',

  bg:           '#1A1007',
  surface:      '#231509',
  surfaceAlt:   '#2A1A0D',

  text:         '#F5E6D8',
  textSec:      '#C4A589',
  textMuted:    '#8A6D57',

  red:          '#F87171',
  redPale:      '#2D0C0C',
  orange:       '#FBBF24',
  accent:       '#FB923C',   // orange vif dark — exercices, streak
  blue:         '#60A5FA',
  bluePale:     '#0F1F3D',
  purple:       '#A78BFA',   // violet dark — ressources, BKT delta
  purplePale:   '#2D1B4B',

  gold:         '#F59E0B',
  goldPale:     '#2D1F08',

  border:       '#3D2815',

  sidebarBg:    '#110B04',
  sidebarBorder:'rgba(255,255,255,0.08)',

  ...BOGOLAN_DARK,
}

// Export statique pour les fichiers qui importent C directement
export const C = C_LIGHT

const ThemeCtx = createContext({ C: C_LIGHT, isDark: false, toggleTheme: () => {} })

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem('sensia_theme') === 'dark' } catch { return false }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    try { localStorage.setItem('sensia_theme', isDark ? 'dark' : 'light') } catch {}
  }, [isDark])

  return (
    <ThemeCtx.Provider value={{ C: isDark ? C_DARK : C_LIGHT, isDark, toggleTheme: () => setIsDark(d => !d) }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export function useTheme() { return useContext(ThemeCtx) }
