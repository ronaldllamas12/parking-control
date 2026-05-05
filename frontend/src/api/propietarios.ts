import type { PropietarioOut, PropietarioUpdate } from '../types'
import apiClient from './axios'

/**
 * POST /api/v1/propietarios/
 * Multipart form — mirrors the backend Form() + File() signature.
 */
export async function registrarPropietario(
  nombre: string,
  torre: string,
  apartamento: string,
  foto: File,
): Promise<PropietarioOut> {
  const form = new FormData()
  form.append('nombre', nombre)
  form.append('torre', torre.trim())
  form.append('apartamento', apartamento.toUpperCase())
  form.append('foto', foto)

  const { data } = await apiClient.post<PropietarioOut>('/api/v1/propietarios/', form)
  return data
}

/** GET /api/v1/propietarios/ */
export async function listarPropietarios(): Promise<PropietarioOut[]> {
  const { data } = await apiClient.get<PropietarioOut[]>('/api/v1/propietarios/')
  return data
}

/** PUT /api/v1/propietarios/{uid} */
export async function actualizarPropietario(
  uid: string,
  fields: PropietarioUpdate,
  foto?: File,
): Promise<PropietarioOut> {
  const form = new FormData()
  if (fields.nombre !== undefined) form.append('nombre', fields.nombre)
  if (fields.torre !== undefined) form.append('torre', fields.torre.trim())
  if (fields.apartamento !== undefined)
    form.append('apartamento', fields.apartamento.toUpperCase())
  if (foto) form.append('foto', foto)

  const { data } = await apiClient.put<PropietarioOut>(`/api/v1/propietarios/${uid}`, form)
  return data
}

/** DELETE /api/v1/propietarios/{uid} */
export async function eliminarPropietario(uid: string): Promise<void> {
  await apiClient.delete(`/api/v1/propietarios/${uid}`)
}
