import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db
from app.exceptions import AppException
from app.security import role_required
from app.services.cloudinary_service import upload_owner_photo

router = APIRouter(prefix="/propietarios", tags=["propietarios"])
logger = logging.getLogger(__name__)


@router.post("/", response_model=schemas.PropietarioOut)
def registrar_propietario(
    nombre: str = Form(...),
    torre: str = Form(...),
    apartamento: str = Form(...),
    foto: UploadFile = File(...),
    _: object = Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    logger.info(
        "Registro de propietario solicitado torre=%s apartamento=%s",
        torre,
        apartamento,
    )

    try:
        payload = schemas.PropietarioCreate(
            nombre=nombre, torre=torre, apartamento=apartamento
        )
    except ValidationError as exc:
        logger.warning(
            "Payload invalido para propietario torre=%s apartamento=%s errors=%s",
            torre,
            apartamento,
            exc.errors(),
        )
        raise AppException(
            status_code=422, detail="Datos de propietario invalidos"
        ) from exc

    if not foto.content_type or not foto.content_type.startswith("image/"):
        logger.warning(
            "Archivo invalido para propietario torre=%s apartamento=%s content_type=%s",
            torre,
            apartamento,
            foto.content_type,
        )
        raise AppException(status_code=400, detail="Archivo no es imagen")

    try:
        foto_url = upload_owner_photo(foto)
        propietario = crud.create_propietario(db=db, payload=payload, foto_url=foto_url)
    except IntegrityError as exc:
        db.rollback()
        logger.warning(
            "Propietario duplicado torre=%s apartamento=%s",
            payload.torre,
            payload.apartamento,
        )
        raise AppException(
            status_code=409,
            detail="Ya existe un propietario registrado para torre/apartamento",
        ) from exc
    except SQLAlchemyError:
        db.rollback()
        logger.exception(
            "Error de base de datos registrando propietario torre=%s apartamento=%s",
            payload.torre,
            payload.apartamento,
        )
        raise
    except AppException:
        raise
    except Exception:
        logger.exception(
            "Error inesperado registrando propietario torre=%s apartamento=%s",
            payload.torre,
            payload.apartamento,
        )
        raise

    logger.info(
        "Propietario registrado uid=%s torre=%s apartamento=%s",
        propietario.uid,
        propietario.torre,
        propietario.apartamento,
    )
    return propietario


@router.get("/", response_model=list[schemas.PropietarioOut])
def listar_propietarios(
    _: object = Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    return crud.get_all_propietarios(db)


@router.put("/{uid}", response_model=schemas.PropietarioOut)
def actualizar_propietario(
    uid: str,
    nombre: Optional[str] = Form(None),
    torre: Optional[str] = Form(None),
    apartamento: Optional[str] = Form(None),
    foto: Optional[UploadFile] = File(None),
    _: object = Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    propietario = crud.get_propietario_by_uid(db, uid)
    if not propietario:
        raise HTTPException(status_code=404, detail="Propietario no encontrado")

    try:
        payload = schemas.PropietarioUpdate(
            nombre=nombre, torre=torre, apartamento=apartamento
        )
    except ValidationError as exc:
        raise AppException(status_code=422, detail="Datos inválidos") from exc

    new_foto_url: Optional[str] = None
    if foto and foto.filename:
        if not foto.content_type or not foto.content_type.startswith("image/"):
            raise AppException(status_code=400, detail="Archivo no es imagen")
        new_foto_url = upload_owner_photo(foto)

    try:
        propietario = crud.update_propietario(db, propietario, payload, new_foto_url)
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error actualizando propietario uid=%s", uid)
        raise

    logger.info("Propietario actualizado uid=%s", uid)
    return propietario


@router.delete("/{uid}", status_code=204)
def eliminar_propietario(
    uid: str,
    _: object = Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    propietario = crud.get_propietario_by_uid(db, uid)
    if not propietario:
        raise HTTPException(status_code=404, detail="Propietario no encontrado")

    try:
        crud.delete_propietario(db, propietario)
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error eliminando propietario uid=%s", uid)
        raise

    logger.info("Propietario eliminado uid=%s", uid)
