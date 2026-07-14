import logging

from app import crud, schemas
from app.database import get_db
from app.security import role_required
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)


@router.get("/metricas", response_model=schemas.ConjuntoMetricasOut)
def obtener_metricas_mi_conjunto(
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    conjunto = crud.get_conjunto_by_id(db, current_user.conjunto_id)
    if not conjunto:
        raise HTTPException(status_code=404, detail="Conjunto residencial no encontrado")

    logger.info(
        "Metricas solicitadas por admin=%s conjunto_id=%s",
        current_user.username,
        current_user.conjunto_id,
    )
    return crud.get_conjunto_metricas(db, conjunto)
