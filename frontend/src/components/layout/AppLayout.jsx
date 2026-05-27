import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import NavRail   from './NavRail'
import MobileNav from './MobileNav'
import ParcoursPage from './ParcoursPage'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { useTheme } from '../../styles/theme.jsx'

export default function AppLayout({ children }) {
  const [activeView, setActiveView] = useState('main') // 'main' | 'parcours'
  const { mobile } = useBreakpoint()
  const { C } = useTheme()
  const location = useLocation()

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
      <main
        key={location.pathname}
        style={{
          flex:          1,
          overflowX:     'hidden',
          minWidth:       0,
          paddingBottom:  mobile ? 68 : 0,
          animation:     'pageFadeIn .22s ease',
        }}
      >
        <style>{`@keyframes pageFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
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