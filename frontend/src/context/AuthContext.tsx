import { jwtDecode } from 'jwt-decode'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { login as apiLogin, getWebAuthnAssertionOptions, verifyWebAuthnAssertion } from '../api/auth'
import type { AuthUser } from '../types'
import { base64UrlToBuffer, bufferToBase64Url } from '../utils/webauthn'

interface JwtPayload {
  sub: string
  role: string
  exp: number
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  webauthnLogin: (username: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Helpers ───────────────────────────────────────────────────────────────────
function readUserFromStorage(): AuthUser | null {
  try {
    const token = sessionStorage.getItem('access_token')
    if (!token) return null
    const payload = jwtDecode<JwtPayload>(token)
    // Reject expired tokens immediately
    if (payload.exp * 1000 < Date.now()) {
      sessionStorage.removeItem('access_token')
      return null
    }
    return { username: payload.sub, role: payload.role as AuthUser['role'] }
  } catch {
    return null
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readUserFromStorage)

  const logout = useCallback(() => {
    sessionStorage.removeItem('access_token')
    setUser(null)
  }, [])

  const login = useCallback(
    async (username: string, password: string) => {
      const tokenResponse = await apiLogin(username, password)
      sessionStorage.setItem('access_token', tokenResponse.access_token)
      const payload = jwtDecode<JwtPayload>(tokenResponse.access_token)
      setUser({ username: payload.sub, role: payload.role as AuthUser['role'] })
    },
    [],
  )

  const webauthnLogin = useCallback(async (username: string) => {
    // Start assertion flow
    const options = await getWebAuthnAssertionOptions(username)

    // Convert options to platform format
    const publicKey: PublicKeyCredentialRequestOptions = {
      ...options,
      challenge: base64UrlToBuffer(options.challenge),
      allowCredentials: (options.allowCredentials || []).map((c: any) => ({
        ...c,
        id: base64UrlToBuffer(c.id),
      })),
    }

    const cred = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null
    if (!cred) throw new Error('Autenticación cancelada')

    const authData = cred.response as AuthenticatorAssertionResponse

    const toSend = {
      id: cred.id,
      rawId: bufferToBase64Url(cred.rawId),
      type: cred.type,
      response: {
        clientDataJSON: bufferToBase64Url(authData.clientDataJSON),
        authenticatorData: bufferToBase64Url(authData.authenticatorData),
        signature: bufferToBase64Url(authData.signature),
        userHandle: authData.userHandle ? bufferToBase64Url(authData.userHandle) : null,
      },
    }

    const tokenResponse = await verifyWebAuthnAssertion(toSend)
    sessionStorage.setItem('access_token', tokenResponse.access_token)
    const payload = jwtDecode<JwtPayload>(tokenResponse.access_token)
    setUser({ username: payload.sub, role: payload.role as AuthUser['role'] })
  }, [])

  // ── Auto-logout when token expires ────────────────────────────────────────
  useEffect(() => {
    const token = sessionStorage.getItem('access_token')
    if (!token || !user) return
    try {
      const payload = jwtDecode<JwtPayload>(token)
      const msUntilExpiry = payload.exp * 1000 - Date.now()
      if (msUntilExpiry <= 0) {
        logout()
        return
      }
      const timer = setTimeout(logout, msUntilExpiry)
      return () => clearTimeout(timer)
    } catch {
      logout()
    }
  }, [user, logout])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: !!user, login, webauthnLogin, logout }),
    [user, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
