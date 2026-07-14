import type {
  ActualizarConjuntoPayload,
  ConjuntoResidencial,
  CrearConjuntoPayload,
  CrearVigilantePayload,
  UserOut,
} from '../types'
import apiClient from './axios'

export async function listarConjuntos(): Promise<ConjuntoResidencial[]> {
  const { data } = await apiClient.get<ConjuntoResidencial[]>('/api/v1/superadmin/conjuntos')
  return data
}

export async function crearConjunto(
  payload: CrearConjuntoPayload,
): Promise<ConjuntoResidencial> {
  const { data } = await apiClient.post<ConjuntoResidencial>(
    '/api/v1/superadmin/conjuntos',
    payload,
  )
  return data
}

export async function actualizarConjunto(
  id: string,
  payload: ActualizarConjuntoPayload,
): Promise<ConjuntoResidencial> {
  const { data } = await apiClient.put<ConjuntoResidencial>(
    `/api/v1/superadmin/conjuntos/${id}`,
    payload,
  )
  return data
}

export async function eliminarConjunto(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/superadmin/conjuntos/${id}`)
}

export async function crearVigilante(
  conjuntoId: string,
  payload: CrearVigilantePayload,
): Promise<UserOut> {
  const { data } = await apiClient.post<UserOut>(
    `/api/v1/superadmin/conjuntos/${conjuntoId}/vigilantes`,
    payload,
  )
  return data
}

export async function listarUsuariosConjunto(conjuntoId: string): Promise<UserOut[]> {
  const { data } = await apiClient.get<UserOut[]>(
    `/api/v1/superadmin/conjuntos/${conjuntoId}/usuarios`,
  )
  return data
}

export async function actualizarPasswordUsuario(
  userId: number,
  password: string,
): Promise<UserOut> {
  const { data } = await apiClient.patch<UserOut>(
    `/api/v1/superadmin/usuarios/${userId}/password`,
    { password },
  )
  return data
}
