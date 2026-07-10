import { AlertTriangle, CheckCircle2, Fingerprint, Loader2, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function RegisterFingerprint() {
  const { user, webauthnRegister } = useAuth()
  const [status, setStatus]   = useState<Status>('idle')
  const [message, setMessage] = useState('')

  if (!user) return null

  const handleRegister = async () => {
    setStatus('loading')
    setMessage('')
    try {
      await webauthnRegister(user.username)
      setStatus('success')
      setMessage('¡Huella registrada! Ya puedes iniciar sesión con tu huella dactilar.')
    } catch (err: any) {
      setStatus('error')
      const raw = err?.response?.data?.detail ?? err?.message ?? 'Error desconocido'
      setMessage(typeof raw === 'string' ? raw : JSON.stringify(raw))
    }
  }

  return (
    <div className="max-w-md mx-auto animate-slide-up">
      <div className="card-lg overflow-hidden">

        {/* Hero gradient header */}
        <div className="bg-gradient-premium px-6 py-10 text-white text-center relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-brand-400/15 rounded-full blur-2xl pointer-events-none" />

          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="w-20 h-20 rounded-3xl bg-white/15 border border-white/25 backdrop-blur
                            flex items-center justify-center shadow-glow">
              <Fingerprint className="w-10 h-10 text-white" />
            </div>
            {status === 'success' && (
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 rounded-full
                              flex items-center justify-center border-2 border-white shadow-lg animate-scale-in">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
            )}
          </div>

          <h1 className="text-xl font-extrabold tracking-tight">Registrar Huella Digital</h1>
          <p className="mt-1.5 text-white/65 text-sm">
            Usuario: <span className="font-semibold text-white">{user.username}</span>
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-7 space-y-5">

          {/* Steps */}
          <div className="space-y-3">
            {[
              'Haz clic en Registrar huella',
              'Tu dispositivo pedirá autenticación biométrica',
              'Confirma cuando el sistema lo solicite',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center
                                text-xs font-extrabold shrink-0 mt-0.5 border border-brand-200">
                  {i + 1}
                </div>
                <p className="text-sm text-slate-600 leading-snug">{step}</p>
              </div>
            ))}
          </div>

          {/* Feedback */}
          {status === 'success' && (
            <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3.5 animate-fade-in">
              <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-800 font-medium">{message}</p>
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-start gap-3 rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3.5 animate-fade-in">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-700">{message}</p>
            </div>
          )}

          {/* Action */}
          <button
            onClick={handleRegister}
            disabled={status === 'loading' || status === 'success'}
            className="btn-primary w-full py-3.5 text-base"
          >
            {status === 'loading' ? (
              <><Loader2 className="w-5 h-5 animate-spin" />Esperando autenticación…</>
            ) : status === 'success' ? (
              <><CheckCircle2 className="w-5 h-5" />Registrada correctamente</>
            ) : (
              <><Fingerprint className="w-5 h-5" />Registrar huella</>
            )}
          </button>

          {status === 'success' && (
            <p className="text-xs text-slate-400 text-center">
              La próxima vez podrás iniciar sesión usando "Iniciar con huella" en el login.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
