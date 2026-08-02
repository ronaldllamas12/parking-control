from datetime import date, timedelta

from app import schemas
from app.database import get_db
from app.security import role_required
from app.services import salones_service
from app.services.cloudinary_service import upload_owner_photo
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

router = APIRouter(prefix="/salones-sociales", tags=["salones-sociales"])


def _range_defaults(
    fecha_inicio: date | None,
    fecha_fin: date | None,
) -> tuple[date, date]:
    start = fecha_inicio or date.today()
    end = fecha_fin or (start + timedelta(days=45))
    if end < start:
        raise HTTPException(status_code=422, detail="La fecha final no puede ser anterior a la inicial")
    if (end - start).days > 120:
        raise HTTPException(status_code=422, detail="El rango máximo del calendario es de 120 días")
    return start, end


@router.get("/admin/salones", response_model=list[schemas.SalonSocialOut])
def admin_list_salones(
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    return salones_service.list_salones(db, current_user.conjunto_id)


@router.post("/admin/salones", response_model=schemas.SalonSocialOut, status_code=201)
async def admin_create_salon(
    nombre: str = Form(...),
    descripcion: str | None = Form(None),
    capacidad: int = Form(...),
    estado: str = Form("activo"),
    color_calendario: str = Form("#0f766e"),
    precio_sin_aseo_centavos: int = Form(salones_service.DEFAULT_PRECIO_SIN_ASEO_CENTAVOS),
    precio_con_aseo_centavos: int = Form(salones_service.DEFAULT_PRECIO_CON_ASEO_CENTAVOS),
    imagen: UploadFile | None = File(None),
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    if estado not in {"activo", "inactivo"}:
        raise HTTPException(status_code=422, detail="Estado de salón inválido")
    if capacidad <= 0:
        raise HTTPException(status_code=422, detail="La capacidad debe ser mayor a cero")
    if not color_calendario.startswith("#") or len(color_calendario) != 7:
        raise HTTPException(status_code=422, detail="Color de calendario inválido")

    imagen_url = None
    if imagen and imagen.filename:
        if not imagen.content_type or not imagen.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="La imagen del salón debe ser una imagen")
        imagen_url = upload_owner_photo(imagen)

    try:
        return salones_service.create_salon(
            db,
            conjunto_id=current_user.conjunto_id,
            nombre=nombre.strip(),
            descripcion=descripcion.strip() if descripcion else None,
            capacidad=capacidad,
            imagen_url=imagen_url,
            estado=estado,
            color_calendario=color_calendario,
            precio_sin_aseo_centavos=precio_sin_aseo_centavos,
            precio_con_aseo_centavos=precio_con_aseo_centavos,
        )
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail="Ya existe un salón con ese nombre") from exc


@router.put("/admin/salones/{salon_id}", response_model=schemas.SalonSocialOut)
async def admin_update_salon(
    salon_id: int,
    nombre: str | None = Form(None),
    descripcion: str | None = Form(None),
    capacidad: int | None = Form(None),
    estado: str | None = Form(None),
    color_calendario: str | None = Form(None),
    precio_sin_aseo_centavos: int | None = Form(None),
    precio_con_aseo_centavos: int | None = Form(None),
    imagen: UploadFile | None = File(None),
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    salon = salones_service.get_salon(db, current_user.conjunto_id, salon_id)
    if not salon:
        raise HTTPException(status_code=404, detail="Salón no encontrado")

    payload = schemas.SalonSocialUpdate(
        nombre=nombre,
        descripcion=descripcion,
        capacidad=capacidad,
        estado=estado,
        color_calendario=color_calendario,
        precio_sin_aseo_centavos=precio_sin_aseo_centavos,
        precio_con_aseo_centavos=precio_con_aseo_centavos,
    )
    imagen_url = None
    if imagen and imagen.filename:
        if not imagen.content_type or not imagen.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="La imagen del salón debe ser una imagen")
        imagen_url = upload_owner_photo(imagen)
    try:
        return salones_service.update_salon(db, salon, payload, imagen_url=imagen_url)
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail="Ya existe un salón con ese nombre") from exc


@router.get("/admin/calendario", response_model=list[schemas.SalonSocialCalendarDayOut])
def admin_calendario(
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    start, end = _range_defaults(fecha_inicio, fecha_fin)
    return salones_service.calendario(db, current_user.conjunto_id, start, end)


@router.get("/admin/reservas", response_model=list[schemas.SalonSocialReservaOut])
def admin_reservas(
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    return salones_service.list_reservas(db, current_user.conjunto_id)


@router.post("/admin/bloqueos", response_model=schemas.SalonSocialReservaOut | None)
def admin_bloqueo(
    payload: schemas.SalonSocialBloqueoIn,
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    try:
        bloqueo = salones_service.set_bloqueo_admin(db, current_user.conjunto_id, payload, current_user.username)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return salones_service._reserva_out(bloqueo) if bloqueo else None


@router.patch("/admin/reservas/{reserva_id}", response_model=schemas.SalonSocialReservaOut)
def admin_update_reserva(
    reserva_id: int,
    payload: schemas.SalonSocialReservaEstadoIn,
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    reserva = salones_service.get_reserva(db, current_user.conjunto_id, reserva_id)
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    try:
        updated = salones_service.update_estado_reserva_admin(db, reserva, payload, current_user.username)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return salones_service._reserva_out(updated)


@router.get("/propietario/salones", response_model=list[schemas.SalonSocialOut])
def propietario_salones(
    current_user=Depends(role_required(["propietario"])),
    db: Session = Depends(get_db),
):
    return salones_service.list_salones(db, current_user.conjunto_id, only_active=True)


@router.get("/propietario/calendario", response_model=list[schemas.SalonSocialCalendarDayOut])
def propietario_calendario(
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    current_user=Depends(role_required(["propietario"])),
    db: Session = Depends(get_db),
):
    start, end = _range_defaults(fecha_inicio, fecha_fin)
    return salones_service.calendario(
        db,
        current_user.conjunto_id,
        start,
        end,
        only_active_salones=True,
    )


@router.get("/propietario/reservas", response_model=list[schemas.SalonSocialReservaOut])
def propietario_reservas(
    current_user=Depends(role_required(["propietario"])),
    db: Session = Depends(get_db),
):
    if current_user.propietario_id is None:
        raise HTTPException(status_code=404, detail="Cuenta de propietario no vinculada")
    return salones_service.list_reservas(
        db,
        current_user.conjunto_id,
        propietario_id=current_user.propietario_id,
    )


@router.post("/propietario/reservas", response_model=schemas.SalonSocialReservaOut, status_code=201)
def propietario_crear_reserva(
    payload: schemas.SalonSocialReservaCreate,
    current_user=Depends(role_required(["propietario"])),
    db: Session = Depends(get_db),
):
    propietario = current_user.propietario
    if not propietario:
        raise HTTPException(status_code=404, detail="Cuenta de propietario no vinculada")
    try:
        reserva = salones_service.create_reserva_propietario(
            db,
            current_user.conjunto_id,
            propietario,
            payload,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return salones_service._reserva_out(reserva)


@router.post("/propietario/reservas/{reserva_id}/pago", response_model=schemas.SalonSocialReservaOut)
async def propietario_reportar_pago(
    reserva_id: int,
    referencia_pago: str | None = Form(None),
    notas: str | None = Form(None),
    comprobante: UploadFile | None = File(None),
    current_user=Depends(role_required(["propietario"])),
    db: Session = Depends(get_db),
):
    reserva = salones_service.get_reserva(db, current_user.conjunto_id, reserva_id)
    if not reserva or reserva.propietario_id != current_user.propietario_id:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    comprobante_url = None
    if comprobante and comprobante.filename:
        if not comprobante.content_type or not comprobante.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="El comprobante debe ser una imagen")
        comprobante_url = upload_owner_photo(comprobante)
    try:
        updated = salones_service.reportar_pago(db, reserva, comprobante_url, referencia_pago, notas)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return salones_service._reserva_out(updated)


@router.post("/propietario/reservas/{reserva_id}/cancelar", response_model=schemas.SalonSocialReservaOut)
def propietario_cancelar_reserva(
    reserva_id: int,
    motivo: str | None = Form(None),
    current_user=Depends(role_required(["propietario"])),
    db: Session = Depends(get_db),
):
    reserva = salones_service.get_reserva(db, current_user.conjunto_id, reserva_id)
    if not reserva or reserva.propietario_id != current_user.propietario_id:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    try:
        updated = salones_service.cancel_reserva_propietario(db, reserva, motivo)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return salones_service._reserva_out(updated)
