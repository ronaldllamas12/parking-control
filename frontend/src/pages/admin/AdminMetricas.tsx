import type { AxiosError } from 'axios'
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  Fingerprint,
  Home,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { obtenerMisMetricas } from '../../api/admin'
import type { ApiErrorBody, ConjuntoMetricas } from '../../types'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMetricas = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await obtenerMisMetricas()
      setMetricas(data)
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
        </>
      )}
    </div>
  )
}
