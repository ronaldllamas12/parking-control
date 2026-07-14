import logging

from app import crud, schemas
from app.database import get_db
from app.exceptions import AppException
from app.security import role_required
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

router = APIRouter(prefix="/zonas-acceso", tags=["zonas-acceso"])
logger = logging.getLogger(__name__)


@router.get("/", response_model=list[schemas.ZonaAccesoOut])
def listar_zonas(
    current_user=Depends(role_required(["admin", "vigilante"])),
    db: Session = Depends(get_db),
):
    return crud.get_zonas_by_conjunto(db, current_user.conjunto_id)


@router.post("/", response_model=schemas.ZonaAccesoOut, status_code=201)
def crear_zona(
    payload: schemas.ZonaAccesoCreate,
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    try:
        zona = crud.create_zona(db, current_user.conjunto_id, payload)
    except IntegrityError as exc:
        db.rollback()
        raise AppException(status_code=409, detail="Ya existe una zona con ese nombre") from exc
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error creando zona conjunto_id=%s", current_user.conjunto_id)
        raise
    return zona


@router.put("/{zona_id}", response_model=schemas.ZonaAccesoOut)
def actualizar_zona(
    zona_id: int,
    payload: schemas.ZonaAccesoUpdate,
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    zona = crud.get_zona_by_id(db, zona_id, current_user.conjunto_id)
    if not zona:
        raise HTTPException(status_code=404, detail="Zona de acceso no encontrada")
    try:
        zona = crud.update_zona(db, zona, payload)
    except IntegrityError as exc:
        db.rollback()
        raise AppException(status_code=409, detail="Ya existe una zona con ese nombre") from exc
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error actualizando zona id=%s", zona_id)
        raise
    return zona


@router.delete("/{zona_id}", status_code=204)
def eliminar_zona(
    zona_id: int,
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    zona = crud.get_zona_by_id(db, zona_id, current_user.conjunto_id)
    if not zona:
        raise HTTPException(status_code=404, detail="Zona de acceso no encontrada")
    if zona.nombre.strip().lower() == "parqueadero":
        raise AppException(status_code=400, detail="La zona Parqueadero no se puede eliminar")
    try:
        crud.delete_zona(db, zona)
    except IntegrityError as exc:
        db.rollback()
        raise AppException(
            status_code=409,
            detail="No se puede eliminar una zona con registros de acceso",
        ) from exc
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error eliminando zona id=%s", zona_id)
        raise
