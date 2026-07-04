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
    current_user=Depends(role_required(["vigilante"])),
    db: Session = Depends(get_db),
):
    propietario = crud.get_propietario_by_uid(db, uid=uid.upper())
    if not propietario:
        logger.warning("Acceso denegado uid=%s motivo=no_encontrado", uid.upper())
        raise AppException(status_code=404, detail="Propietario no encontrado")

    log = crud.register_access_log(
        db, propietario, vigilante_username=current_user.username
    )
    logger.info(
        "Acceso autorizado uid=%s torre=%s apartamento=%s",
        propietario.uid,
        propietario.torre,
        propietario.apartamento,
    )

    return schemas.VerificacionResponse(
        uid=propietario.uid,
        nombre=propietario.nombre,
        numero_contacto=propietario.numero_contacto,
        torre=propietario.torre,
        apartamento=propietario.apartamento,
        foto_url=propietario.foto_url,
        verificado_en=log.fecha_hora or datetime.now(timezone.utc),
    )


@router.get(
    "/historial-reciente",
    response_model=list[schemas.HistorialAccesoOut],
)
def historial_reciente(
    current_user=Depends(role_required(["vigilante"])),
    db: Session = Depends(get_db),
):
    logs = crud.get_recent_access_logs_by_vigilante(
        db, vigilante_username=current_user.username, limit=10
    )
    return [
        schemas.HistorialAccesoOut(
            uid=log.propietario.uid,
            nombre=log.propietario.nombre,
            numero_contacto=log.propietario.numero_contacto,
            torre=log.propietario.torre,
            apartamento=log.propietario.apartamento,
            foto_url=log.propietario.foto_url,
            verificado_en=log.fecha_hora,
        )
        for log in logs
    ]
