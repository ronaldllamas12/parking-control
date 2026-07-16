import logging
from datetime import datetime, timezone

from app import crud, schemas
from app.database import get_db
from app.exceptions import AppException
from app.security import role_required
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

router = APIRouter(prefix="/acceso", tags=["acceso"])
logger = logging.getLogger(__name__)


@router.get("/verificar/{uid}", response_model=schemas.VerificacionResponse)
def verificar_acceso(
    uid: str,
    current_user=Depends(role_required(["vigilante"])),
    db: Session = Depends(get_db),
):
    zona = crud.get_or_create_parqueadero_zone(db, current_user.conjunto_id)
    return _verificar_identificador(
        db=db,
        identificador=uid,
        tipo_identificador="qr",
        zona=zona,
        current_user=current_user,
    )


@router.post("/verificar", response_model=schemas.VerificacionResponse)
def verificar_acceso_zona(
    payload: schemas.VerificacionAccesoIn,
    current_user=Depends(role_required(["vigilante"])),
    db: Session = Depends(get_db),
):
    zona = crud.get_zona_by_id(db, payload.zona_id, current_user.conjunto_id)
    if not zona or not zona.activa:
        raise AppException(status_code=404, detail="Zona de acceso no encontrada o inactiva")
    return _verificar_identificador(
        db=db,
        identificador=payload.identificador,
        tipo_identificador=payload.tipo_identificador,
        zona=zona,
        current_user=current_user,
    )


def _verificar_identificador(
    db: Session,
    identificador: str,
    tipo_identificador: str,
    zona,
    current_user,
) -> schemas.VerificacionResponse:
    normalized = identificador.strip()
    if tipo_identificador == "nfc":
        propietario = crud.get_propietario_by_nfc(
            db, nfc_tag_id=normalized, conjunto_id=current_user.conjunto_id
        )
    else:
        normalized = normalized.upper()
        propietario = crud.get_propietario_by_uid(
            db, uid=normalized, conjunto_id=current_user.conjunto_id
        )
    if not propietario:
        logger.warning("Acceso denegado identificador=%s motivo=no_encontrado", normalized)
        raise AppException(status_code=404, detail="Propietario no encontrado")

    estado_intento = "concedido"
    motivo = None

    if not zona.acceso_universal:
        if not propietario.acceso_habilitado:
            estado_intento = "denegado"
            motivo = (
                "NO SE ENCUENTRA PAZ Y SALVO CON LA ADMINISTRACIÓN. "
                "Por favor acercarse a administración para resolver la situación."
            )
        elif propietario.estado_cuenta == "en_mora":
            estado_intento = "denegado"
            motivo = "Estado de cuenta en mora"
        elif propietario.amenidades_suspendidas:
            estado_intento = "denegado"
            motivo = "Amenidades suspendidas por administración"

    log = crud.register_access_log(
        db,
        propietario,
        zona=zona,
        vigilante_username=current_user.username,
        estado_intento=estado_intento,
        motivo=motivo,
    )

    if estado_intento == "denegado":
        logger.warning(
            "Acceso denegado uid=%s zona=%s motivo=%s",
            propietario.uid,
            zona.nombre,
            motivo,
        )
        raise AppException(status_code=403, detail=f"Acceso Denegado: {motivo}")
    else:
        logger.info(
            "Acceso autorizado uid=%s torre=%s apartamento=%s zona=%s",
            propietario.uid,
            propietario.torre,
            propietario.apartamento,
            zona.nombre,
        )

    return schemas.VerificacionResponse(
        uid=propietario.uid,
        nombre=propietario.nombre,
        numero_contacto=propietario.numero_contacto,
        torre=propietario.torre,
        apartamento=propietario.apartamento,
        foto_url=propietario.foto_url,
        zona=zona.nombre,
        estado_intento=estado_intento,
        motivo=motivo,
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
        db,
        vigilante_username=current_user.username,
        conjunto_id=current_user.conjunto_id,
        limit=10,
    )
    return [
        schemas.HistorialAccesoOut(
            uid=log.propietario.uid,
            nombre=log.propietario.nombre,
            numero_contacto=log.propietario.numero_contacto,
            torre=log.propietario.torre,
            apartamento=log.propietario.apartamento,
            foto_url=log.propietario.foto_url,
            zona=log.zona.nombre if log.zona else None,
            estado_intento=log.estado_intento,
            motivo=log.motivo,
            verificado_en=log.fecha_hora,
        )
        for log in logs
    ]


@router.get("/huellas", response_model=list[schemas.HuellaTemplate])
def listar_huellas(
    current_user=Depends(role_required(["vigilante"])),
    db: Session = Depends(get_db),
):
    """Return all enrolled fingerprint templates for client-side matching."""
    huellas = crud.get_all_huellas(db, conjunto_id=current_user.conjunto_id)
    return [
        schemas.HuellaTemplate(uid=h.propietario_uid, template_b64=h.template_b64)
        for h in huellas
    ]
