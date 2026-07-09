import type { AxiosError } from 'axios'
import {
    Building2,
    Camera,
    CameraOff,
    Clock,
    CreditCard,
    Home,
    Phone,
    QrCode,
    RotateCcw,
    Search,
    ShieldCheck,
    ShieldX,
} from 'lucide-react'
import QrScanner from 'qr-scanner'
import { useEffect, useRef, useState } from 'react'
import { listarHistorialReciente, verificarAcceso } from '../../api/acceso'
import type { ApiErrorBody, HistorialAccesoOut, VerificacionResponse } from '../../types'

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function avatarSvg(letter: string): string {
  const encoded = encodeURIComponent(letter.toUpperCase())
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="16" fill="%232563eb"/><text x="48" y="62" font-size="42" text-anchor="middle" fill="white" font-family="sans-serif" font-weight="bold">${encoded}</text></svg>`
}

function phoneHref(phone?: string | null): string | null {
  if (!phone) return null

  const cleaned = phone.replace(/[^\d+]/g, '')
  return cleaned ? `tel:${cleaned}` : null
}

// ── Sub-components ────────────────────────────────────────────────────────────
function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3">
      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-slate-500 text-xs leading-none mb-0.5">{label}</p>
        <p className="text-slate-900 font-semibold text-sm">{value}</p>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function VerificarAcceso() {
  const [uid, setUid] = useState('')
  const [loading, setLoading] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [result, setResult] = useState<VerificacionResponse | null>(null)
  const [denied, setDenied] = useState<string | null>(null)
  const [historial, setHistorial] = useState<HistorialAccesoOut[]>([])
  const [historialError, setHistorialError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    void loadHistorial()
  }, [])

  useEffect(() => {
    return () => {
      scannerRef.current?.stop()
      scannerRef.current?.destroy()
      scannerRef.current = null
    }
  }, [])

  const loadHistorial = async () => {
    setHistorialError(null)
    try {
      const data = await listarHistorialReciente()
      setHistorial(data)
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setHistorialError(axiosErr.response?.data?.detail ?? 'No se pudo cargar el historial')
    }
  }

  const verifyUid = async (rawUid: string) => {
    const trimmed = rawUid.trim()
    if (!trimmed) return

    setLoading(true)
    setResult(null)
    setDenied(null)
    try {
      const data = await verificarAcceso(trimmed)
      setResult(data)
      await loadHistorial()
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      if (axiosErr.response?.status === 404) {
        setDenied('ID no encontrado en el sistema')
      } else {
        setDenied(axiosErr.response?.data?.detail ?? 'Error de conexión')
      }
    } finally {
      setLoading(false)
    }
  }

  const stopScanner = () => {
    scannerRef.current?.stop()
    scannerRef.current?.destroy()
    scannerRef.current = null
    setCameraActive(false)
    setCameraLoading(false)
  }

  const startScanner = async () => {
    if (!videoRef.current) return
    setCameraError(null)
    setCameraLoading(true)

    try {
      const hasCamera = await QrScanner.hasCamera()
      if (!hasCamera) {
        setCameraError('No se detectó cámara en este dispositivo.')
        setCameraLoading(false)
        return
      }

      const scanner = new QrScanner(
        videoRef.current,
        (scanResult) => {
          const qrText = scanResult.data.trim()
          if (!qrText) return

          const parsedUid = qrText.toUpperCase()
          setUid(parsedUid)
          stopScanner()
          void verifyUid(parsedUid)
        },
        {
          preferredCamera: 'environment',
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
        },
      )

      scannerRef.current = scanner
      await scanner.start()
      await videoRef.current.play()
      setCameraActive(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('Error al iniciar QrScanner:', err)
      setCameraError(
        `No se pudo iniciar la cámara. ${errorMessage}. Revisa permisos y prueba nuevamente.`,
      )
      stopScanner()
    } finally {
      setCameraLoading(false)
    }
  }

  const toggleScanner = async () => {
    if (cameraActive) {
      stopScanner()
      return
    }

    try {
      await startScanner()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('toggleScanner error:', err)
      setCameraError(`Error al activar la cámara: ${errorMessage}`)
      setCameraLoading(false)
    }
  }

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault()
    await verifyUid(uid)
  }

  const handleReset = () => {
    setUid('')
    setResult(null)
    setDenied(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in pb-28 sm:pb-0">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Verificar Acceso</h1>
        <p className="text-slate-600 mt-2 text-sm sm:text-base max-w-2xl mx-auto">
          Escanea el QR con la cámara o ingresa manualmente el ID para confirmar acceso rápido.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        <div>
      {/* QR Scanner */}
      <div className="glass p-4 mb-5 rounded-[28px]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
            <QrCode className="w-4 h-4 text-blue-600" />
            Escáner QR
          </div>
          <button
            type="button"
            onClick={() => {
              void toggleScanner()
            }}
            disabled={cameraLoading}
            className="btn-ghost px-4 py-2 text-xs"
          >
            {cameraLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
                Iniciando...
              </>
            ) : cameraActive ? (
              <>
                <CameraOff className="w-4 h-4" />
                Detener cámara
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                Activar cámara
              </>
            )}
          </button>
        </div>

        {cameraError && <p className="field-error mt-3">{cameraError}</p>}

        <div className="mt-3 rounded-3xl overflow-hidden border border-slate-200 bg-slate-950 text-slate-200">
          <div className={`relative overflow-hidden bg-slate-900/80 ${cameraActive ? 'h-80 sm:h-96' : 'h-56'}`}>
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              muted
              playsInline
              autoPlay
              style={{ opacity: cameraActive ? 1 : 0 }}
            />
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-slate-300">
                <Camera className="w-10 h-10 text-slate-300" />
                <p className="text-sm font-semibold">Cámara inactiva</p>
                <p className="text-xs text-slate-400 max-w-xs">
                  Toca el botón de arriba para iniciar el escaneo de QR.
                </p>
              </div>
            )}
          </div>
          <div className="p-3 text-center text-xs text-slate-400 bg-slate-950/95">
            {cameraActive ? 'Apunta al código QR del propietario' : 'La cámara se mostrará aquí cuando esté activa.'}
          </div>
        </div>
      </div>

      {/* UID Input */}
      <form onSubmit={handleVerify} className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              ref={inputRef}
              value={uid}
              onChange={(e) => setUid(e.target.value.toUpperCase())}
              placeholder="ID DEL PROPIETARIO"
              maxLength={16}
              disabled={loading}
              className="field pl-12 font-mono tracking-[0.2em] text-base uppercase disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="ID del propietario"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !uid.trim()}
            className="btn-primary px-5 min-w-[148px]"
            aria-label="Verificar acceso"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>

      {/* ── Access Granted ──────────────────────────────────────────────────── */}
      {result && (
        <div className="animate-scale-in space-y-4">
          {/* Status banner */}
          <div className="bg-emerald-500/10 border border-emerald-500/35 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-emerald-300 font-semibold">Acceso Autorizado</p>
              <p className="text-emerald-600/80 text-xs flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                {formatDateTime(result.verificado_en)}
              </p>
            </div>
          </div>

          {/* Hero photo outside card */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-white">
            <img
              src={result.foto_url}
              alt={result.nombre}
              className="w-full h-96 object-cover"
              onError={(e) => {
                ;(e.target as HTMLImageElement).src = avatarSvg(result.nombre)
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
              <h2 className="text-2xl font-bold text-white drop-shadow">{result.nombre}</h2>
                <span className="inline-block text-xs text-slate-200 font-mono bg-black/40 border border-white/15 px-2 py-0.5 rounded-md mt-1 tracking-widest">
                {result.uid}
              </span>
            </div>
          </div>

          {/* Profile card */}
          <div className="glass overflow-hidden">
            <div className="px-5 pb-5 pt-4">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                <InfoCard
                  icon={<Building2 className="w-4 h-4 text-blue-400" />}
                  label="Torre"
                  value={result.torre}
                />
                <InfoCard
                  icon={<Home className="w-4 h-4 text-blue-400" />}
                  label="Apartamento"
                  value={result.apartamento}
                />
                <InfoCard
                  icon={<Phone className="w-4 h-4 text-blue-400" />}
                  label="Contacto"
                  value={result.numero_contacto ?? 'Sin registrar'}
                />
              </div>
            </div>
          </div>

          {/* Reset button */}
          <button onClick={handleReset} className="btn-ghost w-full">
            <RotateCcw className="w-4 h-4" />
            Nueva consulta
          </button>
        </div>
      )}

      {/* ── Access Denied ───────────────────────────────────────────────────── */}
      {denied && (
        <div className="animate-scale-in space-y-4">
          <div className="glass p-8 text-center border-rose-500/20">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4 ring-1 ring-rose-500/25">
              <ShieldX className="w-8 h-8 text-rose-400" />
            </div>
            <p className="text-rose-300 font-bold text-xl mb-2">Acceso Denegado</p>
            <p className="text-slate-600 text-sm">{denied}</p>
            <p className="text-slate-500 text-xs mt-1">ID consultado: {uid}</p>
          </div>

          <button onClick={handleReset} className="btn-ghost w-full">
            <RotateCcw className="w-4 h-4" />
            Intentar con otro ID
          </button>
        </div>
      )}
        </div>

        {/* Recent history */}
        <aside className="glass p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Últimos usuarios escaneos</h2>
              <p className="text-xs text-slate-500">Tus 10 verificaciones más recientes</p>
            </div>
            <button
              type="button"
              onClick={() => {
                void loadHistorial()
              }}
              className="btn-ghost px-3 py-2 text-xs"
            >
              Actualizar
            </button>
          </div>

          {historialError && <p className="field-error mb-3">{historialError}</p>}

          {!historialError && historial.length === 0 && (
            <p className="text-sm text-slate-500 py-6 text-center">
              Aún no hay propietarios escaneados.
            </p>
          )}

          {historial.length > 0 && (
            <div className="space-y-2">
              {historial.map((item, index) => (
                <div
                  key={`${item.uid}-${item.verificado_en}-${index}`}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/60 p-3"
                >
                  <img
                    src={item.foto_url}
                    alt={item.nombre}
                    className="w-11 h-11 rounded-lg object-cover border border-slate-200 flex-shrink-0"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).src = avatarSvg(item.nombre)
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{item.nombre}</p>
                    <p className="text-xs text-slate-500 truncate">
                      Torre {item.torre} · Apto {item.apartamento}
                    </p>
                    {phoneHref(item.numero_contacto) ? (
                      <a
                        href={phoneHref(item.numero_contacto) ?? undefined}
                        className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
                        aria-label={`Llamar a ${item.nombre} al ${item.numero_contacto}`}
                      >
                        <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{item.numero_contacto}</span>
                      </a>
                    ) : (
                      <p className="mt-1 text-xs text-slate-400 truncate">Sin contacto</p>
                    )}
                    <p className="text-[11px] text-slate-400 truncate">
                      {formatDateTime(item.verificado_en)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      <div className="sm:hidden fixed inset-x-0 bottom-0 z-40 px-4 pb-4 pt-3 bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-transparent">
        <div className="mx-auto max-w-xl rounded-[24px] border border-white/10 bg-slate-950/95 p-3 shadow-[0_25px_60px_rgba(15,23,42,0.35)] backdrop-blur-xl">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                void toggleScanner()
              }}
              className="flex flex-col items-center justify-center rounded-2xl bg-slate-900 px-2 py-2 text-[11px] font-semibold text-slate-100 transition hover:bg-slate-800"
            >
              <Camera className="mb-1 h-4 w-4" />
              Escanear
            </button>
            <button
              type="button"
              onClick={() => {
                void handleVerify()
              }}
              disabled={loading || !uid.trim()}
              className="flex flex-col items-center justify-center rounded-2xl bg-blue-600 px-2 py-2 text-[11px] font-semibold text-white shadow-lg shadow-blue-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-500"
            >
              <Search className="mb-1 h-4 w-4" />
              Verificar
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex flex-col items-center justify-center rounded-2xl bg-slate-100 px-2 py-2 text-[11px] font-semibold text-slate-900 transition hover:bg-slate-200"
            >
              <RotateCcw className="mb-1 h-4 w-4" />
              Reiniciar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
