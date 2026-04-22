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
