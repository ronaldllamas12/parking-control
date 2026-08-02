import type { AxiosError } from 'axios'
import {
    CheckSquare,
    ChevronDown,
    FilePlus,
    ListOrdered,
    Pencil,
    RefreshCw,
    Search,
    Square,
    Trash2,
    X,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import {
    actualizarMovimiento,
    crearMovimientoCartera,
    eliminarMovimiento,
    listarConceptos,
    listarMovimientos,
} from '../../api/finanzas'
import { listarPropietarios } from '../../api/propietarios'
import type {
    ApiErrorBody,
    ConceptoMovimientoOut,
    MovimientoCarteraListItem,
    PropietarioOut,
} from '../../types'

function formatCop(centavos: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(centavos / 100)
}

function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

function periodoActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── Modal de edición masiva ───────────────────────────────────────────────────
interface BulkEditModalProps {
  ids: number[]
  conceptos: ConceptoMovimientoOut[]
  tipoFiltro: 'todos' | 'cargo' | 'abono'
  onClose: () => void
  onSaved: (updated: MovimientoCarteraListItem[]) => void
}

function BulkEditModal({ ids, conceptos, tipoFiltro, onClose, onSaved }: BulkEditModalProps) {
  const [applyMonto, setApplyMonto]       = useState(false)
  const [applyFecha, setApplyFecha]       = useState(false)
  const [applyPeriodo, setApplyPeriodo]   = useState(false)
  const [applyConcepto, setApplyConcepto] = useState(false)
  const [applyRef, setApplyRef]           = useState(false)
  const [applyNotas, setApplyNotas]       = useState(false)

  const [monto, setMonto]       = useState('')
  const [fecha, setFecha]       = useState(hoy())
  const [periodo, setPeriodo]   = useState(periodoActual())
  const [conceptoId, setConceptoId] = useState('')
  const [referencia, setReferencia] = useState('')
  const [notas, setNotas]       = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const filteredConceptos = tipoFiltro !== 'todos'
    ? conceptos.filter((c) => c.tipo === tipoFiltro)
    : conceptos.filter((c) => c.tipo === 'cargo' || c.tipo === 'abono')

  const noneSelected = !applyMonto && !applyFecha && !applyPeriodo && !applyConcepto && !applyRef && !applyNotas

  const handleSave = async () => {
    if (noneSelected) { setError('Marca al menos un campo para actualizar'); return }
    if (applyMonto && (!monto || Math.round(Number(monto) * 100) <= 0)) {
      setError('El monto debe ser mayor a 0'); return
    }
    setSaving(true); setError(null)
    const payload: Parameters<typeof actualizarMovimiento>[1] = {
      ...(applyMonto    ? { monto_centavos: Math.round(Number(monto) * 100) } : {}),
      ...(applyFecha    ? { fecha }                                            : {}),
      ...(applyPeriodo  ? { periodo }                                          : {}),
      ...(applyConcepto ? { concepto_id: conceptoId ? Number(conceptoId) : null } : {}),
      ...(applyRef      ? { referencia: referencia || null }                   : {}),
      ...(applyNotas    ? { notas: notas || null }                             : {}),
    }
    const results: MovimientoCarteraListItem[] = []
    const errors: string[] = []
    await Promise.allSettled(
      ids.map(async (id) => {
        try {
          results.push(await actualizarMovimiento(id, payload))
        } catch {
          errors.push(String(id))
        }
      }),
    )
    setSaving(false)
    if (errors.length) {
      setError(`${errors.length} movimiento(s) no se pudieron actualizar.`)
    }
    if (results.length) onSaved(results)
  }

  const Field = ({ active, onToggle, label, children }: {
    active: boolean; onToggle: () => void; label: string; children: ReactNode
  }) => (
    <div className={`rounded-xl border p-3 transition-colors ${active ? 'border-teal-300 bg-teal-50/40' : 'border-slate-200 bg-slate-50/50'}`}>
      <label className="flex items-center gap-2 cursor-pointer mb-2">
        <button type="button" onClick={onToggle} className="text-teal-600">
          {active ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-slate-400" />}
        </button>
        <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{label}</span>
      </label>
      <div className={active ? '' : 'pointer-events-none opacity-40'}>{children}</div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-800">
            Editar {ids.length} movimiento{ids.length !== 1 ? 's' : ''}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>
        <p className="px-5 pt-3 text-xs text-slate-500">
          Marca los campos que quieres actualizar. Los desmarcados no se modificarán.
        </p>

        <div className="overflow-y-auto space-y-3 p-5">
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

          <Field active={applyMonto} onToggle={() => setApplyMonto((v) => !v)} label="Monto (COP)">
            <input className="field" type="number" min={1} value={monto}
              onChange={(e) => setMonto(e.target.value)} />
          </Field>
          <Field active={applyFecha} onToggle={() => setApplyFecha((v) => !v)} label="Fecha">
            <input className="field" type="date" value={fecha}
              onChange={(e) => setFecha(e.target.value)} />
          </Field>
          <Field active={applyPeriodo} onToggle={() => setApplyPeriodo((v) => !v)} label="Período (YYYY-MM)">
            <input className="field" type="month" value={periodo}
              onChange={(e) => setPeriodo(e.target.value)} />
          </Field>
          <Field active={applyConcepto} onToggle={() => setApplyConcepto((v) => !v)} label="Concepto">
            <select className="field" value={conceptoId} onChange={(e) => setConceptoId(e.target.value)}>
              <option value="">— sin concepto —</option>
              {filteredConceptos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Field>
          <Field active={applyRef} onToggle={() => setApplyRef((v) => !v)} label="Referencia">
            <input className="field" type="text" maxLength={120} value={referencia}
              onChange={(e) => setReferencia(e.target.value)} />
          </Field>
          <Field active={applyNotas} onToggle={() => setApplyNotas((v) => !v)} label="Notas">
            <textarea className="field" rows={2} maxLength={500} value={notas}
              onChange={(e) => setNotas(e.target.value)} />
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancelar</button>
          <button type="button" onClick={() => { void handleSave() }} className="btn-primary"
            disabled={saving || noneSelected}>
            {saving ? 'Guardando…' : `Aplicar a ${ids.length} movimiento${ids.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal de edición ─────────────────────────────────────────────────────────
interface EditModalProps {
  item: MovimientoCarteraListItem
  conceptos: ConceptoMovimientoOut[]
  onClose: () => void
  onSaved: (updated: MovimientoCarteraListItem) => void
}

function EditModal({ item, conceptos, onClose, onSaved }: EditModalProps) {
  const [monto, setMonto] = useState(String(item.monto_centavos / 100))
  const [fecha, setFecha] = useState(item.fecha)
  const [periodo, setPeriodo] = useState(item.periodo ?? '')
  const [conceptoId, setConceptoId] = useState<string>(item.concepto_id ? String(item.concepto_id) : '')
  const [referencia, setReferencia] = useState(item.referencia ?? '')
  const [notas, setNotas] = useState(item.notas ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredConceptos = conceptos.filter((c) => c.tipo === item.tipo)

  const handleSave = async () => {
    const montoCentavos = Math.round(Number(monto) * 100)
    if (!monto || montoCentavos <= 0) { setError('El monto debe ser mayor a 0'); return }
    setSaving(true); setError(null)
    try {
      const updated = await actualizarMovimiento(item.id, {
        monto_centavos: montoCentavos,
        fecha: fecha || undefined,
        periodo: periodo || undefined,
        concepto_id: conceptoId ? Number(conceptoId) : null,
        referencia: referencia || null,
        notas: notas || null,
      })
      onSaved(updated)
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-800">
            Editar {item.tipo === 'cargo' ? 'cargo' : 'abono'} —&nbsp;
            {item.torre}{item.apartamento} · {item.propietario_nombre}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {error && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Monto (COP)</label>
              <input className="field" type="number" min={1} value={monto}
                onChange={(e) => setMonto(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Fecha</label>
              <input className="field" type="date" value={fecha}
                onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Período (YYYY-MM)</label>
              <input className="field" type="month" value={periodo}
                onChange={(e) => setPeriodo(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Concepto</label>
              <select className="field" value={conceptoId}
                onChange={(e) => setConceptoId(e.target.value)}>
                <option value="">— sin concepto —</option>
                {filteredConceptos.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="field-label">Referencia</label>
            <input className="field" type="text" maxLength={120} value={referencia}
              onChange={(e) => setReferencia(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Notas</label>
            <textarea className="field" rows={2} maxLength={500} value={notas}
              onChange={(e) => setNotas(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancelar</button>
          <button type="button" onClick={() => { void handleSave() }} className="btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal de nuevo movimiento ─────────────────────────────────────────────────
interface NuevoModalProps {
  conceptos: ConceptoMovimientoOut[]
  propietarios: PropietarioOut[]
  onClose: () => void
  onCreated: (item: MovimientoCarteraListItem) => void
}

function NuevoModal({ conceptos, propietarios, onClose, onCreated }: NuevoModalProps) {
  const [tipo, setTipo] = useState<'cargo' | 'abono'>('cargo')
  const [uid, setUid] = useState('')
  const [propSearch, setPropSearch] = useState('')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(hoy())
  const [periodo, setPeriodo] = useState(periodoActual())
  const [conceptoId, setConceptoId] = useState('')
  const [referencia, setReferencia] = useState('')
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredConceptos = conceptos.filter((c) => c.tipo === tipo)

  const filteredProps = propietarios.filter((p) => {
    const term = propSearch.toLowerCase()
    return (
      !term ||
      p.nombre.toLowerCase().includes(term) ||
      (p.torre + p.apartamento).toLowerCase().includes(term) ||
      p.uid.toLowerCase().includes(term)
    )
  })

  const handleCreate = async () => {
    if (!uid) { setError('Selecciona un propietario'); return }
    const montoCentavos = Math.round(Number(monto) * 100)
    if (!monto || montoCentavos <= 0) { setError('El monto debe ser mayor a 0'); return }
    setSaving(true); setError(null)
    try {
      const result = await crearMovimientoCartera(uid, {
        tipo,
        monto_centavos: montoCentavos,
        fecha,
        periodo: periodo || undefined,
        concepto_id: conceptoId ? Number(conceptoId) : null,
        referencia: referencia || null,
        notas: notas || null,
      })
      // result is EstadoCuentaOut — find the last movement and cast it
      const last = result.movimientos.at(-1)
      if (!last) { onClose(); return }
      const prop = propietarios.find((p) => p.uid === uid)!
      onCreated({
        id: last.id,
        tipo: last.tipo,
        monto_centavos: last.monto_centavos,
        fecha: last.fecha,
        periodo: last.periodo ?? null,
        referencia: last.referencia ?? null,
        notas: last.notas ?? null,
        concepto_id: last.concepto_id ?? null,
        concepto_nombre: last.concepto_nombre ?? null,
        created_by: last.created_by ?? null,
        created_at: last.created_at,
        propietario_id: result.propietario_id,
        propietario_uid: result.uid,
        propietario_nombre: result.nombre,
        torre: prop.torre,
        apartamento: prop.apartamento,
      })
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'Error al crear')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-800">Nuevo movimiento</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {error && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          )}

          {/* tipo */}
          <div>
            <label className="field-label">Tipo</label>
            <select className="field" value={tipo}
              onChange={(e) => { setTipo(e.target.value as 'cargo' | 'abono'); setConceptoId('') }}>
              <option value="cargo">Cargo / Expensa</option>
              <option value="abono">Abono / Pago</option>
            </select>
          </div>

          {/* propietario */}
          <div>
            <label className="field-label">Propietario</label>
            <div className="relative mb-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input className="field pl-8" type="text" placeholder="Buscar por nombre, torre/apto, UID…"
                value={propSearch} onChange={(e) => setPropSearch(e.target.value)} />
            </div>
            <select className="field" size={5} value={uid} onChange={(e) => setUid(e.target.value)}>
              {filteredProps.map((p) => (
                <option key={p.uid} value={p.uid}>
                  T{p.torre}-{p.apartamento} · {p.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Monto (COP)</label>
              <input className="field" type="number" min={1} value={monto}
                onChange={(e) => setMonto(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Fecha</label>
              <input className="field" type="date" value={fecha}
                onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Período (YYYY-MM)</label>
              <input className="field" type="month" value={periodo}
                onChange={(e) => setPeriodo(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Concepto</label>
              <select className="field" value={conceptoId}
                onChange={(e) => setConceptoId(e.target.value)}>
                <option value="">— sin concepto —</option>
                {filteredConceptos.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="field-label">Referencia</label>
            <input className="field" type="text" maxLength={120} value={referencia}
              onChange={(e) => setReferencia(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Notas</label>
            <textarea className="field" rows={2} maxLength={500} value={notas}
              onChange={(e) => setNotas(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancelar</button>
          <button type="button" onClick={() => { void handleCreate() }} className="btn-primary" disabled={saving}>
            {saving ? 'Creando…' : 'Crear movimiento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function FinanzasMovimientos() {
  const [items, setItems] = useState<MovimientoCarteraListItem[]>([])
  const [conceptos, setConceptos] = useState<ConceptoMovimientoOut[]>([])
  const [propietarios, setPropietarios] = useState<PropietarioOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // filters
  const [tipo, setTipo] = useState<'todos' | 'cargo' | 'abono'>('todos')
  const [periodo, setPeriodo] = useState(periodoActual())
  const [search, setSearch] = useState('')

  // modals
  const [editItem, setEditItem] = useState<MovimientoCarteraListItem | null>(null)
  const [showNuevo, setShowNuevo] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  // selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const allSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id))
  const someSelected = selectedIds.size > 0

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)))
    }
  }

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const data = await listarMovimientos({
        tipo: tipo !== 'todos' ? tipo : undefined,
        periodo: periodo || undefined,
        search: search.trim() || undefined,
      })
      setItems(data)
    } catch {
      setError('No se pudo cargar la lista de movimientos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.all([
      listarConceptos().then(setConceptos),
      listarPropietarios().then((d) => setPropietarios(d)),
    ])
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [tipo, periodo])

  const handleSearch = () => { void load() }

  const handleDelete = async () => {
    if (deleteId === null) return
    setDeleting(true)
    try {
      await eliminarMovimiento(deleteId)
      setItems((prev) => prev.filter((i) => i.id !== deleteId))
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(deleteId); return n })
      setNotice('Movimiento eliminado.')
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'Error al eliminar')
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  const handleBulkDelete = async () => {
    setBulkDeleting(true)
    const ids = [...selectedIds]
    let ok = 0
    await Promise.allSettled(ids.map(async (id) => {
      try { await eliminarMovimiento(id); ok++ } catch { /* skip */ }
    }))
    setItems((prev) => prev.filter((i) => !selectedIds.has(i.id)))
    setSelectedIds(new Set())
    setShowBulkDelete(false)
    setBulkDeleting(false)
    setNotice(`${ok} movimiento${ok !== 1 ? 's' : ''} eliminado${ok !== 1 ? 's' : ''}.`)
  }

  const totalCargos = items.filter((i) => i.tipo === 'cargo').reduce((s, i) => s + i.monto_centavos, 0)
  const totalAbonos = items.filter((i) => i.tipo === 'abono').reduce((s, i) => s + i.monto_centavos, 0)

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="page-header flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-500 flex items-center justify-center shadow-brand">
              <ListOrdered className="w-5 h-5 text-white" />
            </div>
            <h1 className="page-title">Cargos y expensas</h1>
          </div>
          <p className="page-subtitle pl-12">Gestión de cargos, abonos y expensas por propietario.</p>
        </div>
        <button type="button" onClick={() => setShowNuevo(true)} className="btn-primary">
          <FilePlus className="w-4 h-4" />
          Nuevo movimiento
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}
      {notice && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">{notice}</div>
      )}

      {/* Filtros */}
      <div className="card-lg p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="field-label">Tipo</label>
            <div className="relative">
              <select className="field pr-8" value={tipo}
                onChange={(e) => setTipo(e.target.value as typeof tipo)}>
                <option value="todos">Todos</option>
                <option value="cargo">Cargos / Expensas</option>
                <option value="abono">Abonos / Pagos</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>
          <div>
            <label className="field-label">Período</label>
            <input className="field" type="month" value={periodo}
              onChange={(e) => setPeriodo(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Buscar propietario</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input className="field pl-8" type="text" placeholder="Nombre, torre/apto, UID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
              </div>
              <button type="button" onClick={handleSearch} className="btn-primary px-3" disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Totales */}
      {!loading && items.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="stat-card">
            <div className="stat-icon bg-rose-100 text-rose-700">
              <ListOrdered className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total cargos</p>
              <p className="text-lg font-extrabold">{formatCop(totalCargos)}</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-emerald-100 text-emerald-700">
              <ListOrdered className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total abonos</p>
              <p className="text-lg font-extrabold">{formatCop(totalAbonos)}</p>
            </div>
          </div>
          <div className="stat-card">
            <div className={`stat-icon ${totalCargos - totalAbonos > 0 ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'}`}>
              <ListOrdered className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Saldo neto período</p>
              <p className="text-lg font-extrabold">{formatCop(totalCargos - totalAbonos)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-teal-600 px-4 py-3 text-white text-sm shadow-lg">
          <button type="button" onClick={() => setSelectedIds(new Set())} className="rounded-lg p-1 hover:bg-teal-500">
            <X className="h-4 w-4" />
          </button>
          <span className="font-semibold">{selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}</span>
          <div className="ml-auto flex gap-2">
            <button type="button" className="flex items-center gap-1.5 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/30 transition-colors"
              onClick={() => setShowBulkEdit(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Editar seleccionados
            </button>
            <button type="button" className="flex items-center gap-1.5 rounded-xl bg-rose-500/80 px-3 py-1.5 text-xs font-semibold hover:bg-rose-500 transition-colors"
              onClick={() => setShowBulkDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar seleccionados
            </button>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="card-lg overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400 text-sm">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No hay movimientos con esos filtros.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">
                    <button type="button" onClick={toggleAll} className="text-slate-400 hover:text-teal-600">
                      {allSelected
                        ? <CheckSquare className="h-4 w-4 text-teal-600" />
                        : someSelected
                          ? <CheckSquare className="h-4 w-4 text-teal-400" />
                          : <Square className="h-4 w-4" />}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold">Apto</th>
                  <th className="px-4 py-3 font-semibold">Propietario</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Concepto</th>
                  <th className="px-4 py-3 font-semibold">Período</th>
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                  <th className="px-4 py-3 font-semibold text-right">Monto</th>
                  <th className="px-4 py-3 font-semibold">Referencia</th>
                  <th className="px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className={`hover:bg-slate-50/60 transition-colors ${selectedIds.has(item.id) ? 'bg-teal-50/40' : ''}`}>
                    <td className="px-3 py-3">
                      <button type="button" onClick={() => toggleOne(item.id)} className="text-slate-400 hover:text-teal-600">
                        {selectedIds.has(item.id)
                          ? <CheckSquare className="h-4 w-4 text-teal-600" />
                          : <Square className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                      T{item.torre}-{item.apartamento}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.propietario_nombre}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        item.tipo === 'cargo'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {item.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.concepto_nombre ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.periodo ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(item.fecha + 'T12:00:00').toLocaleDateString('es-CO', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {formatCop(item.monto_centavos)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-[160px] truncate" title={item.referencia ?? undefined}>
                      {item.referencia ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Editar"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-teal-50 hover:text-teal-700 transition-colors"
                          onClick={() => setEditItem(item)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Eliminar"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                          onClick={() => setDeleteId(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal editar masivo */}
      {showBulkEdit && (
        <BulkEditModal
          ids={[...selectedIds]}
          conceptos={conceptos}
          tipoFiltro={tipo}
          onClose={() => setShowBulkEdit(false)}
          onSaved={(updated) => {
            setItems((prev) => prev.map((i) => updated.find((u) => u.id === i.id) ?? i))
            setShowBulkEdit(false)
            setSelectedIds(new Set())
            setNotice(`${updated.length} movimiento${updated.length !== 1 ? 's' : ''} actualizado${updated.length !== 1 ? 's' : ''}.`)
          }}
        />
      )}

      {/* Modal editar */}
      {editItem && (
        <EditModal
          item={editItem}
          conceptos={conceptos}
          onClose={() => setEditItem(null)}
          onSaved={(updated) => {
            setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
            setEditItem(null)
            setNotice('Movimiento actualizado.')
          }}
        />
      )}

      {/* Modal nuevo */}
      {showNuevo && (
        <NuevoModal
          conceptos={conceptos}
          propietarios={propietarios}
          onClose={() => setShowNuevo(false)}
          onCreated={(item) => {
            setItems((prev) => [item, ...prev])
            setShowNuevo(false)
            setNotice('Movimiento creado correctamente.')
          }}
        />
      )}

      {/* Confirm bulk delete */}
      {showBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h2 className="font-bold text-slate-800">¿Eliminar {selectedIds.size} movimiento{selectedIds.size !== 1 ? 's' : ''}?</h2>
            <p className="text-sm text-slate-600">
              Esta acción no se puede deshacer. Los saldos de los propietarios se recalcularán automáticamente.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" disabled={bulkDeleting}
                onClick={() => setShowBulkDelete(false)}>Cancelar</button>
              <button type="button" className="btn-danger" disabled={bulkDeleting}
                onClick={() => { void handleBulkDelete() }}>
                {bulkDeleting ? 'Eliminando…' : 'Eliminar todos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h2 className="font-bold text-slate-800">¿Eliminar movimiento?</h2>
            <p className="text-sm text-slate-600">
              Esta acción no se puede deshacer. El saldo del propietario se recalculará automáticamente.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" disabled={deleting}
                onClick={() => setDeleteId(null)}>Cancelar</button>
              <button type="button" className="btn-danger" disabled={deleting}
                onClick={() => { void handleDelete() }}>
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
