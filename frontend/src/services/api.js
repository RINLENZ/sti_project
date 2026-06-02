import axios from 'axios'
import { store }  from '../store/store.js'
import { logout } from '../store/authSlice.js'

const BASE_URL = import.meta.env.VITE_API_URL
  || import.meta.env.VITE_BACKEND_URL
  || 'https://sti-proxy.sergedjiomo01.workers.dev'

export { BASE_URL }

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,  // 30s — connexions mobiles lentes
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('sti_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let _refreshing = false
let _queue = []

function processQueue(error, token = null) {
  _queue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token))
  _queue = []
}

function forceLogout() {
  try { store.dispatch(logout()) } catch {}
  localStorage.removeItem('sti_token')
  localStorage.removeItem('sti_refresh_token')
  localStorage.removeItem('sti_user')
  window.location.href = '/login'
}

// Retry automatique sur erreur réseau (pas sur les 4xx/5xx)
async function retryRequest(config, retries = 2) {
  for (let i = 0; i < retries; i++) {
    await new Promise(r => setTimeout(r, 1000 * (i + 1)))
    try {
      // _retry: true évite que le retry déclenche un second refresh de token si 401
      return await api({ ...config, _retry: true })
    } catch { /* continue */ }
  }
  return Promise.reject(new Error('Connexion impossible après plusieurs tentatives'))
}

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config

    // Retry silencieux sur timeout ou erreur réseau (code ERR_NETWORK / ECONNABORTED)
    if (
      !original._retried &&
      !err.response &&
      (err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK' || err.message === 'Network Error')
    ) {
      original._retried = true
      return retryRequest({ ...original, timeout: 45000 })
    }

    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err)
    }

    const refreshToken = localStorage.getItem('sti_refresh_token')
    if (!refreshToken) {
      forceLogout()
      return Promise.reject(err)
    }

    if (_refreshing) {
      return new Promise((resolve, reject) => _queue.push({ resolve, reject }))
        .then(token => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
    }

    original._retry = true
    _refreshing = true

    try {
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      }, { timeout: 30000 })
      localStorage.setItem('sti_token',         data.access_token)
      localStorage.setItem('sti_refresh_token', data.refresh_token)

      processQueue(null, data.access_token)
      original.headers.Authorization = `Bearer ${data.access_token}`
      return api(original)
    } catch (refreshErr) {
      processQueue(refreshErr, null)
      // Ne pas forcer la déconnexion sur une simple erreur réseau :
      // si le refresh échoue parce que la connexion est coupée, le token
      // est peut-être encore valide — on ne veut pas déconnecter l'utilisateur.
      const isAuthError = refreshErr.response?.status === 401
                       || refreshErr.response?.status === 403
      if (isAuthError) forceLogout()
      return Promise.reject(refreshErr)
    } finally {
      _refreshing = false
    }
  }
)

export default api
