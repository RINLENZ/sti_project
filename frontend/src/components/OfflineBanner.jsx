import { useState, useEffect } from 'react'
import { WifiOff, Wifi } from 'lucide-react'

export default function OfflineBanner() {
  const [offline,  setOffline]  = useState(!navigator.onLine)
  const [showBack, setShowBack] = useState(false)
  const [visible,  setVisible]  = useState(false)

  useEffect(() => {
    const goOffline = () => { setOffline(true);  setShowBack(false); setVisible(true) }
    const goOnline  = () => {
      setOffline(false)
      setShowBack(true)
      setVisible(true)
      // Masquer la bannière "Connexion rétablie" après 3s
      setTimeout(() => setVisible(false), 3000)
    }

    window.addEventListener('offline', goOffline)
    window.addEventListener('online',  goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online',  goOnline)
    }
  }, [])

  if (!visible) return null

  const bg    = offline ? '#7F1D1D' : '#065F46'
  const icon  = offline ? <WifiOff size={14}/> : <Wifi size={14}/>
  const msg   = offline
    ? 'Hors-ligne — les données affichées peuvent ne pas être à jour'
    : 'Connexion rétablie'

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: bg, color: 'white',
      padding: '10px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      fontSize: 13, fontWeight: 600,
      animation: 'slideUpBanner .3s ease',
    }}>
      <style>{`
        @keyframes slideUpBanner {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
      `}</style>
      {icon}
      {msg}
    </div>
  )
}
