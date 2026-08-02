import type { AxiosError } from 'axios'
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ImagePlus,
  RefreshCw,
  Save,
  Users,
  Wrench,
  XCircle,
} from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  adminActualizarSalon,
  adminBloquearFechaSalon,
  adminCalendarioSalones,
  adminCambiarEstadoReservaSalon,
  adminCrearSalon,
  adminListarReservasSalones,
  adminListarSalones,
  moneySalon,
} from '../../api/salonesSociales'
import type {
  ApiErrorBody,
  SalonSocialCalendarDayOut,
  SalonSocialOut,
  SalonSocialReservaOut,
} from '../../types'

const colors = ['#0f766e', '#2563eb', '#9333ea', '#ea580c', '#16a34a', '#db2777']
const statusClass: Record<string, string> = {
  disponible: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  reservado_pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
  reservado_confirmado: 'bg-blue-50 text-blue-700 border-blue-200',
  no_disponible: 'bg-slate-100 text-slate-600 border-slate-200',
  mantenimiento: 'bg-orange-50 text-orange-700 border-orange-200',
  evento_privado: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  cancelado: 'bg-rose-50 text-rose-700 border-rose-200',
}

function isoDate(offset = 0): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

function labelEstado(value: string): string {
  return ({
    disponible: 'Disponible',
    reservado_pendiente: 'Pendiente',
    reservado_confirmado: 'Confirmado',
    no_disponible: 'No disponible',
    mantenimiento: 'Mantenimiento',
    evento_privado: 'Evento privado',
    pendiente_pago: 'Pendiente pago',
    pendiente_aprobacion: 'Por aprobar',
    confirmado: 'Confirmado',
    cancelado: 'Cancelado',
  } as Record<string, string>)[value] ?? value
}

const emptyForm = {
  nombre: '',
  descripcion: '',
  capacidad: 50,
  estado: 'activo' as const,
  color_calendario: colors[0],
  precio_sin_aseo: '130000',
  precio_con_aseo: '160000',
  imagen: null as File | null,
}

export default function SalonesSociales() {
  const [salones, setSalones] = useState<SalonSocialOut[]>([])
  const [calendar, setCalendar] = useState<SalonSocialCalendarDayOut[]>([])
  const [reservas, setReservas] = useState<SalonSocialReservaOut[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [fechaInicio, setFechaInicio] = useState(isoDate())
  const [fechaFin, setFechaFin] = useState(isoDate(30))
  const [blockSalonId, setBlockSalonId] = useState<number | ''>('')
  const [blockFecha, setBlockFecha] = useState(isoDate())
  const [blockEstado, setBlockEstado] = useState<'disponible' | 'no_disponible' | 'mantenimiento' | 'evento_privado'>('no_disponible')
  const [blockNotas, setBlockNotas] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const days = useMemo(() => {
    const map = new Map<string, SalonSocialCalendarDayOut[]>()
    calendar.forEach((item) => {
      map.set(item.fecha, [...(map.get(item.fecha) ?? []), item])
    })
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [calendar])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [salonesData, calendarioData, reservasData] = await Promise.all([
        adminListarSalones(),
        adminCalendarioSalones(fechaInicio, fechaFin),
        adminListarReservasSalones(),
      ])
      setSalones(salonesData)
      setCalendar(calendarioData)
      setReservas(reservasData)
      setBlockSalonId((current) => current || salonesData[0]?.id || '')
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo cargar salones sociales')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const startEdit = (salon: SalonSocialOut) => {
    setEditingId(salon.id)
    setForm({
      nombre: salon.nombre,
      descripcion: salon.descripcion ?? '',
      capacidad: salon.capacidad,
      estado: salon.estado,
      color_calendario: salon.color_calendario,
      precio_sin_aseo: String(Math.round(salon.precio_sin_aseo_centavos / 100)),
      precio_con_aseo: String(Math.round(salon.precio_con_aseo_centavos / 100)),
      imagen: null,
    })
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setNotice(null)
    setError(null)
    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      capacidad: Number(form.capacidad),
      estado: form.estado,
      color_calendario: form.color_calendario,
      precio_sin_aseo_centavos: Math.round(Number(form.precio_sin_aseo) * 100),
      precio_con_aseo_centavos: Math.round(Number(form.precio_con_aseo) * 100),
      imagen: form.imagen,
    }
    try {
      if (editingId) {
        await adminActualizarSalon(editingId, payload)
        setNotice('Salón actualizado')
      } else {
        await adminCrearSalon(payload)
        setNotice('Salón creado')
      }
      resetForm()
      await load()
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo guardar el salón')
    } finally {
      setSaving(false)
    }
  }

  const handleBlock = async () => {
    if (!blockSalonId) return
    setSaving(true)
    setNotice(null)
    setError(null)
    try {
      await adminBloquearFechaSalon({
        salon_id: Number(blockSalonId),
        fecha: blockFecha,
        estado: blockEstado,
        notas: blockNotas.trim() || undefined,
      })
      setNotice(blockEstado === 'disponible' ? 'Fecha liberada' : 'Fecha bloqueada')
      setBlockNotas('')
      await load()
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo actualizar la fecha')
    } finally {
      setSaving(false)
    }
  }

  const updateReserva = async (reservaId: number, estado: 'confirmado' | 'cancelado') => {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await adminCambiarEstadoReservaSalon(reservaId, estado, estado === 'cancelado' ? 'Cancelada por administración' : undefined)
      setNotice(estado === 'confirmado' ? 'Reserva confirmada' : 'Reserva cancelada')
      await load()
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo actualizar la reserva')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-teal-700">Zonas comunes</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Salones Sociales</h1>
          <p className="text-sm text-slate-500">Configuración, calendario, bloqueos y aprobación de reservas.</p>
        </div>
        <button onClick={() => { void load() }} className="btn-secondary">
          <RefreshCw className="h-4 w-4" />Actualizar
        </button>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <section className="card-lg p-5">
          <h2 className="mb-4 text-lg font-extrabold text-slate-900">{editingId ? 'Editar salón' : 'Nuevo salón'}</h2>
          <form onSubmit={(event) => { void handleSubmit(event) }} className="space-y-3">
            <input className="field" placeholder="Nombre del salón" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            <textarea className="field min-h-24 resize-none" placeholder="Descripción" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <input className="field" type="number" min={1} placeholder="Capacidad" value={form.capacidad} onChange={(e) => setForm({ ...form, capacidad: Number(e.target.value) })} />
              <select className="field" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as 'activo' | 'inactivo' })}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input className="field" type="number" min={0} placeholder="Precio sin aseo" value={form.precio_sin_aseo} onChange={(e) => setForm({ ...form, precio_sin_aseo: e.target.value })} />
              <input className="field" type="number" min={0} placeholder="Precio con aseo" value={form.precio_con_aseo} onChange={(e) => setForm({ ...form, precio_con_aseo: e.target.value })} />
            </div>
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm({ ...form, color_calendario: color })}
                  className={`h-8 w-8 rounded-full border-2 ${form.color_calendario === color ? 'border-slate-900' : 'border-white'}`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-teal-300 bg-teal-50 px-4 py-4 text-sm font-semibold text-teal-700 hover:bg-teal-100">
              <ImagePlus className="h-4 w-4" />
              {form.imagen ? form.imagen.name : 'Imagen del salón'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setForm({ ...form, imagen: e.target.files?.[0] ?? null })} />
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={saving || !form.nombre.trim()} className="btn-primary flex-1">
                <Save className="h-4 w-4" />Guardar
              </button>
              {editingId && <button type="button" onClick={resetForm} className="btn-secondary">Cancelar</button>}
            </div>
          </form>

          <div className="mt-6 space-y-3">
            {salones.map((salon) => (
              <button key={salon.id} type="button" onClick={() => startEdit(salon)} className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left hover:border-teal-300">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: salon.color_calendario }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{salon.nombre}</p>
                    <p className="text-xs text-slate-500">{salon.capacidad} personas · {moneySalon(salon.precio_sin_aseo_centavos)} / {moneySalon(salon.precio_con_aseo_centavos)}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${salon.estado === 'activo' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{salon.estado}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <div className="space-y-6">
          <section className="card-lg p-5">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900"><CalendarDays className="h-5 w-5 text-teal-700" />Calendario</h2>
                <p className="text-xs text-slate-500">Cada reserva ocupa de 09:00 AM a 08:59 AM del día siguiente.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <input className="field" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                <input className="field" type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
                <button onClick={() => { void load() }} className="btn-secondary col-span-2 sm:col-span-1">Filtrar</button>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-sm text-slate-400">Cargando calendario...</div>
            ) : days.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-400">No hay salones configurados.</div>
            ) : (
              <div className="max-h-[520px] overflow-y-auto rounded-2xl border border-slate-200">
                {days.map(([fecha, items]) => (
                  <div key={fecha} className="grid gap-2 border-b border-slate-100 p-3 lg:grid-cols-[120px_1fr]">
                    <div className="text-sm font-extrabold text-slate-700">
                      {new Date(`${fecha}T00:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {items.map((item) => (
                        <div key={`${item.salon_id}-${item.fecha}`} className={`rounded-xl border px-3 py-2 ${statusClass[item.estado_visual] ?? 'bg-white text-slate-700 border-slate-200'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-extrabold">{item.salon_nombre}</p>
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.salon_color }} />
                          </div>
                          <p className="mt-1 text-[11px] font-semibold">{labelEstado(item.estado_visual)}</p>
                          {item.reserva?.propietario_nombre && <p className="mt-1 truncate text-[11px]">{item.reserva.propietario_nombre}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card-lg p-5">
            <h2 className="mb-4 text-lg font-extrabold text-slate-900">Bloqueo manual</h2>
            <div className="grid gap-3 lg:grid-cols-[1fr_160px_180px_1fr_auto]">
              <select className="field" value={blockSalonId} onChange={(e) => setBlockSalonId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Seleccione salón</option>
                {salones.map((salon) => <option key={salon.id} value={salon.id}>{salon.nombre}</option>)}
              </select>
              <input className="field" type="date" value={blockFecha} onChange={(e) => setBlockFecha(e.target.value)} />
              <select className="field" value={blockEstado} onChange={(e) => setBlockEstado(e.target.value as typeof blockEstado)}>
                <option value="disponible">Disponible</option>
                <option value="no_disponible">No disponible</option>
                <option value="mantenimiento">Mantenimiento</option>
                <option value="evento_privado">Evento privado</option>
              </select>
              <input className="field" placeholder="Notas" value={blockNotas} onChange={(e) => setBlockNotas(e.target.value)} />
              <button onClick={() => { void handleBlock() }} disabled={saving || !blockSalonId} className="btn-primary">
                <Ban className="h-4 w-4" />Aplicar
              </button>
            </div>
          </section>

          <section className="card-lg p-5">
            <h2 className="mb-4 text-lg font-extrabold text-slate-900">Reservas y pagos</h2>
            <div className="space-y-3">
              {reservas.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">No hay reservas registradas.</p>
              ) : reservas.slice(0, 20).map((reserva) => (
                <div key={reserva.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-extrabold text-slate-900">{reserva.salon_nombre}</p>
                      <p className="text-xs text-slate-500">
                        {reserva.fecha} · {reserva.propietario_nombre ?? 'Administración'} · {moneySalon(reserva.precio_centavos)}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        Pago: {labelEstado(reserva.pago_estado)} · Estado: {labelEstado(reserva.estado)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {reserva.comprobante_url && (
                        <a href={reserva.comprobante_url} target="_blank" rel="noreferrer" className="btn-secondary text-xs">Ver pago</a>
                      )}
                      {reserva.tipo === 'reserva' && reserva.estado !== 'confirmado' && reserva.estado !== 'cancelado' && (
                        <button onClick={() => { void updateReserva(reserva.id, 'confirmado') }} disabled={saving} className="btn-primary text-xs">
                          <CheckCircle2 className="h-4 w-4" />Confirmar
                        </button>
                      )}
                      {reserva.tipo === 'reserva' && reserva.estado !== 'cancelado' && (
                        <button
                          onClick={() => { void updateReserva(reserva.id, 'cancelado') }}
                          disabled={saving}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          <XCircle className="h-4 w-4" />Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="stat-card"><div className="stat-icon bg-blue-100 text-blue-700"><Users className="h-5 w-5" /></div><div><p className="text-xs text-slate-500">Salones</p><p className="text-lg font-extrabold">{salones.length}</p></div></div>
        <div className="stat-card"><div className="stat-icon bg-amber-100 text-amber-700"><Clock3 className="h-5 w-5" /></div><div><p className="text-xs text-slate-500">Por aprobar</p><p className="text-lg font-extrabold">{reservas.filter((r) => r.estado === 'pendiente_aprobacion').length}</p></div></div>
        <div className="stat-card"><div className="stat-icon bg-orange-100 text-orange-700"><Wrench className="h-5 w-5" /></div><div><p className="text-xs text-slate-500">Bloqueos</p><p className="text-lg font-extrabold">{reservas.filter((r) => r.tipo === 'bloqueo' && r.estado !== 'cancelado').length}</p></div></div>
      </div>
    </div>
  )
}
