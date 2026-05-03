import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL
  || import.meta.env.VITE_BACKEND_URL
  || 'https://sti-backend-a2d1.onrender.com'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
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
  localStorage.removeItem('sti_token')
  localStorage.removeItem('sti_refresh_token')
  localStorage.removeItem('sti_user')
  window.location.href = '/login'
}

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config
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
      })
      localStorage.setItem('sti_token',         data.access_token)
      localStorage.setItem('sti_refresh_token', data.refresh_token)

      processQueue(null, data.access_token)
      original.headers.Authorization = `Bearer ${data.access_token}`
      return api(original)
    } catch (refreshErr) {
      processQueue(refreshErr, null)
      forceLogout()
      return Promise.reject(refreshErr)
    } finally {
      _refreshing = false
    }
  }
)

export default api
