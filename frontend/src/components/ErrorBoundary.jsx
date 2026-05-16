import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    // ChunkLoadError = ancien HTML en cache après un déploiement Netlify.
    // On recharge une seule fois automatiquement au lieu d'afficher l'écran d'erreur.
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('error loading dynamically imported module') ||
      error?.message?.includes('Importing a module script failed')

    if (isChunkError) {
      const lastReload = sessionStorage.getItem('_chunk_reload')
      const now = Date.now()
      if (!lastReload || now - Number(lastReload) > 15000) {
        sessionStorage.setItem('_chunk_reload', String(now))
        window.location.reload()
        return { hasError: false, error: null }
      }
    }

    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#FAF7F4', padding: 24, fontFamily: "'DM Sans', system-ui, sans-serif",
        textAlign: 'center', gap: 16,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'linear-gradient(135deg, #C4865A, #6B3A2A)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, boxShadow: '0 8px 24px rgba(107,58,42,0.25)',
        }}>⚡</div>

        <h1 style={{ fontSize: 20, fontWeight: 900, color: '#1A1207', margin: 0 }}>
          Une erreur inattendue s'est produite
        </h1>

        <p style={{ fontSize: 13, color: '#6B5A4E', maxWidth: 340, lineHeight: 1.6, margin: 0 }}>
          L'application a rencontré un problème. Essayez de recharger la page.
          Si le problème persiste, reconnectez-vous.
        </p>

        {this.state.error && (
          <code style={{
            fontSize: 11, color: '#9B7B6B', background: '#F0EAE5',
            padding: '8px 14px', borderRadius: 8, maxWidth: 400,
            wordBreak: 'break-all', lineHeight: 1.5,
          }}>
            {this.state.error.message}
          </code>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 22px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #C4865A, #6B3A2A)',
              color: 'white', fontSize: 13, fontWeight: 800,
              boxShadow: '0 4px 14px rgba(107,58,42,0.3)',
            }}
          >
            Recharger la page
          </button>
          <button
            onClick={() => { localStorage.clear(); window.location.href = '/login' }}
            style={{
              padding: '10px 22px', borderRadius: 10, cursor: 'pointer',
              background: 'none', border: '1.5px solid #C4865A',
              color: '#6B3A2A', fontSize: 13, fontWeight: 700,
            }}
          >
            Se reconnecter
          </button>
        </div>
      </div>
    )
  }
}
