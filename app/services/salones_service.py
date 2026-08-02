"""Servicio de administración y reservas de salones sociales."""

from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID

from app import models, schemas
from sqlalchemy import and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

DEFAULT_PRECIO_SIN_ASEO_CENTAVOS = 13000000
DEFAULT_PRECIO_CON_ASEO_CENTAVOS = 16000000
RESERVA_START = time(hour=9, minute=0)
RESERVA_END = time(hour=8, minute=59)
PENDING_EXPIRY_HOURS = 24
ACTIVE_STATES = {
    "pendiente_pago",
    "pendiente_aprobacion",
    "confirmado",
    "no_disponible",
    "mantenimiento",
    "evento_privado",
}
BLOCK_STATES = {"no_disponible", "mantenimiento", "evento_privado"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def slot_start(fecha: date) -> datetime:
    return datetime.combine(fecha, RESERVA_START, tzinfo=timezone.utc)


def slot_end(fecha: date) -> datetime:
    return datetime.combine(fecha + timedelta(days=1), RESERVA_END, tzinfo=timezone.utc)


def _slot_key(fecha: date) -> str:
    return fecha.isoformat()


def _estado_visual(reserva: models.SalonSocialReserva | None, salon: models.SalonSocial | None = None) -> str:
    if salon and salon.estado != "activo":
        return "no_disponible"
    if not reserva:
        return "disponible"
    if reserva.estado == "pendiente_pago":
        return "reservado_pendiente"
    if reserva.estado == "pendiente_aprobacion":
        return "reservado_pendiente"
    if reserva.estado == "confirmado":
        return "reservado_confirmado"
    return reserva.estado


def _reserva_out(reserva: models.SalonSocialReserva) -> schemas.SalonSocialReservaOut:
    propietario = reserva.propietario
    return schemas.SalonSocialReservaOut(
        id=reserva.id,
        salon_id=reserva.salon_id,
        salon_nombre=reserva.salon.nombre,
        salon_color=reserva.salon.color_calendario,
        propietario_id=reserva.propietario_id,
        propietario_nombre=propietario.nombre if propietario else None,
        propietario_uid=propietario.uid if propietario else None,
        torre=propietario.torre if propietario else None,
        apartamento=propietario.apartamento if propietario else None,
        fecha=reserva.fecha,
        inicio=slot_start(reserva.fecha),
        fin=slot_end(reserva.fecha),
        tipo=reserva.tipo,
        estado=reserva.estado,
        estado_visual=_estado_visual(reserva),
        incluye_aseo=reserva.incluye_aseo,
        precio_centavos=reserva.precio_centavos,
        pago_estado=reserva.pago_estado,
        comprobante_url=reserva.comprobante_url,
        referencia_pago=reserva.referencia_pago,
        notas=reserva.notas,
        cancel_reason=reserva.cancel_reason,
        created_by=reserva.created_by,
        approved_by=reserva.approved_by,
        approved_at=reserva.approved_at,
        created_at=reserva.created_at,
    )


def cancel_expired_reservas(db: Session, conjunto_id: UUID) -> int:
    cutoff = _now() - timedelta(hours=PENDING_EXPIRY_HOURS)
    expired = (
        db.query(models.SalonSocialReserva)
        .filter(
            models.SalonSocialReserva.conjunto_id == conjunto_id,
            models.SalonSocialReserva.tipo == "reserva",
            models.SalonSocialReserva.estado == "pendiente_pago",
            models.SalonSocialReserva.created_at <= cutoff,
            models.SalonSocialReserva.active_slot_key.isnot(None),
        )
        .all()
    )
    past_pending = (
        db.query(models.SalonSocialReserva)
        .filter(
            models.SalonSocialReserva.conjunto_id == conjunto_id,
            models.SalonSocialReserva.tipo == "reserva",
            models.SalonSocialReserva.estado.in_(["pendiente_pago", "pendiente_aprobacion"]),
            models.SalonSocialReserva.fecha < _now().date(),
            models.SalonSocialReserva.active_slot_key.isnot(None),
        )
        .all()
    )
    changed = 0
    for reserva in {item.id: item for item in [*expired, *past_pending]}.values():
        reserva.estado = "cancelado"
        reserva.active_slot_key = None
        reserva.cancel_reason = "Cancelada automáticamente por vencimiento"
        reserva.updated_at = _now()
        changed += 1
    if changed:
        db.commit()
    return changed


def list_salones(db: Session, conjunto_id: UUID, only_active: bool = False) -> list[models.SalonSocial]:
    query = db.query(models.SalonSocial).filter(models.SalonSocial.conjunto_id == conjunto_id)
    if only_active:
        query = query.filter(models.SalonSocial.estado == "activo")
    return query.order_by(models.SalonSocial.nombre).all()


def get_salon(db: Session, conjunto_id: UUID, salon_id: int) -> models.SalonSocial | None:
    return (
        db.query(models.SalonSocial)
        .filter(
            models.SalonSocial.conjunto_id == conjunto_id,
            models.SalonSocial.id == salon_id,
        )
        .first()
    )


def create_salon(
    db: Session,
    conjunto_id: UUID,
    nombre: str,
    descripcion: str | None,
    capacidad: int,
    imagen_url: str | None,
    estado: str,
    color_calendario: str,
    precio_sin_aseo_centavos: int,
    precio_con_aseo_centavos: int,
) -> models.SalonSocial:
    salon = models.SalonSocial(
        conjunto_id=conjunto_id,
        nombre=nombre,
        descripcion=descripcion,
        capacidad=capacidad,
        imagen_url=imagen_url,
        estado=estado,
        color_calendario=color_calendario,
        precio_sin_aseo_centavos=precio_sin_aseo_centavos,
        precio_con_aseo_centavos=precio_con_aseo_centavos,
        created_at=_now(),
        updated_at=_now(),
    )
    db.add(salon)
    db.commit()
    db.refresh(salon)
    return salon


def update_salon(
    db: Session,
    salon: models.SalonSocial,
    payload: schemas.SalonSocialUpdate,
    imagen_url: str | None = None,
) -> models.SalonSocial:
    values = payload.model_dump(exclude_unset=True)
    for key, value in values.items():
        setattr(salon, key, value)
    if imagen_url is not None:
        salon.imagen_url = imagen_url
    salon.updated_at = _now()
    db.commit()
    db.refresh(salon)
    return salon


def _active_reservas_by_range(
    db: Session,
    conjunto_id: UUID,
    fecha_inicio: date,
    fecha_fin: date,
) -> list[models.SalonSocialReserva]:
    return (
        db.query(models.SalonSocialReserva)
        .options(
            joinedload(models.SalonSocialReserva.salon),
            joinedload(models.SalonSocialReserva.propietario),
        )
        .filter(
            models.SalonSocialReserva.conjunto_id == conjunto_id,
            models.SalonSocialReserva.fecha >= fecha_inicio,
            models.SalonSocialReserva.fecha <= fecha_fin,
            models.SalonSocialReserva.active_slot_key.isnot(None),
        )
        .order_by(models.SalonSocialReserva.fecha, models.SalonSocialReserva.id)
        .all()
    )


def calendario(
    db: Session,
    conjunto_id: UUID,
    fecha_inicio: date,
    fecha_fin: date,
    only_active_salones: bool = False,
) -> list[schemas.SalonSocialCalendarDayOut]:
    cancel_expired_reservas(db, conjunto_id)
    salones = list_salones(db, conjunto_id, only_active=only_active_salones)
    reservas = _active_reservas_by_range(db, conjunto_id, fecha_inicio, fecha_fin)
    by_slot = {(reserva.salon_id, reserva.fecha): reserva for reserva in reservas}
    days = (fecha_fin - fecha_inicio).days
    result: list[schemas.SalonSocialCalendarDayOut] = []
    for offset in range(days + 1):
        fecha = fecha_inicio + timedelta(days=offset)
        for salon in salones:
            reserva = by_slot.get((salon.id, fecha))
            estado_visual = _estado_visual(reserva, salon=salon)
            result.append(
                schemas.SalonSocialCalendarDayOut(
                    salon_id=salon.id,
                    salon_nombre=salon.nombre,
                    salon_color=salon.color_calendario,
                    fecha=fecha,
                    inicio=slot_start(fecha),
                    fin=slot_end(fecha),
                    disponible=estado_visual == "disponible",
                    estado_visual=estado_visual,
                    reserva=_reserva_out(reserva) if reserva else None,
                )
            )
    return result


def list_reservas(
    db: Session,
    conjunto_id: UUID,
    propietario_id: int | None = None,
    include_cancelled: bool = True,
) -> list[schemas.SalonSocialReservaOut]:
    cancel_expired_reservas(db, conjunto_id)
    query = (
        db.query(models.SalonSocialReserva)
        .options(
            joinedload(models.SalonSocialReserva.salon),
            joinedload(models.SalonSocialReserva.propietario),
        )
        .filter(models.SalonSocialReserva.conjunto_id == conjunto_id)
    )
    if propietario_id is not None:
        query = query.filter(models.SalonSocialReserva.propietario_id == propietario_id)
    if not include_cancelled:
        query = query.filter(models.SalonSocialReserva.active_slot_key.isnot(None))
    reservas = query.order_by(models.SalonSocialReserva.fecha.desc(), models.SalonSocialReserva.id.desc()).all()
    return [_reserva_out(reserva) for reserva in reservas]


def get_reserva(
    db: Session,
    conjunto_id: UUID,
    reserva_id: int,
) -> models.SalonSocialReserva | None:
    return (
        db.query(models.SalonSocialReserva)
        .options(
            joinedload(models.SalonSocialReserva.salon),
            joinedload(models.SalonSocialReserva.propietario),
        )
        .filter(
            models.SalonSocialReserva.conjunto_id == conjunto_id,
            models.SalonSocialReserva.id == reserva_id,
        )
        .first()
    )


def _assert_slot_available(db: Session, salon: models.SalonSocial, fecha: date) -> None:
    if salon.estado != "activo":
        raise ValueError("El salón no está activo")
    exists = (
        db.query(models.SalonSocialReserva.id)
        .filter(
            models.SalonSocialReserva.salon_id == salon.id,
            models.SalonSocialReserva.active_slot_key == _slot_key(fecha),
        )
        .first()
    )
    if exists:
        raise ValueError("El salón no está disponible para esa fecha")


def create_reserva_propietario(
    db: Session,
    conjunto_id: UUID,
    propietario: models.Propietario,
    payload: schemas.SalonSocialReservaCreate,
) -> models.SalonSocialReserva:
    cancel_expired_reservas(db, conjunto_id)
    salon = get_salon(db, conjunto_id, payload.salon_id)
    if not salon:
        raise LookupError("Salón no encontrado")
    if payload.fecha < _now().date():
        raise ValueError("No se puede reservar una fecha pasada")
    _assert_slot_available(db, salon, payload.fecha)
    reserva = models.SalonSocialReserva(
        conjunto_id=conjunto_id,
        salon_id=salon.id,
        propietario_id=propietario.id,
        fecha=payload.fecha,
        active_slot_key=_slot_key(payload.fecha),
        tipo="reserva",
        estado="pendiente_pago",
        incluye_aseo=payload.incluye_aseo,
        precio_centavos=salon.precio_con_aseo_centavos if payload.incluye_aseo else salon.precio_sin_aseo_centavos,
        pago_estado="pendiente",
        notas=payload.notas,
        created_by="propietario",
        created_at=_now(),
        updated_at=_now(),
    )
    db.add(reserva)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError("El salón no está disponible para esa fecha") from exc
    db.refresh(reserva)
    return get_reserva(db, conjunto_id, reserva.id) or reserva


def set_bloqueo_admin(
    db: Session,
    conjunto_id: UUID,
    payload: schemas.SalonSocialBloqueoIn,
    username: str,
) -> models.SalonSocialReserva | None:
    cancel_expired_reservas(db, conjunto_id)
    salon = get_salon(db, conjunto_id, payload.salon_id)
    if not salon:
        raise LookupError("Salón no encontrado")
    active = (
        db.query(models.SalonSocialReserva)
        .filter(
            models.SalonSocialReserva.salon_id == salon.id,
            models.SalonSocialReserva.active_slot_key == _slot_key(payload.fecha),
        )
        .first()
    )
    if payload.estado == "disponible":
        if active and active.tipo == "bloqueo":
            active.estado = "cancelado"
            active.active_slot_key = None
            active.cancel_reason = "Liberado por administración"
            active.updated_at = _now()
            db.commit()
        elif active and active.tipo == "reserva":
            raise ValueError("La fecha tiene una reserva vigente; cancélela desde reservas")
        return None

    if active and active.tipo == "reserva":
        raise ValueError("La fecha tiene una reserva vigente")
    if active and active.tipo == "bloqueo":
        active.estado = payload.estado
        active.notas = payload.notas
        active.updated_at = _now()
        active.created_by = username
        db.commit()
        db.refresh(active)
        return active

    bloqueo = models.SalonSocialReserva(
        conjunto_id=conjunto_id,
        salon_id=salon.id,
        fecha=payload.fecha,
        active_slot_key=_slot_key(payload.fecha),
        tipo="bloqueo",
        estado=payload.estado,
        incluye_aseo=False,
        precio_centavos=0,
        pago_estado="pendiente",
        notas=payload.notas,
        created_by=username,
        created_at=_now(),
        updated_at=_now(),
    )
    db.add(bloqueo)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError("La fecha ya no está disponible") from exc
    db.refresh(bloqueo)
    return get_reserva(db, conjunto_id, bloqueo.id) or bloqueo


def reportar_pago(
    db: Session,
    reserva: models.SalonSocialReserva,
    comprobante_url: str | None,
    referencia_pago: str | None,
    notas: str | None,
) -> models.SalonSocialReserva:
    if reserva.estado == "cancelado" or reserva.active_slot_key is None:
        raise ValueError("La reserva no está vigente")
    reserva.comprobante_url = comprobante_url or reserva.comprobante_url
    reserva.referencia_pago = referencia_pago
    reserva.notas = notas or reserva.notas
    reserva.pago_estado = "reportado"
    reserva.estado = "pendiente_aprobacion"
    reserva.updated_at = _now()
    db.commit()
    db.refresh(reserva)
    return get_reserva(db, reserva.conjunto_id, reserva.id) or reserva


def update_estado_reserva_admin(
    db: Session,
    reserva: models.SalonSocialReserva,
    payload: schemas.SalonSocialReservaEstadoIn,
    username: str,
) -> models.SalonSocialReserva:
    if reserva.tipo != "reserva":
        raise ValueError("Solo las reservas pueden aprobarse o cancelarse")
    if payload.estado == "confirmado":
        reserva.estado = "confirmado"
        reserva.pago_estado = "validado"
        reserva.approved_by = username
        reserva.approved_at = _now()
    elif payload.estado == "cancelado":
        reserva.estado = "cancelado"
        reserva.active_slot_key = None
        reserva.cancel_reason = payload.motivo or "Cancelada por administración"
        if reserva.pago_estado == "reportado":
            reserva.pago_estado = "rechazado"
    else:
        reserva.estado = payload.estado
        if payload.estado == "pendiente_pago":
            reserva.pago_estado = "pendiente"
    reserva.updated_at = _now()
    db.commit()
    db.refresh(reserva)
    return get_reserva(db, reserva.conjunto_id, reserva.id) or reserva


def cancel_reserva_propietario(
    db: Session,
    reserva: models.SalonSocialReserva,
    motivo: str | None = None,
) -> models.SalonSocialReserva:
    if reserva.estado == "confirmado":
        raise ValueError("Una reserva confirmada debe cancelarla administración")
    reserva.estado = "cancelado"
    reserva.active_slot_key = None
    reserva.cancel_reason = motivo or "Cancelada por propietario"
    reserva.updated_at = _now()
    db.commit()
    db.refresh(reserva)
    return get_reserva(db, reserva.conjunto_id, reserva.id) or reserva
