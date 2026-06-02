import React from 'react'
import ReactDOM from 'react-dom/client'

// ── Capture des erreurs non-catchées du loader MediaPipe ──────────
// face_mesh_solution_packed_assets_loader.js lève un TypeError dans
// son callback XHR onprogress quand la connexion est coupée pendant
// le téléchargement des packed assets (~10 MB). Cette erreur est
// async et contourne l'ErrorBoundary → crash complet sans ce filtre.
window.addEventListener('error', (e) => {
  const isMediaPipe =
    e.filename?.includes('face_mesh_solution_packed_assets_loader') ||
    e.filename?.includes('face_mesh_solution_simd_wasm_bin') ||
    e.message?.includes('face_mesh_solution_packed_assets')
  if (isMediaPipe) {
    e.preventDefault()
    console.warn('[MediaPipe] Chargement interrompu (connexion instable) — caméra désactivée temporairement.')
    return true
  }
})
window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason?.message || e.reason?.toString() || ''
  if (msg.includes('face_mesh') || msg.includes('mediapipe')) {
    e.preventDefault()
    console.warn('[MediaPipe] Promesse rejetée absorbée :', msg)
  }
})
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import { store } from './store/store.js'
import { ThemeProvider } from './styles/theme.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { NotificationsProvider } from './contexts/NotificationsContext.jsx'
import OfflineBanner from './components/OfflineBanner.jsx'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <ThemeProvider>
          <ErrorBoundary>
            <NotificationsProvider>
              <App />
              <Toaster position="top-right" />
              <OfflineBanner />
            </NotificationsProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
)