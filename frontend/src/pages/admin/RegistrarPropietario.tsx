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
      <label className="block text-sm font-medium text-black mb-2">
        {label}
        {required && <span className="text-rose-400 ml-1">*</span>}
        {hint && <span className="text-gray-100 font-normal ml-2 text-xs">— {hint}</span>}
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
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <span className="text-blue-900 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span
          className={`text-black text-sm ${
            mono ? 'font-mono bg-white px-2 py-0.5 rounded-md tracking-widest' : 'font-medium'
          }`}
        >
          {value}
        </span>
        {mono && (
          <button
            onClick={handleCopy}
            className="text-gray-500 hover:text-gray-200 transition-colors"
            aria-label="Copiar UID"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
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
        <div className="glass p-8">
          {/* Icon */}
          <div className="w-16 h-16 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-5 ring-1 ring-emerald-500/30">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>

          <h2 className="text-xl font-bold text-blue/900 text-center mb-1">
            Propietario registrado
          </h2>
          <p className="text-blue-400 text-sm text-center mb-7">
            El propietario fue guardado exitosamente en el sistema.
          </p>

          {/* Summary */}
          <div className="bg-gray/500 rounded-xl px-4 py-2 mb-6 space-y-0.5">
            <InfoRow label="UID de acceso" value={success.uid} mono />
            <InfoRow label="Nombre" value={success.nombre} />
            <InfoRow label="Número de contacto" value={success.numero_contacto ?? 'Sin registrar'} />
            <InfoRow label="Torre" value={success.torre} />
            <InfoRow label="Apartamento" value={success.apartamento} />
          </div>

          {/* Photo thumbnail */}
          {success.foto_url && (
            <div className="flex justify-center mb-6">
              <img
                src={success.foto_url}
                alt={success.nombre}
                className="w-24 h-24 rounded-2xl object-cover border border-white/10 shadow-xl"
              />
            </div>
          )}

          {/* UID QR */}
          <div className="bg-gray-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <QrCode className="w-4 h-4 text-blue-600" />
              <p className="text-sm text-blue-900 font-medium">Código QR del UID</p>
            </div>

            {qrCodeDataUrl ? (
              <>
                <div className="flex justify-center mb-3">
                  <img
                    src={qrCodeDataUrl}
                    alt={`QR UID ${success.uid}`}
                    className="w-44 h-44 rounded-lg bg-white p-2"
                  />
                </div>
                <a
                  href={qrCodeDataUrl}
                  download={qrFileName(success.nombre, success.uid)}
                  className="btn-ghost w-full"
                >
                  <Download className="w-4 h-4" />
                  Descargar QR
                </a>
              </>
            ) : (
              <p className="text-sm text-gray-300">Generando QR...</p>
            )}

            {qrError && <p className="field-error mt-2">{qrError}</p>}
          </div>

          <button
            onClick={() => {
              setSuccess(null)
              setQrCodeDataUrl(null)
              setQrError(null)
            }}
            className="btn-primary w-full"
          >
            Registrar otro propietario
          </button>
        </div>
      </div>
    )
  }

  // ── Registration form ────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-blue-900 tracking-tight">Registrar Propietario</h1>
        <p className="text-gray-700 mt-1.5 text-sm">
          Completa los datos para dar de alta a un nuevo propietario y su acceso al parqueadero.
        </p>
      </div>

      <div className="glass p-8">
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
          <FormField label="Número de contacto" required error={errors.numero_contacto?.message}>
            <input
              {...register('numero_contacto')}
              placeholder="Ej: 300 123 4567"
              className="field"
              autoComplete="tel"
              maxLength={30}
            />
          </FormField>

          {/* Torre + Apartamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Torre"
              hint="1 · 2 · 12"
              required
              error={errors.torre?.message}
            >
              <input
                {...register('torre')}
                placeholder="Ej: 2"
                className="field"
                maxLength={3}
              />
            </FormField>

            <FormField
              label="Apartamento"
              hint="101 · 2204 · 302A"
              required
              error={errors.apartamento?.message}
            >
              <input
                {...register('apartamento')}
                placeholder="Ej: 101"
                className="field uppercase"
                maxLength={5}
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
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              className={`border-2 border-dashed rounded-xl transition-all duration-200 ${
                isDragging
                  ? 'border-blue-400 bg-blue-400/10 scale-[1.01]'
                  : 'border-white/15 hover:border-white/30'
              }`}
            >
              {photoPreview ? (
                /* Preview */
                <div className="flex items-center gap-4 p-4">
                  <img
                    src={photoPreview}
                    alt="Vista previa"
                    className="w-20 h-20 rounded-xl object-cover flex-shrink-0 border border-white/10"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{photo?.name}</p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {((photo?.size ?? 0) / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
                    aria-label="Quitar imagen"
                  >
                    <X className="w-4 h-4 text-gray-300" />
                  </button>
                </div>
              ) : (
                /* Drop zone */
                <label className="flex flex-col items-center justify-center py-10 cursor-pointer select-none">
                  <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-3">
                    <ImagePlus className="w-7 h-7 text-gray-500" />
                  </div>
                  <p className="text-sm text-gray-400">
                    Arrastra una foto o{' '}
                    <span className="text-blue-400 font-medium underline underline-offset-2">
                      haz clic aquí
                    </span>
                  </p>
                  <p className="text-xs text-gray-600 mt-1">PNG · JPG · WebP — máx. 5 MB</p>
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
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 flex items-start gap-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-rose-300">{apiError}</p>
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
