import { AlertTriangle, Fingerprint, Loader2, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function RegisterFingerprint() {
  const { user, webauthnRegister } = useAuth()
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  if (!user) return null

  const handleRegister = async () => {
    setStatus('loading')
    setMessage('')
    try {
      await webauthnRegister(user.username)
      setStatus('success')
      setMessage('¡Huella registrada correctamente! Ya puedes iniciar sesión con tu huella dactilar.')
    } catch (err: any) {
      setStatus('error')
      const raw = err?.response?.data?.detail ?? err?.message ?? 'Error desconocido'
      setMessage(typeof raw === 'string' ? raw : JSON.stringify(raw))
    }
  }

  return (
    <div className="max-w-md mx-auto">
      {/* Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-8 text-white">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              <Fingerprint className="w-9 h-9 text-white" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-center">Registrar Huella Digital</h1>
          <p className="mt-1 text-sm text-white/80 text-center">
            Vincula tu huella al usuario <strong>{user.username}</strong>
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-8 space-y-5">
          {/* Instructions */}
          <ul className="text-sm text-slate-600 space-y-2">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">1</span>
              Haz clic en <strong>Registrar huella</strong>.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">2</span>
              Tu dispositivo pedirá autenticación biométrica (huella, rostro o PIN).
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">3</span>
              Confirma cuando el sistema lo solicite.
            </li>
          </ul>

          {/* Status feedback */}
          {status === 'success' && (
            <div className="flex items-start gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
              <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-start gap-3 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          {/* Action */}
          <button
            onClick={handleRegister}
            disabled={status === 'loading' || status === 'success'}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 text-sm transition-colors duration-200"
          >
            {status === 'loading' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Esperando autenticación…
              </>
            ) : status === 'success' ? (
              <>
                <ShieldCheck className="w-4 h-4" />
                Registrada
              </>
            ) : (
              <>
                <Fingerprint className="w-4 h-4" />
                Registrar huella
              </>
            )}
          </button>

          {status === 'success' && (
            <p className="text-xs text-slate-500 text-center">
              Puedes volver al inicio de sesión y usar tu huella la próxima vez.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
