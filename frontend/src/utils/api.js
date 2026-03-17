// utils/api.js - Axios instance with auth interceptors

import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000, // 60s for analysis requests
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Global response error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If 401, token expired → redirect to login
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
