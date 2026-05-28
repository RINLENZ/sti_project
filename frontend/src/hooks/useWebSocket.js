import { useEffect, useRef, useCallback } from 'react'

const WS_BASE = (import.meta.env.VITE_API_URL || 'https://sti-backend-a2d1.onrender.com')
  .replace(/^http/, 'ws')

// Tentatives max avant abandon (évite le flood de logs si le backend est down)
// Backoff : 1s, 2s, 4s, 8s, 16s, 30s, 30s, 30s = ~2 min de tentatives
const MAX_RETRIES = 8

/**
 * Hook WebSocket avec reconnexion automatique (backoff exponentiel, max 8 tentatives).
 *
 * @param {string} path  - ex: '/ws/notifications' ou '/ws/chat/ROOM_ID'
 * @param {object} opts
 * @param {function} opts.onMessage   - appelé à chaque message JSON reçu
 * @param {boolean}  opts.enabled     - active/désactive la connexion (défaut: true)
 */
export function useWebSocket(path, { onMessage, enabled = true } = {}) {
  const wsRef      = useRef(null)
  const retryRef   = useRef(0)
  const timerRef   = useRef(null)
  const pingRef    = useRef(null)
  const onMsgRef   = useRef(onMessage)

  // Garde onMessage à jour sans recréer la connexion
  useEffect(() => { onMsgRef.current = onMessage }, [onMessage])

  const connect = useCallback(() => {
    if (!enabled) return
    const token = localStorage.getItem('sti_token')
    if (!token) return

    const url = `${WS_BASE}${path}?token=${token}`
    const ws  = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      retryRef.current = 0
      // Heartbeat ping toutes les 25s pour éviter timeout Render
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping')
      }, 25000)
    }

    ws.onmessage = (e) => {
      if (e.data === 'pong') return
      try {
        const data = JSON.parse(e.data)
        onMsgRef.current?.(data)
      } catch {
        // message texte simple
      }
    }

    ws.onclose = () => {
      clearInterval(pingRef.current)
      if (!enabled) return
      // Abandon après MAX_RETRIES pour éviter le flood console quand le backend est down
      if (retryRef.current >= MAX_RETRIES) {
        console.info(`[WS] ${path} : abandon après ${MAX_RETRIES} tentatives`)
        return
      }
      // Backoff exponentiel : 1s, 2s, 4s, 8s, 16s, 30s (plafonné)
      const delay = Math.min(1000 * 2 ** retryRef.current, 30000)
      retryRef.current++
      timerRef.current = setTimeout(connect, delay)
    }

    ws.onerror = () => ws.close()
  }, [path, enabled])

  useEffect(() => {
    if (!enabled) {
      wsRef.current?.close()
      return
    }
    connect()
    return () => {
      clearTimeout(timerRef.current)
      clearInterval(pingRef.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect, enabled])

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data))
    }
  }, [])

  return { send }
}
