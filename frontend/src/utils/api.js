// utils/api.js - Axios instance with auth interceptors

import axios from 'axios'

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()
const deploymentConfigurationError = !import.meta.env.DEV && !configuredApiUrl

const api = axios.create({
  baseURL: configuredApiUrl || '/api',
  timeout: 60000, // 60s for analysis requests
  withCredentials: true,
})

const readCookie = (name) => document.cookie
  .split('; ')
  .find((cookie) => cookie.startsWith(`${name}=`))
  ?.split('=')[1]

// Cookie-authenticated mutations carry a double-submit CSRF token.
api.interceptors.request.use((config) => {
  if (deploymentConfigurationError) {
    return Promise.reject(
      new Error('ResumeIQ is missing VITE_API_URL. Configure the deployed API origin before using the application.')
    )
  }
  const method = (config.method || 'get').toLowerCase()
  const publicAuthRoute = /\/auth\/(login|register)$/.test(config.url || '')
  if (!['get', 'head', 'options'].includes(method) && !publicAuthRoute) {
    const csrfToken = readCookie('resumeiq_csrf')
    if (csrfToken) config.headers['X-CSRF-Token'] = csrfToken
  }
  return config
})

// Global response error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If 401, token expired → redirect to login
    if (error.response?.status === 401) {
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
export { deploymentConfigurationError }
