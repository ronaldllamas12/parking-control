import type { AxiosError } from 'axios'
import { ArrowLeft, CalendarPlus, Save, Settings2 } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  actualizarConfigFinanciera,
  generarCuotas,
  obtenerConfigFinanciera,
} from '../../api/finanzas'
import type { ApiErrorBody, ConfigFinancieraOut } from '../../types'

function currentPeriodo(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function FinanzasConfig() {
  const [config, setConfig] = useState<ConfigFinancieraOut | null>(null)
  const [cuotaCop, setCuotaCop] = useState('')
  const [diaVencimiento, setDiaVencimiento] = useState('5')
  const [activo, setActivo] = useState(true)
  const [periodo, setPeriodo] = useState(currentPeriodo())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await obtenerConfigFinanciera()
        setConfig(data)
        setCuotaCop(String(Math.round(data.cuota_mensual_centavos / 100)))
        setDiaVencimiento(String(data.dia_vencimiento))
        setActivo(data.activo)
      } catch (err) {
        const axiosErr = err as AxiosError<ApiErrorBody>
        setError(axiosErr.response?.data?.detail ?? 'No se pudo cargar la configuración')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    const cuota = Number(cuotaCop)
    const dia = Number(diaVencimiento)
    if (!Number.isFinite(cuota) || cuota < 0) {
      setError('Cuota inválida')
      return
    }
    if (!Number.isInteger(dia) || dia < 1 || dia > 28) {
      setError('Día de vencimiento debe estar entre 1 y 28')
      return
    }
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const updated = await actualizarConfigFinanciera({
        cuota_mensual_centavos: Math.round(cuota * 100),
        dia_vencimiento: dia,
        activo,
      })
      setConfig(updated)
      setNotice('Configuración guardada')
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerar = async () => {
    setGenerating(true)
    setError(null)
    setNotice(null)
    try {
      const result = await generarCuotas(periodo)
      setNotice(
        `Periodo ${result.periodo}: ${result.creados} cuotas creadas, ${result.omitidos} omitidas (ya existían).`,
      )
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorBody>
      setError(axiosErr.response?.data?.detail ?? 'No se pudieron generar las cuotas')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return <div className="p-10 text-center text-slate-400 text-sm">Cargando configuración…</div>
  }

  return (
    <div className="animate-fade-in space-y-6 max-w-xl">
      <Link to="/admin/finanzas/cartera" className="btn-secondary inline-flex">
        <ArrowLeft className="w-4 h-4" /> Cartera
      </Link>

      <div className="page-header">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-500 flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-white" />
          </div>
          <h1 className="page-title">Configuración financiera</h1>
        </div>
        <p className="page-subtitle pl-12">
          Cuota fija mensual y generación masiva por periodo.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}
      {notice && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">{notice}</div>
      )}

      <form onSubmit={(e) => { void handleSave(e) }} className="card-lg p-5 space-y-4">
        <div>
          <label className="field-label">Cuota mensual (COP)</label>
          <input
            className="field"
            type="number"
            min={0}
            step={1}
            required
            value={cuotaCop}
            onChange={(e) => setCuotaCop(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">Día de vencimiento (1–28)</label>
          <input
            className="field"
            type="number"
            min={1}
            max={28}
            required
            value={diaVencimiento}
            onChange={(e) => setDiaVencimiento(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 font-medium">
          <input
            type="checkbox"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            className="rounded border-surface-300"
          />
          Configuración activa
        </label>
        {config && (
          <p className="text-xs text-slate-400">ID config #{config.id}</p>
        )}
        <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
          {saving
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <Save className="w-4 h-4" />}
          Guardar
        </button>
      </form>

      <div className="card-lg p-5 space-y-4">
        <h2 className="font-bold text-slate-800 text-sm">Generar cuotas del mes</h2>
        <p className="text-xs text-slate-500">
          Crea un cargo de cuota para cada propietario del conjunto en el periodo indicado.
          No duplica si ya existe una cuota para ese mes.
        </p>
        <div>
          <label className="field-label">Periodo (YYYY-MM)</label>
          <input
            className="field"
            type="month"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
          />
        </div>
        <button
          type="button"
          disabled={generating || !activo}
          onClick={() => { void handleGenerar() }}
          className="btn-primary w-full justify-center bg-teal-600 hover:bg-teal-700 disabled:opacity-50"
        >
          {generating
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <CalendarPlus className="w-4 h-4" />}
          Generar cuotas
        </button>
      </div>
    </div>
  )
}
