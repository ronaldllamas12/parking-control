from app import crud, schemas
from app.database import get_db
from app.security import role_required
from app.services.cloudinary_service import upload_owner_photo
from app.services import finanzas_service
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

router = APIRouter(prefix="/propietario", tags=["propietario"])


def _current_propietario(current_user, db: Session):
    propietario = crud.get_propietario_for_user(db, current_user)
    if not propietario:
        raise HTTPException(status_code=404, detail="Cuenta de propietario no vinculada")
    return propietario


@router.get("/dashboard", response_model=schemas.PropietarioDashboardOut)
def get_dashboard(
    current_user=Depends(role_required(["propietario"])),
    db: Session = Depends(get_db),
):
    propietario = _current_propietario(current_user, db)
    return finanzas_service.resumen_propietario_dashboard(db, propietario)


@router.get("/comprobantes", response_model=list[schemas.ComprobantePagoOut])
def get_comprobantes(
    current_user=Depends(role_required(["propietario"])),
    db: Session = Depends(get_db),
):
    propietario = _current_propietario(current_user, db)
    return crud.list_comprobantes_pago(db, propietario)


@router.post("/mensaje", response_model=schemas.TelegramMessageOut, status_code=201)
def post_mensaje_admin(
    payload: schemas.PropietarioMensajeIn,
    current_user=Depends(role_required(["propietario"])),
    db: Session = Depends(get_db),
):
    propietario = _current_propietario(current_user, db)
    conversation = crud.get_or_create_telegram_conversation(db, propietario, "admin")
    return crud.add_telegram_message(
        db,
        conversation,
        sender_role="propietario",
        text_value=payload.mensaje,
        read_by_staff=False,
    )


@router.post("/comprobantes", response_model=schemas.ComprobantePagoOut, status_code=201)
async def post_comprobante(
    imagen: UploadFile = File(...),
    mensaje: str | None = Form(None),
    referencia: str | None = Form(None),
    monto_centavos: int | None = Form(None),
    current_user=Depends(role_required(["propietario"])),
    db: Session = Depends(get_db),
):
    propietario = _current_propietario(current_user, db)
    if not imagen.content_type or not imagen.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El comprobante debe ser una imagen")

    imagen_url = upload_owner_photo(imagen)
    comprobante = crud.create_comprobante_pago(
        db,
        propietario,
        imagen_url=imagen_url,
        mensaje=mensaje,
        referencia=referencia,
        monto_centavos=monto_centavos,
    )
    conversation = crud.get_or_create_telegram_conversation(db, propietario, "admin")
    partes = ["Comprobante de pago recibido desde el dashboard."]
    if referencia:
        partes.append(f"Referencia: {referencia}")
    if monto_centavos:
        partes.append(f"Monto: ${monto_centavos / 100:,.0f} COP")
    if mensaje:
        partes.append(f"Mensaje: {mensaje}")
    partes.append(f"Imagen: {imagen_url}")
    crud.add_telegram_message(
        db,
        conversation,
        sender_role="propietario",
        text_value="\n".join(partes),
        read_by_staff=False,
    )
    return comprobante
