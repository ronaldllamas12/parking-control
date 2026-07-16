from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.database import Base
from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship


class ConjuntoResidencial(Base):
    __tablename__ = "conjuntos_residenciales"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid4, index=True
    )
    nombre: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    direccion: Mapped[str | None] = mapped_column(String(255), nullable=True)
    telegram_bot_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    activo: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true", index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    usuarios: Mapped[list["User"]] = relationship(back_populates="conjunto")
    propietarios: Mapped[list["Propietario"]] = relationship(back_populates="conjunto")
    zonas_acceso: Mapped[list["ZonaAcceso"]] = relationship(back_populates="conjunto")


class ZonaAcceso(Base):
    __tablename__ = "zonas_acceso"
    __table_args__ = (
        UniqueConstraint("conjunto_id", "nombre", name="uq_zonas_acceso_conjunto_nombre"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    conjunto_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("conjuntos_residenciales.id"),
        nullable=False,
        index=True,
    )
    nombre: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    activa: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    acceso_universal: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false", index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    conjunto: Mapped[ConjuntoResidencial] = relationship(back_populates="zonas_acceso")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "(role = 'superadmin' AND conjunto_id IS NULL) OR "
            "(role IN ('admin', 'vigilante') AND conjunto_id IS NOT NULL)",
            name="ck_users_role_conjunto_scope",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    conjunto_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("conjuntos_residenciales.id"),
        nullable=True,
        index=True,
    )
    username: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    conjunto: Mapped[ConjuntoResidencial | None] = relationship(back_populates="usuarios")


class WebAuthnCredential(Base):
    __tablename__ = "webauthn_credentials"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    credential_id: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)
    public_key: Mapped[str] = mapped_column(String(2000), nullable=False)
    sign_count: Mapped[int] = mapped_column(nullable=False, default=0)

    user: Mapped[User] = relationship()


class WebAuthnChallenge(Base):
    __tablename__ = "webauthn_challenges"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    state: Mapped[bytes] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class Propietario(Base):
    __tablename__ = "propietarios"
    __table_args__ = (
        UniqueConstraint("conjunto_id", "uid", name="uq_propietarios_conjunto_uid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    conjunto_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("conjuntos_residenciales.id"),
        nullable=False,
        index=True,
    )
    uid: Mapped[str] = mapped_column(
        String(16), nullable=False, index=True
    )
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    numero_contacto: Mapped[str | None] = mapped_column(String(30), nullable=True)
    torre: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    apartamento: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    foto_url: Mapped[str] = mapped_column(String(500), nullable=False)
    acceso_habilitado: Mapped[bool] = mapped_column(nullable=False, default=True, server_default="true")
    estado_cuenta: Mapped[str] = mapped_column(
        String(20), nullable=False, default="al_dia", server_default="al_dia", index=True
    )
    amenidades_suspendidas: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false", index=True
    )
    telegram_chat_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    nfc_tag_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    huella_registrada: Mapped[bool] = mapped_column(nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    conjunto: Mapped[ConjuntoResidencial] = relationship(back_populates="propietarios")
    accesos: Mapped[list["HistorialAcceso"]] = relationship(
        back_populates="propietario", cascade="all, delete-orphan"
    )
    huella: Mapped["HuellaDigital | None"] = relationship(
        back_populates="propietario", cascade="all, delete-orphan", uselist=False
    )


class HistorialAcceso(Base):
    __tablename__ = "historial_accesos"
    __table_args__ = (
        CheckConstraint(
            "estado_intento IN ('concedido', 'denegado')",
            name="ck_historial_accesos_estado_intento",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    conjunto_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("conjuntos_residenciales.id"),
        nullable=False,
        index=True,
    )
    propietario_id: Mapped[int] = mapped_column(
        ForeignKey("propietarios.id"), nullable=False, index=True
    )
    zona_id: Mapped[int] = mapped_column(
        ForeignKey("zonas_acceso.id"), nullable=False, index=True
    )
    propietario_uid: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    vigilante_username: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True
    )
    estado_intento: Mapped[str] = mapped_column(
        String(20), nullable=False, default="concedido", server_default="concedido", index=True
    )
    motivo: Mapped[str | None] = mapped_column(String(255), nullable=True)
    fecha_hora: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    propietario: Mapped[Propietario] = relationship(back_populates="accesos")
    zona: Mapped[ZonaAcceso] = relationship()


class HuellaDigital(Base):
    __tablename__ = "huellas_digitales"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    conjunto_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("conjuntos_residenciales.id"),
        nullable=False,
        index=True,
    )
    propietario_id: Mapped[int] = mapped_column(
        ForeignKey("propietarios.id"), nullable=False, unique=True, index=True
    )
    propietario_uid: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    template_b64: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    propietario: Mapped[Propietario] = relationship(back_populates="huella")
