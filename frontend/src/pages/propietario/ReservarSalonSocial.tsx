import type { AxiosError } from 'axios'
import {
    CalendarDays,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
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
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear())
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth())
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

  const dayMap = useMemo(() => {
    const map: Record<string, SalonSocialCalendarDayOut> = {}
    for (const day of daysForSalon) map[day.fecha] = day
    return map
  }, [daysForSalon])

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1)
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0)
    const startOffset = (firstDay.getDay() + 6) % 7 // Monday = 0
    const grid: (string | null)[] = []
    for (let i = 0; i < startOffset; i++) grid.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) {
      grid.push(
        `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      )
    }
    while (grid.length % 7 !== 0) grid.push(null)
    return grid
  }, [calendarYear, calendarMonth])

  const todayStr = isoDate()
  const maxCalDate = new Date(); maxCalDate.setDate(maxCalDate.getDate() + 60)
  const canGoPrev = calendarYear > new Date().getFullYear() || calendarMonth > new Date().getMonth()
  const canGoNext = calendarYear < maxCalDate.getFullYear() || (calendarYear === maxCalDate.getFullYear() && calendarMonth < maxCalDate.getMonth())

  const goPrevMonth = () => {
    if (!canGoPrev) return
    if (calendarMonth === 0) { setCalendarYear((y) => y - 1); setCalendarMonth(11) }
    else setCalendarMonth((m) => m - 1)
  }
  const goNextMonth = () => {
    if (!canGoNext) return
    if (calendarMonth === 11) { setCalendarYear((y) => y + 1); setCalendarMonth(0) }
    else setCalendarMonth((m) => m + 1)
  }

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
            <div className="mb-4 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-teal-600" />
              <div className="flex-1">
                <h2 className="text-lg font-extrabold text-slate-900">Disponibilidad</h2>
                <p className="text-xs text-slate-500">Selecciona una fecha disponible para reservar.</p>
              </div>
            </div>

            {/* Month navigation */}
            <div className="mb-3 flex items-center gap-2">
              <button
                type="button"
                onClick={goPrevMonth}
                disabled={!canGoPrev}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="flex-1 text-center text-sm font-extrabold capitalize text-slate-800">
                {new Date(calendarYear, calendarMonth).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
              </p>
              <button
                type="button"
                onClick={goNextMonth}
                disabled={!canGoNext}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="mb-1 grid grid-cols-7 text-center">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                <div key={d} className="py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarGrid.map((fecha, idx) => {
                if (!fecha) return <div key={`empty-${idx}`} className="aspect-square" />
                const item = dayMap[fecha]
                const isSelected = selectedDate === fecha
                const isToday = fecha === todayStr
                const isAvailable = item?.disponible ?? false

                if (!item) {
                  return (
                    <div key={fecha} className="flex aspect-square items-center justify-center rounded-xl text-xs font-medium text-slate-200">
                      {new Date(`${fecha}T00:00:00`).getDate()}
                    </div>
                  )
                }

                return (
                  <button
                    key={fecha}
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => setSelectedDate(fecha)}
                    className={`relative flex aspect-square flex-col items-center justify-center rounded-xl transition-all ${
                      isSelected
                        ? 'scale-105 bg-teal-600 text-white shadow-lg shadow-teal-200'
                        : isAvailable
                          ? 'border border-teal-200 bg-white text-teal-800 hover:scale-105 hover:border-teal-400 hover:bg-teal-50 hover:shadow-md'
                          : 'cursor-not-allowed bg-slate-50 text-slate-300'
                    }`}
                  >
                    {isToday && (
                      <span className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${
                        isSelected ? 'bg-teal-200' : 'bg-blue-500'
                      }`} />
                    )}
                    <span className={`text-sm font-extrabold leading-none ${!isAvailable && !isSelected ? 'line-through' : ''}`}>
                      {new Date(`${fecha}T00:00:00`).getDate()}
                    </span>
                    <span className={`mt-0.5 text-[8px] font-bold uppercase leading-none ${
                      isSelected ? 'text-teal-100' : isAvailable ? 'text-teal-500' : 'text-slate-300'
                    }`}>
                      {isAvailable ? 'libre' : 'ocupado'}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-100 pt-3">
              {[
                { color: 'bg-white border border-teal-300', label: 'Disponible' },
                { color: 'bg-teal-600', label: 'Seleccionado' },
                { color: 'bg-slate-100', label: 'No disponible' },
                { color: 'bg-blue-500 rounded-full', label: 'Hoy' },
              ].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                  <span className={`h-3 w-3 rounded-sm ${color}`} />
                  {label}
                </span>
              ))}
            </div>

            {/* Selected date callout */}
            {selectedDate && (
              <div className="mt-3 flex items-center gap-2 rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50 px-4 py-2.5">
                <CalendarDays className="h-4 w-4 flex-shrink-0 text-teal-600" />
                <div>
                  <p className="text-xs font-bold text-teal-800">{formatDate(selectedDate)}</p>
                  <p className="text-[10px] text-teal-600">Fecha seleccionada · completa el formulario abajo</p>
                </div>
              </div>
            )}
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
