// ── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthUser {
  username: string
  role: 'superadmin' | 'admin' | 'vigilante'
  conjunto_id?: string | null
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

// ── Super Admin ──────────────────────────────────────────────────────────────
export interface ConjuntoResidencial {
  id: string
  nombre: string
  direccion?: string | null
  activo: boolean
  created_at: string
}

export interface CrearConjuntoPayload {
  conjunto: {
    nombre: string
    direccion?: string | null
  }
  admin: {
    username: string
    password: string
  }
}

export interface ActualizarConjuntoPayload {
  nombre?: string
  direccion?: string | null
  activo?: boolean
}

export interface CrearVigilantePayload {
  username: string
  password: string
}

export interface UserOut {
  id: number
  username: string
  role: 'superadmin' | 'admin' | 'vigilante'
  conjunto_id?: string | null
}

// ── Propietarios ──────────────────────────────────────────────────────────────
export interface PropietarioOut {
  uid: string
  nombre: string
  numero_contacto?: string | null
  torre: string
  apartamento: string
  foto_url: string
  acceso_habilitado: boolean
  huella_registrada: boolean
}

export interface PropietarioUpdate {
  nombre?: string
  numero_contacto?: string
  torre?: string
  apartamento?: string
}

// ── Acceso ────────────────────────────────────────────────────────────────────
export interface VerificacionResponse {
  uid: string
  nombre: string
  numero_contacto?: string | null
  torre: string
  apartamento: string
  foto_url: string
  verificado_en: string // ISO 8601
}

export interface HistorialAccesoOut {
  uid: string
  nombre: string
  numero_contacto?: string | null
  torre: string
  apartamento: string
  foto_url: string
  verificado_en: string
}

// ── Bulk import ─────────────────────────────────────────────────────────────
export interface BulkImportResult {
  creados: PropietarioOut[]
  errores: string[]
}

// ── Fingerprint ────────────────────────────────────────────────────────────
export interface HuellaTemplate {
  uid: string
  template_b64: string
}

// ── API errors ────────────────────────────────────────────────────────────────
export interface ApiErrorBody {
  detail: string
  errors?: Array<{
    loc: string[]
    msg: string
    type: string
  }>
}
