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
      const wsResp = await fetch(new Request(url.toString(), request))
      return wsResp
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

    // Retransmet la réponse telle quelle (headers CORS inclus)
    return new Response(response.body, {
      status:     response.status,
      statusText: response.statusText,
      headers:    response.headers,
    })
  },
}
