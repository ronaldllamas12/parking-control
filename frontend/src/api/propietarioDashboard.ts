import type {
    ComprobantePagoOut,
    PropietarioDashboardOut,
    TelegramMessageOut,
} from '../types'
import apiClient from './axios'

export async function obtenerDashboardPropietario(): Promise<PropietarioDashboardOut> {
  const { data } = await apiClient.get<PropietarioDashboardOut>('/api/v1/propietario/dashboard')
  return data
}

export async function listarComprobantesPropietario(): Promise<ComprobantePagoOut[]> {
  const { data } = await apiClient.get<ComprobantePagoOut[]>('/api/v1/propietario/comprobantes')
  return data
}

export async function enviarMensajeAdmin(mensaje: string): Promise<TelegramMessageOut> {
  const { data } = await apiClient.post<TelegramMessageOut>('/api/v1/propietario/mensaje', {
    mensaje,
  })
  return data
}

export async function obtenerMensajesConversacion(): Promise<TelegramMessageOut[]> {
  const { data } = await apiClient.get<TelegramMessageOut[]>('/api/v1/propietario/mensajes')
  return data
}

export async function enviarComprobantePago(payload: {
  imagen: File
  mensaje?: string
  referencia?: string
  monto_centavos?: number
}): Promise<ComprobantePagoOut> {
  const form = new FormData()
  form.append('imagen', payload.imagen)
  if (payload.mensaje) form.append('mensaje', payload.mensaje)
  if (payload.referencia) form.append('referencia', payload.referencia)
  if (payload.monto_centavos !== undefined) form.append('monto_centavos', String(payload.monto_centavos))
  const { data } = await apiClient.post<ComprobantePagoOut>('/api/v1/propietario/comprobantes', form)
  return data
}
