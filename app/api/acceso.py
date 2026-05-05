import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db
from app.exceptions import AppException
from app.security import role_required

router = APIRouter(prefix="/acceso", tags=["acceso"])
logger = logging.getLogger(__name__)


@router.get("/verificar/{uid}", response_model=schemas.VerificacionResponse)
def verificar_acceso(
    uid: str,
    _: object = Depends(role_required(["vigilante"])),
    db: Session = Depends(get_db),
):
    propietario = crud.get_propietario_by_uid(db, uid=uid.upper())
    if not propietario:
        logger.warning("Acceso denegado uid=%s motivo=no_encontrado", uid.upper())
        raise AppException(status_code=404, detail="Propietario no encontrado")

    crud.register_access_log(db, propietario)
    logger.info(
        "Acceso autorizado uid=%s torre=%s apartamento=%s",
        propietario.uid,
        propietario.torre,
        propietario.apartamento,
    )

    return schemas.VerificacionResponse(
        uid=propietario.uid,
        nombre=propietario.nombre,
        torre=propietario.torre,
        apartamento=propietario.apartamento,
        foto_url=propietario.foto_url,
        verificado_en=datetime.now(timezone.utc),
    )
