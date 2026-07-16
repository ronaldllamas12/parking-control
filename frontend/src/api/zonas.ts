import type { ZonaAcceso } from '../types'
import apiClient from './axios'

export async function listarZonasAcceso(): Promise<ZonaAcceso[]> {
  const { data } = await apiClient.get<ZonaAcceso[]>('/api/v1/zonas-acceso/')
  return data
}

export async function crearZonaAcceso(
  nombre: string,
  acceso_universal = false,
): Promise<ZonaAcceso> {
  const { data } = await apiClient.post<ZonaAcceso>('/api/v1/zonas-acceso/', {
    nombre,
    acceso_universal,
  })
  return data
}

export async function actualizarZonaAcceso(
  id: number,
  payload: { nombre?: string; activa?: boolean; acceso_universal?: boolean },
): Promise<ZonaAcceso> {
  const { data } = await apiClient.put<ZonaAcceso>(`/api/v1/zonas-acceso/${id}`, payload)
  return data
}

export async function eliminarZonaAcceso(id: number): Promise<void> {
  await apiClient.delete(`/api/v1/zonas-acceso/${id}`)
}
