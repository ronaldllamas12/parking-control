import { BarChart3, Building2, Fingerprint, List, LogOut, PencilLine, Shield, UserCircle2, UserPlus } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const FINGERPRINT_LINK = { to: '/perfil/huella', label: 'Huella', icon: Fingerprint }

const ROLE_META: Record<string, { label: string; dot: string }> = {
  superadmin: { label: 'Super Admin', dot: 'bg-sky-400' },
  admin:     { label: 'Admin',     dot: 'bg-amber-400' },
  vigilante: { label: 'Vigilante', dot: 'bg-emerald-400' },
}

const ADMIN_LINKS = [
  { to: '/admin/metricas',               label: 'Métricas', icon: BarChart3 },
  { to: '/admin/propietarios',           label: 'Listar',    icon: List },
  { to: '/admin/registrar',              label: 'Registrar', icon: UserPlus },
  { to: '/admin/propietarios?mode=edit', label: 'Editar',    icon: PencilLine },
]

const SUPERADMIN_LINKS = [
  { to: '/superadmin/conjuntos', label: 'Conjuntos', icon: Building2 },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()
  const isEditMode =
    location.pathname === '/admin/propietarios' &&
    new URLSearchParams(location.search).get('mode') === 'edit'

  const handleLogout = () => { logout(); navigate('/login', { replace: true }) }
  const roleMeta = user ? ROLE_META[user.role] : null

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">

      {/* ── Navbar ────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-gradient-premium shadow-float border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

          {/* Brand + links */}
          <div className="flex items-center gap-5 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/95 backdrop-blur border border-white/25
                              flex items-center justify-center shadow-glow overflow-hidden">
                <img src="/logo.svg" alt="Logo" className="w-12 h-12 object-contain" />
              </div>
              <span className="font-extrabold text-white text-sm hidden sm:block tracking-tight">
                Gestion de Acceso zonas Comunes
              </span>
            </div>

            {user?.role === 'admin' && (
              <div className="hidden sm:flex items-center gap-0.5">
                {ADMIN_LINKS.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      `text-xs font-semibold px-3.5 py-2 rounded-xl transition-all duration-200 ${
                        (link.label === 'Editar' ? isEditMode : isActive)
                          ? 'bg-black/22 text-white shadow-sm'
                          : 'text-white/60 hover:text-white hover:bg-black'
                      }`
                    }
                  >{link.label}</NavLink>
                ))}
              </div>
            )}

            {user?.role === 'superadmin' && (
              <div className="hidden sm:flex items-center gap-0.5">
                {SUPERADMIN_LINKS.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      `text-xs font-semibold px-3.5 py-2 rounded-xl transition-all duration-200 ${
                        isActive
                          ? 'bg-black/22 text-white shadow-sm'
                          : 'text-white/60 hover:text-white hover:bg-black'
                      }`
                    }
                  >{link.label}</NavLink>
                ))}
              </div>
            )}
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {user && (
              <>
                <div className="hidden sm:flex items-center gap-2 bg-white/10 border border-white/20
                                rounded-full px-3 py-1.5 select-none">
                  <UserCircle2 className="w-3.5 h-3.5 text-white/70" />
                  <span className="text-white text-xs font-semibold">{user.username}</span>
                  {roleMeta && (
                    <>
                      <span className="text-white/30 text-xs">·</span>
                      <span className="text-white/60 text-xs">{roleMeta.label}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${roleMeta.dot}`} />
                    </>
                  )}
                </div>

                {user.role !== 'superadmin' && (
                  <NavLink
                    to={FINGERPRINT_LINK.to}
                    title="Registrar huella"
                    className={({ isActive }) =>
                      `w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
                        isActive ? 'bg-white/25 text-white' : 'bg-white/10 hover:bg-white/20 text-white/70 hover:text-white'
                      }`
                    }
                  >
                    <Fingerprint className="w-4 h-4" />
                  </NavLink>
                )}
              </>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-rose-500 border border-white/15
                         text-white/80 hover:text-white text-xs font-semibold
                         px-3 py-2 rounded-xl transition-all duration-200"
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Salir</span>
            </button>
          </div>
        </div>

        {/* Mobile admin links strip */}
        {user?.role === 'admin' && (
          <div className="sm:hidden border-t border-white/10 px-4 py-2 flex items-center gap-1.5 overflow-x-auto">
            {ADMIN_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `whitespace-nowrap text-xs font-bold px-3 py-1.5 rounded-lg transition-colors duration-150 ${
                    (link.label === 'Editar' ? isEditMode : isActive)
                      ? 'bg-white/22 text-white'
                      : 'text-white/55 hover:text-white hover:bg-white/10'
                  }`
                }
              >{link.label}</NavLink>
            ))}
          </div>
        )}

        {user?.role === 'superadmin' && (
          <div className="sm:hidden border-t border-white/10 px-4 py-2 flex items-center gap-1.5 overflow-x-auto">
            {SUPERADMIN_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `whitespace-nowrap text-xs font-bold px-3 py-1.5 rounded-lg transition-colors duration-150 ${
                    isActive ? 'bg-white/22 text-white' : 'text-white/55 hover:text-white hover:bg-white/10'
                  }`
                }
              >{link.label}</NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-28 sm:pb-10">
        {children}
      </main>

      {/* ── Mobile bottom bar — Admin ────────────────────────────────── */}
      {user?.role === 'admin' && (
        <div className="sm:hidden fixed inset-x-0 bottom-0 z-40 px-3 pb-4 pt-2
                        bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-transparent">
          <div className="mx-auto max-w-sm rounded-[28px] bg-gradient-premium border border-white/15
                          p-1.5 shadow-float backdrop-blur-xl">
            <div className="grid grid-cols-5 gap-1">
              {ADMIN_LINKS.map((link) => {
                const Icon = link.icon
                const active =
                  link.label === 'Editar'
                    ? isEditMode
                    : location.pathname === link.to.split('?')[0] && !isEditMode
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={() =>
                      `flex flex-col items-center justify-center rounded-[20px] py-2.5 text-[10px] font-bold tracking-wide transition-all duration-200 ${
                        active ? 'bg-white text-brand-700 shadow-brand' : 'text-white/65 hover:text-white hover:bg-white/10'
                      }`
                    }
                  >
                    <Icon className="mb-1 h-4 w-4" />
                    <span>{link.label}</span>
                  </NavLink>
                )
              })}
              <NavLink
                to={FINGERPRINT_LINK.to}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center rounded-[20px] py-2.5 text-[10px] font-bold tracking-wide transition-all duration-200 ${
                    isActive ? 'bg-white text-brand-700 shadow-brand' : 'text-white/65 hover:text-white hover:bg-white/10'
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

      {/* ── Mobile bottom bar — Vigilante ───────────────────────────── */}
      {user?.role === 'vigilante' && (
        <div className="sm:hidden fixed inset-x-0 bottom-0 z-40 px-3 pb-4 pt-2
                        bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-transparent">
          <div className="mx-auto max-w-sm rounded-[28px] bg-gradient-premium border border-white/15
                          p-1.5 shadow-float backdrop-blur-xl">
            <div className="grid grid-cols-2 gap-1">
              {[{ to: '/vigilante/verificar', label: 'Verificar', icon: Shield },
                { to: '/perfil/huella',       label: 'Huella',    icon: Fingerprint }
              ].map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center rounded-[20px] py-2.5 text-[10px] font-bold tracking-wide transition-all duration-200 ${
                      isActive ? 'bg-white text-brand-700 shadow-brand' : 'text-white/65 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <Icon className="mb-1 h-4 w-4" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      {user?.role === 'superadmin' && (
        <div className="sm:hidden fixed inset-x-0 bottom-0 z-40 px-3 pb-4 pt-2
                        bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-transparent">
          <div className="mx-auto max-w-sm rounded-[28px] bg-gradient-premium border border-white/15
                          p-1.5 shadow-float backdrop-blur-xl">
            <NavLink
              to="/superadmin/conjuntos"
              className={({ isActive }) =>
                `flex items-center justify-center gap-2 rounded-[20px] py-3 text-xs font-bold tracking-wide transition-all duration-200 ${
                  isActive ? 'bg-white text-brand-700 shadow-brand' : 'text-white/65 hover:text-white hover:bg-white/10'
                }`
              }
            >
              <Building2 className="h-4 w-4" />
              <span>Conjuntos</span>
            </NavLink>
          </div>
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="hidden sm:block border-t border-surface-200 py-4 bg-white/70">
        <p className="text-center text-slate-400 text-xs tracking-wide">
          © {new Date().getFullYear()} Sistema de Control de Acceso · Parqueadero Residencial
        </p>
      </footer>
    </div>
  )
}
