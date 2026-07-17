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


def _build_paz_y_salvo_pdf(propietario: models.Propietario) -> bytes:
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.units import inch
        from reportlab.pdfgen import canvas
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="Dependencia reportlab no instalada para generar PDF",
        ) from exc

    def draw_wrapped_text(
        pdf: canvas.Canvas,
        text: str,
        x: float,
        y: float,
        max_width: float,
        font_name: str,
        font_size: int,
        leading: int,
    ) -> float:
        words = text.split()
        lines: list[str] = []
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if pdf.stringWidth(candidate, font_name, font_size) <= max_width:
                current = candidate
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)

        pdf.setFont(font_name, font_size)
        for line in lines:
            pdf.drawString(x, y, line)
            y -= leading
        return y

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    margin = 0.72 * inch
    navy = colors.HexColor("#0F172A")
    slate = colors.HexColor("#475569")
    muted = colors.HexColor("#94A3B8")
    blue = colors.HexColor("#1D4ED8")
    blue_dark = colors.HexColor("#1E3A8A")
    blue_light = colors.HexColor("#EFF6FF")
    emerald = colors.HexColor("#059669")
    emerald_light = colors.HexColor("#ECFDF5")
    border = colors.HexColor("#D8E2F0")
    surface = colors.HexColor("#F8FAFC")
    today = datetime.now().strftime("%d/%m/%Y")

    pdf.setTitle(f"Paz y Salvo {propietario.uid}")

    # Header band
    pdf.setFillColor(navy)
    pdf.rect(0, height - 1.85 * inch, width, 1.85 * inch, fill=1, stroke=0)
    pdf.setFillColor(blue_dark)
    pdf.circle(width - 0.65 * inch, height - 0.2 * inch, 1.35 * inch, fill=1, stroke=0)
    pdf.setFillColor(blue)
    pdf.circle(width - 1.65 * inch, height - 1.65 * inch, 0.85 * inch, fill=1, stroke=0)

    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 26)
    pdf.drawString(margin, height - 0.82 * inch, "PAZ Y SALVO")
    pdf.setFont("Helvetica", 10)
    pdf.setFillColor(colors.HexColor("#CBD5E1"))
    pdf.drawString(margin, height - 1.12 * inch, "Certificado de estado administrativo del residente")
    pdf.setFont("Helvetica-Bold", 9)
    pdf.setFillColor(colors.white)
    pdf.roundRect(width - margin - 1.72 * inch, height - 0.94 * inch, 1.72 * inch, 0.36 * inch, 9, fill=0, stroke=1)
    pdf.drawCentredString(width - margin - 0.86 * inch, height - 0.82 * inch, f"UID {propietario.uid}")

    # Main certificate card
    card_x = margin
    card_y = 1.18 * inch
    card_w = width - 2 * margin
    card_h = height - 3.42 * inch
    pdf.setFillColor(colors.white)
    pdf.setStrokeColor(border)
    pdf.roundRect(card_x, card_y, card_w, card_h, 14, fill=1, stroke=1)

    pdf.setFillColor(surface)
    pdf.roundRect(card_x + 0.25 * inch, height - 2.72 * inch, card_w - 0.5 * inch, 0.92 * inch, 12, fill=1, stroke=0)
    pdf.setFillColor(navy)
    pdf.setFont("Helvetica-Bold", 15)
    pdf.drawString(card_x + 0.48 * inch, height - 2.17 * inch, propietario.nombre)
    pdf.setFont("Helvetica", 10)
    pdf.setFillColor(slate)
    pdf.drawString(
        card_x + 0.48 * inch,
        height - 2.42 * inch,
        f"Torre {propietario.torre}   Apartamento {propietario.apartamento}   Contacto {propietario.numero_contacto or 'No registrado'}",
    )

    status_w = 1.42 * inch
    pdf.setFillColor(emerald_light)
    pdf.setStrokeColor(colors.HexColor("#A7F3D0"))
    pdf.roundRect(card_x + card_w - status_w - 0.48 * inch, height - 2.38 * inch, status_w, 0.34 * inch, 8, fill=1, stroke=1)
    pdf.setFillColor(emerald)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawCentredString(card_x + card_w - 0.48 * inch - status_w / 2, height - 2.26 * inch, "AL DIA")

    # Details grid
    detail_y = height - 3.3 * inch
    detail_items = [
        ("Fecha de expedicion", today),
        ("Estado de cuenta", "Al dia"),
        ("Amenidades", "Sin suspension"),
        ("Acceso", "Habilitado"),
    ]
    col_w = (card_w - 0.84 * inch) / 2
    for idx, (label, value) in enumerate(detail_items):
        col = idx % 2
        row = idx // 2
        x = card_x + 0.42 * inch + col * col_w
        y = detail_y - row * 0.7 * inch
        pdf.setFillColor(colors.white)
        pdf.setStrokeColor(border)
        pdf.roundRect(x, y - 0.42 * inch, col_w - 0.16 * inch, 0.5 * inch, 9, fill=1, stroke=1)
        pdf.setFillColor(muted)
        pdf.setFont("Helvetica-Bold", 7)
        pdf.drawString(x + 0.16 * inch, y - 0.1 * inch, label.upper())
        pdf.setFillColor(navy)
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(x + 0.16 * inch, y - 0.28 * inch, value)

    statement_y = height - 5.05 * inch
    pdf.setFillColor(navy)
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(card_x + 0.42 * inch, statement_y, "Certificacion")
    pdf.setFillColor(slate)
    statement = (
        "La administracion certifica que el residente identificado en este documento "
        "se encuentra a paz y salvo por concepto de obligaciones administrativas "
        "registradas en el sistema a la fecha de expedicion."
    )
    draw_wrapped_text(
        pdf,
        statement,
        card_x + 0.42 * inch,
        statement_y - 0.34 * inch,
        card_w - 0.84 * inch,
        "Helvetica",
        10,
        15,
    )

    # Signature area
    signature_y = card_y + 1.48 * inch
    pdf.setStrokeColor(colors.HexColor("#CBD5E1"))
    pdf.line(card_x + 0.42 * inch, signature_y, card_x + 2.95 * inch, signature_y)
    pdf.setFillColor(navy)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(card_x + 0.42 * inch, signature_y - 0.22 * inch, "Administracion")
    pdf.setFillColor(muted)
    pdf.setFont("Helvetica", 8)
    pdf.drawString(card_x + 0.42 * inch, signature_y - 0.4 * inch, "Documento generado digitalmente")

    pdf.setFillColor(blue_light)
    pdf.setStrokeColor(colors.HexColor("#BFDBFE"))
    pdf.roundRect(card_x + card_w - 2.45 * inch, signature_y - 0.45 * inch, 2.03 * inch, 0.62 * inch, 10, fill=1, stroke=1)
    pdf.setFillColor(blue_dark)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawCentredString(card_x + card_w - 1.435 * inch, signature_y - 0.13 * inch, "VALIDO PARA TRAMITES")
    pdf.setFont("Helvetica", 8)
    pdf.drawCentredString(card_x + card_w - 1.435 * inch, signature_y - 0.31 * inch, "internos del conjunto")

    # Footer
    pdf.setStrokeColor(border)
    pdf.line(margin, 0.78 * inch, width - margin, 0.78 * inch)
    pdf.setFillColor(muted)
    pdf.setFont("Helvetica", 8)
    pdf.drawString(margin, 0.52 * inch, "Este certificado es informativo y fue emitido desde el sistema de control de acceso.")
    pdf.drawRightString(width - margin, 0.52 * inch, f"Generado: {today}")

    pdf.showPage()
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

