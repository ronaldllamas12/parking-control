import type {
  SalonSocialCalendarDayOut,
  SalonSocialOut,
  SalonSocialReservaOut,
} from '../types'
import apiClient from './axios'

export function moneySalon(centavos: number): string {
  return `$${Math.round(centavos / 100).toLocaleString('es-CO')}`
}

function appendIfPresent(form: FormData, key: string, value: unknown) {
  if (value !== undefined && value !== null && value !== '') {
    form.append(key, String(value))
  }
}

export interface SalonPayload {
  nombre: string
  descripcion?: string | null
  capacidad: number
  estado: 'activo' | 'inactivo'
  color_calendario: string
  precio_sin_aseo_centavos: number
  precio_con_aseo_centavos: number
  imagen?: File | null
}

export async function adminListarSalones(): Promise<SalonSocialOut[]> {
  const { data } = await apiClient.get<SalonSocialOut[]>('/api/v1/salones-sociales/admin/salones')
  return data
}

export async function adminCrearSalon(payload: SalonPayload): Promise<SalonSocialOut> {
  const form = new FormData()
  appendIfPresent(form, 'nombre', payload.nombre)
  appendIfPresent(form, 'descripcion', payload.descripcion)
  appendIfPresent(form, 'capacidad', payload.capacidad)
  appendIfPresent(form, 'estado', payload.estado)
  appendIfPresent(form, 'color_calendario', payload.color_calendario)
  appendIfPresent(form, 'precio_sin_aseo_centavos', payload.precio_sin_aseo_centavos)
  appendIfPresent(form, 'precio_con_aseo_centavos', payload.precio_con_aseo_centavos)
  if (payload.imagen) form.append('imagen', payload.imagen)
  const { data } = await apiClient.post<SalonSocialOut>('/api/v1/salones-sociales/admin/salones', form)
  return data
}

export async function adminActualizarSalon(id: number, payload: Partial<SalonPayload>): Promise<SalonSocialOut> {
  const form = new FormData()
  appendIfPresent(form, 'nombre', payload.nombre)
  appendIfPresent(form, 'descripcion', payload.descripcion)
  appendIfPresent(form, 'capacidad', payload.capacidad)
  appendIfPresent(form, 'estado', payload.estado)
  appendIfPresent(form, 'color_calendario', payload.color_calendario)
  appendIfPresent(form, 'precio_sin_aseo_centavos', payload.precio_sin_aseo_centavos)
  appendIfPresent(form, 'precio_con_aseo_centavos', payload.precio_con_aseo_centavos)
  if (payload.imagen) form.append('imagen', payload.imagen)
  const { data } = await apiClient.put<SalonSocialOut>(`/api/v1/salones-sociales/admin/salones/${id}`, form)
  return data
}

export async function adminCalendarioSalones(fechaInicio: string, fechaFin: string): Promise<SalonSocialCalendarDayOut[]> {
  const { data } = await apiClient.get<SalonSocialCalendarDayOut[]>('/api/v1/salones-sociales/admin/calendario', {
    params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
  })
  return data
}

export async function adminListarReservasSalones(): Promise<SalonSocialReservaOut[]> {
  const { data } = await apiClient.get<SalonSocialReservaOut[]>('/api/v1/salones-sociales/admin/reservas')
  return data
}

export async function adminBloquearFechaSalon(payload: {
  salon_id: number
  fecha: string
  estado: 'disponible' | 'no_disponible' | 'mantenimiento' | 'evento_privado'
  notas?: string
}): Promise<SalonSocialReservaOut | null> {
  const { data } = await apiClient.post<SalonSocialReservaOut | null>('/api/v1/salones-sociales/admin/bloqueos', payload)
  return data
}

export async function adminCambiarEstadoReservaSalon(
  reservaId: number,
  estado: 'confirmado' | 'cancelado' | 'pendiente_pago' | 'pendiente_aprobacion',
  motivo?: string,
): Promise<SalonSocialReservaOut> {
  const { data } = await apiClient.patch<SalonSocialReservaOut>(
    `/api/v1/salones-sociales/admin/reservas/${reservaId}`,
    { estado, motivo },
  )
  return data
}

export async function propietarioListarSalones(): Promise<SalonSocialOut[]> {
  const { data } = await apiClient.get<SalonSocialOut[]>('/api/v1/salones-sociales/propietario/salones')
  return data
}

export async function propietarioCalendarioSalones(fechaInicio: string, fechaFin: string): Promise<SalonSocialCalendarDayOut[]> {
  const { data } = await apiClient.get<SalonSocialCalendarDayOut[]>('/api/v1/salones-sociales/propietario/calendario', {
    params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
  })
  return data
}

export async function propietarioReservasSalones(): Promise<SalonSocialReservaOut[]> {
  const { data } = await apiClient.get<SalonSocialReservaOut[]>('/api/v1/salones-sociales/propietario/reservas')
  return data
}

export async function propietarioCrearReservaSalon(payload: {
  salon_id: number
  fecha: string
  incluye_aseo: boolean
  notas?: string
}): Promise<SalonSocialReservaOut> {
  const { data } = await apiClient.post<SalonSocialReservaOut>('/api/v1/salones-sociales/propietario/reservas', payload)
  return data
}

export async function propietarioReportarPagoSalon(payload: {
  reserva_id: number
  comprobante?: File | null
  referencia_pago?: string
  notas?: string
}): Promise<SalonSocialReservaOut> {
  const form = new FormData()
  appendIfPresent(form, 'referencia_pago', payload.referencia_pago)
  appendIfPresent(form, 'notas', payload.notas)
  if (payload.comprobante) form.append('comprobante', payload.comprobante)
  const { data } = await apiClient.post<SalonSocialReservaOut>(
    `/api/v1/salones-sociales/propietario/reservas/${payload.reserva_id}/pago`,
    form,
  )
  return data
}

export async function propietarioCancelarReservaSalon(reservaId: number, motivo?: string): Promise<SalonSocialReservaOut> {
  const form = new FormData()
  appendIfPresent(form, 'motivo', motivo)
  const { data } = await apiClient.post<SalonSocialReservaOut>(
    `/api/v1/salones-sociales/propietario/reservas/${reservaId}/cancelar`,
    form,
  )
  return data
}
