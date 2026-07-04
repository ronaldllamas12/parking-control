from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

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


class PropietarioOut(BaseModel):
    uid: str
    nombre: str
    numero_contacto: str | None = None
    torre: str
    apartamento: str
    foto_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class VerificacionResponse(BaseModel):
    uid: str
    nombre: str
    numero_contacto: str | None = None
    torre: str
    apartamento: str
    foto_url: str
    verificado_en: datetime


class HistorialAccesoOut(BaseModel):
    uid: str
    nombre: str
    numero_contacto: str | None = None
    torre: str
    apartamento: str
    foto_url: str
    verificado_en: datetime


class UserOut(BaseModel):
    username: str
    role: str

    model_config = ConfigDict(from_attributes=True)
