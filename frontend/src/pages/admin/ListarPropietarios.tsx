import type { AxiosError } from 'axios'
import {
  Building2,
  Download,
  Edit2,
  Home,
  Plus,
  Phone,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'
import {
  actualizarPropietario,
  eliminarPropietario,
  listarPropietarios,
} from '../../api/propietarios'
import type { ApiErrorBody, PropietarioOut } from '../../types'

// ── helpers ───────────────────────────────────────────────────────────────────
function avatarSvg(letter: string): string {
  const encoded = encodeURIComponent(letter.toUpperCase())
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="12" fill="%232563eb"/><text x="40" y="52" font-size="34" text-anchor="middle" fill="white" font-family="sans-serif" font-weight="bold">${encoded}</text></svg>`
}

// ── EditModal ─────────────────────────────────────────────────────────────────
interface EditModalProps {
  item: PropietarioOut
  onClose: () => void
  onSaved: (updated: PropietarioOut) => void
}

function EditModal({ item, onClose, onSaved }: EditModalProps) {
  const [nombre, setNombre] = useState(item.nombre)
  const [numeroContacto, setNumeroContacto] = useState(item.numero_contacto ?? '')
  const [torre, setTorre] = useState(item.torre)
  const [apartamento, setApartamento] = useState(item.apartamento)
  const [foto, setFoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string>(item.foto_url)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFoto(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const updated = await actualizarPropietario(
        item.uid,
        { nombre, numero_contacto: numeroContacto, torre, apartamento },
        foto ?? undefined,
      )
      onSaved(updated)
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <div className="glass w-full max-w-md animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-red/10">
          <h2 className="text-blue-800 font-bold text-lg">Editar Propietario</h2>
          <button onClick={onClose} className="text-red-400 hover:text-red-600  transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Foto */}
          <div className="flex items-center gap-4">
            <img
              src={preview}
              alt={nombre}
              className="w-16 h-16 rounded-xl object-cover border-2 border-white/20 flex-shrink-0"
              onError={(e) => {
                ;(e.target as HTMLImageElement).src = avatarSvg(nombre)
              }}
            />
            <div>
              <p className="text-gray-400 text-xs mb-1.5">Foto (opcional)</p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="btn-ghost text-xs px-3 py-2"
              >
                Cambiar foto
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFoto}
              />
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              minLength={3}
              maxLength={120}
              className="field"
            />
          </div>

          {/* Torre */}
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Número de contacto</label>
            <input
              value={numeroContacto}
              onChange={(e) => setNumeroContacto(e.target.value)}
              required
              minLength={7}
              maxLength={30}
              pattern="^\+?[0-9\s()-]+$"
              className="field"
            />
          </div>

          {/* Torre */}
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Torre</label>
            <input
              value={torre}
              onChange={(e) => setTorre(e.target.value)}
              required
              pattern="^[1-9][0-9]{0,2}$"
              className="field"
            />
          </div>

          {/* Apartamento */}
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Apartamento</label>
            <input
              value={apartamento}
              onChange={(e) => setApartamento(e.target.value.toUpperCase())}
              required
              pattern="^[0-9]{2,4}[A-Z]?$"
              className="field uppercase"
            />
          </div>

          {error && <p className="field-error">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-cancel flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── DeleteConfirm ─────────────────────────────────────────────────────────────
interface DeleteConfirmProps {
  item: PropietarioOut
  onClose: () => void
  onDeleted: (uid: string) => void
}

function DeleteConfirm({ item, onClose, onDeleted }: DeleteConfirmProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      await eliminarPropietario(item.uid)
      onDeleted(item.uid)
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'Error al eliminar')
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass w-full max-w-sm animate-scale-in p-6 text-center">
        <div className="w-14 h-14 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4 ring-1 ring-rose-500/30">
          <Trash2 className="w-6 h-6 text-rose-400" />
        </div>
        <h2 className="text-white font-bold text-lg mb-1">Eliminar Propietario</h2>
        <p className="text-gray-400 text-sm mb-1">
          ¿Estás seguro de eliminar a <span className="text-white font-medium">{item.nombre}</span>?
        </p>
        <p className="text-gray-500 text-xs mb-5">
          Torre {item.torre} · Apto {item.apartamento} · UID {item.uid}
        </p>
        {error && <p className="field-error justify-center mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-cancel flex-1">
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50
                       text-white font-semibold rounded-xl px-6 py-3 transition-all duration-200 flex-1"
          >
            {deleting ? (
              <span className="w-4 h-4 border-2 border-red border-t-red rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ListarPropietarios() {
  const [propietarios, setPropietarios] = useState<PropietarioOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<PropietarioOut | null>(null)
  const [deleting, setDeleting] = useState<PropietarioOut | null>(null)
  const [downloadingQrUid, setDownloadingQrUid] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listarPropietarios()
      setPropietarios(data)
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'Error al cargar propietarios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleSaved = (updated: PropietarioOut) => {
    setPropietarios((prev) => prev.map((p) => (p.uid === updated.uid ? updated : p)))
    setEditing(null)
  }

  const handleDeleted = (uid: string) => {
    setPropietarios((prev) => prev.filter((p) => p.uid !== uid))
    setDeleting(null)
  }

  const handleDownloadQr = async (item: PropietarioOut) => {
    setDownloadingQrUid(item.uid)
    try {
      const qrDataUrl = await QRCode.toDataURL(item.uid, {
        width: 320,
        margin: 2,
        errorCorrectionLevel: 'M',
      })

      const anchor = document.createElement('a')
      anchor.href = qrDataUrl
      anchor.download = `qr-uid-${item.uid}.png`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
    } catch {
      setError(`No se pudo generar el QR para el UID ${item.uid}`)
    } finally {
      setDownloadingQrUid(null)
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-blue-900 tracking-tight">Propietarios</h1>
          <p className="text-gray-700 mt-1 text-sm">
            {loading ? 'Cargando…' : `${propietarios.length} propietario${propietarios.length !== 1 ? 's' : ''} registrado${propietarios.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="btn-ghost px-4"
            aria-label="Recargar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <a href="/admin/registrar" className="btn-primary px-4">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:block">Registrar</span>
          </a>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="glass border-rose-500/20 p-4 text-rose-300 text-sm mb-6">{error}</div>
      )}

      {/* Empty state */}
      {!loading && !error && propietarios.length === 0 && (
        <div className="glass p-12 text-center">
          <p className="text-gray-400 text-sm">No hay propietarios registrados.</p>
        </div>
      )}

      {/* List */}
      {propietarios.length > 0 && (
        <div className="space-y-3">
          {propietarios.map((p) => (
            <div
              key={p.uid}
              className="glass flex items-center gap-4 px-4 py-3 hover:bg-white/[0.09] transition-colors duration-150"
            >
              {/* Photo */}
              <img
                src={p.foto_url}
                alt={p.nombre}
                className="w-12 h-12 rounded-xl object-cover border border-white/10 flex-shrink-0"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src = avatarSvg(p.nombre)
                }}
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-blue-800 font-semibold text-sm truncate">{p.nombre}</p>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <span className="flex items-center gap-1 text-gray-400 text-xs">
                    <Building2 className="w-3 h-3" />
                    Torre {p.torre}
                  </span>
                  <span className="flex items-center gap-1 text-gray-400 text-xs">
                    <Home className="w-3 h-3" />
                    Apto {p.apartamento}
                  </span>
                  {p.numero_contacto && (
                    <span className="flex items-center gap-1 text-gray-400 text-xs">
                      <Phone className="w-3 h-3" />
                      {p.numero_contacto}
                    </span>
                  )}
                  <span className="text-gray-600 text-xs font-mono tracking-widest hidden sm:block">
                    {p.uid}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    void handleDownloadQr(p)
                  }}
                  disabled={downloadingQrUid === p.uid}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-emerald-500/20
                             text-gray-400 hover:text-emerald-400 transition-colors duration-150 disabled:opacity-60"
                  aria-label="Descargar QR del propietario"
                >
                  {downloadingQrUid === p.uid ? (
                    <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => setEditing(p)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-blue-500/20
                             text-gray-400 hover:text-blue-400 transition-colors duration-150"
                  aria-label="Editar propietario"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleting(p)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-rose-500/20
                             text-gray-400 hover:text-rose-400 transition-colors duration-150"
                  aria-label="Eliminar propietario"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {editing && (
        <EditModal item={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}
      {deleting && (
        <DeleteConfirm
          item={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
