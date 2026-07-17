import logging

from app import crud, models, schemas
from app.database import get_db
from app.security import role_required
from app.services.telegram_service import (get_bot_username, get_webhook_info,
                                           send_message_direct,
                                           set_telegram_webhook)
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

router = APIRouter(prefix="/telegram", tags=["telegram"])
logger = logging.getLogger(__name__)

_MSG_OK = (
    "✅ <b>Su cuenta quedó vinculada correctamente.</b>\n\n"
    "A partir de este momento recibirá las notificaciones del conjunto residencial."
)

_MSG_START = (
    "👋 Hola. Para vincular su cuenta escanee el código QR o presione el botón "
    "<b>Vincular Telegram</b> en el panel de administración."
)


# ── Webhook ───────────────────────────────────────────────────────────────────

@router.post("/webhook", include_in_schema=False)
async def telegram_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """Receives Telegram Bot API updates. No authentication required —
    security is provided by the single-use UUID token in the /start payload."""
    try:
        update: dict = await request.json()
    except Exception:
        return {"ok": True}

    message: dict | None = update.get("message")
    if not message:
        return {"ok": True}

    chat_id = str(message.get("chat", {}).get("id", ""))
    text: str = (message.get("text") or "").strip()

    if not chat_id or not text.startswith("/start"):
        return {"ok": True}

    parts = text.split(maxsplit=1)
    token: str | None = parts[1].strip() if len(parts) > 1 else None

    if not token:
        # Plain /start with no token — can't identify which conjunto or propietario
        return {"ok": True}

    # Locate propietario BEFORE linking so we can get the bot token even on failure
    candidate = (
        db.query(models.Propietario)
        .filter(models.Propietario.telegram_link_token == token)
        .first()
    )

    bot_token: str | None = None
    if candidate:
        conjunto = crud.get_conjunto_by_id(db, candidate.conjunto_id)
        if conjunto and conjunto.telegram_bot_token:
            bot_token = conjunto.telegram_bot_token
        elif conjunto and not conjunto.telegram_bot_token:
            logger.warning(
                "Conjunto id=%s sin telegram_bot_token configurado", candidate.conjunto_id
            )

    # Attempt the actual link
    propietario, error_msg = crud.link_telegram_by_token(db, token, chat_id)

    if bot_token:
        if propietario:
            await send_message_direct(bot_token, chat_id, _MSG_OK)
            logger.info(
                "Telegram vinculado propietario_id=%s chat_id=%s", propietario.id, chat_id
            )
        elif error_msg:
            await send_message_direct(bot_token, chat_id, f"❌ {error_msg}")
            logger.warning(
                "Vinculacion fallida token=%s...%s chat_id=%s error=%s",
                token[:6],
                token[-4:],
                chat_id,
                error_msg,
            )
    else:
        logger.warning(
            "No se encontro bot_token para responder al webhook token=%s...%s",
            token[:6],
            token[-4:],
        )

    return {"ok": True}


# ── Set webhook ───────────────────────────────────────────────────────────────

@router.post("/set-webhook")
async def configurar_webhook(
    payload: schemas.TelegramSetWebhookIn,
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    """Register our webhook URL with Telegram for the conjunto's bot.

    ``base_url`` should be the public root URL of this API
    (e.g. ``https://my-api.onrender.com``).  The path
    ``/api/v1/telegram/webhook`` is appended automatically.
    """
    conjunto = crud.get_conjunto_by_id(db, current_user.conjunto_id)
    if not conjunto:
        raise HTTPException(status_code=404, detail="Conjunto no encontrado")
    if not conjunto.telegram_bot_token:
        raise HTTPException(
            status_code=400,
            detail="El conjunto no tiene un token de bot Telegram configurado",
        )

    webhook_url = payload.base_url.rstrip("/") + "/api/v1/telegram/webhook"

    try:
        result = await set_telegram_webhook(conjunto.telegram_bot_token, webhook_url)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if not result.get("ok"):
        raise HTTPException(
            status_code=502,
            detail=f"Telegram rechazó el webhook: {result.get('description', 'error desconocido')}",
        )

    logger.info(
        "Webhook configurado conjunto_id=%s url=%s", current_user.conjunto_id, webhook_url
    )
    return {"ok": True, "webhook_url": webhook_url, "description": result.get("description")}


# ── Webhook info (diagnóstico) ────────────────────────────────────────────────

@router.get("/webhook-info")
async def info_webhook(
    current_user=Depends(role_required(["admin"])),
    db: Session = Depends(get_db),
):
    """Return current webhook configuration from Telegram (diagnostic)."""
    conjunto = crud.get_conjunto_by_id(db, current_user.conjunto_id)
    if not conjunto:
        raise HTTPException(status_code=404, detail="Conjunto no encontrado")
    if not conjunto.telegram_bot_token:
        raise HTTPException(
            status_code=400,
            detail="El conjunto no tiene un token de bot Telegram configurado",
        )

    try:
        info = await get_webhook_info(conjunto.telegram_bot_token)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    result = info.get("result", {})
    webhook_url = result.get("url", "")
    pending = result.get("pending_update_count", 0)
    last_error = result.get("last_error_message")
    last_error_date = result.get("last_error_date")

    return {
        "webhook_configurado": bool(webhook_url),
        "webhook_url": webhook_url or None,
        "pending_updates": pending,
        "last_error": last_error,
        "last_error_date": last_error_date,
        "raw": result,
    }
