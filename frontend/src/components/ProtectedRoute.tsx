import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface Props {
  allowedRoles: string[]
}

/**
 * Wraps a set of routes, redirecting to /login if not authenticated
 * or to /login if the authenticated role is not allowed.
 */
export default function ProtectedRoute({ allowedRoles }: Props) {
  const { isAuthenticated, user } = useAuth()

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user && !allowedRoles.includes(user.role)) return <Navigate to="/login" replace />

  return <Outlet />
}
