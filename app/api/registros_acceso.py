from app import crud, schemas
from app.database import get_db
from app.security import role_required
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

router = APIRouter(prefix="/registros-acceso", tags=["registros-acceso"])


@router.get("", response_model=list[schemas.RegistroAccesoOut])
def listar_registros_acceso(
    limit: int = Query(default=200, ge=1, le=1000),
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    logs = crud.get_access_logs_by_conjunto(
        db, conjunto_id=current_user.conjunto_id, limit=limit
    )
    return [
        schemas.RegistroAccesoOut(
            id=log.id,
            propietario_id=log.propietario_id,
            uid=log.propietario.uid,
            nombre=log.propietario.nombre,
            torre=log.propietario.torre,
            apartamento=log.propietario.apartamento,
            zona_id=log.zona_id,
            zona=log.zona.nombre,
            estado_intento=log.estado_intento,
            motivo=log.motivo,
            vigilante_username=log.vigilante_username,
            fecha_hora=log.fecha_hora,
        )
        for log in logs
    ]
