import { createContext, useContext, useState, useEffect } from 'react'

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
  textMuted:    '#9C7E6A',

  red:          '#DC2626',
  redPale:      '#FEF2F2',
  orange:       '#F59E0B',
  blue:         '#2563EB',
  bluePale:     '#DBEAFE',

  gold:         '#D4A853',
  goldPale:     '#FBF3E0',

  border:       '#EDE3DA',

  sidebarBg:    '#1A0F0A',
  sidebarBorder:'rgba(255,255,255,0.08)',
}

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
  blue:         '#60A5FA',
  bluePale:     '#0F1F3D',

  gold:         '#F59E0B',
  goldPale:     '#2D1F08',

  border:       '#3D2815',

  sidebarBg:    '#110B04',
  sidebarBorder:'rgba(255,255,255,0.08)',
}

// Export statique pour le code module-level (toujours thème clair)
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
