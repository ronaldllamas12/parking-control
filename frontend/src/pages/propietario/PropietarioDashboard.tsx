import type { AxiosError } from 'axios'
import {
  CalendarDays,
  CreditCard,
  ExternalLink,
  FileImage,
  Home,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldCheck,
  Upload,
  Wallet,
} from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  enviarComprobantePago,
  enviarMensajeAdmin,
  listarComprobantesPropietario,
  obtenerDashboardPropietario,
} from '../../api/propietarioDashboard'
import type { ApiErrorBody, ComprobantePagoOut, PropietarioDashboardOut } from '../../types'

function money(centavos?: number | null): string {
  return `$${Math.round((centavos ?? 0) / 100).toLocaleString('es-CO')} COP`
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

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [dash, proofs] = await Promise.all([
        obtenerDashboardPropietario(),
        listarComprobantesPropietario(),
      ])
      setDashboard(dash)
      setComprobantes(proofs)
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
      await enviarMensajeAdmin(message.trim())
      setMessage('')
      setNotice('Mensaje enviado a administración')
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo enviar el mensaje')
    } finally {
      setSavingMessage(false)
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
          <button onClick={() => { void load() }} className="btn-icon bg-white/10 border-white/20 hover:bg-white/20" aria-label="Actualizar">
            <RefreshCw className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <form onSubmit={(e) => { void handleMessage(e) }} className="card-lg p-5 space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
              <MessageSquare className="h-5 w-5 text-blue-600" />Mensaje a admin
            </h2>
            <textarea
              className="field min-h-28 resize-none"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe tu solicitud o novedad..."
            />
            <button type="submit" disabled={savingMessage || !message.trim()} className="btn-primary w-full">
              {savingMessage ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Send className="h-4 w-4" />}
              Enviar mensaje
            </button>
          </form>

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
