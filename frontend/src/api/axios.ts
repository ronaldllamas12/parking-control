import axios, { AxiosError, AxiosResponse } from 'axios'

/**
 * Base URL: empty string → requests are relative to the current origin.
 * - In dev:  Vite proxy forwards /api/* → backend.
 * - In prod: nginx proxy forwards /api/* → backend container.
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  timeout: 40_000,
})

function isAuthTokenRequest(error: AxiosError): boolean {
  const requestUrl = error.config?.url ?? ''
  return requestUrl.includes('/api/v1/auth/token')
}

function logApiError(error: AxiosError): void {
  const status = error.response?.status ?? 'NO_RESPONSE'
  const method = error.config?.method?.toUpperCase() ?? 'UNKNOWN'
  const requestUrl = error.config?.url ?? '(sin URL)'
  const detail = error.response?.data ?? error.message

  console.error('[api]', {
    method,
    url: requestUrl,
    status,
    detail,
  })
}

// ── Request interceptor: attach Bearer token ──────────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Response interceptor: handle 401 globally ────────────────────────────
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    logApiError(error)

    if (error.response?.status === 401 && !isAuthTokenRequest(error)) {
      sessionStorage.removeItem('access_token')
      // Hard redirect so every state is cleared
      if (window.location.pathname !== '/login') {
        window.location.replace('/login')
      }
    }
    return Promise.reject(error)
  },
)

export default apiClient
