import type { PropietarioOut, TelegramLinkOut } from '../types'
import apiClient from './axios'

/** POST /api/v1/propietarios/{uid}/telegram-link
 *  Generates (or regenerates) a one-time Telegram deep-link for the propietario.
 *  The previous token is automatically invalidated.
 */
export async function generarEnlaceTelegram(uid: string): Promise<TelegramLinkOut> {
  const { data } = await apiClient.post<TelegramLinkOut>(
    `/api/v1/propietarios/${uid}/telegram-link`,
  )
  return data
}

/** GET /api/v1/propietarios/{uid}
 *  Fetch a single propietario — used for polling the linked status.
 */
export async function obtenerPropietario(uid: string): Promise<PropietarioOut> {
  const { data } = await apiClient.get<PropietarioOut>(`/api/v1/propietarios/${uid}`)
  return data
}

/** POST /api/v1/telegram/set-webhook
 *  Registers the webhook URL with Telegram for the current conjunto's bot.
 *  base_url — public root URL of the API, e.g. "https://my-api.onrender.com"
 */
export async function configurarWebhook(
  base_url: string,
): Promise<{ ok: boolean; webhook_url: string }> {
  const { data } = await apiClient.post('/api/v1/telegram/set-webhook', { base_url })
  return data
}
