/**
 * Cache IndexedDB pour les audios Edge TTS générés.
 * Évite de rappeler le backend pour les mêmes textes.
 * Capacité : 200 entrées, éviction LRU sur la plus ancienne.
 */

const DB_NAME   = 'alisha_tts_cache'
const STORE     = 'audio'
const VERSION   = 1
const MAX_ITEMS = 200

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'cacheKey' })
        store.createIndex('ts', 'ts', { unique: false })
      }
    }
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror   = ()  => reject(req.error)
  })
}

// Hachage FNV-1a 32-bit — rapide, sans dépendance
function hashStr(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h.toString(16)
}

function buildKey(voice, text) {
  return `${voice}_${hashStr(text)}`
}

// Éviction : supprime la plus ancienne entrée si on dépasse MAX_ITEMS
async function evictIfNeeded(db) {
  return new Promise((resolve) => {
    const tx    = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const count = store.count()
    count.onsuccess = () => {
      if (count.result < MAX_ITEMS) { resolve(); return }
      const cursor = store.index('ts').openCursor()
      cursor.onsuccess = (e) => {
        const c = e.target.result
        if (c) { c.delete(); resolve() }
        else resolve()
      }
      cursor.onerror = () => resolve()
    }
    count.onerror = () => resolve()
  })
}

/**
 * Récupère un ArrayBuffer audio depuis le cache.
 * Retourne null si absent ou si IndexedDB est indisponible.
 */
export async function getAudio(voice, text) {
  if (!window.indexedDB) return null
  try {
    const db  = await openDB()
    const key = buildKey(voice, text)
    return new Promise((resolve) => {
      const tx  = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(key)
      req.onsuccess = () => resolve(req.result?.data ?? null)
      req.onerror   = () => resolve(null)
    })
  } catch {
    return null
  }
}

/**
 * Stocke un ArrayBuffer audio dans le cache.
 * Fire-and-forget : les erreurs sont silencieuses.
 */
export async function setAudio(voice, text, arrayBuffer) {
  if (!window.indexedDB) return
  try {
    const db  = await openDB()
    await evictIfNeeded(db)
    const key = buildKey(voice, text)
    return new Promise((resolve) => {
      const tx    = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      store.put({ cacheKey: key, data: arrayBuffer, ts: Date.now() })
      tx.oncomplete = resolve
      tx.onerror    = resolve
    })
  } catch {
    // Cache optionnel — on absorbe l'erreur silencieusement
  }
}

/**
 * Vide entièrement le cache audio (utile si changement de voix par l'utilisateur).
 */
export async function clearAudioCache() {
  if (!window.indexedDB) return
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      tx.oncomplete = resolve
      tx.onerror    = resolve
    })
  } catch {}
}
