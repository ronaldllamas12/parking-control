// ── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthUser {
  username: string
  role: 'admin' | 'vigilante'
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

// ── Propietarios ──────────────────────────────────────────────────────────────
export interface PropietarioOut {
  uid: string
  nombre: string
  torre: string
  apartamento: string
  foto_url: string
}

export interface PropietarioUpdate {
  nombre?: string
  torre?: string
  apartamento?: string
}

// ── Acceso ────────────────────────────────────────────────────────────────────
export interface VerificacionResponse {
  uid: string
  nombre: string
  torre: string
  apartamento: string
  foto_url: string
  verificado_en: string // ISO 8601
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
