import type { BulkImportResult, HuellaTemplate, PropietarioOut, PropietarioUpdate } from '../types'
import apiClient from './axios'

/**
 * POST /api/v1/propietarios/
 * Multipart form — mirrors the backend Form() + File() signature.
 */
export async function registrarPropietario(
  nombre: string,
  numeroContacto: string,
  torre: string,
  apartamento: string,
  foto: File,
): Promise<PropietarioOut> {
  const form = new FormData()
  form.append('nombre', nombre)
  form.append('numero_contacto', numeroContacto.trim())
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
  if (fields.numero_contacto !== undefined)
    form.append('numero_contacto', fields.numero_contacto.trim())
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

/** PATCH /api/v1/propietarios/{uid}/toggle-acceso */
export async function toggleAccesoPropietario(uid: string): Promise<PropietarioOut> {
  const { data } = await apiClient.patch<PropietarioOut>(`/api/v1/propietarios/${uid}/toggle-acceso`)
  return data
}

/** POST /api/v1/propietarios/bulk */
export async function registrarPropietariosBulk(
  items: Array<{ nombre: string; numero_contacto: string; torre: string; apartamento: string }>,
): Promise<BulkImportResult> {
  const { data } = await apiClient.post<BulkImportResult>('/api/v1/propietarios/bulk', items)
  return data
}

/** POST /api/v1/propietarios/{uid}/huella */
export async function registrarHuella(uid: string, template_b64: string): Promise<PropietarioOut> {
  const { data } = await apiClient.post<PropietarioOut>(`/api/v1/propietarios/${uid}/huella`, { template_b64 })
  return data
}

/** DELETE /api/v1/propietarios/{uid}/huella */
export async function eliminarHuella(uid: string): Promise<PropietarioOut> {
  const { data } = await apiClient.delete<PropietarioOut>(`/api/v1/propietarios/${uid}/huella`)
  return data
}

/** GET /api/v1/acceso/huellas (via acceso router, called from propietarios for admin use) */
export async function listarHuellasAdmin(): Promise<HuellaTemplate[]> {
  const { data } = await apiClient.get<HuellaTemplate[]>('/api/v1/acceso/huellas')
  return data
}
