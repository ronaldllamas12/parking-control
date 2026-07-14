import logging
import csv
import io
import unicodedata
from typing import Optional

from app import crud, models, schemas
from app.database import get_db
from app.exceptions import AppException
from app.security import role_required
from app.services.cloudinary_service import upload_owner_photo
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

router = APIRouter(prefix="/propietarios", tags=["propietarios"])
logger = logging.getLogger(__name__)

_DEFAULT_BULK_FOTO = "https://placehold.co/200x200/2563eb/ffffff?text=P"


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

