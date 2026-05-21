/**
 * Proxy Cloudflare Worker — STI Backend
 *
 * Rôle : relayer tout le trafic HTTP et WebSocket vers Render,
 * en contournant le blocage Orange Cameroun.
 *
 * Déployer sur : https://workers.cloudflare.com (plan gratuit)
 */

const BACKEND = 'sti-backend-a2d1.onrender.com'

export default {
  async fetch(request) {
    const url = new URL(request.url)
    url.hostname = BACKEND

    // ── WebSocket (notifications, chat) ─────────────────────────
    if (request.headers.get('Upgrade') === 'websocket') {
      url.protocol = 'wss:'

      // WebSocketPair : tunnel bidirectionnel persistant
      const backendResp = await fetch(url.toString(), {
        headers: {
          'Upgrade':    'websocket',
          'Connection': 'Upgrade',
          'Sec-WebSocket-Version': request.headers.get('Sec-WebSocket-Version') || '13',
          'Sec-WebSocket-Key':     request.headers.get('Sec-WebSocket-Key') || '',
          // Transmet le token dans la query string (déjà dans l'URL)
        },
      })

      if (backendResp.status !== 101) {
        return new Response('WebSocket backend unavailable', { status: 502 })
      }

      const backendWs = backendResp.webSocket
      backendWs.accept()

      const [clientWs, serverWs] = Object.values(new WebSocketPair())
      serverWs.accept()

      // Frontend → Backend
      serverWs.addEventListener('message', ({ data }) => {
        try { backendWs.send(data) } catch {}
      })
      serverWs.addEventListener('close', ({ code, reason }) => {
        try { backendWs.close(code, reason) } catch {}
      })

      // Backend → Frontend
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
      method:  request.method,
      headers: request.headers,
      body:    ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'follow',
    })

    const response = await fetch(proxied)

    return new Response(response.body, {
      status:     response.status,
      statusText: response.statusText,
      headers:    response.headers,
    })
  },
}
