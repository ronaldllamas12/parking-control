import type { AxiosError } from 'axios'
import {
    CalendarDays,
    CreditCard,
    Download,
    ExternalLink,
    FileImage,
    Home,
    MessageSquare,
    QrCode,
    RefreshCw,
    Send,
    ShieldCheck,
    Upload,
    Wallet,
    Waves,
} from 'lucide-react'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
    enviarComprobantePago,
    enviarMensajeAdmin,
    listarComprobantesPropietario,
    obtenerDashboardPropietario,
    obtenerMensajesConversacion,
} from '../../api/propietarioDashboard'
import type { ApiErrorBody, ComprobantePagoOut, PropietarioDashboardOut, TelegramMessageOut } from '../../types'
import { createOwnerQrDataUrl, qrFileName } from '../../utils/qrDownload'

function money(centavos?: number | null): string {
  return `$${Math.round((centavos ?? 0) / 100).toLocaleString('es-CO')} COP`
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
}

function imageUrlsFromText(text: string): string[] {
  const urls = text.match(/https?:\/\/[^\s]+/g) ?? []
  return urls
    .map((url) => url.replace(/[),.;]+$/, ''))
    .filter((url) => /res\.cloudinary\.com|\/image\/upload\/|\.(png|jpe?g|webp|gif)(\?|$)/i.test(url))
}

function textWithoutImageUrls(text: string, imageUrls: string[]): string {
  let cleaned = text
  for (const url of imageUrls) {
    cleaned = cleaned.replace(url, '').replace('Imagen:', '')
  }
  return cleaned.split('\n').map((l) => l.trim()).filter(Boolean).join('\n')
}

function dateLabel(value?: string | null): string {
  if (!value) return 'Sin registro'
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function PropietarioDashboard() {
  const [dashboard, setDashboard] = useState<PropietarioDashboardOut | null>(null)
  const [comprobantes, setComprobantes] = useState<ComprobantePagoOut[]>([])
  const [conversationMessages, setConversationMessages] = useState<TelegramMessageOut[]>([])
  const [loading, setLoading] = useState(true)
  const [savingMessage, setSavingMessage] = useState(false)
  const [savingProof, setSavingProof] = useState(false)
  const [message, setMessage] = useState('')
  const [proofMessage, setProofMessage] = useState('')
  const [reference, setReference] = useState('')
  const [amountCop, setAmountCop] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloadingQr, setDownloadingQr] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [dash, proofs, msgs] = await Promise.all([
        obtenerDashboardPropietario(),
        listarComprobantesPropietario(),
        obtenerMensajesConversacion(),
      ])
      setDashboard(dash)
      setComprobantes(proofs)
      setConversationMessages(msgs)
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo cargar el dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversationMessages])

  const saldo = dashboard?.estado_cuenta.saldo_centavos ?? 0
  const cargos = useMemo(
    () => dashboard?.estado_cuenta.movimientos.filter((m) => m.tipo === 'cargo') ?? [],
    [dashboard],
  )
  const abonos = useMemo(
    () => dashboard?.estado_cuenta.movimientos.filter((m) => m.tipo === 'abono') ?? [],
    [dashboard],
  )

  const handleMessage = async (event: FormEvent) => {
    event.preventDefault()
    if (!message.trim()) return
    setSavingMessage(true)
    setNotice(null)
    setError(null)
    try {
      const sent = await enviarMensajeAdmin(message.trim())
      setConversationMessages((prev) => [...prev, sent])
      setMessage('')
      setNotice('Mensaje enviado a administración')
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo enviar el mensaje')
    } finally {
      setSavingMessage(false)
    }
  }

  const handleDownloadQr = async () => {
    if (!dashboard) return
    setDownloadingQr(true)
    try {
      const { propietario: p } = dashboard
      const qrDataUrl = await createOwnerQrDataUrl(p.uid, p.nombre)
      const anchor = document.createElement('a')
      anchor.href = qrDataUrl
      anchor.download = qrFileName(p.nombre, p.uid)
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
    } catch {
      setError('No se pudo generar el código QR')
    } finally {
      setDownloadingQr(false)
    }
  }

  const handleProof = async (event: FormEvent) => {
    event.preventDefault()
    if (!file) {
      setError('Adjunta una imagen del comprobante')
      return
    }
    const amount = amountCop ? Math.round(Number(amountCop) * 100) : undefined
    if (amountCop && (amount === undefined || !Number.isFinite(amount) || amount <= 0)) {
      setError('Monto inválido')
      return
    }
    setSavingProof(true)
    setNotice(null)
    setError(null)
    try {
      const proof = await enviarComprobantePago({
        imagen: file,
        mensaje: proofMessage.trim() || undefined,
        referencia: reference.trim() || undefined,
        monto_centavos: amount,
      })
      setComprobantes((items) => [proof, ...items])
      setFile(null)
      setProofMessage('')
      setReference('')
      setAmountCop('')
      setNotice('Comprobante enviado para revisión')
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo enviar el comprobante')
    } finally {
      setSavingProof(false)
    }
  }

  if (loading) {
    return <div className="p-10 text-center text-slate-400 text-sm">Cargando dashboard...</div>
  }

  if (!dashboard) {
    return <div className="card-lg p-8 text-center text-rose-600 text-sm">{error ?? 'Sin datos'}</div>
  }

  const propietario = dashboard.propietario

  return (
    <div className="animate-fade-in space-y-6">
      <div className="rounded-3xl bg-gradient-dark p-5 sm:p-6 text-white shadow-float">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/55">Mi cuenta</p>
            <h1 className="mt-1 text-2xl font-extrabold">{propietario.nombre}</h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-white/65">
              <Home className="h-4 w-4" />
              Torre {propietario.torre} · Apartamento {propietario.apartamento}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { void handleDownloadQr() }}
              disabled={downloadingQr}
              className="btn-icon bg-white/10 border-white/20 hover:bg-white/20"
              title="Descargar mi código QR"
              aria-label="Descargar QR"
            >
              {downloadingQr
                ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                : <QrCode className="h-4 w-4 text-white" />}
            </button>
            <button onClick={() => { void load() }} className="btn-icon bg-white/10 border-white/20 hover:bg-white/20" aria-label="Actualizar">
              <RefreshCw className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="stat-card">
          <div className="stat-icon bg-blue-100 text-blue-700"><Wallet className="h-5 w-5" /></div>
          <div>
            <p className="text-xs text-slate-500">Saldo pendiente</p>
            <p className={`text-lg font-extrabold ${saldo > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{money(saldo)}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-emerald-100 text-emerald-700"><ShieldCheck className="h-5 w-5" /></div>
          <div>
            <p className="text-xs text-slate-500">Estado</p>
            <p className="text-lg font-extrabold text-slate-900">{dashboard.estado_cuenta.estado_cuenta === 'al_dia' ? 'Al día' : 'En mora'}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className={`stat-icon ${propietario.amenidades_suspendidas ? 'bg-orange-100 text-orange-700' : 'bg-teal-100 text-teal-700'}`}>
            <Waves className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Amenidades</p>
            <p className={`text-lg font-extrabold ${propietario.amenidades_suspendidas ? 'text-orange-700' : 'text-teal-700'}`}>
              {propietario.amenidades_suspendidas ? 'Suspendidas' : 'Habilitadas'}
            </p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-amber-100 text-amber-700"><CalendarDays className="h-5 w-5" /></div>
          <div>
            <p className="text-xs text-slate-500">Próximo vencimiento</p>
            <p className="text-sm font-bold text-slate-900">{dateLabel(dashboard.proximo_vencimiento)}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-sky-100 text-sky-700"><CreditCard className="h-5 w-5" /></div>
          <div>
            <p className="text-xs text-slate-500">Último pago</p>
            <p className="text-sm font-bold text-slate-900">{dateLabel(dashboard.ultimo_pago)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <section className="card-lg p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Desglose de deuda</h2>
              <p className="text-xs text-slate-500">{cargos.length} cargos · {abonos.length} abonos</p>
            </div>
            {dashboard.payment_link_url ? (
              <a href={dashboard.payment_link_url} target="_blank" rel="noreferrer" className="btn-primary px-4 py-2 text-xs">
                <CreditCard className="h-4 w-4" />Pagar<ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <span className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400">
                Pago no configurado
              </span>
            )}
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3 text-left">Fecha</th>
                  <th className="px-3 py-3 text-left">Concepto</th>
                  <th className="px-3 py-3 text-right">Monto</th>
                  <th className="px-3 py-3 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dashboard.estado_cuenta.movimientos.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">Sin movimientos registrados</td></tr>
                ) : dashboard.estado_cuenta.movimientos.map((m) => (
                  <tr key={m.id} className="bg-white">
                    <td className="px-3 py-3 text-slate-500">{dateLabel(m.fecha)}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-800">{m.concepto_nombre ?? m.referencia ?? m.tipo}</p>
                      {m.notas && <p className="text-xs text-slate-400">{m.notas}</p>}
                    </td>
                    <td className={`px-3 py-3 text-right font-bold ${m.tipo === 'abono' ? 'text-emerald-700' : 'text-slate-800'}`}>
                      {m.tipo === 'abono' ? '-' : ''}{money(m.monto_centavos)}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-slate-900">{money(m.saldo_acumulado_centavos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <div className="card-lg p-5 space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
              <MessageSquare className="h-5 w-5 text-blue-600" />Mensajes con administración
            </h2>
            <div className="max-h-72 overflow-y-auto space-y-2 rounded-2xl bg-slate-50 p-3">
              {conversationMessages.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-400">No hay mensajes aún. Escribe el primero.</p>
              ) : (
                conversationMessages.map((msg) => {
                  const imgs = imageUrlsFromText(msg.text)
                  const cleanText = imgs.length > 0 ? textWithoutImageUrls(msg.text, imgs) : msg.text
                  return (
                    <div key={msg.id} className={`flex ${msg.sender_role === 'propietario' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        msg.sender_role === 'propietario'
                          ? 'bg-blue-600 text-white'
                          : 'border border-slate-200 bg-white text-slate-800'
                      }`}>
                        {msg.sender_role !== 'propietario' && (
                          <p className="mb-1 text-[10px] font-bold text-blue-600">Administración</p>
                        )}
                        {cleanText ? <p className="whitespace-pre-wrap break-words">{cleanText}</p> : null}
                        {imgs.map((url) => (
                          <a key={url} href={url} target="_blank" rel="noreferrer" className="mt-1.5 block">
                            <img
                              src={url}
                              alt="Imagen adjunta"
                              className="max-h-48 w-full rounded-xl object-cover border border-white/20"
                            />
                            <span className="mt-0.5 flex items-center gap-1 text-[10px] opacity-70">
                              <Download className="h-3 w-3" />Ver imagen completa
                            </span>
                          </a>
                        ))}
                        <p className={`mt-1 text-[10px] ${msg.sender_role === 'propietario' ? 'text-blue-200' : 'text-slate-400'}`}>
                          {formatDateTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={(e) => { void handleMessage(e) }} className="space-y-3">
              <textarea
                className="field min-h-20 resize-none"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escribe tu solicitud o novedad..."
              />
              <button type="submit" disabled={savingMessage || !message.trim()} className="btn-primary w-full">
                {savingMessage ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Send className="h-4 w-4" />}
                Enviar mensaje
              </button>
            </form>
          </div>

          <form onSubmit={(e) => { void handleProof(e) }} className="card-lg p-5 space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
              <FileImage className="h-5 w-5 text-blue-600" />Comprobante
            </h2>
            <input className="field" placeholder="Referencia de pago" value={reference} onChange={(e) => setReference(e.target.value)} />
            <input className="field" type="number" min={0} step={1} placeholder="Monto pagado COP" value={amountCop} onChange={(e) => setAmountCop(e.target.value)} />
            <textarea className="field min-h-20 resize-none" placeholder="Mensaje opcional" value={proofMessage} onChange={(e) => setProofMessage(e.target.value)} />
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-blue-300 bg-blue-50 px-4 py-4 text-sm font-semibold text-blue-700 hover:bg-blue-100">
              <Upload className="h-4 w-4" />
              {file ? file.name : 'Adjuntar imagen del pago'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <button type="submit" disabled={savingProof || !file} className="btn-primary w-full">
              {savingProof ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Upload className="h-4 w-4" />}
              Enviar comprobante
            </button>
          </form>
        </div>
      </div>

      <section className="card-lg p-5">
        <h2 className="mb-4 text-lg font-extrabold text-slate-900">Comprobantes enviados</h2>
        {comprobantes.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">Aún no has enviado comprobantes.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {comprobantes.map((proof) => (
              <a key={proof.id} href={proof.imagen_url} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-200 bg-white p-3 hover:border-blue-300">
                <img src={proof.imagen_url} alt="Comprobante de pago" className="h-36 w-full rounded-xl object-cover" />
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-700">{proof.referencia ?? `Comprobante #${proof.id}`}</p>
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold uppercase text-blue-700">{proof.estado}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{new Date(proof.created_at).toLocaleString('es-CO')}</p>
                {proof.monto_centavos ? <p className="mt-1 text-sm font-bold text-slate-900">{money(proof.monto_centavos)}</p> : null}
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
