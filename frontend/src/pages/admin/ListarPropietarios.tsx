import type { AxiosError } from 'axios'
import {
    Building2,
    Download,
    Edit2,
    Home,
    Phone,
    Plus,
    RefreshCw,
    Save,
    ShieldCheck,
    ShieldX,
    Trash2,
    X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
    actualizarPropietario,
    eliminarPropietario,
    listarPropietarios,
    toggleAccesoPropietario,
} from '../../api/propietarios'
import type { ApiErrorBody, PropietarioOut } from '../../types'
import { createOwnerQrDataUrl, qrFileName } from '../../utils/qrDownload'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
      <div className="card-lg w-full max-w-md animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-premium px-5 py-4 flex items-center justify-between">
          <h2 className="text-white font-bold text-base">Editar Propietario</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Foto */}
          <div className="flex items-center gap-4 p-3 bg-surface-50 rounded-2xl border border-surface-200">
            <img
              src={preview} alt={nombre}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-surface-200 shadow-card flex-shrink-0"
              onError={(e) => { ;(e.target as HTMLImageElement).src = avatarSvg(nombre) }}
            />
            <div>
              <p className="text-slate-500 text-xs mb-1.5 font-medium">Foto (opcional)</p>
              <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary text-xs px-3 py-2">
                Cambiar foto
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFoto} />
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label className="field-label">Nombre</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value.toUpperCase())} required minLength={3} maxLength={120} className="field" />
          </div>

          {/* numero de contacto */}
          <div>
            <label className="field-label">Número de contacto</label>
            <input type="text" value={numeroContacto} onChange={(e) => setNumeroContacto(e.target.value.replace(/\D/g, ''))} required minLength={7} maxLength={10} inputMode="numeric" pattern="[0-9]*" className="field" />
          </div>

          {/* Torre */}
          <div>
            <label className="field-label">Torre</label>
            <input value={torre} onChange={(e) => setTorre(e.target.value.replace(/\D/g, ''))} required inputMode="numeric" pattern="[0-9]*" className="field" />
          </div>

          {/* Apartamento */}
          <div>
            <label className="field-label">Apartamento</label>
            <input value={apartamento} onChange={(e) => setApartamento(e.target.value.toUpperCase().replace(/\D/g, ''))} required inputMode="numeric" pattern="[0-9]*" className="field uppercase" />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
      <div className="card-lg w-full max-w-sm animate-scale-in overflow-hidden">
        <div className="bg-gradient-to-br from-rose-600 to-rose-500 px-5 py-6 text-center text-white">
          <div className="w-14 h-14 rounded-full bg-white/20 border border-white/30 flex items-center justify-center mx-auto mb-3">
            <Trash2 className="w-6 h-6" />
          </div>
          <h2 className="font-extrabold text-lg">Eliminar Propietario</h2>
          <p className="text-white/75 text-sm mt-1">{item.nombre}</p>
          <p className="text-white/50 text-xs mt-0.5">Torre {item.torre} · Apto {item.apartamento}</p>
        </div>
        <div className="p-5">
          <p className="text-center text-slate-600 text-sm mb-4">Esta acción es irreversible. ¿Continuar?</p>
          {error && <p className="field-error justify-center mb-3">{error}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-cancel flex-1">Cancelar</button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50
                         text-white font-semibold rounded-2xl px-6 py-3 text-sm transition-all duration-200">
              {deleting
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Trash2 className="w-4 h-4" />}
              Eliminar
            </button>
          </div>
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
  const [togglingUid, setTogglingUid] = useState<string | null>(null)
  const location = useLocation()
  const isEditMode = new URLSearchParams(location.search).get('mode') === 'edit'

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
      const qrDataUrl = await createOwnerQrDataUrl(item.uid, item.nombre)

      const anchor = document.createElement('a')
      anchor.href = qrDataUrl
      anchor.download = qrFileName(item.nombre, item.uid)
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
    } catch {
      setError(`No se pudo generar el QR para el UID ${item.uid}`)
    } finally {
      setDownloadingQrUid(null)
    }
  }

  const handleToggleAcceso = async (item: PropietarioOut) => {
    setTogglingUid(item.uid)
    try {
      const updated = await toggleAccesoPropietario(item.uid)
      setPropietarios((prev) => prev.map((p) => (p.uid === updated.uid ? updated : p)))
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'Error al cambiar estado de acceso')
    } finally {
      setTogglingUid(null)
    }
  }

  return (
    <div className="animate-fade-in">

      {/* Premium header */}
      <div className="page-header mb-7 rounded-3xl bg-gradient-dark p-5 sm:p-6 text-white shadow-float">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/80 mb-2">
              Gestión rápida
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight">Propietarios</h1>
            <p className="mt-0.5 text-sm text-white/55">
              {loading ? 'Cargando…' : `${propietarios.length} propietario${propietarios.length !== 1 ? 's' : ''} registrado${propietarios.length !== 1 ? 's' : ''}`}
            </p>
            {isEditMode && (
              <span className="mt-2 inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300 font-semibold">
                Modo edición activado
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={load} disabled={loading} className="btn-icon w-10 h-10" aria-label="Recargar lista">
              <RefreshCw className={`w-4 h-4 text-white ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Link to="/admin/registrar" className="btn-primary px-4 py-2.5 text-xs">
              <Plus className="w-4 h-4" />Registrar
            </Link>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 text-rose-700 text-sm mb-5">{error}</div>
      )}

      {/* Empty */}
      {!loading && !error && propietarios.length === 0 && (
        <div className="card-lg p-12 text-center">
          <p className="text-slate-400 text-sm">No hay propietarios registrados aún.</p>
          <Link to="/admin/registrar" className="btn-primary mt-4 inline-flex"><Plus className="w-4 h-4" />Registrar primero</Link>
        </div>
      )}

      {/* Grid */}
      {propietarios.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {propietarios.map((p) => (
            <div
              key={p.uid}
              className={`card p-4 flex items-center gap-3 hover:-translate-y-0.5 hover:shadow-card-lg transition-all duration-200 ${!p.acceso_habilitado ? 'opacity-75 border-rose-200' : ''}`}
            >
              <div className="relative flex-shrink-0">
                <img
                  src={p.foto_url} alt={p.nombre}
                  className={`h-14 w-14 rounded-2xl object-cover border-2 shadow-sm ${p.acceso_habilitado ? 'border-surface-200' : 'border-rose-300'}`}
                  onError={(e) => { ;(e.target as HTMLImageElement).src = avatarSvg(p.nombre) }}
                />
                {!p.acceso_habilitado && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center shadow-sm">
                    <ShieldX className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">{p.nombre}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="badge-blue"><Building2 className="w-2.5 h-2.5" />T{p.torre}</span>
                  <span className="badge bg-surface-100 text-slate-600 border border-surface-200"><Home className="w-2.5 h-2.5" />{p.apartamento}</span>
                  {p.acceso_habilitado ? (
                    <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <ShieldCheck className="w-2.5 h-2.5" />Acceso OK
                    </span>
                  ) : (
                    <span className="badge bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                      <ShieldX className="w-2.5 h-2.5" />Denegado
                    </span>
                  )}
                </div>
                {p.numero_contacto && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
                    <Phone className="w-3 h-3" />{p.numero_contacto}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => { void handleToggleAcceso(p) }}
                  disabled={togglingUid === p.uid}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors disabled:opacity-60 ${
                    p.acceso_habilitado
                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                  }`}
                  aria-label={p.acceso_habilitado ? 'Deshabilitar acceso' : 'Habilitar acceso'}
                  title={p.acceso_habilitado ? 'Deshabilitar acceso' : 'Habilitar acceso'}
                >
                  {togglingUid === p.uid
                    ? <span className={`w-3.5 h-3.5 border-2 rounded-full animate-spin ${p.acceso_habilitado ? 'border-emerald-200 border-t-emerald-600' : 'border-rose-200 border-t-rose-600'}`} />
                    : p.acceso_habilitado
                      ? <ShieldCheck className="w-3.5 h-3.5" />
                      : <ShieldX className="w-3.5 h-3.5" />
                  }
                </button>
                <button onClick={() => { void handleDownloadQr(p) }} disabled={downloadingQrUid === p.uid}
                  className="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition-colors disabled:opacity-60"
                  aria-label="Descargar QR">
                  {downloadingQrUid === p.uid
                    ? <span className="w-3.5 h-3.5 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                    : <Download className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => setEditing(p)}
                  className="w-8 h-8 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-600 flex items-center justify-center transition-colors"
                  aria-label="Editar">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setDeleting(p)}
                  className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors"
                  aria-label="Eliminar">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditModal item={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}
      {deleting && (
        <DeleteConfirm item={deleting} onClose={() => setDeleting(null)} onDeleted={handleDeleted} />
      )}
    </div>
  )
}
