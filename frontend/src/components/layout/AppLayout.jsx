import { useState } from 'react'
import NavRail   from './NavRail'
import MobileNav from './MobileNav'
import ParcoursPage from './ParcoursPage'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { useTheme } from '../../styles/theme.jsx'

export default function AppLayout({ children }) {
  const [activeView, setActiveView] = useState('main') // 'main' | 'parcours'
  const { mobile } = useBreakpoint()
  const { C } = useTheme()

  return (
    <div style={{
      display:       'flex',
      minHeight:     '100vh',
      flexDirection: 'row',
      background:     C.bg,
    }}>

      {/* ── NavRail desktop ── */}
      {!mobile && (
        <NavRail
          activeView={activeView}
          onViewChange={setActiveView}
        />
      )}

      {/* ── Zone principale ── */}
      <main style={{
        flex:          1,
        overflowX:     'hidden',
        minWidth:       0,
        // Espace pour la barre mobile en bas
        paddingBottom:  mobile ? 68 : 0,
      }}>
        {activeView === 'parcours'
          ? <ParcoursPage onBack={() => setActiveView('main')} />
          : children
        }
      </main>

      {/* ── MobileNav bottom ── */}
      {mobile && (
        <MobileNav
          activeView={activeView}
          onViewChange={setActiveView}
        />
      )}
    </div>
  )
}