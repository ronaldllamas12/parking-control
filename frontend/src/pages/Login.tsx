import { zodResolver } from '@hookform/resolvers/zod'
import type { AxiosError } from 'axios'
import { AlertCircle, Eye, EyeOff, Lock, User } from 'lucide-react'
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
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const { webauthnLogin } = useAuth()

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate(user.role === 'admin' ? '/admin/registrar' : '/vigilante/verificar', {
        replace: true,
      })
    }
  }, [user, navigate])

  const onSubmit = async ({ username, password }: FormValues) => {
    setApiError(null)
    try {
      await login(username, password)
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      const status = axiosErr.response?.status
      const detail = axiosErr.response?.data?.detail
      setApiError(detail ? `Error ${status ?? ''}: ${detail}`.trim() : 'Error de conexión. Intenta de nuevo.')
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 bg-center bg-cover bg-no-repeat"
      style={{
        backgroundImage:
          "url('https://res.cloudinary.com/dms34zmay/image/upload/v1777934516/jh8oon16lkqfx4ppq5pb.jpg')",
      }}
    >
      <div aria-hidden className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]" />

      {/* Ambient blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-56 -right-56 w-[500px] h-[500px]
                   bg-blue-600/15 rounded-full blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-56 -left-56 w-[500px] h-[500px]
                   bg-image rounded-full blur-[120px]"
      />

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Brand */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-20 h-20
                        bg-white rounded-2xl mb-5
                        shadow-xl shadow-blue-600 ring ring-blue-500"
          >
            <img
              src="/moto.png"
              alt="Logo"
              className="w-18 h-18 object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Control de Acceso</h1>
          <p className="text-white text-sm mt-1.5">Sistema de Parqueadero Residencial</p>
        </div>

        {/* Card */}
        <div className="glass p-8 shadow-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-black font-bold mb-2">Usuario</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <input
                  {...register('username')}
                  autoComplete="username"
                  placeholder="Ingresa tu usuario"
                  className="field pl-11"
                />
              </div>
              {errors.username && (
                <p className="field-error">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  {errors.username.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-black mb-2">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Ingresa tu contraseña"
                  className="field pl-11 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-200 transition-colors"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="field-error">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* API error banner */}
            {apiError && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 flex items-start gap-2.5 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-rose-300">{apiError}</p>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Espera un momento estamos Verificando la Informacion...
                </>
              ) : (
                'Iniciar sesión'
              )}
            </button>

            <button
              type="button"
              onClick={async () => {
                setApiError(null)
                const username = getValues('username')
                if (!username) {
                  setApiError('Ingresa el usuario para autenticar con huella')
                  return
                }

                if (!('credentials' in navigator) || !navigator.credentials) {
                  setApiError('Tu navegador no soporta autenticación por huella (WebAuthn)')
                  return
                }

                try {
                  await webauthnLogin(username)
                } catch (err) {
                  const errMsg = err instanceof Error ? err.message : String(err)
                  setApiError(`Autenticación con huella falló: ${errMsg}`)
                }
              }}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 border border-white/10 bg-white/5 text-white py-2 rounded-xl"
            >
              Iniciar con huella
            </button>
          </form>
        </div>

        <p className="text-center text-white text-xs mt-6">
          © {new Date().getFullYear()} Parqueadero Residencial · Todos los derechos reservados
        </p>
      </div>
    </div>
  )
}
