/**
 * Cache en mémoire pour les appels API fréquents.
 * Survit aux navigations React Router (unmount/remount),
 * se vide uniquement sur rechargement complet de la page.
 */

const store = {}
const DEFAULT_TTL = 3 * 60 * 1000  // 3 minutes

export function getCache(key) {
  const entry = store[key]
  if (!entry) return null
  if (Date.now() - entry.ts > entry.ttl) {
    delete store[key]
    return null
  }
  return entry.data
}

export function setCache(key, data, ttl = DEFAULT_TTL) {
  store[key] = { data, ts: Date.now(), ttl }
}

export function clearCache(key) {
  if (key) delete store[key]
  else Object.keys(store).forEach(k => delete store[k])
}
