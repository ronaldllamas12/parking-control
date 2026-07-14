import type { ConjuntoMetricas } from '../types'
import apiClient from './axios'

export async function obtenerMisMetricas(): Promise<ConjuntoMetricas> {
  const { data } = await apiClient.get<ConjuntoMetricas>('/api/v1/admin/metricas')
  return data
}
