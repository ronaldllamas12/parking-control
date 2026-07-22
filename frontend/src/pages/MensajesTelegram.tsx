import { MessageSquare, RefreshCw, Send } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  listarConversacionesTelegram,
  obtenerConversacionTelegram,
  responderConversacionTelegram,
} from '../api/telegram'
import { useAuth } from '../context/AuthContext'
import type { TelegramConversationDetailOut, TelegramConversationOut } from '../types'

const MAX_MESSAGE_LENGTH = 1000

function formatDate(value: string): string {
  return new Date(value).toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export default function MensajesTelegram() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<TelegramConversationOut[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<TelegramConversationDetailOut | null>(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const roleLabel = user?.role === 'vigilante' ? 'vigilante' : 'administración'

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedId) ?? null,
    [conversations, selectedId],
  )

  const loadConversations = async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await listarConversacionesTelegram()
      setConversations(data)
      setSelectedId((current) => current ?? data[0]?.id ?? null)
    } catch {
      setError('No se pudieron cargar las conversaciones.')
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = async (id: number) => {
    setLoadingDetail(true)
    setError(null)
    try {
      const data = await obtenerConversacionTelegram(id)
      setDetail(data)
      setConversations((items) =>
        items.map((item) =>
          item.id === id ? { ...item, unread_count: 0, last_message_text: data.conversation.last_message_text } : item,
        ),
      )
    } catch {
      setError('No se pudo abrir la conversación.')
    } finally {
      setLoadingDetail(false)
    }
  }

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId)
    } else {
      setDetail(null)
    }
  }, [selectedId])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const message = draft.trim()
    if (!selectedId || !message || message.length > MAX_MESSAGE_LENGTH) return

    setSending(true)
    setError(null)
    try {
      const sent = await responderConversacionTelegram(selectedId, message)
      setDetail((current) =>
        current
          ? {
              ...current,
              messages: [...current.messages, sent],
              conversation: {
                ...current.conversation,
                last_message_at: sent.created_at,
                last_message_text: sent.text,
              },
            }
          : current,
      )
      setConversations((items) =>
        items
          .map((item) =>
            item.id === selectedId
              ? { ...item, last_message_at: sent.created_at, last_message_text: sent.text }
              : item,
          )
          .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()),
      )
      setDraft('')
    } catch {
      setError('No se pudo enviar el mensaje.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-teal-700">Telegram</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Mensajes</h1>
          <p className="text-sm text-slate-500">Conversaciones dirigidas a {roleLabel}.</p>
        </div>
        <button
          type="button"
          onClick={loadConversations}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-surface-50"
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      <div className="grid min-h-[620px] gap-4 lg:grid-cols-[360px_1fr]">
        <section className="overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm">
          <div className="border-b border-surface-200 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-800">Conversaciones</h2>
          </div>

          {loading ? (
            <div className="p-4 text-sm text-slate-500">Cargando conversaciones...</div>
          ) : conversations.length === 0 ? (
            <div className="flex h-72 flex-col items-center justify-center gap-3 px-6 text-center text-slate-500">
              <MessageSquare className="h-9 w-9 text-slate-300" />
              <p className="text-sm font-semibold">Aún no hay mensajes para {roleLabel}.</p>
            </div>
          ) : (
            <div className="max-h-[560px] overflow-y-auto">
              {conversations.map((conversation) => {
                const active = conversation.id === selectedId
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setSelectedId(conversation.id)}
                    className={`w-full border-b border-surface-100 px-4 py-3 text-left transition-colors ${
                      active ? 'bg-teal-50' : 'hover:bg-surface-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {conversation.propietario_nombre}
                        </p>
                        <p className="text-xs font-semibold text-slate-500">
                          Torre {conversation.torre} · Apto {conversation.apartamento} · {conversation.propietario_uid}
                        </p>
                      </div>
                      {conversation.unread_count > 0 && (
                        <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[11px] font-bold text-white">
                          {conversation.unread_count}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                      {conversation.last_message_text || 'Sin mensajes'}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">
                      {formatDate(conversation.last_message_at)}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="flex min-h-[620px] flex-col overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm">
          <div className="border-b border-surface-200 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-800">
              {selectedConversation
                ? `${selectedConversation.propietario_nombre} · Torre ${selectedConversation.torre} Apto ${selectedConversation.apartamento}`
                : 'Seleccione una conversación'}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto bg-surface-50 p-4">
            {loadingDetail ? (
              <p className="text-sm text-slate-500">Cargando mensajes...</p>
            ) : !detail ? (
              <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">
                No hay conversación seleccionada.
              </div>
            ) : (
              <div className="space-y-3">
                {detail.messages.map((message) => {
                  const outgoing = message.sender_role !== 'propietario'
                  return (
                    <div key={message.id} className={`flex ${outgoing ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[82%] rounded-lg px-3 py-2 shadow-sm ${
                          outgoing
                            ? 'bg-teal-700 text-white'
                            : 'border border-surface-200 bg-white text-slate-800'
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>
                        <p className={`mt-1 text-[11px] font-semibold ${outgoing ? 'text-teal-100' : 'text-slate-400'}`}>
                          {outgoing ? message.sender_username || roleLabel : 'Propietario'} · {formatDate(message.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-surface-200 bg-white p-3">
            <div className="flex gap-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                disabled={!selectedId || sending}
                maxLength={MAX_MESSAGE_LENGTH}
                rows={2}
                className="min-h-[52px] flex-1 resize-none rounded-lg border border-surface-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-surface-100"
                placeholder="Escriba una respuesta..."
              />
              <button
                type="submit"
                disabled={!selectedId || !draft.trim() || sending}
                className="inline-flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-lg bg-teal-700 text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                title="Enviar"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-right text-[11px] font-semibold text-slate-400">
              {draft.length}/{MAX_MESSAGE_LENGTH}
            </p>
          </form>
        </section>
      </div>
    </div>
  )
}
