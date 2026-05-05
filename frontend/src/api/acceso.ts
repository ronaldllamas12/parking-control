import type { VerificacionResponse } from '../types'
import apiClient from './axios'

/**
 * GET /api/v1/acceso/verificar/{uid}
 * Returns 404 if UID not found, or propietario + acceso timestamp on success.
 */
export async function verificarAcceso(uid: string): Promise<VerificacionResponse> {
  const { data } = await apiClient.get<VerificacionResponse>(
    `/api/v1/acceso/verificar/${uid.toUpperCase()}`,
  )
  return data
}
