import secrets
from datetime import datetime, time, timezone
from typing import Optional
from uuid import UUID

import bcrypt as _bcrypt
from app import models, schemas
from sqlalchemy import func
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
    db: Session, propietario: models.Propietario, vigilante_username: str | None = None
) -> models.HistorialAcceso:
    log = models.HistorialAcceso(
        conjunto_id=propietario.conjunto_id,
        propietario_id=propietario.id,
        propietario_uid=propietario.uid,
        vigilante_username=vigilante_username,
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
    if new_foto_url is not None:
        propietario.foto_url = new_foto_url
    db.commit()
    db.refresh(propietario)
    return propietario


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


