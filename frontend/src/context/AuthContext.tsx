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
import { login as apiLogin } from '../api/auth'
import type { AuthUser } from '../types'

interface JwtPayload {
  sub: string
  role: string
  exp: number
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
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
    () => ({ user, isAuthenticated: !!user, login, logout }),
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
