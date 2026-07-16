from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

NombreStr = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=3, max_length=120),
]
TorreStr = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, pattern=r"^[1-9][0-9]{0,2}$"
    ),
]
ApartamentoStr = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, to_upper=True, pattern=r"^[0-9]{2,4}[A-Z]?$"
    ),
]
NumeroContactoStr = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, min_length=7, max_length=30, pattern=r"^\+?[0-9\s()-]+$"
    ),
]


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    username: str
    role: str
    conjunto_id: UUID | None = None


class ConjuntoResidencialCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nombre: NombreStr
    direccion: str | None = None
    telegram_bot_token: str | None = None


class ConjuntoResidencialUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nombre: NombreStr | None = None
    direccion: str | None = None
    activo: bool | None = None
    telegram_bot_token: str | None = None


class AdminInicialCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=3, max_length=50)
    ]
    password: Annotated[str, StringConstraints(min_length=8, max_length=128)]


class VigilanteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=3, max_length=50)
    ]
    password: Annotated[str, StringConstraints(min_length=8, max_length=128)]


class UserPasswordUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    password: Annotated[str, StringConstraints(min_length=8, max_length=128)]


class ConjuntoWithAdminCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    conjunto: ConjuntoResidencialCreate
    admin: AdminInicialCreate


class ConjuntoResidencialOut(BaseModel):
    id: UUID
    nombre: str
    direccion: str | None = None
    telegram_bot_token: str | None = None
    activo: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SuperAdminRecentAccessOut(BaseModel):
    uid: str
    nombre: str
    torre: str
    apartamento: str
    vigilante_username: str | None = None
    verificado_en: datetime


class ConjuntoMetricasOut(BaseModel):
    conjunto: ConjuntoResidencialOut
    admins: int
    vigilantes: int
    propietarios: int
    propietarios_con_acceso: int
    propietarios_sin_acceso: int
    huellas_registradas: int
    accesos_totales: int
    accesos_hoy: int
    ultimos_accesos: list[SuperAdminRecentAccessOut]


class ZonaAccesoCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nombre: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=80)]
    acceso_universal: bool = False


class ZonaAccesoUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nombre: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=80)] | None = None
    activa: bool | None = None
    acceso_universal: bool | None = None


class ZonaAccesoOut(BaseModel):
    id: int
    nombre: str
    activa: bool = True
    acceso_universal: bool = False

    model_config = ConfigDict(from_attributes=True)


class PropietarioCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nombre: NombreStr
    numero_contacto: NumeroContactoStr
    torre: TorreStr
    apartamento: ApartamentoStr


class PropietarioUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nombre: NombreStr | None = None
    numero_contacto: NumeroContactoStr | None = None
    torre: TorreStr | None = None
    apartamento: ApartamentoStr | None = None
    estado_cuenta: str | None = Field(default=None, pattern="^(al_dia|en_mora)$")
    amenidades_suspendidas: bool | None = None
    telegram_chat_id: str | None = None
    nfc_tag_id: str | None = None


class PropietarioOut(BaseModel):
    uid: str
    nombre: str
    numero_contacto: str | None = None
    torre: str
    apartamento: str
    foto_url: str | None = None
    acceso_habilitado: bool = True
    estado_cuenta: str = "al_dia"
    amenidades_suspendidas: bool = False
    telegram_chat_id: str | None = None
    nfc_tag_id: str | None = None
    huella_registrada: bool = False

    model_config = ConfigDict(from_attributes=True)


class VerificacionResponse(BaseModel):
    uid: str
    nombre: str
    numero_contacto: str | None = None
    torre: str
    apartamento: str
    foto_url: str
    telegram_chat_id: str | None = None
    zona: str | None = None
    estado_intento: str = "concedido"
    motivo: str | None = None
    verificado_en: datetime


class VerificacionAccesoIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    identificador: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    tipo_identificador: str = Field(default="qr", pattern="^(qr|nfc)$")
    zona_id: int


class HistorialAccesoOut(BaseModel):
    uid: str
    nombre: str
    numero_contacto: str | None = None
    torre: str
    apartamento: str
    foto_url: str
    telegram_chat_id: str | None = None
    zona: str | None = None
    estado_intento: str = "concedido"
    motivo: str | None = None
    verificado_en: datetime


class AmenidadesUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amenidades_suspendidas: bool


class TelegramNotificationIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mensaje: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]


class TelegramNotificationOut(BaseModel):
    detail: str


class RegistroAccesoOut(BaseModel):
    id: int
    propietario_id: int
    uid: str
    nombre: str
    torre: str
    apartamento: str
    zona_id: int
    zona: str
    estado_intento: str
    motivo: str | None = None
    vigilante_username: str | None = None
    fecha_hora: datetime


class BulkImportResponse(BaseModel):
    creados: list[PropietarioOut]
    errores: list[str]


class PropietarioEstadoBulkItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    torre: TorreStr
    apartamento: ApartamentoStr
    nuevo_estado: str = Field(pattern="^(al_dia|en_mora)$")
    amenidades_suspendidas: bool | None = None


class PropietarioEstadoBulkIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    registros: list[PropietarioEstadoBulkItem]


class BulkStatusError(BaseModel):
    fila: int
    torre: str
    apartamento: str
    error: str


class BulkStatusResponse(BaseModel):
    actualizados: int
    errores: list[BulkStatusError]


class HuellaRegisterIn(BaseModel):
    template_b64: str


class HuellaTemplate(BaseModel):
    uid: str
    template_b64: str

    model_config = ConfigDict(from_attributes=True)


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    conjunto_id: UUID | None = None

    model_config = ConfigDict(from_attributes=True)


class WebAuthnAssertionOptions(BaseModel):
    challenge: str
    allowCredentials: list[dict] | None = None
    timeout: int | None = 60000
    rpId: str | None = None


class WebAuthnAssertionVerifyIn(BaseModel):
    id: str
    rawId: str
    type: str
    response: dict


class WebAuthnRegisterOptions(BaseModel):
    challenge: str
    rp: dict | None = None
    user: dict
    pubKeyCredParams: list | None = None
    timeout: int | None = 60000
    attestation: str | None = None
    excludeCredentials: list[dict] | None = None


class WebAuthnRegisterVerifyIn(BaseModel):
    id: str
    rawId: str
    type: str
    response: dict
    username: str | None = None
