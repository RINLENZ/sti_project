/**
 * Proxy Cloudflare Worker — STI Backend
 *
 * Rôle : relayer tout le trafic HTTP et WebSocket vers Render,
 * en contournant le blocage Orange Cameroun.
 *
 * Déployer sur : https://workers.cloudflare.com (plan gratuit)
 */

const BACKEND        = 'sti-backend-a2d1.onrender.com'
const ALLOWED_ORIGIN = 'https://sti-projects.netlify.app'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':      ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods':     'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':     'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age':           '86400',
}

function corsResponse(body, init = {}) {
  const res = new Response(body, init)
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v)
  return res
}

function withCors(response) {
  const cloned = new Response(response.body, {
    status:     response.status,
    statusText: response.statusText,
    headers:    response.headers,
  })
  for (const [k, v] of Object.entries(CORS_HEADERS)) cloned.headers.set(k, v)
  return cloned
}

export default {
  async fetch(request) {
    const url = new URL(request.url)

    // ── Preflight OPTIONS ────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return corsResponse(null, { status: 204 })
    }

    url.hostname = BACKEND

    // ── WebSocket (notifications, chat) ─────────────────────────
    if (request.headers.get('Upgrade') === 'websocket') {
      url.protocol = 'wss:'

      let backendResp
      try {
        backendResp = await fetch(url.toString(), {
          headers: {
            'Upgrade':               'websocket',
            'Connection':            'Upgrade',
            'Sec-WebSocket-Version': request.headers.get('Sec-WebSocket-Version') || '13',
            'Sec-WebSocket-Key':     request.headers.get('Sec-WebSocket-Key') || '',
          },
        })
      } catch (e) {
        return corsResponse(`WebSocket fetch error: ${e.message}`, { status: 502 })
      }

      if (backendResp.status !== 101) {
        return corsResponse('WebSocket backend unavailable', { status: 502 })
      }

      const backendWs = backendResp.webSocket
      backendWs.accept()

      const [clientWs, serverWs] = Object.values(new WebSocketPair())
      serverWs.accept()

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
      return corsResponse(JSON.stringify({ detail: `Proxy fetch error: ${e.message}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return withCors(response)
  },
}
