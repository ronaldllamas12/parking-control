import type { TokenResponse } from '../types'
import apiClient from './axios'

/**
 * OAuth2 Password Flow — matches the backend /api/v1/auth/token endpoint.
 * Content-Type must be application/x-www-form-urlencoded.
 */
export async function login(username: string, password: string): Promise<TokenResponse> {
  const body = new URLSearchParams()
  body.append('username', username)
  body.append('password', password)

  const { data } = await apiClient.post<TokenResponse>('/api/v1/auth/token', body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return data
}

// WebAuthn assertion (login) helpers
export async function getWebAuthnAssertionOptions(username: string) {
  const { data } = await apiClient.post('/api/v1/auth/webauthn/assertion/options', { username })
  return data
}

export async function verifyWebAuthnAssertion(assertion: any): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>('/api/v1/auth/webauthn/assertion/verify', assertion)
  return data
}
