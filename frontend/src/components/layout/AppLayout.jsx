import { useState } from 'react'
import Sidebar from './Sidebar'
import ParcoursPage from './ParcoursPage'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { useTheme } from '../../styles/theme.jsx'

export default function AppLayout({ children }) {
  const [collapsed,  setCollapsed]  = useState(false)
  const [activeView, setActiveView] = useState('main') // 'main' | 'parcours'
  const { mobile } = useBreakpoint()
  const { C } = useTheme()

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      flexDirection: mobile ? 'column' : 'row',
      background: C.bg,
    }}>

      {/* ── Sidebar desktop uniquement ── */}
      {!mobile && (
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          activeView={activeView}
          onViewChange={setActiveView}
        />
      )}

      {/* ── Zone principale ── */}
      <main style={{
        flex: 1,
        overflowX: 'hidden',
        minWidth: 0,
        paddingBottom: mobile ? 72 : 0,
      }}>
        {activeView === 'parcours'
          ? <ParcoursPage onBack={() => setActiveView('main')} />
          : children
        }
      </main>

      {/* ── Bottom nav mobile uniquement ── */}
      {mobile && (
        <Sidebar
          mobile
          activeView={activeView}
          onViewChange={setActiveView}
        />
      )}
    </div>
  )
}