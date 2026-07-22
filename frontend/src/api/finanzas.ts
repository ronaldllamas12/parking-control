import type {
  CarteraItemOut,
  ConceptoMovimientoOut,
  ConfigFinancieraOut,
  EstadoCuentaOut,
  GenerarCuotasOut,
  MovimientoCarteraCreate,
} from '../types'
import apiClient from './axios'

export async function obtenerConfigFinanciera(): Promise<ConfigFinancieraOut> {
  const { data } = await apiClient.get<ConfigFinancieraOut>('/api/v1/finanzas/config')
  return data
}

export async function actualizarConfigFinanciera(payload: {
  cuota_mensual_centavos: number
  dia_vencimiento: number
  activo: boolean
}): Promise<ConfigFinancieraOut> {
  const { data } = await apiClient.put<ConfigFinancieraOut>('/api/v1/finanzas/config', payload)
  return data
}

export async function listarConceptos(tipo?: string): Promise<ConceptoMovimientoOut[]> {
  const { data } = await apiClient.get<ConceptoMovimientoOut[]>('/api/v1/finanzas/conceptos', {
    params: tipo ? { tipo } : undefined,
  })
  return data
}

export async function generarCuotas(periodo: string): Promise<GenerarCuotasOut> {
  const { data } = await apiClient.post<GenerarCuotasOut>('/api/v1/finanzas/generar-cuotas', {
    periodo,
  })
  return data
}

export async function listarCartera(params?: {
  torre?: string
  estado?: string
  saldo_min?: number
  saldo_max?: number
}): Promise<CarteraItemOut[]> {
  const { data } = await apiClient.get<CarteraItemOut[]>('/api/v1/finanzas/cartera', { params })
  return data
}

export async function obtenerEstadoCuenta(uid: string): Promise<EstadoCuentaOut> {
  const { data } = await apiClient.get<EstadoCuentaOut>(
    `/api/v1/finanzas/propietarios/${uid}/estado-cuenta`,
  )
  return data
}

export async function crearMovimientoCartera(
  uid: string,
  payload: MovimientoCarteraCreate,
): Promise<EstadoCuentaOut> {
  const { data } = await apiClient.post<EstadoCuentaOut>(
    `/api/v1/finanzas/propietarios/${uid}/movimientos`,
    payload,
  )
  return data
}

export async function enviarRecordatorioFinanciero(uid: string): Promise<void> {
  await apiClient.post(`/api/v1/finanzas/propietarios/${uid}/recordatorio`)
}

async function downloadBlob(url: string, fallbackName: string): Promise<void> {
  const { data, headers } = await apiClient.get<Blob>(url, { responseType: 'blob' })
  const disposition = headers['content-disposition'] as string | undefined
  const match = disposition?.match(/filename="?([^"]+)"?/)
  const filename = match?.[1] ?? fallbackName
  const objectUrl = URL.createObjectURL(data)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}

export async function exportarEstadoCuentaPdf(uid: string): Promise<void> {
  await downloadBlob(
    `/api/v1/finanzas/propietarios/${uid}/estado-cuenta.pdf`,
    `estado-cuenta-${uid}.pdf`,
  )
}

export async function exportarEstadoCuentaExcel(uid: string): Promise<void> {
  await downloadBlob(
    `/api/v1/finanzas/propietarios/${uid}/estado-cuenta.xlsx`,
    `estado-cuenta-${uid}.xlsx`,
  )
}
