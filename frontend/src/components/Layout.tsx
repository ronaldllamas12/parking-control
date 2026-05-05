import { LogOut, Shield, UserCircle2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLE_META: Record<string, { label: string; classes: string }> = {
  admin: {
    label: 'Administrador',
    classes: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
  },
  vigilante: {
    label: 'Vigilante',
    classes: 'bg-blue-500/10 text-blue-400 border border-blue-500/30',
  },
}

const ADMIN_LINKS = [
  { to: '/admin/propietarios', label: 'Propietarios' },
  { to: '/admin/registrar', label: 'Registrar' },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const roleMeta = user ? ROLE_META[user.role] : null

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* ── Top navbar ──────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo + admin nav links */}
          <div className="flex items-center gap-5 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/30">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-slate-900 text-sm hidden sm:block tracking-tight">
                Control de Acceso
              </span>
            </div>

            {user?.role === 'admin' && (
              <div className="hidden sm:flex items-center gap-1">
                {ADMIN_LINKS.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      `text-xs font-medium px-3 py-1.5 rounded-lg transition-colors duration-150 ${
                        isActive
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          {/* Right section */}
          <div className="flex items-center gap-3">
            {user && (
              <>
                <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500">
                  <UserCircle2 className="w-4 h-4" />
                  <span>{user.username}</span>
                </div>

                {roleMeta && (
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${roleMeta.classes}`}>
                    {roleMeta.label}
                  </span>
                )}
              </>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-slate-500 hover:text-rose-500 text-sm
                         px-3 py-1.5 rounded-lg hover:bg-rose-500/10 transition-colors duration-200"
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Salir</span>
            </button>
          </div>
        </div>

        {user?.role === 'admin' && (
          <div className="sm:hidden border-t border-slate-200 px-4 py-2">
            <div className="flex items-center gap-2 overflow-x-auto">
              {ADMIN_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `whitespace-nowrap text-xs font-medium px-3 py-1.5 rounded-lg transition-colors duration-150 ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* ── Page content ────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10">
        {children}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 py-4 bg-white/80">
        <p className="text-center text-slate-500 text-xs">
          © {new Date().getFullYear()} Sistema de Control de Acceso · Parqueadero Residencial
        </p>
      </footer>
    </div>
  )
}
