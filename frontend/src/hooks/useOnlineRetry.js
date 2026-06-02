import { useState, useEffect } from 'react'

/**
 * Retourne un compteur qui s'incrémente chaque fois que la connexion
 * est rétablie après une coupure.
 *
 * Usage : inclure `retryKey` dans les dépendances d'un useEffect pour
 * relancer automatiquement le fetch de données après reconnexion.
 *
 *   const retryKey = useOnlineRetry()
 *   useEffect(() => { api.get(...) }, [uaId, retryKey])
 */
export function useOnlineRetry() {
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let wasOffline = false

    const goOffline = () => { wasOffline = true }
    const goOnline  = () => {
      if (wasOffline) {
        wasOffline = false
        setRetryKey(k => k + 1)
      }
    }

    window.addEventListener('offline', goOffline)
    window.addEventListener('online',  goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online',  goOnline)
    }
  }, [])

  return retryKey
}
