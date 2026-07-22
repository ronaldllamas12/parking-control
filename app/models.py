from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from app.database import Base
from sqlalchemy import (BigInteger, Boolean, CheckConstraint, Date, DateTime,
                        ForeignKey, Integer, String, Text, UniqueConstraint)
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
    config_financiera: Mapped["ConfigFinanciera | None"] = relationship(
        back_populates="conjunto", uselist=False, cascade="all, delete-orphan"
    )


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
    telegram_link_token: Mapped[str | None] = mapped_column(
        String(100), nullable=True, unique=True, index=True
    )
    telegram_link_token_created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    telegram_linked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
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
    conversaciones_telegram: Mapped[list["TelegramConversation"]] = relationship(
        back_populates="propietario", cascade="all, delete-orphan"
    )


class TelegramConversation(Base):
    __tablename__ = "telegram_conversations"
    __table_args__ = (
        UniqueConstraint(
            "propietario_id",
            "destino_role",
            name="uq_telegram_conversations_propietario_destino",
        ),
        CheckConstraint(
            "destino_role IN ('admin', 'vigilante')",
            name="ck_telegram_conversations_destino_role",
        ),
        CheckConstraint(
            "estado IN ('abierta', 'cerrada')",
            name="ck_telegram_conversations_estado",
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
    destino_role: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    estado: Mapped[str] = mapped_column(
        String(20), nullable=False, default="abierta", server_default="abierta", index=True
    )
    last_message_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    propietario: Mapped[Propietario] = relationship(back_populates="conversaciones_telegram")
    mensajes: Mapped[list["TelegramMessage"]] = relationship(
        back_populates="conversacion", cascade="all, delete-orphan"
    )


class TelegramMessage(Base):
    __tablename__ = "telegram_messages"
    __table_args__ = (
        CheckConstraint(
            "sender_role IN ('propietario', 'admin', 'vigilante')",
            name="ck_telegram_messages_sender_role",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("telegram_conversations.id"), nullable=False, index=True
    )
    conjunto_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("conjuntos_residenciales.id"),
        nullable=False,
        index=True,
    )
    propietario_id: Mapped[int] = mapped_column(
        ForeignKey("propietarios.id"), nullable=False, index=True
    )
    sender_role: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    sender_username: Mapped[str | None] = mapped_column(String(50), nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    read_by_staff: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false", index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    conversacion: Mapped[TelegramConversation] = relationship(back_populates="mensajes")
    propietario: Mapped[Propietario] = relationship()


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


class ConfigFinanciera(Base):
    __tablename__ = "config_financiera"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    conjunto_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("conjuntos_residenciales.id"),
        nullable=False,
        unique=True,
        index=True,
    )
    cuota_mensual_centavos: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=0, server_default="0"
    )
    dia_vencimiento: Mapped[int] = mapped_column(
        Integer, nullable=False, default=5, server_default="5"
    )
    activo: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    conjunto: Mapped[ConjuntoResidencial] = relationship(back_populates="config_financiera")


class ConceptoMovimiento(Base):
    __tablename__ = "concepto_movimiento"
    __table_args__ = (
        UniqueConstraint("conjunto_id", "nombre", "tipo", name="uq_concepto_conjunto_nombre_tipo"),
        CheckConstraint(
            "tipo IN ('cargo', 'abono', 'ingreso', 'egreso')",
            name="ck_concepto_movimiento_tipo",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    conjunto_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("conjuntos_residenciales.id"),
        nullable=False,
        index=True,
    )
    nombre: Mapped[str] = mapped_column(String(80), nullable=False)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    activo: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true", index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class MovimientoCartera(Base):
    __tablename__ = "movimiento_cartera"
    __table_args__ = (
        CheckConstraint(
            "tipo IN ('cargo', 'abono')",
            name="ck_movimiento_cartera_tipo",
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
    concepto_id: Mapped[int | None] = mapped_column(
        ForeignKey("concepto_movimiento.id"), nullable=True, index=True
    )
    tipo: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    monto_centavos: Mapped[int] = mapped_column(BigInteger, nullable=False)
    fecha: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    periodo: Mapped[str | None] = mapped_column(String(7), nullable=True, index=True)
    referencia: Mapped[str | None] = mapped_column(String(120), nullable=True)
    notas: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    propietario: Mapped[Propietario] = relationship()
    concepto: Mapped["ConceptoMovimiento | None"] = relationship()


class MovimientoCaja(Base):
    __tablename__ = "movimiento_caja"
    __table_args__ = (
        CheckConstraint(
            "tipo IN ('ingreso', 'egreso')",
            name="ck_movimiento_caja_tipo",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    conjunto_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("conjuntos_residenciales.id"),
        nullable=False,
        index=True,
    )
    concepto_id: Mapped[int | None] = mapped_column(
        ForeignKey("concepto_movimiento.id"), nullable=True, index=True
    )
    tipo: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    monto_centavos: Mapped[int] = mapped_column(BigInteger, nullable=False)
    fecha: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    periodo: Mapped[str | None] = mapped_column(String(7), nullable=True, index=True)
    referencia: Mapped[str | None] = mapped_column(String(120), nullable=True)
    notas: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    concepto: Mapped["ConceptoMovimiento | None"] = relationship()


class AlertaFinanciera(Base):
    __tablename__ = "alerta_financiera"
    __table_args__ = (
        CheckConstraint(
            "tipo IN ('mora', 'vencimiento', 'sin_pago')",
            name="ck_alerta_financiera_tipo",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    conjunto_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("conjuntos_residenciales.id"),
        nullable=False,
        index=True,
    )
    propietario_id: Mapped[int | None] = mapped_column(
        ForeignKey("propietarios.id"), nullable=True, index=True
    )
    tipo: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    mensaje: Mapped[str] = mapped_column(String(500), nullable=False)
    leida: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false", index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    propietario: Mapped["Propietario | None"] = relationship()
