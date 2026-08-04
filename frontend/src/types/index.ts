// ── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthUser {
  username: string
  role: 'superadmin' | 'admin' | 'vigilante' | 'propietario'
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
  role: 'superadmin' | 'admin' | 'vigilante' | 'propietario'
  conjunto_id?: string | null
  propietario_id?: number | null
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

export interface TelegramConversationOut {
  id: number
  destino_role: 'admin' | 'vigilante'
  estado: 'abierta' | 'cerrada'
  propietario_id: number
  propietario_uid: string
  propietario_nombre: string
  torre: string
  apartamento: string
  last_message_at: string
  last_message_text?: string | null
  unread_count: number
}

export interface TelegramMessageOut {
  id: number
  conversation_id: number
  sender_role: 'propietario' | 'admin' | 'vigilante'
  sender_username?: string | null
  text: string
  read_by_staff: boolean
  created_at: string
}

export interface TelegramConversationDetailOut {
  conversation: TelegramConversationOut
  messages: TelegramMessageOut[]
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

// ── Finanzas ─────────────────────────────────────────────────────────────────
export interface ConfigFinancieraOut {
  id: number
  conjunto_id: string
  cuota_mensual_centavos: number
  dia_vencimiento: number
  activo: boolean
  payment_link_url?: string | null
  created_at: string
}

export interface ConceptoMovimientoOut {
  id: number
  nombre: string
  tipo: 'cargo' | 'abono' | 'ingreso' | 'egreso' | string
  activo: boolean
  created_at: string
}

export interface GenerarCuotasOut {
  periodo: string
  creados: number
  omitidos: number
}

export interface CarteraItemOut {
  propietario_id: number
  uid: string
  nombre: string
  torre: string
  apartamento: string
  estado_cuenta: string
  saldo_centavos: number
  ultimo_pago?: string | null
  proximo_vencimiento?: string | null
  telegram_chat_id?: string | null
}

export interface MultaPendienteOut {
  id: number
  fecha: string
  monto_centavos: number
  referencia?: string | null
  notas?: string | null
  created_at: string
}

export interface MovimientoCarteraOut {
  id: number
  tipo: 'cargo' | 'abono' | string
  monto_centavos: number
  fecha: string
  periodo?: string | null
  referencia?: string | null
  notas?: string | null
  concepto_id?: number | null
  concepto_nombre?: string | null
  created_by?: string | null
  created_at: string
  saldo_acumulado_centavos: number
}

export interface EstadoCuentaOut {
  propietario_id: number
  uid: string
  nombre: string
  torre: string
  apartamento: string
  estado_cuenta: string
  saldo_centavos: number
  movimientos: MovimientoCarteraOut[]
}

export interface PropietarioDashboardOut {
  propietario: PropietarioOut
  estado_cuenta: EstadoCuentaOut
  payment_link_url?: string | null
  proximo_vencimiento?: string | null
  ultimo_pago?: string | null
}

export interface ComprobantePagoOut {
  id: number
  imagen_url: string
  mensaje?: string | null
  referencia?: string | null
  monto_centavos?: number | null
  estado: 'recibido' | 'en_revision' | 'aprobado' | 'rechazado' | string
  created_at: string
}

export interface PropietarioCuentaOut {
  id: number
  username: string
  propietario_uid: string
  propietario_nombre: string
}

// ── Salones Sociales ─────────────────────────────────────────────────────────
export interface SalonSocialOut {
  id: number
  nombre: string
  descripcion?: string | null
  capacidad: number
  imagen_url?: string | null
  estado: 'activo' | 'inactivo'
  color_calendario: string
  precio_sin_aseo_centavos: number
  precio_con_aseo_centavos: number
  created_at: string
  updated_at: string
}

export interface SalonSocialReservaOut {
  id: number
  salon_id: number
  salon_nombre: string
  salon_color: string
  propietario_id?: number | null
  propietario_nombre?: string | null
  propietario_uid?: string | null
  torre?: string | null
  apartamento?: string | null
  fecha: string
  inicio: string
  fin: string
  tipo: 'reserva' | 'bloqueo'
  estado: string
  estado_visual: string
  incluye_aseo: boolean
  precio_centavos: number
  pago_estado: string
  comprobante_url?: string | null
  referencia_pago?: string | null
  notas?: string | null
  cancel_reason?: string | null
  created_by?: string | null
  approved_by?: string | null
  approved_at?: string | null
  created_at: string
}

export interface SalonSocialCalendarDayOut {
  salon_id: number
  salon_nombre: string
  salon_color: string
  fecha: string
  inicio: string
  fin: string
  disponible: boolean
  estado_visual: string
  reserva?: SalonSocialReservaOut | null
}

export interface MovimientoCarteraCreate {
  tipo: 'cargo' | 'abono'
  monto_centavos: number
  fecha: string
  concepto_id?: number | null
  periodo?: string | null
  referencia?: string | null
  notas?: string | null
  multa_ids?: number[] | null
}

export interface MovimientoCarteraUpdate {
  monto_centavos?: number | null
  fecha?: string | null
  concepto_id?: number | null
  periodo?: string | null
  referencia?: string | null
  notas?: string | null
}

export interface MovimientoCarteraListItem {
  id: number
  tipo: 'cargo' | 'abono' | string
  monto_centavos: number
  fecha: string
  periodo?: string | null
  referencia?: string | null
  notas?: string | null
  concepto_id?: number | null
  concepto_nombre?: string | null
  created_by?: string | null
  created_at: string
  propietario_id: number
  propietario_uid: string
  propietario_nombre: string
  torre: string
  apartamento: string
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
