import type { RegistroAccesoOut } from '../types'
import apiClient from './axios'

export async function listarRegistrosAcceso(limit = 200): Promise<RegistroAccesoOut[]> {
  const { data } = await apiClient.get<RegistroAccesoOut[]>('/api/v1/registros-acceso', {
    params: { limit },
  })
  return data
}
