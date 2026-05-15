import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux'
import api from '../services/api'
import { useWebSocket } from '../hooks/useWebSocket'

const Ctx = createContext(null)

export function NotificationsProvider({ children }) {
  const { user } = useSelector(s => s.auth)
  const [notifications, setNotifications] = useState([])
  const [nbNonLues,     setNbNonLues]     = useState(0)

  // Chargement initial + polling de secours (120s)
  const load = useCallback(() => {
    if (!user) return
    api.get('/api/notifications?limit=20').then(({ data }) => {
      setNbNonLues(data.nb_non_lues)
      setNotifications(data.notifications)
    }).catch(() => {})
  }, [user?.id])

  useEffect(() => {
    load()
    const id = setInterval(load, 120000)
    return () => clearInterval(id)
  }, [load])

  // Notifications temps réel via WebSocket (une seule connexion pour toute l'app)
  const handleWsMessage = useCallback((data) => {
    if (data.type !== 'notification') return
    const newNotif = {
      id:         data.id,
      type:       data.notif_type,
      titre:      data.titre,
      message:    data.message,
      meta:       data.meta || {},
      lu:         false,
      created_at: data.created_at,
    }
    setNotifications(prev => [newNotif, ...prev.slice(0, 19)])
    setNbNonLues(prev => prev + 1)
  }, [])

  useWebSocket('/ws/notifications', {
    onMessage: handleWsMessage,
    enabled:   !!user,
  })

  const markRead = useCallback((notifId) => {
    api.put(`/api/notifications/${notifId}/lire`).then(() => {
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, lu: true } : n))
      setNbNonLues(prev => Math.max(0, prev - 1))
    }).catch(() => {})
  }, [])

  const markAllRead = useCallback(() => {
    api.put('/api/notifications/tout-lire').then(() => {
      setNotifications(prev => prev.map(n => ({ ...n, lu: true })))
      setNbNonLues(0)
    }).catch(() => {})
  }, [])

  return (
    <Ctx.Provider value={{ notifications, nbNonLues, markRead, markAllRead }}>
      {children}
    </Ctx.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider')
  return ctx
}
