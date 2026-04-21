import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 15000,
})

// Injecte automatiquement le token JWT dans chaque requête
api.interceptors.request.use(config => {
  const token = localStorage.getItem('sti_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Redirige vers /login si token expiré
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('sti_token')
      localStorage.removeItem('sti_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
