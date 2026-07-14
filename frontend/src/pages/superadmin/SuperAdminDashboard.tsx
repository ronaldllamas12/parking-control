import type { AxiosError } from 'axios'
import {
  AlertCircle,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  Edit2,
  Fingerprint,
  Home,
  KeyRound,
  LockKeyhole,
  Plus,
  Power,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import {
  actualizarConjunto,
  actualizarPasswordUsuario,
  crearConjunto,
  crearVigilante,
  eliminarConjunto,
  listarConjuntos,
  listarUsuariosConjunto,
  obtenerMetricasConjunto,
} from '../../api/superadmin'
import type { ApiErrorBody, ConjuntoMetricas, ConjuntoResidencial, UserOut } from '../../types'

interface FormState {
  nombre: string
  direccion: string
  adminUsername: string
  adminPassword: string
}

const initialForm: FormState = {
  nombre: '',
  direccion: '',
  adminUsername: '',
  adminPassword: '',
}

const initialVigilanteForm = {
  conjuntoId: '',
  username: '',
  password: '',
}

const initialPasswordForm = {
  conjuntoId: '',
  userId: '',
  password: '',
}

export default function SuperAdminDashboard() {
  const [conjuntos, setConjuntos] = useState<ConjuntoResidencial[]>([])
  const [selectedConjuntoId, setSelectedConjuntoId] = useState<string>('')
  const [metricas, setMetricas] = useState<ConjuntoMetricas | null>(null)
  const [usuariosConjunto, setUsuariosConjunto] = useState<UserOut[]>([])
  const [form, setForm] = useState<FormState>(initialForm)
  const [vigilanteForm, setVigilanteForm] = useState(initialVigilanteForm)
  const [passwordForm, setPasswordForm] = useState(initialPasswordForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ nombre: '', direccion: '', activo: true })
  const [loading, setLoading] = useState(true)
  const [loadingMetrics, setLoadingMetrics] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingVigilante, setSavingVigilante] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadConjuntos = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listarConjuntos()
      setConjuntos(data)
      setSelectedConjuntoId((prev) => prev || data[0]?.id || '')
      setVigilanteForm((prev) => ({
        ...prev,
        conjuntoId: prev.conjuntoId || data[0]?.id || '',
      }))
      setPasswordForm((prev) => ({
        ...prev,
        conjuntoId: prev.conjuntoId || data[0]?.id || '',
      }))
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudieron cargar los conjuntos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConjuntos()
  }, [])

  useEffect(() => {
    if (!selectedConjuntoId) {
      setMetricas(null)
      return
    }

    let cancelled = false

    const loadMetricas = async () => {
      setLoadingMetrics(true)
      try {
        const data = await obtenerMetricasConjunto(selectedConjuntoId)
        if (!cancelled) setMetricas(data)
      } catch (err) {
        if (cancelled) return
        const axiosErr = err as AxiosError<ApiErrorBody>
        setError(axiosErr.response?.data?.detail ?? 'No se pudieron cargar las métricas del conjunto')
      } finally {
        if (!cancelled) setLoadingMetrics(false)
      }
    }

    loadMetricas()
    return () => {
      cancelled = true
    }
  }, [selectedConjuntoId])

  useEffect(() => {
    if (!passwordForm.conjuntoId) {
      setUsuariosConjunto([])
      setPasswordForm((prev) => ({ ...prev, userId: '' }))
      return
    }

    let cancelled = false

    const loadUsuarios = async () => {
      setLoadingUsers(true)
      try {
        const data = await listarUsuariosConjunto(passwordForm.conjuntoId)
        if (cancelled) return
        setUsuariosConjunto(data)
        setPasswordForm((prev) => ({
          ...prev,
          userId: data.some((user) => String(user.id) === prev.userId)
            ? prev.userId
            : String(data[0]?.id ?? ''),
        }))
      } catch (err) {
        if (cancelled) return
        const axiosErr = err as AxiosError<ApiErrorBody>
        setError(axiosErr.response?.data?.detail ?? 'No se pudieron cargar los usuarios del conjunto')
      } finally {
        if (!cancelled) setLoadingUsers(false)
      }
    }

    loadUsuarios()
    return () => {
      cancelled = true
    }
  }, [passwordForm.conjuntoId])

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const validate = (): string | null => {
    if (form.nombre.trim().length < 3) return 'El nombre del conjunto debe tener al menos 3 caracteres'
    if (form.adminUsername.trim().length < 3) return 'El usuario admin debe tener al menos 3 caracteres'
    if (form.adminPassword.length < 8) return 'La contraseña del admin debe tener mínimo 8 caracteres'
    return null
  }

  const startEdit = (conjunto: ConjuntoResidencial) => {
    setError(null)
    setSuccess(null)
    setEditingId(conjunto.id)
    setEditForm({
      nombre: conjunto.nombre,
      direccion: conjunto.direccion ?? '',
      activo: conjunto.activo,
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({ nombre: '', direccion: '', activo: true })
  }

  const handleUpdate = async (id: string) => {
    setError(null)
    setSuccess(null)

    if (editForm.nombre.trim().length < 3) {
      setError('El nombre del conjunto debe tener al menos 3 caracteres')
      return
    }

    setSavingEdit(true)
    try {
      const updated = await actualizarConjunto(id, {
        nombre: editForm.nombre.trim(),
        direccion: editForm.direccion.trim() || null,
        activo: editForm.activo,
      })
      setConjuntos((prev) => prev.map((item) => (item.id === id ? updated : item)))
      setMetricas((prev) => (prev && prev.conjunto.id === id ? { ...prev, conjunto: updated } : prev))
      setSuccess(`Conjunto actualizado: ${updated.nombre}`)
      cancelEdit()
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo actualizar el conjunto')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleToggleActive = async (conjunto: ConjuntoResidencial) => {
    setError(null)
    setSuccess(null)

    try {
      const updated = await actualizarConjunto(conjunto.id, {
        activo: !conjunto.activo,
      })
      setConjuntos((prev) => prev.map((item) => (item.id === conjunto.id ? updated : item)))
      setMetricas((prev) =>
        prev && prev.conjunto.id === conjunto.id ? { ...prev, conjunto: updated } : prev,
      )
      setSuccess(`${updated.nombre} quedó ${updated.activo ? 'activo' : 'inactivo'}`)
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo cambiar el estado del conjunto')
    }
  }

  const handleDelete = async (conjunto: ConjuntoResidencial) => {
    const confirmed = window.confirm(
      `Eliminar "${conjunto.nombre}" borrará también sus admins, vigilantes, propietarios, accesos y huellas. Esta acción no se puede deshacer.`,
    )
    if (!confirmed) return

    setError(null)
    setSuccess(null)
    setDeletingId(conjunto.id)
    try {
      await eliminarConjunto(conjunto.id)
      setConjuntos((prev) => prev.filter((item) => item.id !== conjunto.id))
      setSelectedConjuntoId((prev) => {
        if (prev !== conjunto.id) return prev
        return conjuntos.find((item) => item.id !== conjunto.id)?.id ?? ''
      })
      setVigilanteForm((prev) => {
        if (prev.conjuntoId !== conjunto.id) return prev
        const nextConjunto = conjuntos.find((item) => item.id !== conjunto.id)
        return { ...prev, conjuntoId: nextConjunto?.id ?? '' }
      })
      setPasswordForm((prev) => {
        if (prev.conjuntoId !== conjunto.id) return prev
        const nextConjunto = conjuntos.find((item) => item.id !== conjunto.id)
        return { ...prev, conjuntoId: nextConjunto?.id ?? '', userId: '', password: '' }
      })
      setSuccess(`Conjunto eliminado: ${conjunto.nombre}`)
      if (editingId === conjunto.id) cancelEdit()
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo eliminar el conjunto')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    try {
      const created = await crearConjunto({
        conjunto: {
          nombre: form.nombre.trim(),
          direccion: form.direccion.trim() || null,
        },
        admin: {
          username: form.adminUsername.trim(),
          password: form.adminPassword,
        },
      })
      setConjuntos((prev) => [created, ...prev])
      setSelectedConjuntoId((prev) => prev || created.id)
      setVigilanteForm((prev) => ({
        ...prev,
        conjuntoId: prev.conjuntoId || created.id,
      }))
      setPasswordForm((prev) => ({
        ...prev,
        conjuntoId: prev.conjuntoId || created.id,
      }))
      setForm(initialForm)
      setSuccess(`Conjunto creado y admin inicial registrado: ${created.nombre}`)
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo crear el conjunto')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateVigilante = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!vigilanteForm.conjuntoId) {
      setError('Selecciona el conjunto residencial')
      return
    }
    if (vigilanteForm.username.trim().length < 3) {
      setError('El usuario vigilante debe tener al menos 3 caracteres')
      return
    }
    if (vigilanteForm.password.length < 8) {
      setError('La contraseña del vigilante debe tener mínimo 8 caracteres')
      return
    }

    setSavingVigilante(true)
    try {
      const created = await crearVigilante(vigilanteForm.conjuntoId, {
        username: vigilanteForm.username.trim(),
        password: vigilanteForm.password,
      })
      const conjunto = conjuntos.find((item) => item.id === vigilanteForm.conjuntoId)
      if (passwordForm.conjuntoId === vigilanteForm.conjuntoId) {
        setUsuariosConjunto((prev) => [...prev, created])
        setPasswordForm((prev) => ({
          ...prev,
          userId: prev.userId || String(created.id),
        }))
      }
      setMetricas((prev) =>
        prev && prev.conjunto.id === vigilanteForm.conjuntoId
          ? { ...prev, vigilantes: prev.vigilantes + 1 }
          : prev,
      )
      setVigilanteForm((prev) => ({
        conjuntoId: prev.conjuntoId,
        username: '',
        password: '',
      }))
      setSuccess(`Vigilante ${created.username} enrolado en ${conjunto?.nombre ?? 'el conjunto seleccionado'}`)
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo enrolar el vigilante')
    } finally {
      setSavingVigilante(false)
    }
  }

  const handleUpdatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!passwordForm.conjuntoId) {
      setError('Selecciona el conjunto residencial')
      return
    }
    if (!passwordForm.userId) {
      setError('Selecciona el usuario')
      return
    }
    if (passwordForm.password.length < 8) {
      setError('La nueva contraseña debe tener mínimo 8 caracteres')
      return
    }

    setSavingPassword(true)
    try {
      const updated = await actualizarPasswordUsuario(
        Number(passwordForm.userId),
        passwordForm.password,
      )
      setPasswordForm((prev) => ({ ...prev, password: '' }))
      setSuccess(`Contraseña actualizada para ${updated.username}`)
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo actualizar la contraseña')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Super Admin</p>
          <h1 className="page-title">Conjuntos Residenciales</h1>
        </div>
        <button
          type="button"
          onClick={loadConjuntos}
          disabled={loading}
          className="btn-secondary w-full sm:w-auto px-4 py-2.5 text-xs"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {(error || success) && (
        <div
          className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 ${
            error
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {error ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <p className="text-sm font-medium">{error ?? success}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
        <div className="space-y-6">
        <section className="rounded-2xl border border-surface-200 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-surface-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-brand-600" />
              <h2 className="text-base font-extrabold text-slate-800">Tenants activos</h2>
            </div>
            <span className="rounded-full bg-surface-100 px-3 py-1 text-xs font-bold text-slate-500">
              {conjuntos.length}
            </span>
          </div>

          <div className="divide-y divide-surface-100">
            {loading ? (
              <div className="p-6 text-sm font-medium text-slate-500">Cargando conjuntos...</div>
            ) : conjuntos.length === 0 ? (
              <div className="p-6 text-sm font-medium text-slate-500">No hay conjuntos registrados.</div>
            ) : (
              conjuntos.map((conjunto) => {
                const isEditing = editingId === conjunto.id
                const isSelected = selectedConjuntoId === conjunto.id
                return (
                  <article
                    key={conjunto.id}
                    onClick={() => {
                      if (!isEditing) setSelectedConjuntoId(conjunto.id)
                    }}
                    className={`px-5 py-4 transition-colors ${
                      isSelected ? 'bg-brand-50/70' : 'hover:bg-surface-50'
                    } ${isEditing ? '' : 'cursor-pointer'}`}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="field-label">Nombre</label>
                            <input
                              value={editForm.nombre}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, nombre: event.target.value }))}
                              className="field"
                            />
                          </div>
                          <div>
                            <label className="field-label">Direccion</label>
                            <input
                              value={editForm.direccion}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, direccion: event.target.value }))}
                              className="field"
                            />
                          </div>
                        </div>
                        <label className="flex w-fit items-center gap-2 rounded-xl border border-surface-200 px-3 py-2 text-xs font-bold text-slate-600">
                          <input
                            type="checkbox"
                            checked={editForm.activo}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, activo: event.target.checked }))}
                            className="h-4 w-4 accent-brand-600"
                          />
                          Activo
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdate(conjunto.id)}
                            disabled={savingEdit}
                            className="btn-primary px-4 py-2 text-xs"
                          >
                            <Save className="h-4 w-4" />
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="btn-secondary px-4 py-2 text-xs"
                          >
                            <X className="h-4 w-4" />
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-extrabold text-slate-800">{conjunto.nombre}</h3>
                          <p className="truncate text-xs font-medium text-slate-500">
                            {conjunto.direccion || 'Sin direccion registrada'}
                          </p>
                          <p className="mt-1 font-mono text-[11px] text-slate-400">{conjunto.id}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
                          <span
                            className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                              conjunto.activo
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {conjunto.activo ? 'Activo' : 'Inactivo'}
                          </span>
                          <button
                            type="button"
                            onClick={() => startEdit(conjunto)}
                            className="rounded-xl border border-surface-200 p-2 text-slate-500 transition-colors hover:border-brand-300 hover:text-brand-700"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(conjunto)}
                            className="rounded-xl border border-surface-200 p-2 text-slate-500 transition-colors hover:border-amber-300 hover:text-amber-700"
                            title={conjunto.activo ? 'Inactivar' : 'Activar'}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(conjunto)}
                            disabled={deletingId === conjunto.id}
                            className="rounded-xl border border-rose-200 p-2 text-rose-500 transition-colors hover:bg-rose-50 disabled:opacity-50"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                )
              })
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-surface-200 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-surface-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-brand-600" />
              <h2 className="text-base font-extrabold text-slate-800">Métricas del conjunto</h2>
            </div>
            {loadingMetrics && (
              <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
            )}
          </div>

          {!selectedConjuntoId ? (
            <div className="p-6 text-sm font-medium text-slate-500">
              Selecciona un conjunto para ver sus métricas.
            </div>
          ) : !metricas ? (
            <div className="p-6 text-sm font-medium text-slate-500">
              Cargando métricas...
            </div>
          ) : (
            <div className="space-y-5 p-5">
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-extrabold text-slate-900">{metricas.conjunto.nombre}</h3>
                <p className="text-sm font-medium text-slate-500">
                  {metricas.conjunto.direccion || 'Sin direccion registrada'}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: 'Admins', value: metricas.admins, icon: Users },
                  { label: 'Vigilantes', value: metricas.vigilantes, icon: ShieldCheck },
                  { label: 'Propietarios', value: metricas.propietarios, icon: Home },
                  { label: 'Accesos hoy', value: metricas.accesos_hoy, icon: Clock },
                  { label: 'Accesos totales', value: metricas.accesos_totales, icon: BarChart3 },
                  { label: 'Con acceso', value: metricas.propietarios_con_acceso, icon: CheckCircle2 },
                  { label: 'Sin acceso', value: metricas.propietarios_sin_acceso, icon: AlertCircle },
                  { label: 'Huellas', value: metricas.huellas_registradas, icon: Fingerprint },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-2xl font-extrabold text-slate-900">{value}</p>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-surface-200">
                <div className="border-b border-surface-200 px-4 py-3">
                  <h3 className="text-sm font-extrabold text-slate-800">Últimos accesos</h3>
                </div>
                {metricas.ultimos_accesos.length === 0 ? (
                  <div className="px-4 py-5 text-sm font-medium text-slate-500">
                    Este conjunto todavía no tiene registros de acceso.
                  </div>
                ) : (
                  <div className="divide-y divide-surface-100">
                    {metricas.ultimos_accesos.map((access) => (
                      <div key={`${access.uid}-${access.verificado_en}`} className="px-4 py-3">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-800">{access.nombre}</p>
                            <p className="text-xs font-medium text-slate-500">
                              Torre {access.torre} · Apto {access.apartamento} · UID {access.uid}
                            </p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-xs font-semibold text-slate-500">
                              {new Date(access.verificado_en).toLocaleString('es-CO')}
                            </p>
                            <p className="text-xs font-medium text-slate-400">
                              {access.vigilante_username || 'Sin vigilante'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
        </div>

        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="rounded-2xl border border-surface-200 bg-white p-5 shadow-soft">
            <div className="mb-5 flex items-center gap-2">
              <Plus className="h-5 w-5 text-brand-600" />
              <h2 className="text-base font-extrabold text-slate-800">Crear conjunto</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="field-label">Nombre del conjunto</label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={form.nombre}
                    onChange={(event) => updateField('nombre', event.target.value)}
                    className="field pl-10"
                    placeholder="Ej: Torres del Lago"
                    autoComplete="organization"
                  />
                </div>
              </div>

              <div>
                <label className="field-label">Direccion</label>
                <input
                  value={form.direccion}
                  onChange={(event) => updateField('direccion', event.target.value)}
                  className="field"
                  placeholder="Direccion del conjunto"
                  autoComplete="street-address"
                />
              </div>

              <div className="my-5 h-px bg-surface-200" />

              <div className="mb-3 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-brand-600" />
                <h3 className="text-sm font-extrabold text-slate-700">Admin inicial</h3>
              </div>

              <div>
                <label className="field-label">Usuario admin</label>
                <input
                  value={form.adminUsername}
                  onChange={(event) => updateField('adminUsername', event.target.value)}
                  className="field"
                  placeholder="Ej: admin_torres_lago"
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="field-label">Contrasena inicial</label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={form.adminPassword}
                    onChange={(event) => updateField('adminPassword', event.target.value)}
                    type="password"
                    className="field pl-10"
                    placeholder="Minimo 8 caracteres"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <button type="submit" disabled={saving} className="btn-primary w-full">
                {saving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Creando...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Crear conjunto y admin
                  </>
                )}
              </button>
            </div>
          </form>

          <form onSubmit={handleCreateVigilante} className="rounded-2xl border border-surface-200 bg-white p-5 shadow-soft">
            <div className="mb-5 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand-600" />
              <h2 className="text-base font-extrabold text-slate-800">Enrolar vigilante</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="field-label">Conjunto</label>
                <select
                  value={vigilanteForm.conjuntoId}
                  onChange={(event) => setVigilanteForm((prev) => ({ ...prev, conjuntoId: event.target.value }))}
                  className="field"
                  disabled={conjuntos.length === 0}
                >
                  {conjuntos.length === 0 ? (
                    <option value="">No hay conjuntos</option>
                  ) : (
                    conjuntos.map((conjunto) => (
                      <option key={conjunto.id} value={conjunto.id}>
                        {conjunto.nombre}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="field-label">Usuario vigilante</label>
                <input
                  value={vigilanteForm.username}
                  onChange={(event) => setVigilanteForm((prev) => ({ ...prev, username: event.target.value }))}
                  className="field"
                  placeholder="Ej: vigilante_torre_norte"
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="field-label">Contrasena inicial</label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={vigilanteForm.password}
                    onChange={(event) => setVigilanteForm((prev) => ({ ...prev, password: event.target.value }))}
                    type="password"
                    className="field pl-10"
                    placeholder="Minimo 8 caracteres"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingVigilante || conjuntos.length === 0}
                className="btn-primary w-full"
              >
                {savingVigilante ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Enrolando...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Enrolar vigilante
                  </>
                )}
              </button>
            </div>
          </form>

          <form onSubmit={handleUpdatePassword} className="rounded-2xl border border-surface-200 bg-white p-5 shadow-soft">
            <div className="mb-5 flex items-center gap-2">
              <LockKeyhole className="h-5 w-5 text-brand-600" />
              <h2 className="text-base font-extrabold text-slate-800">Cambiar contraseña</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="field-label">Conjunto</label>
                <select
                  value={passwordForm.conjuntoId}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      conjuntoId: event.target.value,
                      userId: '',
                      password: '',
                    }))
                  }
                  className="field"
                  disabled={conjuntos.length === 0}
                >
                  {conjuntos.length === 0 ? (
                    <option value="">No hay conjuntos</option>
                  ) : (
                    conjuntos.map((conjunto) => (
                      <option key={conjunto.id} value={conjunto.id}>
                        {conjunto.nombre}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="field-label">Usuario</label>
                <select
                  value={passwordForm.userId}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({ ...prev, userId: event.target.value }))
                  }
                  className="field"
                  disabled={loadingUsers || usuariosConjunto.length === 0}
                >
                  {loadingUsers ? (
                    <option value="">Cargando usuarios...</option>
                  ) : usuariosConjunto.length === 0 ? (
                    <option value="">No hay admins ni vigilantes</option>
                  ) : (
                    usuariosConjunto.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.username} - {user.role === 'admin' ? 'Admin' : 'Vigilante'}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="field-label">Nueva contraseña</label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={passwordForm.password}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({ ...prev, password: event.target.value }))
                    }
                    type="password"
                    className="field pl-10"
                    placeholder="Minimo 8 caracteres"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  savingPassword ||
                  loadingUsers ||
                  conjuntos.length === 0 ||
                  usuariosConjunto.length === 0
                }
                className="btn-primary w-full"
              >
                {savingPassword ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <LockKeyhole className="h-4 w-4" />
                    Actualizar contraseña
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
