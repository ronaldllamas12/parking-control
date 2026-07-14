import { zodResolver } from '@hookform/resolvers/zod'
import type { AxiosError } from 'axios'
import { AlertCircle, Eye, EyeOff, Fingerprint, Lock, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from '../context/AuthContext'
import type { ApiErrorBody } from '../types'

const schema = z.object({
  username: z.string().min(1, 'El usuario es obligatorio'),
  password: z.string().min(1, 'La contraseña es requerida'),
})
type FormValues = z.infer<typeof schema>

export default function Login() {
  const { login, webauthnLogin, user } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [apiError, setApiError]         = useState<string | null>(null)
  const [webauthnLoading, setWebauthnLoading] = useState(false)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const routeForRole = (role: string) => {
    if (role === 'superadmin') return '/superadmin/conjuntos'
    if (role === 'admin') return '/admin/metricas'
    return '/vigilante/verificar'
  }

  useEffect(() => {
    if (user) navigate(routeForRole(user.role), { replace: true })
  }, [user, navigate])

  const onSubmit = async ({ username, password }: FormValues) => {
    setApiError(null)
    try {
      await login(username, password)
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      const status   = axiosErr.response?.status
      const detail   = axiosErr.response?.data?.detail
      setApiError(detail ? `Error ${status ?? ''}: ${detail}`.trim() : 'Error de conexión. Intenta de nuevo.')
    }
  }

  const handleWebAuthn = async () => {
    setApiError(null)
    const username = getValues('username')
    if (!username) { setApiError('Ingresa el usuario antes de usar huella'); return }
    if (!('credentials' in navigator)) { setApiError('Tu navegador no soporta WebAuthn'); return }
    setWebauthnLoading(true)
    try {
      await webauthnLogin(username)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Autenticación con huella falló')
    } finally {
      setWebauthnLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center lg:justify-end relative overflow-hidden px-4 sm:px-6 lg:px-16 xl:px-24 bg-center bg-cover bg-no-repeat"
      style={{ backgroundImage: "url('https://res.cloudinary.com/dms34zmay/image/upload/v1784067067/ih0mkdfrgiuwvemyjm7t.png')" }}
    >
      {/* Overlay */}
      <div aria-hidden className="absolute inset-0 bg-gradient-dark/70 ]" />

      {/* Ambient glows */}
      <div aria-hidden className="pointer-events-none absolute -top-40 -right-40 w-96 h-96 bg-brand-500/20 rounded-full blur-[100px]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-40 w-96 h-96 bg-brand-800/30 rounded-full blur-[100px]" />

      <div className="relative w-full max-w-md lg:max-w-lg animate-slide-up">

        {/* Brand hero */}
        <div className="text-center mb-8 lg:mb-10">
          <div className="inline-flex items-center justify-center w-28 h-28 lg:w-32 lg:h-32
                          bg-white rounded-3xl mb-6 shadow-brand-lg ring-2 ring-brand-400/50">
            <img src="/logo-login.png" alt="Logo" className="w-24 h-24 lg:w-28 lg:h-28 object-contain" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-black tracking-tight"
          style={{
                  textShadow: `
                    -1px -1px 0 #fff,
                     1px -1px 0 #fff,
                    -1px  1px 0 #fff,
                     1px  1px 0 #fff
                  `,
                }}>Gestion Integral Pro</h1>
          <p
            className="text-white text-base lg:text-lg mt-4 font-medium"
            style={{
                textShadow: `
                  -1px -1px 0 #0c0c0c,
                   1px -1px 0 #0a0a0a,
                  -1px  1px 0 #0a0a0a,
                   1px  1px 0 #050505
                `,
              }}
          >
            Gestion Integral de Zonas Comunes
          </p>
        </div>

        {/* Card */}
        <div className="glass px-8 py-8 lg:px-14 lg:py-14">

          {/* Card header */}
          <div className="flex items-center gap-3 mb-7">
            <div className="w-12 h-12 rounded-lg bg-white border border-surface-200 flex items-center justify-center overflow-hidden">
              <img src="/logo-login.png" alt="Logo" className="w-10 h-10 object-contain" />
            </div>
            <span className="font-bold text-slate-800 text-base">Iniciar sesión</span>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

            {/* Username */}
            <div>
              <label className="field-label">Usuario</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-700 pointer-events-none" />
                <input {...register('username')} autoComplete="username" placeholder="Ej: admin" className="field pl-12 py-4 text-base" />
              </div>
              {errors.username && (
                <p className="field-error"><AlertCircle className="w-3 h-3" />{errors.username.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="field-label">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-800 pointer-events-none" />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="field pl-12 pr-12 py-4 text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="field-error"><AlertCircle className="w-3 h-3" />{errors.password.message}</p>
              )}
            </div>

            {/* Error */}
            {apiError && (
              <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                <p className="text-sm text-rose-700">{apiError}</p>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full mt-2 py-4 text-base">
              {isSubmitting ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verificando…</>
              ) : 'Iniciar sesión'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-surface-200" />
              <span className="text-xs text-slate-400 font-medium">o</span>
              <div className="flex-1 h-px bg-surface-200" />
            </div>

            {/* WebAuthn */}
            <button
              type="button"
              onClick={handleWebAuthn}
              disabled={webauthnLoading}
              className="w-full flex items-center justify-center gap-2.5
                         bg-surface-100 hover:bg-brand-50 border border-surface-200 hover:border-brand-300
                         text-slate-700 hover:text-brand-700 font-semibold text-sm
                         py-4 rounded-2xl transition-all duration-200 disabled:opacity-60"
            >
              {webauthnLoading
                ? <><span className="w-4 h-4 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />Esperando huella…</>
                : <><Fingerprint className="w-4 h-4 text-brand-600" />Iniciar con huella dactilar</>
              }
            </button>
          </form>
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          © {new Date().getFullYear()} Parqueadero Residencial · Todos los derechos reservados
        </p>
      </div>
    </div>
  )
}
