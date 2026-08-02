import type { AxiosError } from 'axios'
import {
  CalendarDays,
  CheckCircle2,
  CreditCard,
  ImageOff,
  RefreshCw,
  Send,
  Upload,
  Users,
  XCircle,
} from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  moneySalon,
  propietarioCalendarioSalones,
  propietarioCancelarReservaSalon,
  propietarioCrearReservaSalon,
  propietarioListarSalones,
  propietarioReportarPagoSalon,
  propietarioReservasSalones,
} from '../../api/salonesSociales'
import type {
  ApiErrorBody,
  SalonSocialCalendarDayOut,
  SalonSocialOut,
  SalonSocialReservaOut,
} from '../../types'

function isoDate(offset = 0): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function statusLabel(value: string): string {
  return ({
    pendiente_pago: 'Pendiente de pago',
    pendiente_aprobacion: 'Pago por aprobar',
    confirmado: 'Confirmado',
    cancelado: 'Cancelado',
    reservado_pendiente: 'Ocupado',
    reservado_confirmado: 'Ocupado',
    no_disponible: 'No disponible',
    mantenimiento: 'Mantenimiento',
    evento_privado: 'Evento privado',
  } as Record<string, string>)[value] ?? value
}

export default function ReservarSalonSocial() {
  const [salones, setSalones] = useState<SalonSocialOut[]>([])
  const [calendar, setCalendar] = useState<SalonSocialCalendarDayOut[]>([])
  const [reservas, setReservas] = useState<SalonSocialReservaOut[]>([])
  const [selectedSalonId, setSelectedSalonId] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [incluyeAseo, setIncluyeAseo] = useState(false)
  const [notas, setNotas] = useState('')
  const [paymentReservaId, setPaymentReservaId] = useState<number | null>(null)
  const [referencia, setReferencia] = useState('')
  const [paymentNotas, setPaymentNotas] = useState('')
  const [proof, setProof] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedSalon = salones.find((salon) => salon.id === selectedSalonId) ?? null
  const selectedPrice = selectedSalon
    ? incluyeAseo
      ? selectedSalon.precio_con_aseo_centavos
      : selectedSalon.precio_sin_aseo_centavos
    : 0

  const daysForSalon = useMemo(
    () => calendar.filter((item) => item.salon_id === selectedSalonId),
    [calendar, selectedSalonId],
  )

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [salonesData, calendarData, reservasData] = await Promise.all([
        propietarioListarSalones(),
        propietarioCalendarioSalones(isoDate(), isoDate(60)),
        propietarioReservasSalones(),
      ])
      setSalones(salonesData)
      setCalendar(calendarData)
      setReservas(reservasData)
      setSelectedSalonId((current) => current ?? salonesData[0]?.id ?? null)
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo cargar la disponibilidad')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleReserve = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedSalonId || !selectedDate) return
    setSaving(true)
    setNotice(null)
    setError(null)
    try {
      const reserva = await propietarioCrearReservaSalon({
        salon_id: selectedSalonId,
        fecha: selectedDate,
        incluye_aseo: incluyeAseo,
        notas: notas.trim() || undefined,
      })
      setReservas((items) => [reserva, ...items])
      setPaymentReservaId(reserva.id)
      setSelectedDate(null)
      setNotas('')
      setNotice('Reserva creada. Reporta el pago para que administración la apruebe.')
      await load()
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo crear la reserva')
    } finally {
      setSaving(false)
    }
  }

  const handlePayment = async (event: FormEvent) => {
    event.preventDefault()
    if (!paymentReservaId) return
    setSaving(true)
    setNotice(null)
    setError(null)
    try {
      const reserva = await propietarioReportarPagoSalon({
        reserva_id: paymentReservaId,
        comprobante: proof,
        referencia_pago: referencia.trim() || undefined,
        notas: paymentNotas.trim() || undefined,
      })
      setReservas((items) => items.map((item) => (item.id === reserva.id ? reserva : item)))
      setProof(null)
      setReferencia('')
      setPaymentNotas('')
      setPaymentReservaId(null)
      setNotice('Pago reportado. La reserva quedó pendiente de aprobación.')
      await load()
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo reportar el pago')
    } finally {
      setSaving(false)
    }
  }

  const cancelReserve = async (id: number) => {
    setSaving(true)
    setNotice(null)
    setError(null)
    try {
      const reserva = await propietarioCancelarReservaSalon(id, 'Cancelada desde el dashboard')
      setReservas((items) => items.map((item) => (item.id === reserva.id ? reserva : item)))
      setNotice('Reserva cancelada')
      await load()
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo cancelar la reserva')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-10 text-center text-sm text-slate-400">Cargando salones sociales...</div>
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="rounded-3xl bg-gradient-dark p-5 text-white shadow-float sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/55">Zonas comunes</p>
            <h1 className="mt-1 text-2xl font-extrabold">Reservar Salón Social</h1>
            <p className="mt-1 text-sm text-white/65">Horario de uso: 09:00 AM a 08:59 AM del día siguiente.</p>
          </div>
          <button onClick={() => { void load() }} className="btn-icon bg-white/10 border-white/20 hover:bg-white/20" aria-label="Actualizar">
            <RefreshCw className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <section className="space-y-4">
          {salones.length === 0 ? (
            <div className="card-lg p-8 text-center text-sm text-slate-400">No hay salones disponibles.</div>
          ) : salones.map((salon) => {
            const selected = salon.id === selectedSalonId
            return (
              <button
                key={salon.id}
                type="button"
                onClick={() => {
                  setSelectedSalonId(salon.id)
                  setSelectedDate(null)
                }}
                className={`w-full overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all ${
                  selected ? 'border-teal-400 ring-2 ring-teal-100' : 'border-slate-200 hover:border-teal-200'
                }`}
              >
                {salon.imagen_url ? (
                  <img src={salon.imagen_url} alt={salon.nombre} className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-40 items-center justify-center bg-slate-100 text-slate-300">
                    <ImageOff className="h-10 w-10" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900">{salon.nombre}</h2>
                      <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Users className="h-3.5 w-3.5" />{salon.capacidad} personas</p>
                    </div>
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: salon.color_calendario }} />
                  </div>
                  {salon.descripcion && <p className="mt-2 text-sm text-slate-500">{salon.descripcion}</p>}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <span className="rounded-xl bg-slate-50 px-3 py-2 font-bold text-slate-700">Sin aseo {moneySalon(salon.precio_sin_aseo_centavos)}</span>
                    <span className="rounded-xl bg-teal-50 px-3 py-2 font-bold text-teal-700">Con aseo {moneySalon(salon.precio_con_aseo_centavos)}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </section>

        <div className="space-y-6">
          <section className="card-lg p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900"><CalendarDays className="h-5 w-5 text-teal-700" />Disponibilidad</h2>
                <p className="text-xs text-slate-500">Solo puedes seleccionar fechas disponibles.</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {daysForSalon.map((item) => {
                const selected = selectedDate === item.fecha
                return (
                  <button
                    key={`${item.salon_id}-${item.fecha}`}
                    type="button"
                    disabled={!item.disponible}
                    onClick={() => setSelectedDate(item.fecha)}
                    className={`min-h-[74px] rounded-2xl border px-3 py-2 text-left transition-all ${
                      selected
                        ? 'border-teal-500 bg-teal-600 text-white shadow-brand'
                        : item.disponible
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400'
                          : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                    }`}
                  >
                    <p className="text-sm font-extrabold">{new Date(`${item.fecha}T00:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</p>
                    <p className="mt-1 text-[11px] font-bold">{item.disponible ? 'Disponible' : statusLabel(item.estado_visual)}</p>
                  </button>
                )
              })}
            </div>
          </section>

          <form onSubmit={(event) => { void handleReserve(event) }} className="card-lg p-5 space-y-4">
            <h2 className="text-lg font-extrabold text-slate-900">Crear reserva</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">Salón</p>
                <p className="text-sm font-extrabold text-slate-900">{selectedSalon?.nombre ?? 'Seleccione salón'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">Fecha</p>
                <p className="text-sm font-extrabold text-slate-900">{selectedDate ? formatDate(selectedDate) : 'Seleccione fecha'}</p>
              </div>
              <div className="rounded-2xl bg-teal-50 px-4 py-3">
                <p className="text-xs text-teal-700">Precio</p>
                <p className="text-sm font-extrabold text-teal-800">{moneySalon(selectedPrice)}</p>
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={incluyeAseo} onChange={(e) => setIncluyeAseo(e.target.checked)} className="h-4 w-4 accent-teal-700" />
              Incluir servicio de aseo
            </label>
            <textarea className="field min-h-20 resize-none" placeholder="Notas para administración" value={notas} onChange={(e) => setNotas(e.target.value)} />
            <button type="submit" disabled={saving || !selectedSalonId || !selectedDate} className="btn-primary w-full">
              <CheckCircle2 className="h-4 w-4" />Reservar
            </button>
          </form>

          <form onSubmit={(event) => { void handlePayment(event) }} className="card-lg p-5 space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900"><CreditCard className="h-5 w-5 text-teal-700" />Reportar pago</h2>
            <select className="field" value={paymentReservaId ?? ''} onChange={(e) => setPaymentReservaId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Seleccione una reserva pendiente</option>
              {reservas.filter((r) => ['pendiente_pago', 'pendiente_aprobacion'].includes(r.estado)).map((reserva) => (
                <option key={reserva.id} value={reserva.id}>{reserva.salon_nombre} · {reserva.fecha} · {moneySalon(reserva.precio_centavos)}</option>
              ))}
            </select>
            <input className="field" placeholder="Referencia de pago" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
            <textarea className="field min-h-20 resize-none" placeholder="Notas del pago" value={paymentNotas} onChange={(e) => setPaymentNotas(e.target.value)} />
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-teal-300 bg-teal-50 px-4 py-4 text-sm font-semibold text-teal-700 hover:bg-teal-100">
              <Upload className="h-4 w-4" />
              {proof ? proof.name : 'Adjuntar comprobante'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
            </label>
            <button type="submit" disabled={saving || !paymentReservaId} className="btn-primary w-full">
              <Send className="h-4 w-4" />Enviar pago
            </button>
          </form>
        </div>
      </div>

      <section className="card-lg p-5">
        <h2 className="mb-4 text-lg font-extrabold text-slate-900">Mis reservas</h2>
        {reservas.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">Aún no tienes reservas.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {reservas.map((reserva) => (
              <div key={reserva.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-slate-900">{reserva.salon_nombre}</p>
                    <p className="text-xs text-slate-500">{formatDate(reserva.fecha)} · {moneySalon(reserva.precio_centavos)}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{statusLabel(reserva.estado)} · Pago {statusLabel(reserva.pago_estado)}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                    reserva.estado === 'confirmado' ? 'bg-blue-50 text-blue-700' :
                      reserva.estado === 'cancelado' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {statusLabel(reserva.estado)}
                  </span>
                </div>
                {reserva.estado !== 'confirmado' && reserva.estado !== 'cancelado' && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => { void cancelReserve(reserva.id) }}
                    className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <XCircle className="h-4 w-4" />Cancelar reserva
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
