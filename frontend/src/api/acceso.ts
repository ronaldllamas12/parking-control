import type { HistorialAccesoOut, HuellaTemplate, VerificacionResponse } from '../types'
import apiClient from './axios'

/**
 * GET /api/v1/acceso/verificar/{uid}
 */
export async function verificarAcceso(uid: string): Promise<VerificacionResponse> {
  const { data } = await apiClient.get<VerificacionResponse>(
    `/api/v1/acceso/verificar/${uid.toUpperCase()}`,
  )
  return data
}

/** GET /api/v1/acceso/historial-reciente */
export async function listarHistorialReciente(): Promise<HistorialAccesoOut[]> {
  const { data } = await apiClient.get<HistorialAccesoOut[]>(
    '/api/v1/acceso/historial-reciente',
  )
  return data
}

/** GET /api/v1/acceso/huellas — all enrolled fingerprint templates (vigilante only) */
export async function listarHuellas(): Promise<HuellaTemplate[]> {
  const { data } = await apiClient.get<HuellaTemplate[]>('/api/v1/acceso/huellas')
  return data
}
