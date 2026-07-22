"""Servicio de administración financiera por conjunto."""

from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, timezone
from uuid import UUID

from app import models, schemas
from sqlalchemy import case, func
from sqlalchemy.orm import Session, joinedload

DEFAULT_CONCEPTOS = [
    ("Administración", "cargo"),
    ("Parqueadero", "cargo"),
    ("Multa", "cargo"),
    ("Cuota extraordinaria", "cargo"),
    ("Pago administración", "abono"),
    ("Abono parcial", "abono"),
    ("Recibo de caja", "ingreso"),
    ("Otros ingresos", "ingreso"),
    ("Nómina", "egreso"),
    ("Mantenimiento", "egreso"),
    ("Servicios públicos", "egreso"),
    ("Otros egresos", "egreso"),
]


def _today() -> date:
    return date.today()


def _periodo_from_date(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def _proximo_vencimiento(dia_vencimiento: int, ref: date | None = None) -> date:
    ref = ref or _today()
    day = min(dia_vencimiento, monthrange(ref.year, ref.month)[1])
    candidate = date(ref.year, ref.month, day)
    if candidate < ref:
        if ref.month == 12:
            year, month = ref.year + 1, 1
        else:
            year, month = ref.year, ref.month + 1
        day = min(dia_vencimiento, monthrange(year, month)[1])
        candidate = date(year, month, day)
    return candidate


def get_or_create_config(db: Session, conjunto_id: UUID) -> models.ConfigFinanciera:
    config = (
        db.query(models.ConfigFinanciera)
        .filter(models.ConfigFinanciera.conjunto_id == conjunto_id)
        .first()
    )
    if config:
        return config
    config = models.ConfigFinanciera(
        conjunto_id=conjunto_id,
        cuota_mensual_centavos=0,
        dia_vencimiento=5,
        activo=True,
        created_at=datetime.now(timezone.utc),
    )
    db.add(config)
    db.flush()
    ensure_default_conceptos(db, conjunto_id)
    db.commit()
    db.refresh(config)
    return config


def update_config(
    db: Session, conjunto_id: UUID, payload: schemas.ConfigFinancieraUpdate
) -> models.ConfigFinanciera:
    config = get_or_create_config(db, conjunto_id)
    config.cuota_mensual_centavos = payload.cuota_mensual_centavos
    config.dia_vencimiento = payload.dia_vencimiento
    config.activo = payload.activo
    db.commit()
    db.refresh(config)
    return config


def ensure_default_conceptos(db: Session, conjunto_id: UUID) -> None:
    existing = (
        db.query(models.ConceptoMovimiento)
        .filter(models.ConceptoMovimiento.conjunto_id == conjunto_id)
        .count()
    )
    if existing:
        return
    now = datetime.now(timezone.utc)
    for nombre, tipo in DEFAULT_CONCEPTOS:
        db.add(
            models.ConceptoMovimiento(
                conjunto_id=conjunto_id,
                nombre=nombre,
                tipo=tipo,
                activo=True,
                created_at=now,
            )
        )
    db.flush()


def list_conceptos(
    db: Session, conjunto_id: UUID, tipo: str | None = None, solo_activos: bool = True
) -> list[models.ConceptoMovimiento]:
    ensure_default_conceptos(db, conjunto_id)
    db.commit()
    q = db.query(models.ConceptoMovimiento).filter(
        models.ConceptoMovimiento.conjunto_id == conjunto_id
    )
    if tipo:
        q = q.filter(models.ConceptoMovimiento.tipo == tipo)
    if solo_activos:
        q = q.filter(models.ConceptoMovimiento.activo.is_(True))
    return q.order_by(models.ConceptoMovimiento.tipo, models.ConceptoMovimiento.nombre).all()


def create_concepto(
    db: Session, conjunto_id: UUID, payload: schemas.ConceptoMovimientoCreate
) -> models.ConceptoMovimiento:
    item = models.ConceptoMovimiento(
        conjunto_id=conjunto_id,
        nombre=payload.nombre,
        tipo=payload.tipo,
        activo=True,
        created_at=datetime.now(timezone.utc),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_concepto(
    db: Session,
    conjunto_id: UUID,
    concepto_id: int,
    payload: schemas.ConceptoMovimientoUpdate,
) -> models.ConceptoMovimiento | None:
    item = (
        db.query(models.ConceptoMovimiento)
        .filter(
            models.ConceptoMovimiento.id == concepto_id,
            models.ConceptoMovimiento.conjunto_id == conjunto_id,
        )
        .first()
    )
    if not item:
        return None
    if payload.nombre is not None:
        item.nombre = payload.nombre
    if payload.activo is not None:
        item.activo = payload.activo
    db.commit()
    db.refresh(item)
    return item


def saldo_propietario(db: Session, propietario_id: int) -> int:
    row = (
        db.query(
            func.coalesce(
                func.sum(
                    case(
                        (models.MovimientoCartera.tipo == "cargo", models.MovimientoCartera.monto_centavos),
                        else_=-models.MovimientoCartera.monto_centavos,
                    )
                ),
                0,
            )
        )
        .filter(models.MovimientoCartera.propietario_id == propietario_id)
        .scalar()
    )
    return int(row or 0)


def sync_estado_cuenta(db: Session, propietario: models.Propietario) -> str:
    saldo = saldo_propietario(db, propietario.id)
    nuevo = "en_mora" if saldo > 0 else "al_dia"
    if propietario.estado_cuenta != nuevo:
        propietario.estado_cuenta = nuevo
        if nuevo == "en_mora":
            propietario.amenidades_suspendidas = True
        db.flush()
    return nuevo


def generar_cuotas(
    db: Session, conjunto_id: UUID, periodo: str, created_by: str | None
) -> schemas.GenerarCuotasOut:
    config = get_or_create_config(db, conjunto_id)
    if config.cuota_mensual_centavos <= 0:
        return schemas.GenerarCuotasOut(periodo=periodo, creados=0, omitidos=0)

    ensure_default_conceptos(db, conjunto_id)
    concepto = (
        db.query(models.ConceptoMovimiento)
        .filter(
            models.ConceptoMovimiento.conjunto_id == conjunto_id,
            models.ConceptoMovimiento.tipo == "cargo",
            models.ConceptoMovimiento.nombre == "Administración",
        )
        .first()
    )

    year, month = int(periodo[:4]), int(periodo[5:7])
    dia = min(config.dia_vencimiento, monthrange(year, month)[1])
    fecha_cargo = date(year, month, dia)

    propietarios = (
        db.query(models.Propietario)
        .filter(models.Propietario.conjunto_id == conjunto_id)
        .all()
    )

    creados = 0
    omitidos = 0
    for p in propietarios:
        exists = (
            db.query(models.MovimientoCartera)
            .filter(
                models.MovimientoCartera.propietario_id == p.id,
                models.MovimientoCartera.tipo == "cargo",
                models.MovimientoCartera.periodo == periodo,
                models.MovimientoCartera.concepto_id == (concepto.id if concepto else None),
            )
            .first()
        )
        if exists:
            omitidos += 1
            continue
        # Also skip if any admin cargo for period exists without concept match
        if not concepto:
            exists_periodo = (
                db.query(models.MovimientoCartera)
                .filter(
                    models.MovimientoCartera.propietario_id == p.id,
                    models.MovimientoCartera.tipo == "cargo",
                    models.MovimientoCartera.periodo == periodo,
                )
                .first()
            )
            if exists_periodo:
                omitidos += 1
                continue

        db.add(
            models.MovimientoCartera(
                conjunto_id=conjunto_id,
                propietario_id=p.id,
                concepto_id=concepto.id if concepto else None,
                tipo="cargo",
                monto_centavos=config.cuota_mensual_centavos,
                fecha=fecha_cargo,
                periodo=periodo,
                referencia=f"Cuota {periodo}",
                notas="Generación automática de cuota mensual",
                created_by=created_by,
                created_at=datetime.now(timezone.utc),
            )
        )
        creados += 1

    db.flush()
    for p in propietarios:
        sync_estado_cuenta(db, p)
    db.commit()
    return schemas.GenerarCuotasOut(periodo=periodo, creados=creados, omitidos=omitidos)


def list_cartera(
    db: Session,
    conjunto_id: UUID,
    torre: str | None = None,
    estado: str | None = None,
    saldo_min: int | None = None,
    saldo_max: int | None = None,
) -> list[schemas.CarteraItemOut]:
    config = get_or_create_config(db, conjunto_id)
    venc = _proximo_vencimiento(config.dia_vencimiento)

    saldo_expr = func.coalesce(
        func.sum(
            case(
                (models.MovimientoCartera.tipo == "cargo", models.MovimientoCartera.monto_centavos),
                else_=-models.MovimientoCartera.monto_centavos,
            )
        ),
        0,
    ).label("saldo_centavos")

    ultimo_pago_expr = func.max(
        case(
            (models.MovimientoCartera.tipo == "abono", models.MovimientoCartera.fecha),
            else_=None,
        )
    ).label("ultimo_pago")

    q = (
        db.query(
            models.Propietario,
            saldo_expr,
            ultimo_pago_expr,
        )
        .outerjoin(
            models.MovimientoCartera,
            models.MovimientoCartera.propietario_id == models.Propietario.id,
        )
        .filter(models.Propietario.conjunto_id == conjunto_id)
        .group_by(models.Propietario.id)
    )
    if torre:
        q = q.filter(models.Propietario.torre == torre)

    rows = q.all()
    items: list[schemas.CarteraItemOut] = []
    for p, saldo, ultimo_pago in rows:
        saldo_i = int(saldo or 0)
        estado_calc = "en_mora" if saldo_i > 0 else "al_dia"
        if estado and estado != "todos" and estado_calc != estado:
            continue
        if saldo_min is not None and saldo_i < saldo_min:
            continue
        if saldo_max is not None and saldo_i > saldo_max:
            continue
        items.append(
            schemas.CarteraItemOut(
                propietario_id=p.id,
                uid=p.uid,
                nombre=p.nombre,
                torre=p.torre,
                apartamento=p.apartamento,
                estado_cuenta=estado_calc,
                saldo_centavos=saldo_i,
                ultimo_pago=ultimo_pago,
                proximo_vencimiento=venc,
                telegram_chat_id=p.telegram_chat_id,
            )
        )

    items.sort(key=lambda x: (x.torre, x.apartamento, x.nombre))
    return items


def estado_cuenta(db: Session, conjunto_id: UUID, uid: str) -> schemas.EstadoCuentaOut | None:
    propietario = (
        db.query(models.Propietario)
        .filter(
            models.Propietario.conjunto_id == conjunto_id,
            models.Propietario.uid == uid.upper(),
        )
        .first()
    )
    if not propietario:
        return None

    movimientos = (
        db.query(models.MovimientoCartera)
        .options(joinedload(models.MovimientoCartera.concepto))
        .filter(models.MovimientoCartera.propietario_id == propietario.id)
        .order_by(models.MovimientoCartera.fecha.asc(), models.MovimientoCartera.id.asc())
        .all()
    )

    running = 0
    out_movs: list[schemas.MovimientoCarteraOut] = []
    for m in movimientos:
        if m.tipo == "cargo":
            running += m.monto_centavos
        else:
            running -= m.monto_centavos
        out_movs.append(
            schemas.MovimientoCarteraOut(
                id=m.id,
                tipo=m.tipo,
                monto_centavos=m.monto_centavos,
                fecha=m.fecha,
                periodo=m.periodo,
                referencia=m.referencia,
                notas=m.notas,
                concepto_id=m.concepto_id,
                concepto_nombre=m.concepto.nombre if m.concepto else None,
                created_by=m.created_by,
                created_at=m.created_at,
                saldo_acumulado_centavos=running,
            )
        )

    return schemas.EstadoCuentaOut(
        propietario_id=propietario.id,
        uid=propietario.uid,
        nombre=propietario.nombre,
        torre=propietario.torre,
        apartamento=propietario.apartamento,
        estado_cuenta="en_mora" if running > 0 else "al_dia",
        saldo_centavos=running,
        movimientos=out_movs,
    )


def crear_movimiento_cartera(
    db: Session,
    conjunto_id: UUID,
    uid: str,
    payload: schemas.MovimientoCarteraCreate,
    created_by: str | None,
) -> schemas.EstadoCuentaOut | None:
    propietario = (
        db.query(models.Propietario)
        .filter(
            models.Propietario.conjunto_id == conjunto_id,
            models.Propietario.uid == uid.upper(),
        )
        .first()
    )
    if not propietario:
        return None

    if payload.concepto_id is not None:
        concepto = (
            db.query(models.ConceptoMovimiento)
            .filter(
                models.ConceptoMovimiento.id == payload.concepto_id,
                models.ConceptoMovimiento.conjunto_id == conjunto_id,
            )
            .first()
        )
        if not concepto:
            raise ValueError("Concepto no encontrado")
        if concepto.tipo != payload.tipo and concepto.tipo not in ("cargo", "abono"):
            raise ValueError("El concepto no corresponde al tipo de movimiento")

    periodo = payload.periodo or _periodo_from_date(payload.fecha)
    mov = models.MovimientoCartera(
        conjunto_id=conjunto_id,
        propietario_id=propietario.id,
        concepto_id=payload.concepto_id,
        tipo=payload.tipo,
        monto_centavos=payload.monto_centavos,
        fecha=payload.fecha,
        periodo=periodo,
        referencia=payload.referencia,
        notas=payload.notas,
        created_by=created_by,
        created_at=datetime.now(timezone.utc),
    )
    db.add(mov)
    db.flush()
    sync_estado_cuenta(db, propietario)
    db.commit()
    return estado_cuenta(db, conjunto_id, uid)


def list_caja(
    db: Session,
    conjunto_id: UUID,
    periodo: str | None = None,
    tipo: str | None = None,
) -> list[schemas.MovimientoCajaOut]:
    q = (
        db.query(models.MovimientoCaja)
        .options(joinedload(models.MovimientoCaja.concepto))
        .filter(models.MovimientoCaja.conjunto_id == conjunto_id)
    )
    if periodo:
        q = q.filter(models.MovimientoCaja.periodo == periodo)
    if tipo:
        q = q.filter(models.MovimientoCaja.tipo == tipo)
    rows = q.order_by(models.MovimientoCaja.fecha.desc(), models.MovimientoCaja.id.desc()).all()
    return [
        schemas.MovimientoCajaOut(
            id=m.id,
            tipo=m.tipo,
            monto_centavos=m.monto_centavos,
            fecha=m.fecha,
            periodo=m.periodo,
            referencia=m.referencia,
            notas=m.notas,
            concepto_id=m.concepto_id,
            concepto_nombre=m.concepto.nombre if m.concepto else None,
            created_by=m.created_by,
            created_at=m.created_at,
        )
        for m in rows
    ]


def crear_movimiento_caja(
    db: Session,
    conjunto_id: UUID,
    payload: schemas.MovimientoCajaCreate,
    created_by: str | None,
) -> schemas.MovimientoCajaOut:
    if payload.concepto_id is not None:
        concepto = (
            db.query(models.ConceptoMovimiento)
            .filter(
                models.ConceptoMovimiento.id == payload.concepto_id,
                models.ConceptoMovimiento.conjunto_id == conjunto_id,
            )
            .first()
        )
        if not concepto:
            raise ValueError("Concepto no encontrado")

    periodo = payload.periodo or _periodo_from_date(payload.fecha)
    mov = models.MovimientoCaja(
        conjunto_id=conjunto_id,
        concepto_id=payload.concepto_id,
        tipo=payload.tipo,
        monto_centavos=payload.monto_centavos,
        fecha=payload.fecha,
        periodo=periodo,
        referencia=payload.referencia,
        notas=payload.notas,
        created_by=created_by,
        created_at=datetime.now(timezone.utc),
    )
    db.add(mov)
    db.commit()
    db.refresh(mov)
    concepto_nombre = None
    if mov.concepto_id:
        c = db.query(models.ConceptoMovimiento).filter_by(id=mov.concepto_id).first()
        concepto_nombre = c.nombre if c else None
    return schemas.MovimientoCajaOut(
        id=mov.id,
        tipo=mov.tipo,
        monto_centavos=mov.monto_centavos,
        fecha=mov.fecha,
        periodo=mov.periodo,
        referencia=mov.referencia,
        notas=mov.notas,
        concepto_id=mov.concepto_id,
        concepto_nombre=concepto_nombre,
        created_by=mov.created_by,
        created_at=mov.created_at,
    )


def refresh_alertas(db: Session, conjunto_id: UUID) -> list[schemas.AlertaFinancieraOut]:
    """Recalcula alertas on-demand: limpia no leídas y regenera."""
    config = get_or_create_config(db, conjunto_id)
    cartera = list_cartera(db, conjunto_id)
    hoy = _today()
    venc = _proximo_vencimiento(config.dia_vencimiento, hoy)

    db.query(models.AlertaFinanciera).filter(
        models.AlertaFinanciera.conjunto_id == conjunto_id,
        models.AlertaFinanciera.leida.is_(False),
    ).delete(synchronize_session=False)

    now = datetime.now(timezone.utc)
    for item in cartera:
        if item.saldo_centavos > 0:
            db.add(
                models.AlertaFinanciera(
                    conjunto_id=conjunto_id,
                    propietario_id=item.propietario_id,
                    tipo="mora",
                    mensaje=(
                        f"{item.nombre} (T{item.torre}-{item.apartamento}) "
                        f"tiene saldo pendiente de ${item.saldo_centavos / 100:,.0f} COP"
                    ),
                    leida=False,
                    created_at=now,
                )
            )
            if venc <= hoy:
                db.add(
                    models.AlertaFinanciera(
                        conjunto_id=conjunto_id,
                        propietario_id=item.propietario_id,
                        tipo="vencimiento",
                        mensaje=(
                            f"Cuota vencida para {item.nombre} "
                            f"(T{item.torre}-{item.apartamento}). Vencimiento: {venc.isoformat()}"
                        ),
                        leida=False,
                        created_at=now,
                    )
                )
            if item.ultimo_pago is None or (hoy - item.ultimo_pago).days >= 45:
                db.add(
                    models.AlertaFinanciera(
                        conjunto_id=conjunto_id,
                        propietario_id=item.propietario_id,
                        tipo="sin_pago",
                        mensaje=(
                            f"Sin pagos recientes: {item.nombre} "
                            f"(T{item.torre}-{item.apartamento})"
                        ),
                        leida=False,
                        created_at=now,
                    )
                )
    db.commit()
    return list_alertas(db, conjunto_id)


def list_alertas(
    db: Session, conjunto_id: UUID, solo_no_leidas: bool = False
) -> list[schemas.AlertaFinancieraOut]:
    q = (
        db.query(models.AlertaFinanciera)
        .options(joinedload(models.AlertaFinanciera.propietario))
        .filter(models.AlertaFinanciera.conjunto_id == conjunto_id)
    )
    if solo_no_leidas:
        q = q.filter(models.AlertaFinanciera.leida.is_(False))
    rows = q.order_by(models.AlertaFinanciera.created_at.desc()).limit(200).all()
    return [
        schemas.AlertaFinancieraOut(
            id=a.id,
            tipo=a.tipo,
            mensaje=a.mensaje,
            leida=a.leida,
            propietario_id=a.propietario_id,
            propietario_nombre=a.propietario.nombre if a.propietario else None,
            propietario_uid=a.propietario.uid if a.propietario else None,
            created_at=a.created_at,
        )
        for a in rows
    ]


def marcar_alerta_leida(
    db: Session, conjunto_id: UUID, alerta_id: int
) -> schemas.AlertaFinancieraOut | None:
    alerta = (
        db.query(models.AlertaFinanciera)
        .options(joinedload(models.AlertaFinanciera.propietario))
        .filter(
            models.AlertaFinanciera.id == alerta_id,
            models.AlertaFinanciera.conjunto_id == conjunto_id,
        )
        .first()
    )
    if not alerta:
        return None
    alerta.leida = True
    db.commit()
    db.refresh(alerta)
    return schemas.AlertaFinancieraOut(
        id=alerta.id,
        tipo=alerta.tipo,
        mensaje=alerta.mensaje,
        leida=alerta.leida,
        propietario_id=alerta.propietario_id,
        propietario_nombre=alerta.propietario.nombre if alerta.propietario else None,
        propietario_uid=alerta.propietario.uid if alerta.propietario else None,
        created_at=alerta.created_at,
    )


def mensaje_recordatorio(db: Session, conjunto_id: UUID, uid: str) -> tuple[models.Propietario, str] | None:
    cuenta = estado_cuenta(db, conjunto_id, uid)
    if not cuenta:
        return None
    propietario = (
        db.query(models.Propietario)
        .filter(
            models.Propietario.conjunto_id == conjunto_id,
            models.Propietario.uid == uid.upper(),
        )
        .first()
    )
    if not propietario:
        return None
    config = get_or_create_config(db, conjunto_id)
    venc = _proximo_vencimiento(config.dia_vencimiento)
    saldo_cop = cuenta.saldo_centavos / 100
    mensaje = (
        f"Hola {cuenta.nombre}. Administración informa: su saldo pendiente es "
        f"${saldo_cop:,.0f} COP (Torre {cuenta.torre}, apto {cuenta.apartamento}). "
        f"Próximo vencimiento: {venc.strftime('%d/%m/%Y')}. "
        f"Por favor acerque su pago o comuníquese con administración."
    )
    return propietario, mensaje
