import type { AxiosError } from 'axios'
import { Send, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ApiErrorBody } from '../types'

const MAX_MESSAGE_LENGTH = 1000

interface Props {
  nombre: string
  uid: string
  torre?: string
  apartamento?: string
  defaultMessage: string
  onClose: () => void
  onSend: (mensaje: string) => Promise<void>
}

export default function TelegramNotifyModal({
  nombre,
  uid,
  torre,
  apartamento,
  defaultMessage,
  onClose,
  onSend,
}: Props) {
  const [mensaje, setMensaje] = useState(defaultMessage)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
    textareaRef.current?.setSelectionRange(defaultMessage.length, defaultMessage.length)
  }, [defaultMessage])

  const trimmed = mensaje.trim()
  const canSend = trimmed.length > 0 && !sending

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSend) return

    setSending(true)
    setError(null)
    try {
      await onSend(trimmed)
      onClose()
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo enviar la notificación')
    } finally {
      setSending(false)
    }
  }

  const locationLabel =
    torre && apartamento ? `Torre ${torre} · Apto ${apartamento}` : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
      <div className="card-lg w-full max-w-md animate-scale-in overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between bg-gradient-to-r from-teal-600 to-emerald-500">
          <div className="flex items-center gap-2.5">
            <Send className="w-4 h-4 text-white" />
            <h2 className="text-white font-bold text-base">Enviar por Telegram</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e) }} className="p-5 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-surface-50 rounded-2xl border border-surface-200">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm text-slate-800 truncate">{nombre}</p>
              {locationLabel && (
                <p className="text-xs text-slate-500">{locationLabel}</p>
              )}
              <p className="text-xs text-slate-400 font-mono mt-0.5">{uid}</p>
            </div>
          </div>

          <div>
            <label htmlFor="telegram-mensaje" className="field-label">
              Mensaje
            </label>
            <textarea
              id="telegram-mensaje"
              ref={textareaRef}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              rows={5}
              maxLength={MAX_MESSAGE_LENGTH}
              disabled={sending}
              className="w-full rounded-2xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-400 resize-y min-h-[120px] disabled:opacity-60"
              placeholder="Escribe el mensaje que quieres enviar al propietario…"
            />
            <p className="text-xs text-slate-400 text-right mt-1">
              {mensaje.length}/{MAX_MESSAGE_LENGTH}
            </p>
          </div>

          {error && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="btn-cancel flex-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSend}
              className="btn-primary flex-1 justify-center bg-teal-600 hover:bg-teal-700 disabled:opacity-50"
            >
              {sending
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Send className="w-4 h-4" />}
              Enviar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
