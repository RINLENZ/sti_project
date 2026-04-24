import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import ParcoursPage from './ParcoursPage'

function useIsMobile() {
  const [mobile, setMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  )
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return mobile
}

export default function AppLayout({ children }) {
  const [collapsed,  setCollapsed]  = useState(false)
  const [activeView, setActiveView] = useState('main') // 'main' | 'parcours'
  const mobile = useIsMobile()

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      flexDirection: mobile ? 'column' : 'row',
      background: '#FAF7F4',
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