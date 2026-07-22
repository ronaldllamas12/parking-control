import type { AxiosError } from 'axios'
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Plus,
  Send,
  Wallet,
  X,
} from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  crearMovimientoCartera,
  exportarEstadoCuentaExcel,
  exportarEstadoCuentaPdf,
  listarConceptos,
  obtenerEstadoCuenta,
} from '../../api/finanzas'
import type {
  ApiErrorBody,
  ConceptoMovimientoOut,
  EstadoCuentaOut,
  MovimientoCarteraCreate,
} from '../../types'

function formatCop(centavos: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(centavos / 100)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function MovimientoModal({
  uid,
  initialTipo,
  onClose,
  onSaved,
}: {
  uid: string
  initialTipo: 'cargo' | 'abono'
  onClose: () => void
  onSaved: (cuenta: EstadoCuentaOut) => void
}) {
  const [tipo, setTipo] = useState<'cargo' | 'abono'>(initialTipo)
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(todayIso())
  const [conceptoId, setConceptoId] = useState<number | ''>('')
  const [referencia, setReferencia] = useState('')
  const [notas, setNotas] = useState('')
  const [conceptos, setConceptos] = useState<ConceptoMovimientoOut[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void listarConceptos(tipo).then(setConceptos).catch(() => setConceptos([]))
    setConceptoId('')
  }, [tipo])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const valor = Number(monto)
    if (!Number.isFinite(valor) || valor <= 0) {
      setError('Ingresa un monto válido mayor a 0')
      return
    }
    setSaving(true)
    setError(null)
    const payload: MovimientoCarteraCreate = {
      tipo,
      monto_centavos: Math.round(valor * 100),
      fecha,
      concepto_id: conceptoId === '' ? null : conceptoId,
      referencia: referencia.trim() || null,
      notas: notas.trim() || null,
    }
    try {
      const cuenta = await crearMovimientoCartera(uid, payload)
      onSaved(cuenta)
      onClose()
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo registrar el movimiento')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
      <div className="card-lg w-full max-w-md animate-scale-in overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between bg-gradient-to-r from-teal-600 to-emerald-500">
          <h2 className="text-white font-bold text-base">Registrar movimiento</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={(e) => { void handleSubmit(e) }} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTipo('abono')}
              className={`rounded-xl px-3 py-2 text-sm font-bold border ${
                tipo === 'abono'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white border-surface-200 text-slate-500'
              }`}
            >
              Abono / Pago
            </button>
            <button
              type="button"
              onClick={() => setTipo('cargo')}
              className={`rounded-xl px-3 py-2 text-sm font-bold border ${
                tipo === 'cargo'
                  ? 'bg-rose-50 border-rose-300 text-rose-700'
                  : 'bg-white border-surface-200 text-slate-500'
              }`}
            >
              Cargo
            </button>
          </div>
          <div>
            <label className="field-label">Monto (COP)</label>
            <input
              className="field"
              type="number"
              min={1}
              step={1}
              required
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="150000"
            />
          </div>
          <div>
            <label className="field-label">Fecha</label>
            <input
              className="field"
              type="date"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Concepto</label>
            <select
              className="field"
              value={conceptoId}
              onChange={(e) => setConceptoId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Sin concepto</option>
              {conceptos.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Referencia</label>
            <input
              className="field"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Recibo, transferencia…"
              maxLength={120}
            />
          </div>
          <div>
            <label className="field-label">Notas</label>
            <textarea
              className="field min-h-[72px]"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              maxLength={500}
            />
          </div>
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={saving} className="btn-cancel flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center bg-teal-600 hover:bg-teal-700">
              {saving
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Send className="w-4 h-4" />}
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function FinanzasEstadoCuenta() {
  const { uid = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [cuenta, setCuenta] = useState<EstadoCuentaOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [modalTipo, setModalTipo] = useState<'cargo' | 'abono'>('abono')

  const load = async () => {
    if (!uid) return
    setLoading(true)
    setError(null)
    try {
      setCuenta(await obtenerEstadoCuenta(uid))
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo cargar el estado de cuenta')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [uid])

  useEffect(() => {
    if (searchParams.get('pago') === '1') {
      setModalTipo('abono')
      setShowModal(true)
      searchParams.delete('pago')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const handleExport = async (kind: 'pdf' | 'xlsx') => {
    if (!uid) return
    setExporting(kind)
    setError(null)
    try {
      if (kind === 'pdf') await exportarEstadoCuentaPdf(uid)
      else await exportarEstadoCuentaExcel(uid)
      setNotice(`Exportación ${kind.toUpperCase()} lista`)
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo exportar')
    } finally {
      setExporting(null)
    }
  }

  if (loading) {
    return <div className="p-10 text-center text-slate-400 text-sm">Cargando estado de cuenta…</div>
  }

  if (!cuenta) {
    return (
      <div className="space-y-4">
        <Link to="/admin/finanzas/cartera" className="btn-secondary inline-flex">
          <ArrowLeft className="w-4 h-4" /> Volver a cartera
        </Link>
        <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {error ?? 'Propietario no encontrado'}
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/finanzas/cartera" className="btn-secondary">
          <ArrowLeft className="w-4 h-4" /> Cartera
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            disabled={!!exporting}
            onClick={() => { void handleExport('pdf') }}
          >
            <Download className="w-4 h-4" />
            {exporting === 'pdf' ? 'PDF…' : 'PDF'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={!!exporting}
            onClick={() => { void handleExport('xlsx') }}
          >
            <FileSpreadsheet className="w-4 h-4" />
            {exporting === 'xlsx' ? 'Excel…' : 'Excel'}
          </button>
          <button
            type="button"
            className="btn-primary bg-teal-600 hover:bg-teal-700"
            onClick={() => { setModalTipo('abono'); setShowModal(true) }}
          >
            <Plus className="w-4 h-4" />
            Registrar pago
          </button>
        </div>
      </div>

      <div className="page-header">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-500 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <h1 className="page-title">Estado de cuenta</h1>
        </div>
        <p className="page-subtitle pl-12">
          {cuenta.nombre} · Torre {cuenta.torre} · Apto {cuenta.apartamento}
        </p>
      </div>

      {error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}
      {notice && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">{notice}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card-lg p-4">
          <p className="text-xs text-slate-400 font-medium mb-1">Saldo</p>
          <p className={`text-2xl font-extrabold tabular-nums ${
            cuenta.saldo_centavos > 0 ? 'text-rose-600' : 'text-emerald-700'
          }`}>
            {formatCop(cuenta.saldo_centavos)}
          </p>
        </div>
        <div className="card-lg p-4">
          <p className="text-xs text-slate-400 font-medium mb-1">Estado</p>
          <p className="text-lg font-bold text-slate-800">
            {cuenta.estado_cuenta === 'al_dia' ? 'Al día' : 'En mora'}
          </p>
        </div>
        <div className="card-lg p-4">
          <p className="text-xs text-slate-400 font-medium mb-1">Movimientos</p>
          <p className="text-lg font-bold text-slate-800">{cuenta.movimientos.length}</p>
        </div>
      </div>

      <div className="card-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-200 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-sm">Movimientos</h2>
          <button
            type="button"
            className="text-xs font-semibold text-teal-700 hover:underline"
            onClick={() => { setModalTipo('cargo'); setShowModal(true) }}
          >
            + Cargo
          </button>
        </div>
        {cuenta.movimientos.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">Sin movimientos registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">Fecha</th>
                  <th className="px-4 py-2.5 font-semibold">Tipo</th>
                  <th className="px-4 py-2.5 font-semibold">Concepto</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Monto</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Saldo acum.</th>
                </tr>
              </thead>
              <tbody>
                {cuenta.movimientos.map((m) => (
                  <tr key={m.id} className="border-t border-surface-100">
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{m.fecha}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        m.tipo === 'abono'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}>
                        {m.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {m.concepto_nombre || m.referencia || '—'}
                      {m.notas && <p className="text-xs text-slate-400">{m.notas}</p>}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                      m.tipo === 'abono' ? 'text-emerald-700' : 'text-rose-600'
                    }`}>
                      {m.tipo === 'abono' ? '−' : '+'}{formatCop(m.monto_centavos)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold tabular-nums text-slate-800">
                      {formatCop(m.saldo_acumulado_centavos)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <MovimientoModal
          uid={cuenta.uid}
          initialTipo={modalTipo}
          onClose={() => setShowModal(false)}
          onSaved={(updated) => {
            setCuenta(updated)
            setNotice('Movimiento registrado')
          }}
        />
      )}
    </div>
  )
}
