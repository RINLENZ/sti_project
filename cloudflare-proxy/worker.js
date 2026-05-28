/**
 * Proxy Cloudflare Worker — STI Backend
 *
 * Rôle : relayer tout le trafic HTTP et WebSocket vers Render,
 * en contournant le blocage Orange Cameroun.
 *
 * Déployer sur : https://workers.cloudflare.com (plan gratuit)
 */

const BACKEND = 'sti-backend-a2d1.onrender.com'

// Origines autorisées (Netlify prod + localhost dev)
const ALLOWED_ORIGINS = new Set([
  'https://sti-projects.netlify.app',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
])

function getCorsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://sti-projects.netlify.app'
  return {
    'Access-Control-Allow-Origin':      allowed,
    'Access-Control-Allow-Methods':     'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':     'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age':           '86400',
  }
}

function corsResponse(body, init = {}, origin = '') {
  const headers = { ...init.headers, ...getCorsHeaders(origin) }
  return new Response(body, { ...init, headers })
}

function withCors(response, origin) {
  const cloned = new Response(response.body, {
    status:     response.status,
    statusText: response.statusText,
    headers:    response.headers,
  })
  for (const [k, v] of Object.entries(getCorsHeaders(origin))) cloned.headers.set(k, v)
  return cloned
}

export default {
  async fetch(request) {
    const url    = new URL(request.url)
    const origin = request.headers.get('Origin') || ''

    // ── Preflight OPTIONS ────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return corsResponse(null, { status: 204 }, origin)
    }

    url.hostname = BACKEND

    // ── WebSocket (notifications, chat) ─────────────────────────
    if (request.headers.get('Upgrade') === 'websocket') {
      url.protocol = 'wss:'

      // Créer la paire WebSocket client ↔ worker en premier
      const pair     = new WebSocketPair()
      const clientWs = pair[0]
      const serverWs = pair[1]
      serverWs.accept()

      // Connexion asynchrone vers le backend Render
      ;(async () => {
        let backendWs
        try {
          const backendResp = await fetch(url.toString(), {
            headers: request.headers,
          })
          if (backendResp.status !== 101) {
            serverWs.close(1014, 'Backend WebSocket unavailable')
            return
          }
          backendWs = backendResp.webSocket
          backendWs.accept()
        } catch (e) {
          serverWs.close(1011, `Proxy error: ${e.message}`)
          return
        }

        // Bridge bidirectionnel client ↔ backend
        serverWs.addEventListener('message', ({ data }) => {
          try { backendWs.send(data) } catch {}
        })
        serverWs.addEventListener('close', ({ code, reason }) => {
          try { backendWs.close(code, reason) } catch {}
        })

        backendWs.addEventListener('message', ({ data }) => {
          try { serverWs.send(data) } catch {}
        })
        backendWs.addEventListener('close', ({ code, reason }) => {
          try { serverWs.close(code, reason) } catch {}
        })
      })()

      return new Response(null, { status: 101, webSocket: clientWs })
    }

    // ── Requêtes HTTP normales ───────────────────────────────────
    url.protocol = 'https:'

    const proxied = new Request(url.toString(), {
      method:   request.method,
      headers:  request.headers,
      body:     ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'follow',
    })

    let response
    try {
      response = await fetch(proxied)
    } catch (e) {
      return corsResponse(
        JSON.stringify({ detail: `Proxy fetch error: ${e.message}` }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
        origin,
      )
    }

    return withCors(response, origin)
  },
}
