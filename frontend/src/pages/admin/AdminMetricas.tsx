import type { AxiosError } from 'axios'
import {
    AlertCircle,
    BarChart3,
    CheckCircle2,
    Clock,
    Fingerprint,
    Home,
    Plus,
    RefreshCw,
    ShieldCheck,
    Trash2,
    Users
} from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { obtenerMisMetricas } from '../../api/admin'
import { listarRegistrosAcceso } from '../../api/registrosAcceso'
import { type WebhookInfo } from '../../api/telegram'
import { actualizarZonaAcceso, crearZonaAcceso, eliminarZonaAcceso, listarZonasAcceso } from '../../api/zonas'
import type { ApiErrorBody, ConjuntoMetricas, RegistroAccesoOut, ZonaAcceso } from '../../types'

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminMetricas() {
  const [metricas, setMetricas] = useState<ConjuntoMetricas | null>(null)
  const [zonas, setZonas] = useState<ZonaAcceso[]>([])
  const [registros, setRegistros] = useState<RegistroAccesoOut[]>([])
  const [zonaNombre, setZonaNombre] = useState('')
  const [zonaUniversal, setZonaUniversal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingZona, setSavingZona] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Telegram webhook state ──────────────────────────────────────────────────
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null)
  const [webhookLoading, setWebhookLoading] = useState(false)
  const [webhookBaseUrl, setWebhookBaseUrl] = useState('')
  const [webhookSaving, setWebhookSaving] = useState(false)
  const [webhookMsg, setWebhookMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const loadMetricas = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await obtenerMisMetricas()
      const zonasData = await listarZonasAcceso()
      const registrosData = await listarRegistrosAcceso(100)
      setMetricas(data)
      setZonas(zonasData)
      setRegistros(registrosData)
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudieron cargar las métricas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMetricas()
  }, [])

  const handleCrearZona = async (event: FormEvent) => {
    event.preventDefault()
    const nombre = zonaNombre.trim()
    if (nombre.length < 3) {
      setError('El nombre de la zona debe tener al menos 3 caracteres')
      return
    }
    setSavingZona(true)
    setError(null)
    try {
      const created = await crearZonaAcceso(nombre, zonaUniversal)
      setZonas((prev) => [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setZonaNombre('')
      setZonaUniversal(false)
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo crear la zona')
    } finally {
      setSavingZona(false)
    }
  }

  const toggleZona = async (zona: ZonaAcceso) => {
    try {
      const updated = await actualizarZonaAcceso(zona.id, { activa: !zona.activa })
      setZonas((prev) => prev.map((item) => (item.id === zona.id ? updated : item)))
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo actualizar la zona')
    }
  }

  const toggleAccesoUniversal = async (zona: ZonaAcceso) => {
    try {
      const updated = await actualizarZonaAcceso(zona.id, { acceso_universal: !zona.acceso_universal })
      setZonas((prev) => prev.map((item) => (item.id === zona.id ? updated : item)))
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo actualizar el acceso universal')
    }
  }

  const deleteZona = async (zona: ZonaAcceso) => {
    const confirmed = window.confirm(`Eliminar la zona "${zona.nombre}"?`)
    if (!confirmed) return
    try {
      await eliminarZonaAcceso(zona.id)
      setZonas((prev) => prev.filter((item) => item.id !== zona.id))
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo eliminar la zona')
    }
  }

  if (loading && !metricas) {
    return (
      <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-soft">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Cargando métricas...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Admin</p>
          <h1 className="page-title">Métricas del conjunto</h1>
        </div>
        <button
          type="button"
          onClick={loadMetricas}
          disabled={loading}
          className="btn-secondary w-full px-4 py-2.5 text-xs sm:w-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {metricas && (
        <>
          <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-soft">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-extrabold text-slate-900">{metricas.conjunto.nombre}</h2>
              <p className="text-sm font-medium text-slate-500">
                {metricas.conjunto.direccion || 'Sin direccion registrada'}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-800">Zonas de acceso</h2>
                <p className="text-xs font-medium text-slate-500">Piscina, gimnasio, salón social u otras áreas.</p>
              </div>
              <span className="rounded-full bg-surface-100 px-3 py-1 text-xs font-bold text-slate-500">{zonas.length}</span>
            </div>

            <form onSubmit={handleCrearZona} className="mb-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={zonaNombre}
                onChange={(event) => setZonaNombre(event.target.value)}
                className="field flex-1"
                placeholder="Nombre de zona"
              />
              <label className="flex items-center gap-2 rounded-2xl border border-surface-200 px-3 py-2 text-xs font-bold text-slate-600">
                <input
                  type="checkbox"
                  checked={zonaUniversal}
                  onChange={(event) => setZonaUniversal(event.target.checked)}
                  className="h-4 w-4 accent-brand-600"
                />
                Universal
              </label>
              <button type="submit" disabled={savingZona} className="btn-primary px-4">
                <Plus className="h-4 w-4" />
                Crear
              </button>
            </form>

            <div className="divide-y divide-surface-100 rounded-2xl border border-surface-200">
              {zonas.length === 0 ? (
                <div className="p-4 text-sm font-medium text-slate-500">No hay zonas registradas.</div>
              ) : (
                zonas.map((zona) => (
                  <div key={zona.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{zona.nombre}</p>
                      <p className="text-xs font-medium text-slate-400">
                        {zona.activa ? 'Activa' : 'Inactiva'} · {zona.acceso_universal ? 'Acceso universal' : 'Valida mora y amenidades'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { void toggleAccesoUniversal(zona) }}
                        className={`rounded-xl px-3 py-2 text-xs font-bold ${zona.acceso_universal ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-500'}`}
                      >
                        {zona.acceso_universal ? 'Universal' : 'Restringida'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { void toggleZona(zona) }}
                        className={`rounded-xl px-3 py-2 text-xs font-bold ${zona.activa ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                      >
                        {zona.activa ? 'Activa' : 'Inactiva'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { void deleteZona(zona) }}
                        disabled={zona.nombre.toLowerCase() === 'parqueadero'}
                        className="rounded-xl border border-rose-200 p-2 text-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Eliminar zona"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Admins', value: metricas.admins, icon: Users },
              { label: 'Vigilantes', value: metricas.vigilantes, icon: ShieldCheck },
              { label: 'Propietarios', value: metricas.propietarios, icon: Home },
              { label: 'Accesos hoy', value: metricas.accesos_hoy, icon: Clock },
              { label: 'Accesos totales', value: metricas.accesos_totales, icon: BarChart3 },
              { label: 'Con acceso', value: metricas.propietarios_con_acceso, icon: CheckCircle2 },
              { label: 'Sin acceso', value: metricas.propietarios_sin_acceso, icon: AlertCircle },
              { label: 'Huellas', value: metricas.huellas_registradas, icon: Fingerprint },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-surface-200 bg-white p-4 shadow-soft">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-2xl font-extrabold text-slate-900">{value}</p>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-surface-200 bg-white shadow-soft">
            <div className="border-b border-surface-200 px-5 py-4">
              <h2 className="text-base font-extrabold text-slate-800">Últimos accesos</h2>
            </div>

            {metricas.ultimos_accesos.length === 0 ? (
              <div className="p-6 text-sm font-medium text-slate-500">
                Este conjunto todavía no tiene registros de acceso.
              </div>
            ) : (
              <div className="divide-y divide-surface-100">
                {metricas.ultimos_accesos.map((access) => (
                  <article key={`${access.uid}-${access.verificado_en}`} className="px-5 py-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold text-slate-800">{access.nombre}</p>
                        <p className="text-xs font-medium text-slate-500">
                          Torre {access.torre} · Apto {access.apartamento} · UID {access.uid}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-xs font-semibold text-slate-500">
                          {formatDateTime(access.verificado_en)}
                        </p>
                        <p className="text-xs font-medium text-slate-400">
                          {access.vigilante_username || 'Sin vigilante'}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-surface-200 bg-white shadow-soft">
            <div className="border-b border-surface-200 px-5 py-4">
              <h2 className="text-base font-extrabold text-slate-800">Historial detallado de intentos</h2>
            </div>

            {registros.length === 0 ? (
              <div className="p-6 text-sm font-medium text-slate-500">
                No hay intentos registrados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Fecha</th>
                      <th className="px-4 py-3 text-left">Residente</th>
                      <th className="px-4 py-3 text-left">Zona</th>
                      <th className="px-4 py-3 text-left">Estado</th>
                      <th className="px-4 py-3 text-left">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {registros.map((registro) => (
                      <tr key={registro.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-500">
                          {formatDateTime(registro.fecha_hora)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-800">{registro.nombre}</p>
                          <p className="text-xs text-slate-500">
                            Torre {registro.torre} · Apto {registro.apartamento}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{registro.zona}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            registro.estado_intento === 'concedido'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}>
                            {registro.estado_intento === 'concedido' ? 'Concedido' : 'Denegado'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {registro.motivo || 'Sin motivo'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
