/**
 * BogolanToaster — react-hot-toast habillé à l'identité Bogolan (clair + sombre).
 * Doit être monté à l'intérieur du ThemeProvider (utilise useTheme).
 */
import { Toaster } from 'react-hot-toast'
import { useTheme } from '../styles/theme.jsx'

export default function BogolanToaster() {
  const { C } = useTheme()
  const RED = '#C0563A'
  return (
    <Toaster
      position="top-right"
      gutter={10}
      toastOptions={{
        duration: 3000,
        style: {
          background:   C.bogolanSurface,
          color:        C.bogolanText,
          border:       `1px solid ${C.bogolanBorder}`,
          borderRadius: '14px',
          boxShadow:    `0 8px 28px ${C.bogolanTerre}22`,
          fontSize:     '13px',
          fontWeight:   600,
          padding:      '11px 14px',
          maxWidth:     '380px',
          fontFamily:   "'DM Sans', system-ui, sans-serif",
        },
        success: {
          iconTheme: { primary: C.bogolanVert, secondary: '#fff' },
          style: { borderLeft: `4px solid ${C.bogolanVert}` },
        },
        error: {
          iconTheme: { primary: RED, secondary: '#fff' },
          style: { borderLeft: `4px solid ${RED}` },
        },
      }}
    />
  )
}
