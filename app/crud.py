import secrets
from datetime import datetime, time, timezone
from typing import Optional
from uuid import UUID

import bcrypt as _bcrypt
from app import models, schemas
from sqlalchemy import func, text
from sqlalchemy.orm import joinedload
from sqlalchemy.orm import Session


def _generate_short_uid(length: int = 10) -> str:
    raw = secrets.token_urlsafe(12)
    normalized = "".join(ch for ch in raw if ch.isalnum()).upper()
    return normalized[:length]


def get_user_by_username(db: Session, username: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.username == username).first()


def create_user(
    db: Session,
    username: str,
    password: str,
    role: str,
    conjunto_id: UUID | None = None,
) -> models.User:
    hashed = _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()
    user = models.User(
        username=username,
        hashed_password=hashed,
        role=role,
        conjunto_id=conjunto_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def ensure_default_users(
    db: Session,
    admin_username: str,
    admin_password: str,
    vigilante_username: str,
    vigilante_password: str,
) -> None:
    legacy_conjunto = get_or_create_legacy_conjunto(db)
    if not get_user_by_username(db, admin_username):
        create_user(
            db,
            admin_username,
            admin_password,
            role="admin",
            conjunto_id=legacy_conjunto.id,
        )
    if not get_user_by_username(db, vigilante_username):
        create_user(
            db,
            vigilante_username,
            vigilante_password,
            role="vigilante",
            conjunto_id=legacy_conjunto.id,
        )


def get_or_create_legacy_conjunto(db: Session) -> models.ConjuntoResidencial:
    conjunto = (
        db.query(models.ConjuntoResidencial)
        .filter(models.ConjuntoResidencial.nombre == "Conjunto Principal")
        .first()
    )
    if conjunto:
        return conjunto

    conjunto = models.ConjuntoResidencial(
        nombre="Conjunto Principal",
        direccion="Migrado desde instalacion monotenante",
    )
    db.add(conjunto)
    db.commit()
    db.refresh(conjunto)
    return conjunto


def create_conjunto_with_initial_admin(
    db: Session,
    payload: schemas.ConjuntoWithAdminCreate,
) -> models.ConjuntoResidencial:
    hashed = _bcrypt.hashpw(payload.admin.password.encode(), _bcrypt.gensalt()).decode()
    conjunto = models.ConjuntoResidencial(
        nombre=payload.conjunto.nombre,
        direccion=payload.conjunto.direccion,
        telegram_bot_token=payload.conjunto.telegram_bot_token,
    )
    db.add(conjunto)
    db.flush()

    admin = models.User(
        username=payload.admin.username,
        hashed_password=hashed,
        role="admin",
        conjunto_id=conjunto.id,
    )
    db.add(admin)
    db.commit()
    db.refresh(conjunto)
    return conjunto


def get_all_conjuntos(db: Session) -> list[models.ConjuntoResidencial]:
    return (
        db.query(models.ConjuntoResidencial)
        .order_by(models.ConjuntoResidencial.created_at.desc())
        .all()
    )


def get_conjunto_by_id(
    db: Session, conjunto_id: UUID
) -> Optional[models.ConjuntoResidencial]:
    return (
        db.query(models.ConjuntoResidencial)
        .filter(models.ConjuntoResidencial.id == conjunto_id)
        .first()
    )


def update_conjunto(
    db: Session,
    conjunto: models.ConjuntoResidencial,
    payload: schemas.ConjuntoResidencialUpdate,
) -> models.ConjuntoResidencial:
    if payload.nombre is not None:
        conjunto.nombre = payload.nombre
    if payload.direccion is not None:
        conjunto.direccion = payload.direccion
    if payload.activo is not None:
        conjunto.activo = payload.activo
    if payload.telegram_bot_token is not None:
        conjunto.telegram_bot_token = payload.telegram_bot_token or None

    db.commit()
    db.refresh(conjunto)
    return conjunto


def create_vigilante_for_conjunto(
    db: Session,
    conjunto: models.ConjuntoResidencial,
    payload: schemas.VigilanteCreate,
) -> models.User:
    hashed = _bcrypt.hashpw(payload.password.encode(), _bcrypt.gensalt()).decode()
    vigilante = models.User(
        username=payload.username,
        hashed_password=hashed,
        role="vigilante",
        conjunto_id=conjunto.id,
    )
    db.add(vigilante)
    db.commit()
    db.refresh(vigilante)
    return vigilante


def get_users_by_conjunto(
    db: Session,
    conjunto_id: UUID,
) -> list[models.User]:
    return (
        db.query(models.User)
        .filter(
            models.User.conjunto_id == conjunto_id,
            models.User.role.in_(["admin", "vigilante"]),
        )
        .order_by(models.User.role, models.User.username)
        .all()
    )


def get_conjunto_metricas(
    db: Session,
    conjunto: models.ConjuntoResidencial,
) -> schemas.ConjuntoMetricasOut:
    conjunto_id = conjunto.id
    today_start = datetime.combine(
        datetime.now(timezone.utc).date(),
        time.min,
        tzinfo=timezone.utc,
    )

    admins = (
        db.query(func.count(models.User.id))
        .filter(models.User.conjunto_id == conjunto_id, models.User.role == "admin")
        .scalar()
        or 0
    )
    vigilantes = (
        db.query(func.count(models.User.id))
        .filter(models.User.conjunto_id == conjunto_id, models.User.role == "vigilante")
        .scalar()
        or 0
    )
    propietarios = (
        db.query(func.count(models.Propietario.id))
        .filter(models.Propietario.conjunto_id == conjunto_id)
        .scalar()
        or 0
    )
    propietarios_con_acceso = (
        db.query(func.count(models.Propietario.id))
        .filter(
            models.Propietario.conjunto_id == conjunto_id,
            models.Propietario.acceso_habilitado.is_(True),
        )
        .scalar()
        or 0
    )
    huellas_registradas = (
        db.query(func.count(models.HuellaDigital.id))
        .filter(models.HuellaDigital.conjunto_id == conjunto_id)
        .scalar()
        or 0
    )
    accesos_totales = (
        db.query(func.count(models.HistorialAcceso.id))
        .filter(models.HistorialAcceso.conjunto_id == conjunto_id)
        .scalar()
        or 0
    )
    accesos_hoy = (
        db.query(func.count(models.HistorialAcceso.id))
        .filter(
            models.HistorialAcceso.conjunto_id == conjunto_id,
            models.HistorialAcceso.fecha_hora >= today_start,
        )
        .scalar()
        or 0
    )

    recientes = (
        db.query(models.HistorialAcceso)
        .join(models.HistorialAcceso.propietario)
        .filter(models.HistorialAcceso.conjunto_id == conjunto_id)
        .order_by(models.HistorialAcceso.fecha_hora.desc())
        .limit(8)
        .all()
    )

    return schemas.ConjuntoMetricasOut(
        conjunto=conjunto,
        admins=admins,
        vigilantes=vigilantes,
        propietarios=propietarios,
        propietarios_con_acceso=propietarios_con_acceso,
        propietarios_sin_acceso=max(propietarios - propietarios_con_acceso, 0),
        huellas_registradas=huellas_registradas,
        accesos_totales=accesos_totales,
        accesos_hoy=accesos_hoy,
        ultimos_accesos=[
            schemas.SuperAdminRecentAccessOut(
                uid=log.propietario.uid,
                nombre=log.propietario.nombre,
                torre=log.propietario.torre,
                apartamento=log.propietario.apartamento,
                vigilante_username=log.vigilante_username,
                verificado_en=log.fecha_hora,
            )
            for log in recientes
        ],
    )


def get_zonas_by_conjunto(db: Session, conjunto_id: UUID) -> list[models.ZonaAcceso]:
    return (
        db.query(models.ZonaAcceso)
        .filter(models.ZonaAcceso.conjunto_id == conjunto_id)
        .order_by(models.ZonaAcceso.nombre)
        .all()
    )


def get_zona_by_id(
    db: Session, zona_id: int, conjunto_id: UUID
) -> Optional[models.ZonaAcceso]:
    return (
        db.query(models.ZonaAcceso)
        .filter(
            models.ZonaAcceso.id == zona_id,
            models.ZonaAcceso.conjunto_id == conjunto_id,
        )
        .first()
    )


def get_or_create_parqueadero_zone(
    db: Session, conjunto_id: UUID
) -> models.ZonaAcceso:
    zona = (
        db.query(models.ZonaAcceso)
        .filter(
            models.ZonaAcceso.conjunto_id == conjunto_id,
            func.lower(models.ZonaAcceso.nombre) == "parqueadero",
        )
        .first()
    )
    if zona:
        return zona
    zona = models.ZonaAcceso(conjunto_id=conjunto_id, nombre="Parqueadero")
    db.add(zona)
    db.commit()
    db.refresh(zona)
    return zona


def create_zona(
    db: Session, conjunto_id: UUID, payload: schemas.ZonaAccesoCreate
) -> models.ZonaAcceso:
    zona = models.ZonaAcceso(
        conjunto_id=conjunto_id,
        nombre=payload.nombre,
        acceso_universal=payload.acceso_universal,
    )
    db.add(zona)
    db.commit()
    db.refresh(zona)
    return zona


def update_zona(
    db: Session, zona: models.ZonaAcceso, payload: schemas.ZonaAccesoUpdate
) -> models.ZonaAcceso:
    if payload.nombre is not None:
        zona.nombre = payload.nombre
    if payload.activa is not None:
        zona.activa = payload.activa
    if payload.acceso_universal is not None:
        zona.acceso_universal = payload.acceso_universal
    db.commit()
    db.refresh(zona)
    return zona


def delete_zona(db: Session, zona: models.ZonaAcceso) -> None:
    db.delete(zona)
    db.commit()


def get_tenant_user_by_id(db: Session, user_id: int) -> Optional[models.User]:
    return (
        db.query(models.User)
        .filter(
            models.User.id == user_id,
            models.User.role.in_(["admin", "vigilante"]),
            models.User.conjunto_id.isnot(None),
        )
        .first()
    )


def update_user_password(
    db: Session,
    user: models.User,
    password: str,
) -> models.User:
    user.hashed_password = _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()
    db.commit()
    db.refresh(user)
    return user


def delete_conjunto(db: Session, conjunto: models.ConjuntoResidencial) -> None:
    conjunto_id = conjunto.id
    tenant_user_ids = db.query(models.User.id).filter(
        models.User.conjunto_id == conjunto_id
    )
    tenant_usernames = db.query(models.User.username).filter(
        models.User.conjunto_id == conjunto_id
    )

    db.query(models.HistorialAcceso).filter(
        models.HistorialAcceso.conjunto_id == conjunto_id
    ).delete(synchronize_session=False)
    db.query(models.TelegramMessage).filter(
        models.TelegramMessage.conjunto_id == conjunto_id
    ).delete(synchronize_session=False)
    db.query(models.TelegramConversation).filter(
        models.TelegramConversation.conjunto_id == conjunto_id
    ).delete(synchronize_session=False)
    db.query(models.ZonaAcceso).filter(
        models.ZonaAcceso.conjunto_id == conjunto_id
    ).delete(synchronize_session=False)
    db.query(models.HuellaDigital).filter(
        models.HuellaDigital.conjunto_id == conjunto_id
    ).delete(synchronize_session=False)
    db.query(models.Propietario).filter(
        models.Propietario.conjunto_id == conjunto_id
    ).delete(synchronize_session=False)
    db.query(models.WebAuthnCredential).filter(
        models.WebAuthnCredential.user_id.in_(tenant_user_ids)
    ).delete(synchronize_session=False)
    db.query(models.WebAuthnChallenge).filter(
        models.WebAuthnChallenge.username.in_(tenant_usernames)
    ).delete(synchronize_session=False)
    db.query(models.User).filter(models.User.conjunto_id == conjunto_id).delete(
        synchronize_session=False
    )
    db.delete(conjunto)
    db.commit()


def get_propietario_by_uid(
    db: Session, uid: str, conjunto_id: UUID | None = None
) -> Optional[models.Propietario]:
    query = db.query(models.Propietario).filter(models.Propietario.uid == uid)
    if conjunto_id:
        query = query.filter(models.Propietario.conjunto_id == conjunto_id)
    return query.first()


def get_propietario_by_id(
    db: Session, propietario_id: int, conjunto_id: UUID
) -> Optional[models.Propietario]:
    return (
        db.query(models.Propietario)
        .filter(
            models.Propietario.id == propietario_id,
            models.Propietario.conjunto_id == conjunto_id,
        )
        .first()
    )


def get_propietario_by_nfc(
    db: Session, nfc_tag_id: str, conjunto_id: UUID
) -> Optional[models.Propietario]:
    return (
        db.query(models.Propietario)
        .filter(
            models.Propietario.conjunto_id == conjunto_id,
            models.Propietario.nfc_tag_id == nfc_tag_id,
        )
        .first()
    )


def create_propietario(
    db: Session,
    payload: schemas.PropietarioCreate,
    foto_url: str,
    conjunto_id: UUID,
) -> models.Propietario:
    for _ in range(10):
        candidate_uid = _generate_short_uid()
        exists = get_propietario_by_uid(db, candidate_uid, conjunto_id=conjunto_id)
        if not exists:
            propietario = models.Propietario(
                conjunto_id=conjunto_id,
                uid=candidate_uid,
                nombre=payload.nombre,
                numero_contacto=payload.numero_contacto,
                torre=payload.torre,
                apartamento=payload.apartamento,
                foto_url=foto_url,
            )
            db.add(propietario)
            db.commit()
            db.refresh(propietario)
            return propietario

    raise RuntimeError("No se pudo generar UID unico")


def register_access_log(
    db: Session,
    propietario: models.Propietario,
    zona: models.ZonaAcceso,
    vigilante_username: str | None = None,
    estado_intento: str = "concedido",
    motivo: str | None = None,
) -> models.HistorialAcceso:
    log = models.HistorialAcceso(
        conjunto_id=propietario.conjunto_id,
        propietario_id=propietario.id,
        zona_id=zona.id,
        propietario_uid=propietario.uid,
        vigilante_username=vigilante_username,
        estado_intento=estado_intento,
        motivo=motivo,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_recent_access_logs_by_vigilante(
    db: Session,
    vigilante_username: str,
    conjunto_id: UUID,
    limit: int = 10,
) -> list[models.HistorialAcceso]:
    return (
        db.query(models.HistorialAcceso)
        .join(models.HistorialAcceso.propietario)
        .filter(
            models.HistorialAcceso.vigilante_username == vigilante_username,
            models.HistorialAcceso.conjunto_id == conjunto_id,
        )
        .order_by(models.HistorialAcceso.fecha_hora.desc())
        .limit(limit)
        .all()
    )


def get_access_logs_by_conjunto(
    db: Session,
    conjunto_id: UUID,
    limit: int = 200,
) -> list[models.HistorialAcceso]:
    return (
        db.query(models.HistorialAcceso)
        .join(models.HistorialAcceso.propietario)
        .join(models.HistorialAcceso.zona)
        .filter(models.HistorialAcceso.conjunto_id == conjunto_id)
        .order_by(models.HistorialAcceso.fecha_hora.desc())
        .limit(limit)
        .all()
    )


def get_all_propietarios(db: Session, conjunto_id: UUID) -> list[models.Propietario]:
    return (
        db.query(models.Propietario)
        .filter(models.Propietario.conjunto_id == conjunto_id)
        .order_by(
            models.Propietario.torre,
            models.Propietario.apartamento,
            models.Propietario.nombre,
        )
        .all()
    )


def update_propietario(
    db: Session,
    propietario: models.Propietario,
    payload: schemas.PropietarioUpdate,
    new_foto_url: Optional[str] = None,
) -> models.Propietario:
    if payload.nombre is not None:
        propietario.nombre = payload.nombre
    if payload.numero_contacto is not None:
        propietario.numero_contacto = payload.numero_contacto
    if payload.torre is not None:
        propietario.torre = payload.torre
    if payload.apartamento is not None:
        propietario.apartamento = payload.apartamento
    if payload.estado_cuenta is not None:
        propietario.estado_cuenta = payload.estado_cuenta
    if payload.amenidades_suspendidas is not None:
        propietario.amenidades_suspendidas = payload.amenidades_suspendidas
    if payload.nfc_tag_id is not None:
        propietario.nfc_tag_id = payload.nfc_tag_id or None
    if new_foto_url is not None:
        propietario.foto_url = new_foto_url
    db.commit()
    db.refresh(propietario)
    return propietario


def bulk_update_estado_propietarios(
    db: Session,
    conjunto_id: UUID,
    registros: list[schemas.PropietarioEstadoBulkItem],
) -> schemas.BulkStatusResponse:
    actualizados = 0
    errores: list[schemas.BulkStatusError] = []

    for idx, item in enumerate(registros, start=1):
        params = {
            "conjunto_id": str(conjunto_id),
            "torre": item.torre,
            "apartamento": item.apartamento,
            "estado_cuenta": item.nuevo_estado,
            "amenidades_suspendidas": item.amenidades_suspendidas,
        }
        result = db.execute(
            text(
                """
                UPDATE propietarios
                SET estado_cuenta = CAST(:estado_cuenta AS estado_cuenta_propietario),
                    amenidades_suspendidas = COALESCE(:amenidades_suspendidas, amenidades_suspendidas)
                WHERE conjunto_id = CAST(:conjunto_id AS uuid)
                  AND torre = :torre
                  AND apartamento = :apartamento
                """
            ),
            params,
        )
        if result.rowcount == 0:
            errores.append(
                schemas.BulkStatusError(
                    fila=idx,
                    torre=item.torre,
                    apartamento=item.apartamento,
                    error="No existe propietario para torre/apartamento en este conjunto",
                )
            )
        else:
            actualizados += result.rowcount or 0

    db.commit()
    return schemas.BulkStatusResponse(actualizados=actualizados, errores=errores)


def delete_propietario(db: Session, propietario: models.Propietario) -> None:
    db.delete(propietario)
    db.commit()


def toggle_acceso_propietario(
    db: Session, propietario: models.Propietario
) -> models.Propietario:
    propietario.acceso_habilitado = not propietario.acceso_habilitado
    db.commit()
    db.refresh(propietario)
    return propietario


def update_amenidades_propietario(
    db: Session, propietario: models.Propietario, amenidades_suspendidas: bool
) -> models.Propietario:
    propietario.amenidades_suspendidas = amenidades_suspendidas
    db.commit()
    db.refresh(propietario)
    return propietario


# ── Fingerprint / Huella ──────────────────────────────────────────────────────

def save_huella(
    db: Session, propietario: models.Propietario, template_b64: str
) -> models.Propietario:
    existing = (
        db.query(models.HuellaDigital)
        .filter(models.HuellaDigital.propietario_id == propietario.id)
        .first()
    )
    if existing:
        existing.template_b64 = template_b64
    else:
        huella = models.HuellaDigital(
            conjunto_id=propietario.conjunto_id,
            propietario_id=propietario.id,
            propietario_uid=propietario.uid,
            template_b64=template_b64,
        )
        db.add(huella)
    propietario.huella_registrada = True
    db.commit()
    db.refresh(propietario)
    return propietario


def delete_huella(
    db: Session, propietario: models.Propietario
) -> models.Propietario:
    db.query(models.HuellaDigital).filter(
        models.HuellaDigital.propietario_id == propietario.id
    ).delete()
    propietario.huella_registrada = False
    db.commit()
    db.refresh(propietario)
    return propietario


def get_all_huellas(db: Session, conjunto_id: UUID) -> list[models.HuellaDigital]:
    return (
        db.query(models.HuellaDigital)
        .filter(models.HuellaDigital.conjunto_id == conjunto_id)
        .all()
    )


# ── Telegram link ─────────────────────────────────────────────────────────────

_TELEGRAM_TOKEN_EXPIRY_HOURS = 48


def generate_telegram_link_token(
    db: Session,
    uid: str,
    conjunto_id: UUID,
) -> Optional[models.Propietario]:
    """Generate (or regenerate) a one-time linking token for the propietario.

    Any previously issued token is replaced, making the old link invalid.
    Returns the updated propietario, or None if not found.
    """
    propietario = get_propietario_by_uid(db, uid.upper(), conjunto_id=conjunto_id)
    if not propietario:
        return None
    propietario.telegram_link_token = secrets.token_urlsafe(32)
    propietario.telegram_link_token_created_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(propietario)
    return propietario


def link_telegram_by_token(
    db: Session,
    token: str,
    chat_id: str,
) -> tuple[Optional[models.Propietario], Optional[str]]:
    """Attempt to link a Telegram chat_id to a propietario via a one-time token.

    Returns ``(propietario, None)`` on success, ``(None, error_message)`` on failure.
    The token is invalidated on success.
    """
    from datetime import timedelta

    propietario = (
        db.query(models.Propietario)
        .filter(models.Propietario.telegram_link_token == token)
        .first()
    )

    if not propietario:
        return None, "El enlace ya fue utilizado o no es válido. Solicita uno nuevo al administrador."

    # Check expiry
    if propietario.telegram_link_token_created_at:
        expires_at = propietario.telegram_link_token_created_at + timedelta(
            hours=_TELEGRAM_TOKEN_EXPIRY_HOURS
        )
        if datetime.now(timezone.utc) > expires_at:
            return None, (
                "⏰ El enlace ha expirado. Solicita un nuevo enlace al administrador."
            )

    # Guard against duplicate chat_id across propietarios in the same conjunction
    duplicate = (
        db.query(models.Propietario)
        .filter(
            models.Propietario.telegram_chat_id == chat_id,
            models.Propietario.id != propietario.id,
            models.Propietario.conjunto_id == propietario.conjunto_id,
        )
        .first()
    )
    if duplicate:
        return None, (
            "⚠️ Esta cuenta de Telegram ya está vinculada a otro residente del conjunto. "
            "Contacta al administrador si crees que es un error."
        )

    propietario.telegram_chat_id = chat_id
    propietario.telegram_linked_at = datetime.now(timezone.utc)
    # Invalidate token so it cannot be reused
    propietario.telegram_link_token = None
    propietario.telegram_link_token_created_at = None
    db.commit()
    db.refresh(propietario)
    return propietario, None


# ── Telegram conversations ───────────────────────────────────────────────────

def get_propietario_by_telegram_chat_id(
    db: Session, chat_id: str
) -> Optional[models.Propietario]:
    return (
        db.query(models.Propietario)
        .filter(models.Propietario.telegram_chat_id == chat_id)
        .first()
    )


def get_or_create_telegram_conversation(
    db: Session,
    propietario: models.Propietario,
    destino_role: str,
) -> models.TelegramConversation:
    conversation = (
        db.query(models.TelegramConversation)
        .filter(
            models.TelegramConversation.propietario_id == propietario.id,
            models.TelegramConversation.destino_role == destino_role,
        )
        .first()
    )
    if conversation:
        if conversation.estado != "abierta":
            conversation.estado = "abierta"
            db.commit()
            db.refresh(conversation)
        return conversation

    conversation = models.TelegramConversation(
        conjunto_id=propietario.conjunto_id,
        propietario_id=propietario.id,
        destino_role=destino_role,
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def add_telegram_message(
    db: Session,
    conversation: models.TelegramConversation,
    sender_role: str,
    text_value: str,
    sender_username: str | None = None,
    read_by_staff: bool = False,
) -> models.TelegramMessage:
    now = datetime.now(timezone.utc)
    message = models.TelegramMessage(
        conversation_id=conversation.id,
        conjunto_id=conversation.conjunto_id,
        propietario_id=conversation.propietario_id,
        sender_role=sender_role,
        sender_username=sender_username,
        text=text_value,
        read_by_staff=read_by_staff,
        created_at=now,
    )
    conversation.last_message_at = now
    conversation.estado = "abierta"
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def get_telegram_conversation(
    db: Session,
    conversation_id: int,
    conjunto_id: UUID,
    destino_role: str,
) -> Optional[models.TelegramConversation]:
    return (
        db.query(models.TelegramConversation)
        .options(joinedload(models.TelegramConversation.propietario))
        .filter(
            models.TelegramConversation.id == conversation_id,
            models.TelegramConversation.conjunto_id == conjunto_id,
            models.TelegramConversation.destino_role == destino_role,
        )
        .first()
    )


def _telegram_conversation_out(
    db: Session,
    conversation: models.TelegramConversation,
) -> schemas.TelegramConversationOut:
    last_message = (
        db.query(models.TelegramMessage)
        .filter(models.TelegramMessage.conversation_id == conversation.id)
        .order_by(models.TelegramMessage.created_at.desc())
        .first()
    )
    unread_count = (
        db.query(func.count(models.TelegramMessage.id))
        .filter(
            models.TelegramMessage.conversation_id == conversation.id,
            models.TelegramMessage.sender_role == "propietario",
            models.TelegramMessage.read_by_staff.is_(False),
        )
        .scalar()
        or 0
    )
    propietario = conversation.propietario
    return schemas.TelegramConversationOut(
        id=conversation.id,
        destino_role=conversation.destino_role,
        estado=conversation.estado,
        propietario_id=conversation.propietario_id,
        propietario_uid=propietario.uid,
        propietario_nombre=propietario.nombre,
        torre=propietario.torre,
        apartamento=propietario.apartamento,
        last_message_at=conversation.last_message_at,
        last_message_text=last_message.text if last_message else None,
        unread_count=unread_count,
    )


def list_telegram_conversations(
    db: Session,
    conjunto_id: UUID,
    destino_role: str,
) -> list[schemas.TelegramConversationOut]:
    conversations = (
        db.query(models.TelegramConversation)
        .options(joinedload(models.TelegramConversation.propietario))
        .filter(
            models.TelegramConversation.conjunto_id == conjunto_id,
            models.TelegramConversation.destino_role == destino_role,
        )
        .order_by(models.TelegramConversation.last_message_at.desc())
        .all()
    )
    return [_telegram_conversation_out(db, conversation) for conversation in conversations]


def get_telegram_conversation_detail(
    db: Session,
    conversation: models.TelegramConversation,
) -> schemas.TelegramConversationDetailOut:
    messages = (
        db.query(models.TelegramMessage)
        .filter(models.TelegramMessage.conversation_id == conversation.id)
        .order_by(models.TelegramMessage.created_at.asc())
        .all()
    )
    db.query(models.TelegramMessage).filter(
        models.TelegramMessage.conversation_id == conversation.id,
        models.TelegramMessage.sender_role == "propietario",
        models.TelegramMessage.read_by_staff.is_(False),
    ).update({"read_by_staff": True}, synchronize_session=False)
    db.commit()
    for message in messages:
        if message.sender_role == "propietario":
            message.read_by_staff = True

    return schemas.TelegramConversationDetailOut(
        conversation=_telegram_conversation_out(db, conversation),
        messages=messages,
    )

