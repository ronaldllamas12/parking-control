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

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-surface-50 border border-surface-200 rounded-2xl p-3 flex items-center gap-3">
      <div className="w-8 h-8 bg-brand-100 rounded-xl flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-slate-400 text-xs leading-none mb-0.5 font-medium">{label}</p>
        <p className="text-slate-900 font-bold text-sm">{value}</p>
      </div>
    </div>
  )
}

// â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        setDenied(axiosErr.response?.data?.detail ?? 'Error de conexiÃ³n')
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
        setCameraError('No se detectÃ³ cÃ¡mara en este dispositivo.')
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
        `No se pudo iniciar la cÃ¡mara. ${errorMessage}. Revisa permisos y prueba nuevamente.`,
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
      setCameraError(`Error al activar la cÃ¡mara: ${errorMessage}`)
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
    <div className="max-w-5xl mx-auto animate-fade-in">

      {/* Page header */}
      <div className="page-header">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-2xl bg-gradient-brand flex items-center justify-center shadow-brand">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <h1 className="page-title">Verificar Acceso</h1>
        </div>
        <p className="page-subtitle pl-12">Escanea el QR o ingresa manualmente el ID del propietario.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div>

          {/* QR Scanner card */}
          <div className="card-lg p-4 mb-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center">
                  <QrCode className="w-4 h-4 text-brand-600" />
                </div>
                <span className="text-sm font-bold text-slate-800">EscÃ¡ner QR</span>
              </div>
              <button
                type="button"
                onClick={() => { void toggleScanner() }}
                disabled={cameraLoading}
                className={cameraActive ? 'btn-cancel px-4 py-2 text-xs' : 'btn-primary px-4 py-2 text-xs'}
              >
                {cameraLoading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Iniciandoâ€¦</>
                ) : cameraActive ? (
                  <><CameraOff className="w-4 h-4" />Detener cÃ¡mara</>
                ) : (
                  <><Camera className="w-4 h-4" />Activar cÃ¡mara</>
                )}
              </button>
            </div>

            {cameraError && <p className="field-error mt-3">{cameraError}</p>}

            <div className="mt-3 rounded-3xl overflow-hidden border border-surface-200 bg-slate-950">
              <div className={`relative overflow-hidden ${cameraActive ? 'h-80 sm:h-96' : 'h-48'}`}>
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  muted
                  playsInline
                  autoPlay
                  style={{ opacity: cameraActive ? 1 : 0 }}
                />
                {!cameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
                    <div className="w-14 h-14 rounded-3xl bg-white/10 border border-white/15 flex items-center justify-center mb-1">
                      <Camera className="w-7 h-7 text-white/35" />
                    </div>
                    <p className="text-sm font-semibold text-white/55">CÃ¡mara inactiva</p>
                    <p className="text-xs text-white/25 max-w-xs">Toca el botÃ³n de arriba para iniciar el escaneo.</p>
                  </div>
                )}
              </div>
              <div className="px-3 py-2 text-center text-xs text-white/35 bg-slate-950/80">
                {cameraActive ? 'Apunta al cÃ³digo QR del propietario' : 'La cÃ¡mara se mostrarÃ¡ aquÃ­.'}
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
                  <><Search className="w-5 h-5" />Verificar</>
                )}
              </button>
            </div>
          </form>

          {/* Access Granted */}
          {result && (
            <div className="animate-scale-in space-y-4">
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3.5">
                <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-emerald-800 font-bold text-sm">Acceso Autorizado</p>
                  <p className="text-emerald-600 text-xs flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />{formatDateTime(result.verificado_en)}
                  </p>
                </div>
              </div>

              <div className="card-lg overflow-hidden">
                <div className="relative">
                  <img
                    src={result.foto_url}
                    alt={result.nombre}
                    className="w-full h-72 object-cover"
                    onError={(e) => { ;(e.target as HTMLImageElement).src = avatarSvg(result.nombre) }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-950/80 via-transparent to-transparent" />
                  <div className="absolute bottom-0 inset-x-0 px-5 pb-5">
                    <h2 className="text-2xl font-extrabold text-white drop-shadow">{result.nombre}</h2>
                    <span className="inline-block text-xs text-white/70 font-mono bg-black/40 border border-white/15 px-2 py-0.5 rounded-lg mt-1 tracking-widest">
                      {result.uid}
                    </span>
                  </div>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                  <InfoCard icon={<Building2 className="w-4 h-4 text-brand-600" />} label="Torre" value={result.torre} />
                  <InfoCard icon={<Home className="w-4 h-4 text-brand-600" />} label="Apartamento" value={result.apartamento} />
                  <InfoCard icon={<Phone className="w-4 h-4 text-brand-600" />} label="Contacto" value={result.numero_contacto ?? 'Sin registrar'} />
                </div>
              </div>

              <button onClick={handleReset} className="btn-secondary w-full">
                <RotateCcw className="w-4 h-4" />Nueva consulta
              </button>
            </div>
          )}

          {/* Access Denied */}
          {denied && (
            <div className="animate-scale-in space-y-4">
              <div className="card-lg overflow-hidden">
                <div className="bg-gradient-to-br from-rose-600 to-rose-500 px-6 py-8 text-center text-white">
                  <div className="w-16 h-16 rounded-3xl bg-white/20 border border-white/30 flex items-center justify-center mx-auto mb-3">
                    <ShieldX className="w-8 h-8" />
                  </div>
                  <p className="font-extrabold text-xl">Acceso Denegado</p>
                  <p className="text-white/70 text-sm mt-1">{denied}</p>
                  <p className="text-white/50 text-xs mt-0.5 font-mono">ID: {uid}</p>
                </div>
              </div>
              <button onClick={handleReset} className="btn-secondary w-full">
                <RotateCcw className="w-4 h-4" />Intentar con otro ID
              </button>
            </div>
          )}
        </div>

        {/* Recent history sidebar */}
        <aside className="card-lg p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Ãšltimos escaneos</h2>
              <p className="text-xs text-slate-500">10 verificaciones recientes</p>
            </div>
            <button
              type="button"
              onClick={() => { void loadHistorial() }}
              className="btn-icon"
              aria-label="Actualizar historial"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>

          {historialError && <p className="field-error mb-3">{historialError}</p>}

          {!historialError && historial.length === 0 && (
            <p className="text-sm text-slate-400 py-6 text-center">AÃºn no hay escaneos.</p>
          )}

          {historial.length > 0 && (
            <div className="space-y-2">
              {historial.map((item, index) => (
                <div
                  key={`${item.uid}-${item.verificado_en}-${index}`}
                  className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-surface-50 p-3 hover:bg-white transition-colors"
                >
                  <img
                    src={item.foto_url}
                    alt={item.nombre}
                    className="w-12 h-12 rounded-xl object-cover border border-surface-200 shadow-sm flex-shrink-0"
                    onError={(e) => { ;(e.target as HTMLImageElement).src = avatarSvg(item.nombre) }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{item.nombre}</p>
                    <p className="text-xs text-slate-500 truncate">T{item.torre} Â· Apto {item.apartamento}</p>
                    {phoneHref(item.numero_contacto) ? (
                      <a
                        href={phoneHref(item.numero_contacto) ?? undefined}
                        className="mt-1 inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        <Phone className="h-3 w-3" />{item.numero_contacto}
                      </a>
                    ) : (
                      <p className="mt-1 text-xs text-slate-400">Sin contacto</p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-0.5">{formatDateTime(item.verificado_en)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
