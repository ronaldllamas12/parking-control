import { zodResolver } from '@hookform/resolvers/zod'
import type { AxiosError } from 'axios'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ImagePlus,
  QrCode,
  UserPlus,
  X,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { registrarPropietario } from '../../api/propietarios'
import type { ApiErrorBody, PropietarioOut } from '../../types'
import { createOwnerQrDataUrl, qrFileName } from '../../utils/qrDownload'

// Mirrors backend Pydantic constraints
const schema = z.object({
  nombre: z.string().min(3, 'Mínimo 3 caracteres').max(120, 'Máximo 120 caracteres').trim(),
  numero_contacto: z
    .string()
    .trim()
    .min(7, 'Mínimo 7 caracteres')
    .max(30, 'Máximo 30 caracteres')
    .regex(/^\+?[0-9\s()-]+$/, 'Solo números, espacios, paréntesis, guiones y + inicial'),
  torre: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{0,2}$/, 'Solo números desde 1. Ejemplos: 1 · 2 · 12'),
  apartamento: z
    .string()
    .trim()
    .regex(/^[0-9]{2,4}[A-Za-z]?$/, 'Formato inválido. Ejemplos: 101 · 2204 · 302A'),
})
type FormValues = z.infer<typeof schema>

// ── Subcomponents ─────────────────────────────────────────────────────────────
function FormField({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="field-label">
        {label}
        {required && <span className="text-rose-500 ml-1">*</span>}
        {hint && <span className="text-slate-400 font-normal normal-case tracking-normal ml-1.5 text-xs">— {hint}</span>}
      </label>
      {children}
      {error && (
        <p className="field-error">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-surface-200 last:border-0">
      <span className="text-slate-500 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-slate-900 text-sm ${
          mono ? 'font-mono bg-brand-50 text-brand-800 px-2.5 py-0.5 rounded-lg tracking-widest border border-brand-100' : 'font-semibold'
        }`}>
          {value}
        </span>
        {mono && (
          <button onClick={handleCopy} className="btn-icon" aria-label="Copiar">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RegistrarPropietario() {
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [success, setSuccess] = useState<PropietarioOut | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null)
  const [qrError, setQrError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const applyPhoto = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setPhotoError('Solo se permiten archivos de imagen (PNG, JPG, WebP…)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('La imagen no debe superar los 5 MB')
      return
    }
    setPhotoError(null)
    setPhoto(file)
    // Revoke any previous object URL to avoid memory leaks
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(URL.createObjectURL(file))
  }, [photoPreview])

  const removePhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhoto(null)
    setPhotoPreview(null)
    setPhotoError(null)
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) applyPhoto(file)
    },
    [applyPhoto],
  )

  const onSubmit = async (values: FormValues) => {
    if (!photo) {
      setPhotoError('La foto del propietario es obligatoria')
      return
    }
    setApiError(null)
    try {
      const result = await registrarPropietario(
        values.nombre,
        values.numero_contacto,
        values.torre,
        values.apartamento,
        photo,
      )

      try {
        const qrPngData = await createOwnerQrDataUrl(result.uid, result.nombre)
        setQrCodeDataUrl(qrPngData)
        setQrError(null)
      } catch {
        setQrCodeDataUrl(null)
        setQrError('No se pudo generar la imagen QR para descargar.')
      }

      setSuccess(result)
      reset()
      removePhoto()
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      const status = axiosErr.response?.status
      const detail = axiosErr.response?.data?.detail
      if (status === 405) {
        setApiError('Error 405: metodo HTTP no permitido para este endpoint')
      } else {
        setApiError(detail ? `Error ${status ?? ''}: ${detail}`.trim() : 'Error al registrar el propietario')
      }
    }
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="max-w-md mx-auto animate-scale-in">
        <div className="card-lg overflow-hidden">

          {/* Success header */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-6 py-8 text-center text-white relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="w-16 h-16 rounded-3xl bg-white/20 border border-white/30 backdrop-blur
                            flex items-center justify-center mx-auto mb-4 shadow-lg">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-extrabold tracking-tight">¡Propietario registrado!</h2>
            <p className="text-white/70 text-sm mt-1">Los datos fueron guardados exitosamente.</p>
          </div>

          <div className="px-6 py-6 space-y-5">
            {/* Summary */}
            <div className="bg-surface-50 border border-surface-200 rounded-2xl px-4 py-1">
              <InfoRow label="UID de acceso" value={success.uid} mono />
              <InfoRow label="Nombre" value={success.nombre} />
              <InfoRow label="Contacto" value={success.numero_contacto ?? 'Sin registrar'} />
              <InfoRow label="Torre" value={success.torre} />
              <InfoRow label="Apartamento" value={success.apartamento} />
            </div>

            {/* Photo */}
            {success.foto_url && (
              <div className="flex justify-center">
                <img
                  src={success.foto_url} alt={success.nombre}
                  className="w-24 h-24 rounded-3xl object-cover border-2 border-surface-200 shadow-card-lg"
                />
              </div>
            )}

            {/* QR */}
            <div className="bg-surface-50 border border-surface-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center">
                  <QrCode className="w-4 h-4 text-brand-600" />
                </div>
                <p className="text-sm font-bold text-slate-700">Código QR del UID</p>
              </div>
              {qrCodeDataUrl ? (
                <>
                  <div className="flex justify-center mb-4">
                    <img src={qrCodeDataUrl} alt={`QR ${success.uid}`}
                      className="w-44 h-44 rounded-2xl bg-white p-2 shadow-card border border-surface-200" />
                  </div>
                  <a href={qrCodeDataUrl} download={qrFileName(success.nombre, success.uid)} className="btn-ghost w-full">
                    <Download className="w-4 h-4" />Descargar QR
                  </a>
                </>
              ) : qrError ? (
                <p className="field-error">{qrError}</p>
              ) : (
                <p className="text-sm text-slate-400">Generando QR…</p>
              )}
            </div>

            <button
              onClick={() => { setSuccess(null); setQrCodeDataUrl(null); setQrError(null) }}
              className="btn-primary w-full"
            >
              <UserPlus className="w-4 h-4" />Registrar otro propietario
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Registration form ────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto animate-fade-in">

      {/* Page header */}
      <div className="page-header">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-2xl bg-gradient-brand flex items-center justify-center shadow-brand">
            <UserPlus className="w-5 h-5 text-white" />
          </div>
          <h1 className="page-title">Registrar Propietario</h1>
        </div>
        <p className="page-subtitle pl-12">Completa los datos para añadir un nuevo acceso al parqueadero.</p>
      </div>

      <div className="card-lg p-6 sm:p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          {/* Nombre */}
          <FormField label="Nombre completo" required error={errors.nombre?.message}>
            <input
              {...register('nombre')}
              placeholder="Ej: Carlos Martínez López"
              className="field"
              autoComplete="name"
            />
          </FormField>

          {/* Numero de contacto */}
          <FormField
              label="Número de contacto"
              required
              error={errors.numero_contacto?.message}
              >
                <input
                {...register("numero_contacto", {
                  pattern: {
                    value: /^[0-9]+$/,
                    message: "Solo se permiten números",
                  },
                })}
                placeholder="Ej: 3001234567"
                className="field"
                autoComplete="tel"
                inputMode="numeric"
                maxLength={10}
                onInput={(e) => {
                  e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "");
                }}
                />
          </FormField>

          {/* Torre + Apartamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Torre"
              hint="1 · 2 · 10"
              required
              error={errors.torre?.message}
            >
              <input
                {...register('torre', {
                  pattern: {
                    value: /^[0-9]+$/,
                    message: "Solo se permiten números",
                  },
                })}
                placeholder="Ej: 2"
                className="field"
                maxLength={2}
                onInput={(e) => {
                  e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").replace(/^0+/, "");
                }}
              />
            </FormField>

            <FormField
              label="Apartamento"
              hint="101 · 2204 · 302"
              required
              error={errors.apartamento?.message}
            >
              <input
                {...register('apartamento')}
                placeholder="Ej: 101"
                className="field uppercase"
                maxLength={5}
                onInput={(e) => {
                  e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").replace(/^0+/, "");
                }}
              />
            </FormField>
          </div>

          {/* Photo upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Foto del propietario <span className="text-rose-400">*</span>
            </label>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              className={`border-2 border-dashed rounded-2xl transition-all duration-200 ${
                isDragging
                  ? 'border-brand-400 bg-brand-50 scale-[1.01]'
                  : 'border-surface-200 hover:border-brand-300 bg-surface-50'
              }`}
            >
              {photoPreview ? (
                /* Preview */
                <div className="flex items-center gap-4 p-4">
                  <img
                    src={photoPreview}
                    alt="Vista previa"
                    className="w-20 h-20 rounded-2xl object-cover flex-shrink-0 border-2 border-surface-200 shadow-card"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-800 text-sm font-semibold truncate">{photo?.name}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{((photo?.size ?? 0) / 1024).toFixed(0)} KB</p>
                  </div>
                  <button type="button" onClick={removePhoto} className="btn-icon" aria-label="Quitar imagen">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                /* Drop zone */
                <label className="flex flex-col items-center justify-center py-10 cursor-pointer select-none">
                  <div className="w-14 h-14 bg-brand-100 rounded-2xl flex items-center justify-center mb-3">
                    <ImagePlus className="w-7 h-7 text-brand-500" />
                  </div>
                  <p className="text-sm text-slate-600">
                    Arrastra una foto o{' '}
                    <span className="text-brand-600 font-semibold underline underline-offset-2">haz clic aquí</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">PNG · JPG · WebP — máx. 5 MB</p>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) applyPhoto(f)
                      // Reset input so the same file can be re-selected
                      e.target.value = ''
                    }}
                  />
                </label>
              )}
            </div>

            {photoError && (
              <p className="field-error mt-2">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                {photoError}
              </p>
            )}
          </div>

          {/* API error */}
          {apiError && (
            <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 rounded-2xl p-3.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-700">{apiError}</p>
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Registrando…
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Registrar Propietario
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
