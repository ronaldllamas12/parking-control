import { Fingerprint, List, LogOut, PencilLine, Shield, UserCircle2, UserPlus } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const FINGERPRINT_LINK = { to: '/perfil/huella', label: 'Huella', icon: Fingerprint }

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
  { to: '/admin/propietarios', label: 'Listar', icon: List },
  { to: '/admin/registrar', label: 'Registrar', icon: UserPlus },
  { to: '/admin/propietarios?mode=edit', label: 'Editar', icon: PencilLine },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isEditMode = location.pathname === '/admin/propietarios' && new URLSearchParams(location.search).get('mode') === 'edit'

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
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/30">
                <Shield className="w-4 h-4 text-blue" />
              </div>
              <span className="font-bold text-slate-900 text-sm hidden sm:block tracking-tight">
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

                <NavLink
                  to={FINGERPRINT_LINK.to}
                  title="Registrar huella"
                  className={({ isActive }) =>
                    `hidden sm:flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors duration-200 ${
                      isActive
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'text-slate-500 hover:text-indigo-700 hover:bg-indigo-50'
                    }`
                  }
                >
                  <Fingerprint className="w-4 h-4" />
                  <span className="hidden md:block">Huella</span>
                </NavLink>
              </>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-rose-500 hover:text-white text-sm
                         px-3 py-1.5 rounded-lg hover:bg-rose-500 transition-colors duration-200"
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
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-24 sm:pb-10">
        {children}
      </main>

      {user?.role === 'admin' && (
        <div className="sm:hidden fixed inset-x-0 bottom-0 z-40 px-3 pb-3 pt-2 bg-gradient-to-t from-slate-950/95 via-slate-950/75 to-transparent">
          <div className="mx-auto max-w-md rounded-[24px] border border-white/10 bg-white/95 p-2 shadow-[0_20px_60px_rgba(15,23,42,0.25)] backdrop-blur-xl">
            <div className="grid grid-cols-4 gap-2">
              {ADMIN_LINKS.map((link) => {
                const Icon = link.icon
                const isActive =
                  link.label === 'Editar'
                    ? isEditMode
                    : location.pathname === link.to.split('?')[0]

                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive: linkActive }) =>
                      `flex flex-col items-center justify-center rounded-2xl px-2 py-2.5 text-[11px] font-semibold transition-all duration-200 ${
                        (link.label === 'Editar' ? isEditMode : linkActive)
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`
                    }
                  >
                    <Icon className="mb-1 h-4 w-4" />
                    <span>{link.label}</span>
                  </NavLink>
                )
              })}
              {/* Huella button */}
              <NavLink
                to={FINGERPRINT_LINK.to}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center rounded-2xl px-2 py-2.5 text-[11px] font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Fingerprint className="mb-1 h-4 w-4" />
                <span>Huella</span>
              </NavLink>
            </div>
          </div>
        </div>
      )}

      {user?.role === 'vigilante' && (
        <div className="sm:hidden fixed inset-x-0 bottom-0 z-40 px-3 pb-3 pt-2 bg-gradient-to-t from-slate-950/95 via-slate-950/75 to-transparent">
          <div className="mx-auto max-w-md rounded-[24px] border border-white/10 bg-white/95 p-2 shadow-[0_20px_60px_rgba(15,23,42,0.25)] backdrop-blur-xl">
            <div className="grid grid-cols-2 gap-2">
              <NavLink
                to="/vigilante/verificar"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center rounded-2xl px-2 py-2.5 text-[11px] font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Shield className="mb-1 h-4 w-4" />
                <span>Verificar</span>
              </NavLink>
              <NavLink
                to={FINGERPRINT_LINK.to}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center rounded-2xl px-2 py-2.5 text-[11px] font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Fingerprint className="mb-1 h-4 w-4" />
                <span>Huella</span>
              </NavLink>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 py-4 bg-white/80">
        <p className="text-center text-slate-500 text-xs">
          © {new Date().getFullYear()} Sistema de Control de Acceso · Parqueadero Residencial
        </p>
      </footer>
    </div>
  )
}
