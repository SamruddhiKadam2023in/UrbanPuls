import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const onAuthPage = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email']
      .includes(window.location.pathname)
    if (err.response?.status === 401 && !onAuthPage) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Turns any API error (including FastAPI validation lists) into one readable sentence
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length) {
    return detail.map(d => (d.msg || '').replace(/^Value error, /, '')).filter(Boolean).join('. ') || fallback
  }
  if (err?.response?.status === 429) return 'Too many attempts. Please wait a minute and try again.'
  if (!err?.response) return 'Cannot reach the server. Check your connection.'
  return fallback
}

// WebSocket URL on the same host as the page, so it works behind nginx and over HTTPS
export function wsUrl(path) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const token = localStorage.getItem('token') || ''
  return `${proto}//${window.location.host}/api${path}?token=${encodeURIComponent(token)}`
}

export default api
