import type { AxiosError } from 'axios'
import {
  Building2,
  Camera,
  CameraOff,
  Clock,
  CreditCard,
  Fingerprint,
  Home,
  Phone,
  QrCode,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  ShieldX,
  Usb,
} from 'lucide-react'
import QrScanner from 'qr-scanner'
import { useEffect, useRef, useState } from 'react'
import { listarHistorialReciente, listarHuellas, notificarPropietarioAcceso, verificarAccesoZona } from '../../api/acceso'
import { listarZonasAcceso } from '../../api/zonas'
import TelegramNotifyModal from '../../components/TelegramNotifyModal'
import type { ApiErrorBody, HistorialAccesoOut, VerificacionResponse, ZonaAcceso } from '../../types'
import {
  FingerprintError,
  FingerprintReader,
  MATCH_THRESHOLD,
  isWebSerialSupported,
} from '../../utils/fingerprintSerial'

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

export default function VerificarAcceso() {
  // ── QR / manual state ──────────────────────────────────────────────────────
  const [uid, setUid] = useState('')
  const [loading, setLoading] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [result, setResult] = useState<VerificacionResponse | null>(null)
  const [denied, setDenied] = useState<string | null>(null)
  const [deniedPazYSalvo, setDeniedPazYSalvo] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [notifyError, setNotifyError] = useState<string | null>(null)
  const [notifyingUid, setNotifyingUid] = useState<string | null>(null)
  const [notifyTarget, setNotifyTarget] = useState<{
    uid: string
    nombre?: string
    torre?: string
    apartamento?: string
  } | null>(null)
  const [historial, setHistorial] = useState<HistorialAccesoOut[]>([])
  const [historialError, setHistorialError] = useState<string | null>(null)
  const [zonas, setZonas] = useState<ZonaAcceso[]>([])
  const [zonaId, setZonaId] = useState<number | ''>('')
  const selectedZona = zonas.find((zona) => zona.id === zonaId)

  // ── Fingerprint state ──────────────────────────────────────────────────────
  type FpStatus = 'idle' | 'connecting' | 'scanning' | 'searching' | 'done' | 'error'
  const [fpStatus, setFpStatus] = useState<FpStatus>('idle')
  const [fpMsg, setFpMsg] = useState('')
  const [fpProgress, setFpProgress] = useState(0)
  const [fpError, setFpError] = useState<string | null>(null)
  const fpReaderRef = useRef<FingerprintReader | null>(null)

  // ── Refs ───────────────────────────────────────────────────────────────────
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    void loadHistorial()
    void loadZonas()
  }, [])

  useEffect(() => {
    return () => {
      scannerRef.current?.stop()
      scannerRef.current?.destroy()
      scannerRef.current = null
      void fpReaderRef.current?.disconnect()
      fpReaderRef.current = null
    }
  }, [])

  // ── Fingerprint scan ───────────────────────────────────────────────────────
  const startFingerprintScan = async () => {
    if (!selectedZona) {
      setDenied('Selecciona una zona de acceso antes de verificar.')
      return
    }
    setFpError(null)
    setFpProgress(0)
    setResult(null)
    setDenied(null)
    setNotice(null)
    setNotifyError(null)
    setDeniedPazYSalvo(false)

    try {
      // 1. Connect reader
      setFpStatus('connecting')
      setFpMsg('Conectando al lector de huella...')
      const reader = new FingerprintReader()
      fpReaderRef.current = reader
      await reader.connect()

      // 2. Capture fingerprint
      setFpStatus('scanning')
      setFpMsg('Coloca el dedo sobre el sensor...')
      await reader.captureOnce()   // stores in CharBuffer1 on sensor

      // 3. Load all templates from server
      setFpStatus('searching')
      setFpMsg('Comparando con huellas registradas...')
      const huellas = await listarHuellas()

      if (huellas.length === 0) {
        setFpError('No hay huellas registradas en el sistema.')
        setFpStatus('error')
        await reader.disconnect()
        fpReaderRef.current = null
        return
      }

      // 4. Identify using sensor hardware matching
      const templates = huellas.map((h) => ({
        uid: h.uid,
        templateBytes: Uint8Array.from(atob(h.template_b64), (c) => c.charCodeAt(0)),
      }))

      const match = await reader.identifyFromBuffer(templates, (pct) => setFpProgress(pct))

      await reader.disconnect()
      fpReaderRef.current = null

      // 5. Resolve match via backend (logs access, checks acceso_habilitado)
      if (!match || match.score < MATCH_THRESHOLD) {
        setFpStatus('done')
        setDenied('Huella no reconocida. Propietario no registrado.')
        return
      }

      setFpStatus('done')
      setFpMsg(`Huella identificada (score ${match.score}). Verificando acceso...`)

      // Use existing verificarAcceso — logs + checks paz y salvo
      setLoading(true)
      try {
        const data = await verificarAccesoZona(match.uid, selectedZona.id, 'qr')
        setResult(data)
        setUid(match.uid)
        await loadHistorial()
      } catch (err) {
        const axiosErr = err as AxiosError<ApiErrorBody>
        if (axiosErr.response?.status === 403) {
          setDenied(axiosErr.response.data?.detail ?? 'Acceso denegado por administración')
        } else if (axiosErr.response?.status === 404) {
          setDenied('ID no encontrado en el sistema')
        } else {
          setDenied(axiosErr.response?.data?.detail ?? 'Error de conexión')
        }
      } finally {
        setLoading(false)
      }
    } catch (e) {
      await fpReaderRef.current?.disconnect().catch(() => undefined)
      fpReaderRef.current = null
      setFpStatus('error')
      if (e instanceof FingerprintError) {
        setFpError(e.message)
      } else {
        setFpError(e instanceof Error ? e.message : 'Error desconocido con el lector.')
      }
    }
  }

  const resetFp = () => {
    setFpStatus('idle')
    setFpMsg('')
    setFpProgress(0)
    setFpError(null)
    setResult(null)
    setDenied(null)
    setNotice(null)
    setNotifyError(null)
    setDeniedPazYSalvo(false)
  }

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

  const loadZonas = async () => {
    try {
      const data = await listarZonasAcceso()
      const active = data.filter((zona) => zona.activa)
      setZonas(active)
      setZonaId((prev) => prev || active[0]?.id || '')
    } catch {
      setDenied('No se pudieron cargar las zonas de acceso.')
    }
  }

  const verifyUid = async (rawUid: string) => {
    if (!selectedZona) {
      setDenied('Selecciona una zona de acceso antes de verificar.')
      return
    }
    const trimmed = rawUid.trim()
    if (!trimmed) return

    setLoading(true)
    setResult(null)
    setDenied(null)
    setNotice(null)
    setNotifyError(null)
    setDeniedPazYSalvo(false)
    try {
      const data = await verificarAccesoZona(trimmed, selectedZona.id, 'qr')
      setResult(data)
      await loadHistorial()
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      if (axiosErr.response?.status === 403) {
        setDenied(axiosErr.response.data?.detail ?? 'Acceso denegado por administración')
      } else if (axiosErr.response?.status === 404) {
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
    setNotice(null)
    setNotifyError(null)
    setDeniedPazYSalvo(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const vigilanteDefaultMessage = (
    nombre?: string,
    torre?: string,
    apartamento?: string,
  ) => {
    const locationText = torre && apartamento ? ` Torre ${torre}, apartamento ${apartamento}.` : ''
    return `Hola${nombre ? ` ${nombre}` : ''}. Vigilancia informa: por favor comuníquese o acérquese a la portería para revisar una novedad de acceso.${locationText}`
  }

  const openNotify = (
    targetUid: string,
    nombre?: string,
    torre?: string,
    apartamento?: string,
  ) => {
    const normalizedUid = targetUid.trim().toUpperCase()
    if (!normalizedUid) return
    setNotifyError(null)
    setNotifyTarget({ uid: normalizedUid, nombre, torre, apartamento })
  }

  const handleNotifySend = async (mensaje: string) => {
    if (!notifyTarget) return
    const { uid: targetUid, nombre } = notifyTarget
    setNotifyingUid(targetUid)
    setNotice(null)
    setNotifyError(null)
    try {
      await notificarPropietarioAcceso(targetUid, mensaje)
      setNotice(`Notificación enviada${nombre ? ` a ${nombre}` : ''}`)
    } catch (err) {
      setNotifyingUid(null)
      throw err
    } finally {
      setNotifyingUid(null)
    }
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
        <p className="page-subtitle pl-12">Escanea el QR, ingresa el ID manualmente, o usa el lector de huella.</p>
      </div>

      <div className="card-lg p-4 mb-5">
        <label className="field-label">Zona de acceso en control</label>
        <select
          value={zonaId}
          onChange={(event) => setZonaId(Number(event.target.value))}
          className="field"
        >
          {zonas.length === 0 ? (
            <option value="">No hay zonas activas</option>
          ) : (
            zonas.map((zona) => (
              <option key={zona.id} value={zona.id}>
                {zona.nombre}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div>

          {/* ── Fingerprint card ─────────────────────────────────────────── */}
          <div className="card-lg p-4 mb-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Fingerprint className="w-4 h-4 text-violet-600" />
                </div>
                <span className="text-sm font-bold text-slate-800">Lector de Huella</span>
              </div>
              <div className="flex items-center gap-2">
                {fpStatus !== 'idle' && fpStatus !== 'error' && fpStatus !== 'done' && (
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <span className="w-3 h-3 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                    {fpMsg}
                  </span>
                )}
                {(fpStatus === 'idle' || fpStatus === 'error') && (
                  <button
                    type="button"
                    onClick={() => { void startFingerprintScan() }}
                    disabled={!isWebSerialSupported()}
                    className="btn-primary px-4 py-2 text-xs bg-violet-600 hover:bg-violet-700 disabled:opacity-50"
                    title={!isWebSerialSupported() ? 'Requiere Chrome o Edge' : ''}
                  >
                    <Fingerprint className="w-4 h-4" />
                    {isWebSerialSupported() ? 'Identificar por huella' : 'Solo Chrome/Edge'}
                  </button>
                )}
                {(fpStatus === 'done' || fpStatus === 'error') && (
                  <button type="button" onClick={resetFp} className="btn-cancel px-3 py-2 text-xs">
                    <RotateCcw className="w-3.5 h-3.5" />Nueva lectura
                  </button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {fpStatus === 'searching' && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Comparando huellas...</span>
                  <span>{fpProgress}%</span>
                </div>
                <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all duration-200"
                    style={{ width: `${fpProgress}%` }}
                  />
                </div>
              </div>
            )}

            {fpError && (
              <p className="field-error mt-2">{fpError}</p>
            )}

            {/* Idle hint */}
            {fpStatus === 'idle' && (
              <div className="mt-2 flex items-center gap-3 p-3 bg-surface-50 rounded-2xl border border-dashed border-surface-300">
                <Usb className="w-5 h-5 text-slate-300 flex-shrink-0" />
                <p className="text-xs text-slate-400">
                  Conecta el lector ZFM-20 / R307 vía USB y presiona <strong>Identificar por huella</strong>.
                  Funciona con adaptadores CH340, CP210x y FTDI.
                </p>
              </div>
            )}

            {/* Scanning prompt */}
            {(fpStatus === 'scanning') && (
              <div className="mt-3 flex flex-col items-center gap-2 py-4">
                <div className="w-20 h-24 rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50 flex items-center justify-center">
                  <Fingerprint className="w-10 h-10 text-violet-400 animate-pulse" />
                </div>
                <p className="text-xs text-slate-500">Coloca el dedo sobre el sensor</p>
              </div>
            )}
          </div>

          {/* QR Scanner card */}
          <div className="card-lg p-4 mb-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center">
                  <QrCode className="w-4 h-4 text-brand-600" />
                </div>
                <span className="text-sm font-bold text-slate-800">Escáner QR</span>
              </div>
              <button
                type="button"
                onClick={() => { void toggleScanner() }}
                disabled={cameraLoading}
                className={cameraActive ? 'btn-cancel px-4 py-2 text-xs' : 'btn-primary px-4 py-2 text-xs'}
              >
                {cameraLoading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Iniciando…</>
                ) : cameraActive ? (
                  <><CameraOff className="w-4 h-4" />Detener cámara</>
                ) : (
                  <><Camera className="w-4 h-4" />Activar cámara</>
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
                    <p className="text-sm font-semibold text-white/55">Cámara inactiva</p>
                    <p className="text-xs text-white/25 max-w-xs">Toca el botón de arriba para iniciar el escaneo.</p>
                  </div>
                )}
              </div>
              <div className="px-3 py-2 text-center text-xs text-white/35 bg-slate-950/80">
                {cameraActive ? 'Apunta al código QR del propietario' : 'La cámara se mostrará aquí.'}
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

          {notifyError && (
            <div className="mb-4 flex items-center gap-2.5 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 text-rose-700 text-sm">
              {notifyError}
            </div>
          )}
          {notice && (
            <div className="mb-4 flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-emerald-700 text-sm">
              {notice}
            </div>
          )}

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
                  <button
                    type="button"
                    onClick={() => openNotify(result.uid, result.nombre, result.torre, result.apartamento)}
                    disabled={notifyingUid === result.uid || !result.telegram_chat_id}
                    className="col-span-2 btn-primary justify-center bg-teal-600 hover:bg-teal-700 disabled:opacity-50"
                    title={result.telegram_chat_id ? 'Notificar por Telegram' : 'El propietario no tiene Chat ID Telegram configurado'}
                  >
                    {notifyingUid === result.uid
                      ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <Send className="w-4 h-4" />}
                    Notificar por Telegram
                  </button>
                </div>
              </div>

              <button onClick={handleReset} className="btn-secondary w-full">
                <RotateCcw className="w-4 h-4" />Nueva consulta
              </button>
            </div>
          )}

          {/* Paz y Salvo — access disabled by admin */}
          {deniedPazYSalvo && (
            <div className="animate-scale-in space-y-4">
              <div className="card-lg overflow-hidden">
                <div className="bg-gradient-to-br from-amber-600 to-orange-500 px-6 py-8 text-center text-white">
                  <div className="w-16 h-16 rounded-3xl bg-white/20 border border-white/30 flex items-center justify-center mx-auto mb-3">
                    <ShieldX className="w-8 h-8" />
                  </div>
                  <p className="font-extrabold text-xl">Acceso Denegado</p>
                  <p className="text-white/90 font-bold text-sm mt-2">
                    NO SE REGISTRA  PAZ Y SALVO CON LA ADMINISTRACIÓN
                  </p>
                  <p className="text-white/75 text-sm mt-2 leading-relaxed">
                    Por favor acercarse a administración para resolver la situación.
                  </p>
                  <p className="text-white/50 text-xs mt-3 font-mono">ID: {uid}</p>
                </div>
              </div>
              <button onClick={handleReset} className="btn-secondary w-full">
                <RotateCcw className="w-4 h-4" />Intentar con otro ID
              </button>
              {uid.trim() && (
                <button
                  type="button"
                  onClick={() => openNotify(uid)}
                  disabled={notifyingUid === uid.trim().toUpperCase()}
                  className="btn-primary w-full justify-center bg-teal-600 hover:bg-teal-700 disabled:opacity-50"
                >
                  {notifyingUid === uid.trim().toUpperCase()
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <Send className="w-4 h-4" />}
                  Notificar propietario
                </button>
              )}
            </div>
          )}

          {/* Access Denied — not found or other error */}
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
              {uid.trim() && (
                <button
                  type="button"
                  onClick={() => openNotify(uid)}
                  disabled={notifyingUid === uid.trim().toUpperCase()}
                  className="btn-primary w-full justify-center bg-teal-600 hover:bg-teal-700 disabled:opacity-50"
                >
                  {notifyingUid === uid.trim().toUpperCase()
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <Send className="w-4 h-4" />}
                  Notificar propietario
                </button>
              )}
            </div>
          )}
        </div>

        {/* Recent history sidebar */}
        <aside className="card-lg p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Últimos escaneos</h2>
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
            <p className="text-sm text-slate-400 py-6 text-center">Aún no hay escaneos.</p>
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
                    <p className="text-xs text-slate-500 truncate">T{item.torre} - Apto {item.apartamento}</p>
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
                    <button
                      type="button"
                      onClick={() => openNotify(item.uid, item.nombre, item.torre, item.apartamento)}
                      disabled={notifyingUid === item.uid || !item.telegram_chat_id}
                      className="mt-2 inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-40"
                      title={item.telegram_chat_id ? 'Notificar por Telegram' : 'El propietario no tiene Chat ID Telegram configurado'}
                    >
                      {notifyingUid === item.uid
                        ? <span className="h-3 w-3 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
                        : <Send className="h-3 w-3" />}
                      Telegram
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {notifyTarget && (
        <TelegramNotifyModal
          nombre={notifyTarget.nombre ?? 'Propietario'}
          uid={notifyTarget.uid}
          torre={notifyTarget.torre}
          apartamento={notifyTarget.apartamento}
          defaultMessage={vigilanteDefaultMessage(
            notifyTarget.nombre,
            notifyTarget.torre,
            notifyTarget.apartamento,
          )}
          onClose={() => setNotifyTarget(null)}
          onSend={handleNotifySend}
        />
      )}
    </div>
  )
}
