import type { AxiosError } from 'axios'
import {
  Bell,
  FileSpreadsheet,
  Filter,
  MessageSquare,
  RefreshCw,
  Search,
  Settings2,
  Wallet,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { descargarPazYSalvo } from '../../api/propietarios'
import {
  enviarRecordatorioFinanciero,
  listarCartera,
} from '../../api/finanzas'
import type { ApiErrorBody, CarteraItemOut } from '../../types'

function formatCop(centavos: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(centavos / 100)
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function FinanzasCartera() {
  const [items, setItems] = useState<CarteraItemOut[]>([])
  const [allTorres, setAllTorres] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [torre, setTorre] = useState('')
  const [estado, setEstado] = useState('todos')
  const [saldoMin, setSaldoMin] = useState('')
  const [saldoMax, setSaldoMax] = useState('')
  const [search, setSearch] = useState('')

  const [busyUid, setBusyUid] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listarCartera({
        torre: torre.trim() || undefined,
        estado: estado === 'todos' ? 'todos' : estado,
        saldo_min: saldoMin.trim() ? Math.round(Number(saldoMin) * 100) : undefined,
        saldo_max: saldoMax.trim() ? Math.round(Number(saldoMax) * 100) : undefined,
      })
      setItems(data)
      if (!torre.trim() && estado === 'todos' && !saldoMin.trim() && !saldoMax.trim()) {
        setAllTorres(Array.from(new Set(data.map((i) => i.torre))).sort())
      }
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo cargar la cartera')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const torres = allTorres

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (i) =>
        i.nombre.toLowerCase().includes(q) ||
        i.apartamento.toLowerCase().includes(q) ||
        i.uid.toLowerCase().includes(q),
    )
  }, [items, search])

  const handlePazYSalvo = async (item: CarteraItemOut) => {
    setBusyUid(item.uid)
    setError(null)
    setNotice(null)
    try {
      const blob = await descargarPazYSalvo(item.uid)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `paz-y-salvo-${item.torre}-${item.apartamento}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setNotice(`Paz y salvo descargado: ${item.nombre}`)
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo generar el paz y salvo')
    } finally {
      setBusyUid(null)
    }
  }

  const handleRecordatorio = async (item: CarteraItemOut) => {
    setBusyUid(item.uid)
    setError(null)
    setNotice(null)
    try {
      await enviarRecordatorioFinanciero(item.uid)
      setNotice(`Recordatorio enviado a ${item.nombre}`)
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo enviar el recordatorio')
    } finally {
      setBusyUid(null)
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="page-header flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-500 flex items-center justify-center shadow-brand">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <h1 className="page-title">Cartera por apartamento</h1>
          </div>
          <p className="page-subtitle pl-12">
            Saldos, vencimientos y acciones rápidas de administración financiera.
          </p>
        </div>
        <Link to="/admin/finanzas/config" className="btn-secondary">
          <Settings2 className="w-4 h-4" />
          Configuración
        </Link>
      </div>

      {error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      <div className="card-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Filter className="w-4 h-4 text-teal-600" />
          Filtros
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="field-label">Buscar</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="field pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, apto, UID…"
              />
            </div>
          </div>
          <div>
            <label className="field-label">Torre</label>
            <select className="field" value={torre} onChange={(e) => setTorre(e.target.value)}>
              <option value="">Todas</option>
              {torres.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Estado</label>
            <select className="field" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="al_dia">Al día</option>
              <option value="en_mora">En mora</option>
            </select>
          </div>
          <div>
            <label className="field-label">Saldo mín. (COP)</label>
            <input
              className="field"
              type="number"
              min={0}
              value={saldoMin}
              onChange={(e) => setSaldoMin(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <label className="field-label">Saldo máx. (COP)</label>
            <input
              className="field"
              type="number"
              min={0}
              value={saldoMax}
              onChange={(e) => setSaldoMax(e.target.value)}
              placeholder="Sin límite"
            />
          </div>
        </div>
        <button type="button" onClick={() => { void load() }} className="btn-primary" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Aplicar filtros
        </button>
      </div>

      <div className="card-lg overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400 text-sm">Cargando cartera…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No hay registros con esos filtros.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-surface-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Apartamento</th>
                  <th className="px-4 py-3 font-semibold">Propietario</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold text-right">Saldo</th>
                  <th className="px-4 py-3 font-semibold">Último pago</th>
                  <th className="px-4 py-3 font-semibold">Próx. vencimiento</th>
                  <th className="px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.uid} className="border-b border-surface-100 hover:bg-surface-50/80">
                    <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                      T{item.torre} · {item.apartamento}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{item.nombre}</p>
                      <p className="text-xs text-slate-400 font-mono">{item.uid}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full border ${
                          item.estado_cuenta === 'al_dia'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {item.estado_cuenta === 'al_dia' ? 'Al día' : 'En mora'}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${
                      item.saldo_centavos > 0 ? 'text-rose-600' : 'text-emerald-700'
                    }`}>
                      {formatCop(item.saldo_centavos)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(item.ultimo_pago)}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(item.proximo_vencimiento)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          to={`/admin/finanzas/propietarios/${item.uid}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100"
                        >
                          Estado
                        </Link>
                        <Link
                          to={`/admin/finanzas/propietarios/${item.uid}?pago=1`}
                          className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                        >
                          Pago
                        </Link>
                        <button
                          type="button"
                          disabled={busyUid === item.uid || item.estado_cuenta !== 'al_dia'}
                          onClick={() => { void handlePazYSalvo(item) }}
                          title={item.estado_cuenta === 'al_dia' ? 'Paz y salvo' : 'Solo si está al día'}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                        >
                          <FileSpreadsheet className="w-3 h-3" />
                          Paz
                        </button>
                        <button
                          type="button"
                          disabled={busyUid === item.uid || !item.telegram_chat_id}
                          onClick={() => { void handleRecordatorio(item) }}
                          title={item.telegram_chat_id ? 'Recordatorio Telegram' : 'Sin Telegram'}
                          className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-40"
                        >
                          {item.telegram_chat_id ? <Bell className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                          Aviso
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
