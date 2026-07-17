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
  telegram_bot_token?: string | null
  activo: boolean
  created_at: string
}

export interface CrearConjuntoPayload {
  conjunto: {
    nombre: string
    direccion?: string | null
    telegram_bot_token?: string | null
  }
  admin: {
    username: string
    password: string
  }
}

export interface ActualizarConjuntoPayload {
  nombre?: string
  direccion?: string | null
  telegram_bot_token?: string | null
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

export interface SuperAdminRecentAccess {
  uid: string
  nombre: string
  torre: string
  apartamento: string
  vigilante_username?: string | null
  verificado_en: string
}

export interface ConjuntoMetricas {
  conjunto: ConjuntoResidencial
  admins: number
  vigilantes: number
  propietarios: number
  propietarios_con_acceso: number
  propietarios_sin_acceso: number
  huellas_registradas: number
  accesos_totales: number
  accesos_hoy: number
  ultimos_accesos: SuperAdminRecentAccess[]
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
  estado_cuenta: 'al_dia' | 'en_mora'
  amenidades_suspendidas: boolean
  telegram_chat_id?: string | null
  telegram_linked_at?: string | null
  nfc_tag_id?: string | null
  huella_registrada: boolean
}

export interface PropietarioUpdate {
  nombre?: string
  numero_contacto?: string
  torre?: string
  apartamento?: string
  estado_cuenta?: 'al_dia' | 'en_mora'
  amenidades_suspendidas?: boolean
  nfc_tag_id?: string | null
}

export interface TelegramLinkOut {
  link: string
  bot_username: string
}

export interface ZonaAcceso {
  id: number
  nombre: string
  activa: boolean
  acceso_universal: boolean
}

export interface BulkStatusItem {
  torre: string
  apartamento: string
  nuevo_estado: 'al_dia' | 'en_mora'
  amenidades_suspendidas?: boolean | null
}

export interface BulkStatusResult {
  actualizados: number
  errores: Array<{
    fila: number
    torre: string
    apartamento: string
    error: string
  }>
}

// ── Acceso ────────────────────────────────────────────────────────────────────
export interface VerificacionResponse {
  uid: string
  nombre: string
  numero_contacto?: string | null
  torre: string
  apartamento: string
  foto_url: string
  telegram_chat_id?: string | null
  zona?: string | null
  estado_intento: 'concedido' | 'denegado'
  motivo?: string | null
  verificado_en: string // ISO 8601
}

export interface HistorialAccesoOut {
  uid: string
  nombre: string
  numero_contacto?: string | null
  torre: string
  apartamento: string
  foto_url: string
  telegram_chat_id?: string | null
  zona?: string | null
  estado_intento: 'concedido' | 'denegado'
  motivo?: string | null
  verificado_en: string
}

export interface RegistroAccesoOut {
  id: number
  propietario_id: number
  uid: string
  nombre: string
  torre: string
  apartamento: string
  zona_id: number
  zona: string
  estado_intento: 'concedido' | 'denegado'
  motivo?: string | null
  vigilante_username?: string | null
  fecha_hora: string
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
