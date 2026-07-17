import type { AxiosError } from 'axios'
import { Check, Copy, ExternalLink, Loader2, RefreshCw, X } from 'lucide-react'
import QRCode from 'qrcode'
import { useCallback, useEffect, useRef, useState } from 'react'
import { generarEnlaceTelegram, obtenerPropietario } from '../api/telegram'
import type { ApiErrorBody, PropietarioOut, TelegramLinkOut } from '../types'

interface Props {
  item: PropietarioOut
  onClose: () => void
  onLinked: (updated: PropietarioOut) => void
}

type Step = 'generating' | 'ready' | 'linked' | 'error'

const POLL_INTERVAL_MS = 3_000

export default function TelegramLinkModal({ item, onClose, onLinked }: Props) {
  const [step, setStep] = useState<Step>('generating')
  const [linkData, setLinkData] = useState<TelegramLinkOut | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Generate / regenerate link ──────────────────────────────────────────────
  const generate = useCallback(async () => {
    setStep('generating')
    setError(null)
    setLinkData(null)
    setQrDataUrl(null)
    try {
      const data = await generarEnlaceTelegram(item.uid)
      const qr = await QRCode.toDataURL(data.link, {
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#0f172a', light: '#ffffff' },
      })
      setLinkData(data)
      setQrDataUrl(qr)
      setStep(item.telegram_linked_at ? 'linked' : 'ready')
    } catch (e) {
      const axErr = e as AxiosError<ApiErrorBody>
      setError(axErr.response?.data?.detail ?? 'No se pudo generar el enlace')
      setStep('error')
    }
  }, [item.uid, item.telegram_linked_at])

  // Run on mount
  useEffect(() => { void generate() }, [generate])

  // ── Poll for linked status ─────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'ready') return
    pollRef.current = setInterval(async () => {
      try {
        const updated = await obtenerPropietario(item.uid)
        if (updated.telegram_linked_at) {
          clearInterval(pollRef.current!)
          onLinked(updated)
          setStep('linked')
        }
      } catch {
        // silently ignore poll errors
      }
    }, POLL_INTERVAL_MS)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [step, item.uid, onLinked])

  // ── Copy to clipboard ──────────────────────────────────────────────────────
  const handleCopy = async () => {
    if (!linkData?.link) return
    await navigator.clipboard.writeText(linkData.link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const isLinked = !!item.telegram_linked_at || step === 'linked'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
      <div className="card-lg w-full max-w-sm animate-scale-in overflow-hidden">

        {/* Header */}
        <div
          className={`px-5 py-4 flex items-center justify-between ${
            isLinked ? 'bg-gradient-to-r from-emerald-600 to-teal-500' : 'bg-gradient-premium'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-xl">✈️</span>
            <h2 className="text-white font-bold text-base">Vincular Telegram</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Propietario info */}
          <div className="flex items-center gap-3 p-3 bg-surface-50 rounded-2xl border border-surface-200">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm text-slate-800 truncate">{item.nombre}</p>
              <p className="text-xs text-slate-500">Torre {item.torre} · Apto {item.apartamento}</p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                isLinked
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isLinked ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              {isLinked ? 'Vinculado' : 'No vinculado'}
            </span>
          </div>

          {/* ── Generating ── */}
          {step === 'generating' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
              <p className="text-sm text-slate-500">Generando enlace…</p>
            </div>
          )}

          {/* ── Error ── */}
          {step === 'error' && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700">
              {error}
            </div>
          )}

          {/* ── Ready / Linked ── */}
          {(step === 'ready' || step === 'linked') && linkData && (
            <>
              {/* Already-linked notice */}
              {isLinked && item.telegram_linked_at && (
                <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Vinculado el{' '}
                    {new Date(item.telegram_linked_at).toLocaleDateString('es-CO', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </span>
                </div>
              )}

              {/* Waiting notice */}
              {step === 'ready' && (
                <div className="flex items-center gap-2 rounded-2xl bg-sky-50 border border-sky-200 px-4 py-3 text-xs text-sky-700">
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse flex-shrink-0" />
                  Esperando que el propietario escanee el QR…
                </div>
              )}

              {/* QR code */}
              {qrDataUrl && (
                <div className="flex justify-center">
                  <div className="p-3 bg-white rounded-2xl border border-surface-200 shadow-card">
                    <img src={qrDataUrl} alt="QR Telegram" className="w-52 h-52 rounded-xl" />
                  </div>
                </div>
              )}

              {/* Link + copy */}
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 bg-surface-50 border border-surface-200 rounded-2xl px-3 py-2">
                  <p className="text-xs text-slate-500 truncate">{linkData.link}</p>
                </div>
                <button
                  onClick={() => { void handleCopy() }}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
                    copied
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-surface-100 hover:bg-surface-200 text-slate-500'
                  }`}
                  title="Copiar enlace"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
                <a
                  href={linkData.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-600 flex items-center justify-center transition-colors flex-shrink-0"
                  title="Abrir en Telegram"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              <p className="text-xs text-slate-400 text-center">
                Comparte este QR con el propietario · válido por 48 h
              </p>
            </>
          )}

          {/* Footer buttons */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="btn-cancel flex-1">
              Cerrar
            </button>
            {step !== 'generating' && (
              <button
                onClick={() => { void generate() }}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerar enlace
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
