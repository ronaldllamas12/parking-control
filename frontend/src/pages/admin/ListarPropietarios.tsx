import type { AxiosError } from 'axios'
import {
    Building2,
    Download,
    Edit2,
    FileSpreadsheet,
    Filter,
    Fingerprint,
    Home,
    Phone,
    Plus,
    RefreshCw,
    Save,
    Search,
    ShieldCheck,
    ShieldX,
    Trash2,
    Upload,
    Users,
    X,
} from 'lucide-react'
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { read as xlsxRead, utils as xlsxUtils, writeFile as xlsxWriteFile } from 'xlsx'
import {
    actualizarPropietario,
    actualizarAmenidadesPropietario,
    descargarPazYSalvo,
    actualizarEstadoBulk,
    eliminarHuella,
    eliminarPropietario,
    importarEstadoCsv,
    listarPropietarios,
    registrarHuella,
    registrarPropietariosBulk,
    toggleAccesoPropietario,
} from '../../api/propietarios'
import type { ApiErrorBody, BulkImportResult, PropietarioOut } from '../../types'
import {
    FingerprintError,
    FingerprintReader,
    isWebSerialSupported,
} from '../../utils/fingerprintSerial'
import { createOwnerQrDataUrl, qrFileName } from '../../utils/qrDownload'

function avatarSvg(letter: string): string {
  const encoded = encodeURIComponent(letter.toUpperCase())
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="16" fill="%232563eb"/><text x="48" y="62" font-size="42" text-anchor="middle" fill="white" font-family="sans-serif" font-weight="bold">${encoded}</text></svg>`
}

const GENERAL_TEMPLATE_ROWS = [
  ['nombre', 'numero contacto', 'torre', 'apartamento', 'nuevo estado', 'amenidades suspendidas'],
  ['JUAN PEREZ GARCIA', '3001234567', '1', '101', 'al dia', 'no'],
  ['MARIA LOPEZ TORRES', '3109876543', '2', '204', 'en mora', 'si'],
]

function downloadGeneralTemplate() {
  const wb = xlsxUtils.book_new()
  const ws = xlsxUtils.aoa_to_sheet(GENERAL_TEMPLATE_ROWS)
  ws['!cols'] = [
    { wch: 28 },
    { wch: 18 },
    { wch: 10 },
    { wch: 14 },
    { wch: 16 },
    { wch: 24 },
  ]
  xlsxUtils.book_append_sheet(wb, ws, 'Plantilla General')
  xlsxWriteFile(wb, 'plantilla_general_propietarios_estados.xlsx')
}

// ── RegisterFingerprintModal ──────────────────────────────────────────────────
interface RegisterFingerprintModalProps {
  item: PropietarioOut
  onClose: () => void
  onSaved: (updated: PropietarioOut) => void
}

type FpStep = 'idle' | 'connecting' | 'step1' | 'waiting' | 'step2' | 'saving' | 'done' | 'error'

function RegisterFingerprintModal({ item, onClose, onSaved }: RegisterFingerprintModalProps) {
  const [step, setStep] = useState<FpStep>('idle')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const readerRef = useRef<FingerprintReader | null>(null)

  const isSupported = isWebSerialSupported()

  const cleanup = async () => {
    try { await readerRef.current?.disconnect() } catch { /* ignore */ }
    readerRef.current = null
  }

  const handleClose = async () => {
    await cleanup()
    onClose()
  }

  const startEnrollment = async () => {
    setError(null)
    setStep('connecting')
    setMsg('Conectando al lector de huella...')

    try {
      const reader = new FingerprintReader()
      readerRef.current = reader
      await reader.connect()

      setStep('step1')
      setMsg('Coloca el dedo firmemente sobre el sensor...')
      await reader.enrollStep1()

      setStep('waiting')
      setMsg('Retira el dedo y espera 2 segundos...')
      await new Promise((r) => setTimeout(r, 2000))

      setStep('step2')
      setMsg('Coloca el mismo dedo nuevamente sobre el sensor...')
      const templateBytes = await reader.enrollStep2()

      setStep('saving')
      setMsg('Guardando huella en el sistema...')

      // Convert bytes to base64
      const b64 = btoa(String.fromCharCode(...templateBytes))
      const updated = await registrarHuella(item.uid, b64)

      await cleanup()
      setStep('done')
      setMsg('¡Huella registrada exitosamente!')
      onSaved(updated)
    } catch (e) {
      await cleanup()
      setStep('error')
      if (e instanceof FingerprintError) {
        setError(e.message)
      } else {
        const axiosErr = e as AxiosError<ApiErrorBody>
        setError(axiosErr.response?.data?.detail ?? 'Error desconocido al registrar la huella.')
      }
    }
  }

  const handleDeleteHuella = async () => {
    setError(null)
    setStep('saving')
    setMsg('Eliminando huella...')
    try {
      const updated = await eliminarHuella(item.uid)
      setStep('done')
      setMsg('Huella eliminada correctamente.')
      onSaved(updated)
    } catch (e) {
      const axiosErr = e as AxiosError<ApiErrorBody>
      setStep('error')
      setError(axiosErr.response?.data?.detail ?? 'Error al eliminar la huella.')
    }
  }

  const stepIcon: Record<FpStep, string> = {
    idle: '👆', connecting: '🔌', step1: '👆', waiting: '✋',
    step2: '👆', saving: '💾', done: '✅', error: '❌',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
      <div className="card-lg w-full max-w-md animate-scale-in overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-premium px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Fingerprint className="w-5 h-5 text-white" />
            <h2 className="text-white font-bold text-base">Huella Digital</h2>
          </div>
          <button onClick={() => { void handleClose() }} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Propietario info */}
          <div className="flex items-center gap-3 p-3 bg-surface-50 rounded-2xl border border-surface-200">
            <img
              src={item.foto_url} alt={item.nombre}
              className="w-12 h-12 rounded-xl object-cover border border-surface-200 flex-shrink-0"
              onError={(e) => { ;(e.target as HTMLImageElement).src = avatarSvg(item.nombre) }}
            />
            <div>
              <p className="font-bold text-sm text-slate-800">{item.nombre}</p>
              <p className="text-xs text-slate-500">Torre {item.torre} · Apto {item.apartamento}</p>
              <span className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold ${item.huella_registrada ? 'text-emerald-600' : 'text-slate-400'}`}>
                <Fingerprint className="w-3 h-3" />
                {item.huella_registrada ? 'Huella registrada' : 'Sin huella'}
              </span>
            </div>
          </div>

          {/* Browser support warning */}
          {!isSupported && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl p-3">
              <span className="text-lg leading-none">⚠️</span>
              <div>
                <p className="text-xs font-semibold text-amber-800">Navegador no compatible</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  El registro de huella requiere <strong>Google Chrome</strong> o <strong>Microsoft Edge</strong> (versión 89+) con el lector conectado por USB.
                </p>
              </div>
            </div>
          )}

          {/* Status */}
          {step !== 'idle' && (
            <div className={`flex items-center gap-3 rounded-2xl p-4 border ${
              step === 'done' ? 'bg-emerald-50 border-emerald-200' :
              step === 'error' ? 'bg-rose-50 border-rose-200' :
              'bg-brand-50 border-brand-200'
            }`}>
              <span className="text-2xl leading-none flex-shrink-0">{stepIcon[step]}</span>
              <div>
                {step !== 'error' && (
                  <p className={`text-sm font-semibold ${step === 'done' ? 'text-emerald-800' : 'text-brand-800'}`}>{msg}</p>
                )}
                {(step === 'step1' || step === 'step2') && (
                  <p className="text-xs text-brand-600 mt-0.5 flex items-center gap-1">
                    <span className="w-3 h-3 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin inline-block" />
                    Esperando huella...
                  </p>
                )}
                {(step === 'connecting' || step === 'saving') && (
                  <p className="text-xs text-brand-600 mt-0.5 flex items-center gap-1">
                    <span className="w-3 h-3 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin inline-block" />
                    Procesando...
                  </p>
                )}
              </div>
            </div>
          )}

          {error && <p className="field-error">{error}</p>}

          {/* Sensor diagram hint */}
          {(step === 'step1' || step === 'step2') && (
            <div className="flex flex-col items-center gap-2 py-3">
              <div className="w-20 h-24 rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50 flex items-center justify-center">
                <Fingerprint className="w-10 h-10 text-brand-400 animate-pulse" />
              </div>
              <p className="text-xs text-slate-500">Coloca el dedo sobre el sensor</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => { void handleClose() }} className="btn-cancel flex-1">
              {step === 'done' ? 'Cerrar' : 'Cancelar'}
            </button>

            {(step === 'idle' || step === 'error') && isSupported && (
              <button type="button" onClick={() => { void startEnrollment() }} className="btn-primary flex-1">
                <Fingerprint className="w-4 h-4" />
                {item.huella_registrada ? 'Actualizar huella' : 'Registrar huella'}
              </button>
            )}

            {(step === 'idle' || step === 'error') && item.huella_registrada && (
              <button type="button" onClick={() => { void handleDeleteHuella() }}
                className="w-10 h-10 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors flex-shrink-0"
                title="Eliminar huella">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── BulkImportModal ───────────────────────────────────────────────────────────
interface BulkImportModalProps {
  onClose: () => void
  onImported: (newItems: PropietarioOut[]) => void
}

interface ParsedRow {
  nombre: string
  numero_contacto: string
  torre: string
  apartamento: string
}

function BulkImportModal({ onClose, onImported }: BulkImportModalProps) {
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const downloadTemplate = () => {
    downloadGeneralTemplate()
  }

  const normalizeHeader = (value: string): string =>
    value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')

  const get = (row: Record<string, unknown>, key: string): string => {
    const found = Object.entries(row).find(([k]) => normalizeHeader(k) === key)
    return String(found?.[1] ?? '').trim()
  }

  const parseRows = (rawRows: Record<string, unknown>[]) => {
    const parsed: ParsedRow[] = rawRows
      .map((row) => ({
        nombre: get(row, 'nombre').toUpperCase(),
        numero_contacto: get(row, 'numero_contacto'),
        torre: get(row, 'torre'),
        apartamento: get(row, 'apartamento').toUpperCase(),
      }))
      .filter((r) => r.nombre || r.torre || r.apartamento)

    if (parsed.length === 0) {
      setParseError('El archivo no contiene datos. Asegúrate de usar la plantilla correcta.')
      return
    }
    setRows(parsed)
  }

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParseError(null)
    setImportResult(null)
    setGeneralError(null)
    setRows([])

    const reader = new FileReader()
    if (/\.(csv|tsv|txt)$/i.test(file.name)) {
      reader.onload = (ev) => {
        try {
          const text = String(ev.target?.result ?? '')
          const lines = text.split(/\r?\n/).filter((line) => line.trim())
          const delimiter = lines[0]?.includes('\t') ? '\t' : ','
          const headers = lines[0].split(delimiter).map((header) => header.trim().replace(/^"|"$/g, ''))
          const rawRows = lines.slice(1).map((line) => {
            const values = line.split(delimiter).map((value) => value.trim().replace(/^"|"$/g, ''))
            return Object.fromEntries(headers.map((header, idx) => [header, values[idx] ?? '']))
          })
          parseRows(rawRows)
        } catch {
          setParseError('No se pudo leer el archivo. Verifica que use la plantilla general.')
        }
      }
      reader.readAsText(file, 'utf-8')
      return
    }

    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer)
        const wb = xlsxRead(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rawRows = xlsxUtils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
        parseRows(rawRows)
      } catch {
        setParseError('No se pudo leer el archivo. Verifica que sea un Excel o CSV válido.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleImport = async () => {
    if (!rows.length) return
    setImporting(true)
    setGeneralError(null)
    try {
      const result = await registrarPropietariosBulk(rows)
      setImportResult(result)
      if (result.creados.length > 0) onImported(result.creados)
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setGeneralError(axiosErr.response?.data?.detail ?? 'Error al importar')
    } finally {
      setImporting(false)
    }
  }

  const isImported = importResult !== null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
      <div className="card-lg w-full max-w-2xl animate-scale-in overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="bg-gradient-premium px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-white" />
            <h2 className="text-white font-bold text-base">Registro Masivo con Plantilla General</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Step 1: Download template */}
          <div className="flex items-center gap-4 p-4 bg-surface-50 rounded-2xl border border-surface-200">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800">Paso 1 — Descargar plantilla</p>
              <p className="text-xs text-slate-500 mt-0.5">Columnas: nombre · numero contacto · torre · apartamento · nuevo estado · amenidades suspendidas</p>
            </div>
            <button type="button" onClick={downloadTemplate} className="btn-secondary text-xs px-3 py-2 flex-shrink-0">
              <Download className="w-3.5 h-3.5" />Plantilla general
            </button>
          </div>

          {/* Step 2: Upload file */}
          <div className="flex items-center gap-4 p-4 bg-surface-50 rounded-2xl border border-surface-200">
            <div className="w-10 h-10 rounded-2xl bg-brand-100 flex items-center justify-center flex-shrink-0">
              <Upload className="w-5 h-5 text-brand-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800">Paso 2 — Subir archivo</p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{fileName ?? 'Ningún archivo seleccionado'}</p>
            </div>
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-primary text-xs px-3 py-2 flex-shrink-0">
              <Upload className="w-3.5 h-3.5" />Seleccionar
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
          </div>

          {parseError && <p className="field-error">{parseError}</p>}

          {/* Preview table */}
          {rows.length > 0 && !isImported && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Vista previa — {rows.length} registro{rows.length !== 1 ? 's' : ''} encontrado{rows.length !== 1 ? 's' : ''}
              </p>
              <div className="rounded-2xl border border-surface-200 overflow-hidden">
                <div className="overflow-x-auto max-h-56">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-100 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">#</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Nombre</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Contacto</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Torre</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Apto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {rows.map((row, i) => (
                        <tr key={i} className="bg-white hover:bg-surface-50 transition-colors">
                          <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                          <td className="px-3 py-2 text-slate-800 font-medium max-w-[160px] truncate">
                            {row.nombre || <span className="text-rose-400 italic">vacío</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {row.numero_contacto || <span className="text-rose-400 italic">vacío</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {row.torre || <span className="text-rose-400 italic">—</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {row.apartamento || <span className="text-rose-400 italic">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Import results */}
          {isImported && (
            <div className="space-y-3">
              <div className={`rounded-2xl p-4 flex items-start gap-3 ${importResult.creados.length > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${importResult.creados.length > 0 ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                  {importResult.creados.length > 0
                    ? <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    : <ShieldX className="w-5 h-5 text-rose-600" />}
                </div>
                <div>
                  <p className={`font-bold text-sm ${importResult.creados.length > 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                    {importResult.creados.length} de {rows.length} registros importados correctamente
                  </p>
                  {importResult.errores.length > 0 && (
                    <p className="text-xs text-rose-600 mt-0.5">{importResult.errores.length} registro{importResult.errores.length !== 1 ? 's' : ''} con errores</p>
                  )}
                </div>
              </div>
              {importResult.errores.length > 0 && (
                <div className="rounded-2xl border border-rose-200 overflow-hidden">
                  <div className="bg-rose-50 px-3 py-2">
                    <p className="text-xs font-semibold text-rose-700">Detalle de errores</p>
                  </div>
                  <ul className="divide-y divide-rose-100 max-h-36 overflow-y-auto">
                    {importResult.errores.map((e, i) => (
                      <li key={i} className="px-3 py-1.5 text-xs text-rose-700 bg-white">{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {generalError && <p className="field-error">{generalError}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-surface-200 flex-shrink-0">
          <button type="button" onClick={onClose} className="btn-cancel flex-1">
            {isImported ? 'Cerrar' : 'Cancelar'}
          </button>
          {!isImported && (
            <button
              type="button"
              onClick={() => { void handleImport() }}
              disabled={rows.length === 0 || importing}
              className="btn-primary flex-1"
            >
              {importing
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Upload className="w-4 h-4" />}
              {importing ? 'Importando…' : `Importar${rows.length > 0 ? ` ${rows.length} registros` : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
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
  const [fpEditing, setFpEditing] = useState<PropietarioOut | null>(null)
  const [downloadingQrUid, setDownloadingQrUid] = useState<string | null>(null)
  const [downloadingPazUid, setDownloadingPazUid] = useState<string | null>(null)
  const [togglingUid, setTogglingUid] = useState<string | null>(null)
  const [togglingAmenidadesUid, setTogglingAmenidadesUid] = useState<string | null>(null)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [selectedUids, setSelectedUids] = useState<string[]>([])
  const [bulkStatusLoading, setBulkStatusLoading] = useState(false)
  const statusCsvRef = useRef<HTMLInputElement>(null)
  const [searchNombre, setSearchNombre] = useState('')
  const [searchTorre, setSearchTorre] = useState('')
  const [searchApto, setSearchApto] = useState('')

  const filtered = useMemo(() => {
    const nombre = searchNombre.toLowerCase().trim()
    const torre = searchTorre.trim()
    const apto = searchApto.trim().toUpperCase()
    return propietarios.filter((p) => {
      const matchNombre = !nombre || p.nombre.toLowerCase().includes(nombre)
      const matchTorre = !torre || p.torre === torre
      const matchApto = !apto || p.apartamento.includes(apto)
      return matchNombre && matchTorre && matchApto
    })
  }, [propietarios, searchNombre, searchTorre, searchApto])

  const hasFilters = searchNombre || searchTorre || searchApto

  const clearFilters = () => {
    setSearchNombre('')
    setSearchTorre('')
    setSearchApto('')
  }
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

  const handleDownloadPazYSalvo = async (item: PropietarioOut) => {
    setDownloadingPazUid(item.uid)
    setError(null)
    try {
      const pdf = await descargarPazYSalvo(item.uid)
      const url = URL.createObjectURL(pdf)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `paz-y-salvo-${item.torre}-${item.apartamento}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo descargar el paz y salvo')
    } finally {
      setDownloadingPazUid(null)
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

  const handleBulkImported = (newItems: PropietarioOut[]) => {
    setPropietarios((prev) => [...prev, ...newItems])
  }

  const handleFpSaved = (updated: PropietarioOut) => {
    setPropietarios((prev) => prev.map((p) => (p.uid === updated.uid ? updated : p)))
    setFpEditing(updated)   // keep modal open showing result
  }

  const handleToggleAmenidades = async (item: PropietarioOut) => {
    setTogglingAmenidadesUid(item.uid)
    setError(null)
    try {
      const updated = await actualizarAmenidadesPropietario(
        item.uid,
        !item.amenidades_suspendidas,
      )
      setPropietarios((prev) => prev.map((p) => (p.uid === updated.uid ? updated : p)))
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'Error al cambiar amenidades')
    } finally {
      setTogglingAmenidadesUid(null)
    }
  }

  const selectedPropietarios = propietarios.filter((p) => selectedUids.includes(p.uid))

  const toggleSelected = (uid: string) => {
    setSelectedUids((prev) =>
      prev.includes(uid) ? prev.filter((item) => item !== uid) : [...prev, uid],
    )
  }

  const updateSelectedStatus = async (nuevoEstado: 'al_dia' | 'en_mora') => {
    if (selectedPropietarios.length === 0) return
    setBulkStatusLoading(true)
    setError(null)
    try {
      const result = await actualizarEstadoBulk(
        selectedPropietarios.map((p) => ({
          torre: p.torre,
          apartamento: p.apartamento,
          nuevo_estado: nuevoEstado,
          amenidades_suspendidas: nuevoEstado === 'en_mora',
        })),
      )
      setPropietarios((prev) =>
        prev.map((p) =>
          selectedUids.includes(p.uid)
            ? { ...p, estado_cuenta: nuevoEstado, amenidades_suspendidas: nuevoEstado === 'en_mora' }
            : p,
        ),
      )
      setSelectedUids([])
      if (result.errores.length > 0) {
        setError(`${result.actualizados} actualizados. ${result.errores.length} registros no coincidieron.`)
      }
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'Error actualizando estados')
    } finally {
      setBulkStatusLoading(false)
    }
  }

  const handleStatusCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setBulkStatusLoading(true)
    setError(null)
    try {
      let fileToUpload = file
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        const buffer = await file.arrayBuffer()
        const wb = xlsxRead(new Uint8Array(buffer), { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const tsv = xlsxUtils.sheet_to_csv(ws, { FS: '\t', RS: '\n' })
        fileToUpload = new File([tsv], 'plantilla_general_propietarios_estados.csv', {
          type: 'text/csv',
        })
      }
      const result = await importarEstadoCsv(fileToUpload)
      await load()
      if (result.errores.length > 0) {
        setError(`${result.actualizados} actualizados. ${result.errores.length} filas con error.`)
      }
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'Error importando CSV')
    } finally {
      setBulkStatusLoading(false)
      event.target.value = ''
    }
  }

  const downloadStatusCsvTemplate = () => {
    downloadGeneralTemplate()
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
              {loading
                ? 'Cargando…'
                : hasFilters
                  ? `${filtered.length} de ${propietarios.length} propietario${propietarios.length !== 1 ? 's' : ''}`
                  : `${propietarios.length} propietario${propietarios.length !== 1 ? 's' : ''} registrado${propietarios.length !== 1 ? 's' : ''}`}
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
            <button
              onClick={() => setShowBulkImport(true)}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-white/25 bg-white/10 hover:bg-white/20 px-4 py-2.5 text-xs font-semibold text-white transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />Importar Plantilla
            </button>
            <button
              onClick={() => statusCsvRef.current?.click()}
              disabled={bulkStatusLoading}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-white/25 bg-white/10 hover:bg-white/20 px-4 py-2.5 text-xs font-semibold text-white transition-all disabled:opacity-60"
              title='Excel con columnas: nombre, numero contacto, torre, apartamento, nuevo estado, amenidades suspendidas'
            >
              <Upload className="w-4 h-4" />Importar Estados
            </button>
            <button
              onClick={downloadStatusCsvTemplate}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-white/25 bg-white/10 hover:bg-white/20 px-4 py-2.5 text-xs font-semibold text-white transition-all"
              title="Descargar plantilla general Excel"
            >
              <Download className="w-4 h-4" />Plantilla General
            </button>
            <input ref={statusCsvRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => { void handleStatusCsv(event) }} />
            <Link to="/admin/registrar" className="btn-primary px-4 py-2.5 text-xs">
              <Plus className="w-4 h-4" />Registrar
            </Link>
          </div>
        </div>
      </div>

      {/* Search / Filters */}
      <div className="card p-3 mb-4 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={searchNombre}
            onChange={(e) => setSearchNombre(e.target.value)}
            placeholder="Buscar por nombre…"
            className="field pl-9 text-sm py-2.5"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              value={searchTorre}
              onChange={(e) => setSearchTorre(e.target.value.replace(/\D/g, ''))}
              placeholder="Torre"
              className="field pl-8 text-sm py-2.5 w-24"
              inputMode="numeric"
            />
          </div>
          <div className="relative">
            <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              value={searchApto}
              onChange={(e) => setSearchApto(e.target.value.toUpperCase())}
              placeholder="Apto"
              className="field pl-8 text-sm py-2.5 w-28 uppercase"
            />
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="btn-cancel px-3 py-2 text-xs flex items-center gap-1.5" title="Limpiar filtros">
              <Filter className="w-3.5 h-3.5" />Limpiar
            </button>
          )}
        </div>
      </div>

      {selectedUids.length > 0 && (
        <div className="card p-3 mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-slate-700">{selectedUids.length} propietario(s) seleccionado(s)</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { void updateSelectedStatus('al_dia') }}
              disabled={bulkStatusLoading}
              className="btn-secondary px-4 py-2 text-xs"
            >
              Marcar al día
            </button>
            <button
              onClick={() => { void updateSelectedStatus('en_mora') }}
              disabled={bulkStatusLoading}
              className="btn-cancel px-4 py-2 text-xs"
            >
              Marcar en mora
            </button>
            <button onClick={() => setSelectedUids([])} className="btn-cancel px-4 py-2 text-xs">
              Limpiar selección
            </button>
          </div>
        </div>
      )}

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

      {/* No filter results */}
      {!loading && !error && propietarios.length > 0 && filtered.length === 0 && (
        <div className="card-lg p-10 text-center">
          <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm font-semibold">Sin resultados</p>
          <p className="text-slate-400 text-xs mt-1">Ningún propietario coincide con los filtros aplicados.</p>
          <button onClick={clearFilters} className="btn-secondary mt-4 text-xs px-4">
            <Filter className="w-3.5 h-3.5" />Limpiar filtros
          </button>
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((p) => (
            <div
              key={p.uid}
              className={`card p-4 flex items-center gap-3 hover:-translate-y-0.5 hover:shadow-card-lg transition-all duration-200 ${!p.acceso_habilitado ? 'opacity-75 border-rose-200' : ''}`}
            >
              <input
                type="checkbox"
                checked={selectedUids.includes(p.uid)}
                onChange={() => toggleSelected(p.uid)}
                className="h-4 w-4 flex-shrink-0 accent-brand-600"
                aria-label={`Seleccionar ${p.nombre}`}
              />
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
                  <span className={`badge border flex items-center gap-1 ${
                    p.estado_cuenta === 'al_dia'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {p.estado_cuenta === 'al_dia' ? 'Al día' : 'En mora'}
                  </span>
                  {p.amenidades_suspendidas && (
                    <span className="badge bg-rose-50 text-rose-700 border border-rose-200">
                      Amenidades suspendidas
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
                <button
                  onClick={() => setFpEditing(p)}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                    p.huella_registrada
                      ? 'bg-violet-50 hover:bg-violet-100 text-violet-600'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-400'
                  }`}
                  aria-label="Gestionar huella"
                  title={p.huella_registrada ? 'Huella registrada — clic para actualizar' : 'Registrar huella'}
                >
                  <Fingerprint className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { void handleToggleAmenidades(p) }}
                  disabled={togglingAmenidadesUid === p.uid}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors disabled:opacity-60 ${
                    p.amenidades_suspendidas
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-500'
                  }`}
                  aria-label={p.amenidades_suspendidas ? 'Habilitar amenidades' : 'Suspender amenidades'}
                  title={p.amenidades_suspendidas ? 'Habilitar amenidades' : 'Suspender amenidades'}
                >
                  {togglingAmenidadesUid === p.uid
                    ? <span className="w-3.5 h-3.5 border-2 border-rose-200 border-t-rose-600 rounded-full animate-spin" />
                    : <ShieldX className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => { void handleDownloadPazYSalvo(p) }}
                  disabled={downloadingPazUid === p.uid || p.estado_cuenta !== 'al_dia'}
                  className="w-8 h-8 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-600 flex items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Descargar paz y salvo"
                  title={p.estado_cuenta === 'al_dia' ? 'Descargar paz y salvo' : 'Paz y salvo disponible solo si está al día'}
                >
                  {downloadingPazUid === p.uid
                    ? <span className="w-3.5 h-3.5 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
                    : <FileSpreadsheet className="w-3.5 h-3.5" />}
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

      {fpEditing && (
        <RegisterFingerprintModal item={fpEditing} onClose={() => setFpEditing(null)} onSaved={handleFpSaved} />
      )}
      {editing && (
        <EditModal item={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}
      {deleting && (
        <DeleteConfirm item={deleting} onClose={() => setDeleting(null)} onDeleted={handleDeleted} />
      )}
      {showBulkImport && (
        <BulkImportModal onClose={() => setShowBulkImport(false)} onImported={handleBulkImported} />
      )}
    </div>
  )
}
