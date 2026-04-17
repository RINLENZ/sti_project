import { useState } from 'react'
import Sidebar from './Sidebar'

export default function AppLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed}/>
      <main style={{ flex: 1, overflowX: 'hidden' }}>
        {children}
      </main>
    </div>
  )
}