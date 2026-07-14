import logging
from uuid import UUID

from app import crud, schemas
from app.database import get_db
from app.exceptions import AppException
from app.security import role_required
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

router = APIRouter(prefix="/superadmin", tags=["superadmin"])
logger = logging.getLogger(__name__)


@router.get("/conjuntos", response_model=list[schemas.ConjuntoResidencialOut])
def listar_conjuntos(
    _current_user=Depends(role_required(["superadmin"])),
    db: Session = Depends(get_db),
):
    return crud.get_all_conjuntos(db)


@router.post(
    "/conjuntos",
    response_model=schemas.ConjuntoResidencialOut,
    status_code=201,
)
def crear_conjunto_con_admin(
    payload: schemas.ConjuntoWithAdminCreate,
    _current_user=Depends(role_required(["superadmin"])),
    db: Session = Depends(get_db),
):
    try:
        conjunto = crud.create_conjunto_with_initial_admin(db, payload)
    except IntegrityError as exc:
        db.rollback()
        logger.warning(
            "Conjunto/admin duplicado nombre=%s username=%s",
            payload.conjunto.nombre,
            payload.admin.username,
        )
        raise AppException(
            status_code=409,
            detail="Ya existe un conjunto con ese nombre o un usuario con ese username",
        ) from exc
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error creando conjunto residencial")
        raise

    logger.info(
        "Conjunto creado id=%s nombre=%s admin=%s",
        conjunto.id,
        conjunto.nombre,
        payload.admin.username,
    )
    return conjunto


@router.put("/conjuntos/{conjunto_id}", response_model=schemas.ConjuntoResidencialOut)
def actualizar_conjunto(
    conjunto_id: UUID,
    payload: schemas.ConjuntoResidencialUpdate,
    _current_user=Depends(role_required(["superadmin"])),
    db: Session = Depends(get_db),
):
    conjunto = crud.get_conjunto_by_id(db, conjunto_id)
    if not conjunto:
        raise HTTPException(status_code=404, detail="Conjunto residencial no encontrado")

    try:
        conjunto = crud.update_conjunto(db, conjunto, payload)
    except IntegrityError as exc:
        db.rollback()
        raise AppException(
            status_code=409,
            detail="Ya existe un conjunto con ese nombre",
        ) from exc
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error actualizando conjunto id=%s", conjunto_id)
        raise

    logger.info("Conjunto actualizado id=%s", conjunto.id)
    return conjunto


@router.post(
    "/conjuntos/{conjunto_id}/vigilantes",
    response_model=schemas.UserOut,
    status_code=201,
)
def crear_vigilante_para_conjunto(
    conjunto_id: UUID,
    payload: schemas.VigilanteCreate,
    _current_user=Depends(role_required(["superadmin"])),
    db: Session = Depends(get_db),
):
    conjunto = crud.get_conjunto_by_id(db, conjunto_id)
    if not conjunto:
        raise HTTPException(status_code=404, detail="Conjunto residencial no encontrado")

    try:
        vigilante = crud.create_vigilante_for_conjunto(db, conjunto, payload)
    except IntegrityError as exc:
        db.rollback()
        raise AppException(
            status_code=409,
            detail="Ya existe un usuario con ese username",
        ) from exc
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error creando vigilante conjunto_id=%s", conjunto_id)
        raise

    logger.info(
        "Vigilante creado username=%s conjunto_id=%s",
        vigilante.username,
        conjunto_id,
    )
    return vigilante


@router.get(
    "/conjuntos/{conjunto_id}/usuarios",
    response_model=list[schemas.UserOut],
)
def listar_usuarios_conjunto(
    conjunto_id: UUID,
    _current_user=Depends(role_required(["superadmin"])),
    db: Session = Depends(get_db),
):
    conjunto = crud.get_conjunto_by_id(db, conjunto_id)
    if not conjunto:
        raise HTTPException(status_code=404, detail="Conjunto residencial no encontrado")

    return crud.get_users_by_conjunto(db, conjunto_id)


@router.patch("/usuarios/{user_id}/password", response_model=schemas.UserOut)
def actualizar_password_usuario(
    user_id: int,
    payload: schemas.UserPasswordUpdate,
    _current_user=Depends(role_required(["superadmin"])),
    db: Session = Depends(get_db),
):
    user = crud.get_tenant_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario tenant no encontrado")

    try:
        user = crud.update_user_password(db, user, payload.password)
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error actualizando password user_id=%s", user_id)
        raise

    logger.info("Password actualizado user_id=%s username=%s", user.id, user.username)
    return user


@router.delete("/conjuntos/{conjunto_id}", status_code=204)
def eliminar_conjunto(
    conjunto_id: UUID,
    _current_user=Depends(role_required(["superadmin"])),
    db: Session = Depends(get_db),
):
    conjunto = crud.get_conjunto_by_id(db, conjunto_id)
    if not conjunto:
        raise HTTPException(status_code=404, detail="Conjunto residencial no encontrado")

    try:
        crud.delete_conjunto(db, conjunto)
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error eliminando conjunto id=%s", conjunto_id)
        raise

    logger.info("Conjunto eliminado id=%s", conjunto_id)
