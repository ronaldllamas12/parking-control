import secrets
from typing import Optional

import bcrypt as _bcrypt
from app import models, schemas
from sqlalchemy.orm import Session


def _generate_short_uid(length: int = 10) -> str:
    raw = secrets.token_urlsafe(12)
    normalized = "".join(ch for ch in raw if ch.isalnum()).upper()
    return normalized[:length]


def get_user_by_username(db: Session, username: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.username == username).first()


def create_user(db: Session, username: str, password: str, role: str) -> models.User:
    hashed = _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()
    user = models.User(
        username=username,
        hashed_password=hashed,
        role=role,
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
    if not get_user_by_username(db, ADMIN_USERNAME):
        create_user(db, ADMIN_USERNAME, ADMIN_PASSWORD, role="admin")
    if not get_user_by_username(db, VIGILANTE_USERNAME):
        create_user(db, VIGILANTE_USERNAME, VIGILANTE_PASSWORD, role="vigilante")


def get_propietario_by_uid(db: Session, uid: str) -> Optional[models.Propietario]:
    return db.query(models.Propietario).filter(models.Propietario.uid == uid).first()


def create_propietario(
    db: Session,
    payload: schemas.PropietarioCreate,
    foto_url: str,
) -> models.Propietario:
    for _ in range(10):
        candidate_uid = _generate_short_uid()
        exists = get_propietario_by_uid(db, candidate_uid)
        if not exists:
            propietario = models.Propietario(
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
        propietario_id=propietario.id,
        propietario_uid=propietario.uid,
        vigilante_username=vigilante_username,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_recent_access_logs_by_vigilante(
    db: Session, vigilante_username: str, limit: int = 10
) -> list[models.HistorialAcceso]:
    return (
        db.query(models.HistorialAcceso)
        .join(models.HistorialAcceso.propietario)
        .filter(models.HistorialAcceso.vigilante_username == vigilante_username)
        .order_by(models.HistorialAcceso.fecha_hora.desc())
        .limit(limit)
        .all()
    )


def get_all_propietarios(db: Session) -> list[models.Propietario]:
    return (
        db.query(models.Propietario)
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


def get_all_huellas(db: Session) -> list[models.HuellaDigital]:
    return db.query(models.HuellaDigital).all()


