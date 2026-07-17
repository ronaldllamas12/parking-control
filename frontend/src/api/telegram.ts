import type { PropietarioOut, TelegramLinkOut } from '../types'
import apiClient from './axios'

/** POST /api/v1/propietarios/{uid}/telegram-link */
export async function generarEnlaceTelegram(uid: string): Promise<TelegramLinkOut> {
  const { data } = await apiClient.post<TelegramLinkOut>(
    `/api/v1/propietarios/${uid}/telegram-link`,
  )
  return data
}

/** GET /api/v1/propietarios/{uid} — poll for linked status */
export async function obtenerPropietario(uid: string): Promise<PropietarioOut> {
  const { data } = await apiClient.get<PropietarioOut>(`/api/v1/propietarios/${uid}`)
  return data
}

export interface WebhookInfo {
  webhook_configurado: boolean
  webhook_url: string | null
  pending_updates: number
  last_error: string | null
  last_error_date: number | null
}

/** GET /api/v1/telegram/webhook-info */
export async function obtenerWebhookInfo(): Promise<WebhookInfo> {
  const { data } = await apiClient.get<WebhookInfo>('/api/v1/telegram/webhook-info')
  return data
}

/** POST /api/v1/telegram/set-webhook */
export async function configurarWebhook(
  base_url: string,
): Promise<{ ok: boolean; webhook_url: string }> {
  const { data } = await apiClient.post('/api/v1/telegram/set-webhook', { base_url })
  return data
}
