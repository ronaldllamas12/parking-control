import csv
import io
import logging
import unicodedata
from datetime import datetime
from typing import Optional

from app import crud, models, schemas
from app.database import get_db
from app.exceptions import AppException
from app.security import role_required
from app.services.cloudinary_service import upload_owner_photo
from app.services.telegram_service import (enviar_notificacion_telegram,
                                           get_bot_username)
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import ValidationError
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

router = APIRouter(prefix="/propietarios", tags=["propietarios"])
logger = logging.getLogger(__name__)

_DEFAULT_BULK_FOTO = "https://placehold.co/200x200/2563eb/ffffff?text=P"


def _get_propietario_scoped(
    db: Session, propietario_id: str, conjunto_id
) -> models.Propietario | None:
    if propietario_id.isdigit():
        return crud.get_propietario_by_id(db, int(propietario_id), conjunto_id=conjunto_id)
    return crud.get_propietario_by_uid(
        db, propietario_id.upper(), conjunto_id=conjunto_id
    )


FONT="Helvetica"
FONT_B="Helvetica-Bold"

NAVY=colors.HexColor("#1E3A8A")
BLUE=colors.HexColor("#144e94")
LIGHT=colors.HexColor("#F8FAFC")
BORDER=colors.HexColor("#CBD5E1")
TEXT=colors.HexColor("#111827")
GRAY=colors.HexColor("#64748B")
GREEN=colors.HexColor("#16A34A")
GREEN_BG=colors.HexColor("#DCFCE7")
SHADOW=colors.HexColor("#E5E7EB")

def card(pdf,x,y,w,h,r=10):
    pdf.setFillColor(SHADOW)
    pdf.roundRect(x+3,y-3,w,h,r,fill=1,stroke=0)
    pdf.setFillColor(colors.white)
    pdf.setStrokeColor(BORDER)
    pdf.roundRect(x,y,w,h,r,fill=1)

def badge(pdf,x,y,text):
    pdf.setFillColor(GREEN_BG)
    pdf.roundRect(x,y,120,24,12,fill=1,stroke=0)
    pdf.setFillColor(GREEN)
    pdf.setFont(FONT_B,10)
    pdf.drawCentredString(x+60,y+8,text)

def paragraph(pdf,text,x,y,w):
    style=ParagraphStyle(
        "body",
        fontName=FONT,
        fontSize=10.5,
        leading=22,
        textColor=TEXT,
        alignment=4 # justify
    )
    p=Paragraph(text,style)
    p.wrapOn(pdf,w,500)
    p.drawOn(pdf,x,y-p.height)

def _build_paz_y_salvo_pdf(propietario):
    buffer=io.BytesIO()
    pdf=canvas.Canvas(buffer,pagesize=letter)
    width,height=letter
    m=40

    # fondo
    pdf.setFillColor(colors.white)
    pdf.rect(0,0,width,height,fill=1,stroke=0)

    # header
    pdf.setFillColor(colors.white)
    pdf.rect(0,height-95,width,95,fill=1,stroke=0)
    pdf.setStrokeColor(GRAY)
    pdf.setLineWidth(3)
    pdf.line(0,height-95,width,height-95)

    try:
        logo=ImageReader("/control-parqueadero/frontend/dist/logo-login.png")
        pdf.drawImage(logo,m,height-72,width=48,height=48,mask='auto')
    except:
        pass

    pdf.setFillColor(TEXT)
    pdf.setFont(FONT_B,20)
    pdf.drawString(m+60,height-45,"CONJUNTO RESIDENCIAL ")
    pdf.setFont(FONT,10)
    pdf.setFillColor(GRAY)
    pdf.drawString(m+60,height-62,"Administración General")

    pdf.setFont(FONT_B,22)
    pdf.setFillColor(NAVY)
    pdf.drawCentredString(width/2,height-120,"CERTIFICADO DE PAZ Y SALVO")

    pdf.setFont(FONT,10)
    pdf.setFillColor(GRAY)
    pdf.drawCentredString(width/2,height-138,"Documento Oficial generado electrónicamente")

    numero=f"PY-{datetime.now():%Y}-{str(propietario.uid)[:6]}"
    pdf.setFillColor(TEXT)
    pdf.setFont(FONT_B,10)
    pdf.drawRightString(width-m,height-45,"Certificado")
    pdf.setFont(FONT,10)
    pdf.drawRightString(width-m,height-60,numero)
    pdf.drawRightString(width-m,height-75,datetime.now().strftime("%d/%m/%Y"))

    # propietario
    y=height-265
    card(pdf,m,y,width-2*m,105)
    pdf.setFillColor(NAVY)
    pdf.setFont(FONT_B,13)
    pdf.drawString(m+20,y+85,"DATOS DEL PROPIETARIO")

    pdf.setFillColor(TEXT)
    pdf.setFont(FONT_B,10)
    pdf.drawString(m+20,y+60,"Nombre")
    pdf.setFont(FONT,10)
    pdf.drawString(m+100,y+60,propietario.nombre)

    pdf.setFont(FONT_B,10)
    pdf.drawString(m+20,y+40,"Torre")
    pdf.setFont(FONT,10)
    pdf.drawString(m+100,y+40,str(propietario.torre))

    pdf.setFont(FONT_B,10)
    pdf.drawString(m+20,y+20,"Apartamento")
    pdf.setFont(FONT,10)
    pdf.drawString(m+100,y+20,str(propietario.apartamento))

    badge(pdf,width-190,y+45," PAZ Y SALVO")

    # certificacion
    y2=y-180
    card(pdf,m,y2,width-2*m,160)
    pdf.setFillColor(NAVY)
    pdf.setFont(FONT_B,13)
    pdf.drawString(m+20,y2+135,"CERTIFICACIÓN")

    texto=f"""
    La Administración certifica que <b>{propietario.nombre}</b>,
    propietario de la Torre <b>{propietario.torre}</b>,
    Apartamento <b>{propietario.apartamento}</b>,
    se encuentra a paz y salvo por concepto de las obligaciones
    económicas registradas en el sistema a la fecha de expedición
    del presente certificado.
    """
    paragraph(pdf,texto,m+20,y2+110,width-120)

    # tabla
    y3=y2-155
    card(pdf,m,y3,330,130)
    pdf.setFillColor(NAVY)
    pdf.setFont(FONT_B,13)
    pdf.drawString(m+20,y3+105,"ESTADO")

    rows=[
        ("Administración"," AL DÍA"),
        ("Amenidades"," ACTIVAS"),
        ("Acceso"," HABILITADO"),
        ("Saldo","$0")
    ]
    yy=y3+78
    for k,v in rows:
        pdf.setStrokeColor(BORDER)
        pdf.line(m+20,yy-6,m+300,yy-6)
        pdf.setFont(FONT_B,10)
        pdf.setFillColor(TEXT)
        pdf.drawString(m+20,yy,k)
        pdf.setFont(FONT,10)
        pdf.setFillColor(GREEN if "✓" in v else TEXT)
        pdf.drawRightString(m+290,yy,v)
        yy-=24

    # qr
    card(pdf,390,y3,160,130)
    qr_code=qr.QrCodeWidget(f"https://tu-dominio.com/verificar/{propietario.uid}")
    b=qr_code.getBounds()
    d=Drawing(70,70,transform=[70/(b[2]-b[0]),0,0,70/(b[3]-b[1]),0,0])
    d.add(qr_code)
    renderPDF.draw(d,pdf,435,y3+35)
    pdf.setFont(FONT,8)
    pdf.setFillColor(GRAY)
    pdf.drawCentredString(470,y3+20,"Escanee para verificar")

    # firma
    pdf.line(m,105,m+170,105)
    pdf.setFont(FONT_B,10)
    pdf.setFillColor(TEXT)
    pdf.drawString(m,90,"Administrador")
    pdf.setFont(FONT,8)
    pdf.setFillColor(GRAY)
    pdf.drawString(m,77,"Firma digital certificada")

    # sello
    pdf.saveState()
    pdf.translate(width-120,120)
    pdf.rotate(20)
    pdf.setStrokeColor(BLUE)
    pdf.setLineWidth(2)
    pdf.circle(0,0,40)
    pdf.setFont(FONT_B,9)
    pdf.setFillColor(NAVY)
    pdf.drawCentredString(0,5,"DOCUMENTO")
    pdf.drawCentredString(0,-8,"OFICIAL")
    pdf.restoreState()

    # footer
    pdf.setStrokeColor(BORDER)
    pdf.line(m,45,width-m,45)
    pdf.setFont(FONT,8)
    pdf.setFillColor(GRAY)
    pdf.drawString(m,30,"Conjunto Residencial • Documento generado automáticamente")
    pdf.drawRightString(width-m,30,"Página 1 de 1")

    pdf.save()
    buffer.seek(0)
    return buffer.getvalue()



@router.post("/", response_model=schemas.PropietarioOut)
def registrar_propietario(
    nombre: str = Form(...),
    numero_contacto: str = Form(...),
    torre: str = Form(...),
    apartamento: str = Form(...),
    foto: UploadFile = File(...),
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    logger.info(
        "Registro de propietario solicitado torre=%s apartamento=%s",
        torre,
        apartamento,
    )

    try:
        payload = schemas.PropietarioCreate(
            nombre=nombre,
            numero_contacto=numero_contacto,
            torre=torre,
            apartamento=apartamento,
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
        propietario = crud.create_propietario(
            db=db,
            payload=payload,
            foto_url=foto_url,
            conjunto_id=current_user.conjunto_id,
        )
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
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    return crud.get_all_propietarios(db, conjunto_id=current_user.conjunto_id)


@router.put("/bulk-status", response_model=schemas.BulkStatusResponse)
def actualizar_estado_masivo(
    payload: schemas.PropietarioEstadoBulkIn,
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    if not payload.registros:
        raise HTTPException(status_code=400, detail="No se enviaron registros")
    if len(payload.registros) > 2000:
        raise HTTPException(status_code=400, detail="Máximo 2000 registros por operación")
    return crud.bulk_update_estado_propietarios(
        db, conjunto_id=current_user.conjunto_id, registros=payload.registros
    )


@router.post("/bulk-status-csv", response_model=schemas.BulkStatusResponse)
async def importar_estado_csv(
    archivo: UploadFile = File(...),
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    filename = archivo.filename.lower()
    if not filename.endswith((".csv", ".tsv", ".txt")):
        raise HTTPException(status_code=400, detail="El archivo debe ser CSV o TSV")

    raw = await archivo.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="El CSV debe estar codificado en UTF-8") from exc

    sample = text[:2048]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters="\t,;")
    except csv.Error:
        dialect = csv.excel_tab if "\t" in sample else csv.excel

    def normalize_key(value: str) -> str:
        normalized = unicodedata.normalize("NFD", value.strip().lower())
        normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
        return normalized.replace(" ", "_")

    def normalize_estado(value: str) -> str:
        normalized = normalize_key(value)
        if normalized in {"al_dia", "aldia"}:
            return "al_dia"
        if normalized in {"en_mora", "enmora"}:
            return "en_mora"
        return normalized

    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    required = {"torre", "apartamento", "nuevo_estado"}
    headers = {normalize_key(h) for h in (reader.fieldnames or [])}
    if not required.issubset(headers):
        raise HTTPException(
            status_code=400,
            detail='El CSV debe incluir las columnas "torre", "apartamento" y "nuevo_estado"',
        )

    registros: list[schemas.PropietarioEstadoBulkItem] = []
    errores: list[schemas.BulkStatusError] = []
    for idx, row in enumerate(reader, start=2):
        normalized = {normalize_key(str(k)): str(v).strip() for k, v in row.items()}
        try:
            registros.append(
                schemas.PropietarioEstadoBulkItem(
                    torre=normalized.get("torre", ""),
                    apartamento=normalized.get("apartamento", ""),
                    nuevo_estado=normalize_estado(normalized.get("nuevo_estado", "")),
                    amenidades_suspendidas=(
                        normalized.get("amenidades_suspendidas", "").lower()
                        in {"true", "1", "si", "sí", "yes"}
                        if normalized.get("amenidades_suspendidas", "") != ""
                        else None
                    ),
                )
            )
        except Exception as exc:
            errores.append(
                schemas.BulkStatusError(
                    fila=idx,
                    torre=normalized.get("torre", ""),
                    apartamento=normalized.get("apartamento", ""),
                    error=f"Fila inválida: {str(exc)[:120]}",
                )
            )

    if not registros and not errores:
        raise HTTPException(status_code=400, detail="El CSV no contiene registros")
    result = crud.bulk_update_estado_propietarios(
        db, conjunto_id=current_user.conjunto_id, registros=registros
    )
    return schemas.BulkStatusResponse(
        actualizados=result.actualizados,
        errores=[*errores, *result.errores],
    )


@router.patch("/{propietario_id}/amenidades", response_model=schemas.PropietarioOut)
def actualizar_amenidades(
    propietario_id: str,
    payload: schemas.AmenidadesUpdate,
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    propietario = _get_propietario_scoped(
        db, propietario_id=propietario_id, conjunto_id=current_user.conjunto_id
    )
    if not propietario:
        raise HTTPException(status_code=404, detail="Propietario no encontrado")
    return crud.update_amenidades_propietario(
        db, propietario, payload.amenidades_suspendidas
    )


@router.post("/{propietario_id}/notificar", response_model=schemas.TelegramNotificationOut)
async def notificar_propietario(
    propietario_id: str,
    payload: schemas.TelegramNotificationIn,
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    propietario = _get_propietario_scoped(
        db, propietario_id=propietario_id, conjunto_id=current_user.conjunto_id
    )
    if not propietario:
        raise HTTPException(status_code=404, detail="Propietario no encontrado")
    if not propietario.telegram_chat_id:
        raise HTTPException(
            status_code=400,
            detail="El propietario no tiene telegram_chat_id configurado",
        )

    conjunto = crud.get_conjunto_by_id(db, current_user.conjunto_id)
    if not conjunto or not conjunto.telegram_bot_token:
        raise HTTPException(
            status_code=400,
            detail="El conjunto no tiene token de bot Telegram configurado",
        )

    sent = await enviar_notificacion_telegram(db, propietario.id, payload.mensaje)
    if not sent:
        raise HTTPException(status_code=502, detail="No se pudo enviar el mensaje por Telegram")
    return schemas.TelegramNotificationOut(detail="Notificación enviada")


@router.get("/{propietario_id}/paz-y-salvo")
def generar_paz_y_salvo(
    propietario_id: str,
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    propietario = _get_propietario_scoped(
        db, propietario_id=propietario_id, conjunto_id=current_user.conjunto_id
    )
    if not propietario:
        raise HTTPException(status_code=404, detail="Propietario no encontrado")
    if propietario.estado_cuenta != "al_dia":
        raise HTTPException(status_code=403, detail="Propietario en mora")

    pdf_bytes = _build_paz_y_salvo_pdf(propietario)
    filename = f"paz-y-salvo-{propietario.torre}-{propietario.apartamento}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.put("/{uid}", response_model=schemas.PropietarioOut)
def actualizar_propietario(
    uid: str,
    nombre: Optional[str] = Form(None),
    numero_contacto: Optional[str] = Form(None),
    torre: Optional[str] = Form(None),
    apartamento: Optional[str] = Form(None),
    foto: Optional[UploadFile] = File(None),
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    propietario = crud.get_propietario_by_uid(
        db, uid.upper(), conjunto_id=current_user.conjunto_id
    )
    if not propietario:
        raise HTTPException(status_code=404, detail="Propietario no encontrado")

    try:
        payload = schemas.PropietarioUpdate(
            nombre=nombre,
            numero_contacto=numero_contacto,
            torre=torre,
            apartamento=apartamento,
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
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    propietario = crud.get_propietario_by_uid(
        db, uid.upper(), conjunto_id=current_user.conjunto_id
    )
    if not propietario:
        raise HTTPException(status_code=404, detail="Propietario no encontrado")

    try:
        crud.delete_propietario(db, propietario)
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error eliminando propietario uid=%s", uid)
        raise

    logger.info("Propietario eliminado uid=%s", uid)


@router.patch("/{uid}/toggle-acceso", response_model=schemas.PropietarioOut)
def toggle_acceso_propietario(
    uid: str,
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    propietario = crud.get_propietario_by_uid(
        db, uid.upper(), conjunto_id=current_user.conjunto_id
    )
    if not propietario:
        raise HTTPException(status_code=404, detail="Propietario no encontrado")

    propietario = crud.toggle_acceso_propietario(db, propietario)
    estado = "habilitado" if propietario.acceso_habilitado else "deshabilitado"
    logger.info("Acceso %s para propietario uid=%s", estado, uid)
    return propietario


# ── Fingerprint endpoints ─────────────────────────────────────────────────────

@router.post("/{uid}/huella", response_model=schemas.PropietarioOut)
def registrar_huella(
    uid: str,
    payload: schemas.HuellaRegisterIn,
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    propietario = crud.get_propietario_by_uid(
        db, uid.upper(), conjunto_id=current_user.conjunto_id
    )
    if not propietario:
        raise HTTPException(status_code=404, detail="Propietario no encontrado")
    propietario = crud.save_huella(db, propietario, payload.template_b64)
    logger.info("Huella registrada uid=%s", uid)
    return propietario


@router.delete("/{uid}/huella", response_model=schemas.PropietarioOut)
def eliminar_huella(
    uid: str,
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    propietario = crud.get_propietario_by_uid(
        db, uid.upper(), conjunto_id=current_user.conjunto_id
    )
    if not propietario:
        raise HTTPException(status_code=404, detail="Propietario no encontrado")
    propietario = crud.delete_huella(db, propietario)
    logger.info("Huella eliminada uid=%s", uid)
    return propietario



@router.post("/bulk", response_model=schemas.BulkImportResponse)
def registrar_propietarios_bulk(
    items: list[schemas.PropietarioCreate],
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    if not items:
        raise HTTPException(status_code=400, detail="No se enviaron registros")
    if len(items) > 200:
        raise HTTPException(status_code=400, detail="Máximo 200 registros por importación")

    creados: list[models.Propietario] = []
    errores: list[str] = []

    for idx, item in enumerate(items, start=1):
        try:
            p = crud.create_propietario(
                db=db,
                payload=item,
                foto_url=_DEFAULT_BULK_FOTO,
                conjunto_id=current_user.conjunto_id,
            )
            creados.append(p)
        except IntegrityError:
            db.rollback()
            errores.append(
                f"Fila {idx} ({item.nombre}): Torre {item.torre} Apto {item.apartamento} ya existe"
            )
        except Exception as exc:
            db.rollback()
            errores.append(f"Fila {idx} ({item.nombre}): Error — {str(exc)[:120]}")

    logger.info(
        "Importación masiva: %d creados, %d errores", len(creados), len(errores)
    )
    return schemas.BulkImportResponse(creados=creados, errores=errores)


# ── Single propietario (status polling) ──────────────────────────────────────

@router.get("/{uid}", response_model=schemas.PropietarioOut)
def obtener_propietario(
    uid: str,
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    propietario = crud.get_propietario_by_uid(
        db, uid.upper(), conjunto_id=current_user.conjunto_id
    )
    if not propietario:
        raise HTTPException(status_code=404, detail="Propietario no encontrado")
    return propietario


# ── Telegram link generation ──────────────────────────────────────────────────

@router.post("/{uid}/telegram-link", response_model=schemas.TelegramLinkOut)
async def generar_telegram_link(
    uid: str,
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    """Generate (or regenerate) a one-time Telegram deep-link for the propietario.

    The previous token is invalidated automatically.
    """
    conjunto = crud.get_conjunto_by_id(db, current_user.conjunto_id)
    if not conjunto:
        raise HTTPException(status_code=404, detail="Conjunto no encontrado")
    if not conjunto.telegram_bot_token:
        raise HTTPException(
            status_code=400,
            detail="El conjunto no tiene un token de bot Telegram configurado. "
                   "Configúralo en Superadmin antes de generar el enlace.",
        )

    bot_username = await get_bot_username(conjunto.telegram_bot_token)
    if not bot_username:
        raise HTTPException(
            status_code=502,
            detail="No se pudo obtener el nombre del bot desde Telegram. "
                   "Verifica que el token del bot sea correcto.",
        )

    propietario = crud.generate_telegram_link_token(db, uid, current_user.conjunto_id)
    if not propietario:
        raise HTTPException(status_code=404, detail="Propietario no encontrado")

    link = f"https://t.me/{bot_username}?start={propietario.telegram_link_token}"
    logger.info("Telegram link generado uid=%s bot=%s", uid, bot_username)
    return schemas.TelegramLinkOut(link=link, bot_username=bot_username)

