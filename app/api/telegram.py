import logging
from html import escape

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

_MENU_MARKUP = {
    "keyboard": [["Administración", "Vigilante"]],
    "resize_keyboard": True,
    "one_time_keyboard": False,
}

_DESTINATION_LABELS = {
    "admin": "administración",
    "vigilante": "vigilante",
}

_active_destinations: dict[str, str] = {}


def _destination_from_text(text: str) -> str | None:
    normalized = text.strip().lower()
    if normalized in {"administracion", "administración", "admin", "/admin"}:
        return "admin"
    if normalized in {"vigilante", "guardia", "/vigilante"}:
        return "vigilante"
    return None


async def _send_owner_menu(bot_token: str, chat_id: str, prefix: str | None = None) -> None:
    text = prefix or "Seleccione con quién quiere hablar:"
    await send_message_direct(bot_token, chat_id, text, reply_markup=_MENU_MARKUP)


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
    text = (message.get("text") or "").strip()
    
    logger.info("Texto recibido: %s", text)
    logger.info("Chat ID: %s", chat_id)
    
    if not chat_id:
        return {"ok": True}

    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        token = parts[1].strip() if len(parts) > 1 else None

        if not token:
            propietario = crud.get_propietario_by_telegram_chat_id(db, chat_id)
            if propietario:
                conjunto = crud.get_conjunto_by_id(db, propietario.conjunto_id)
                if conjunto and conjunto.telegram_bot_token:
                    await _send_owner_menu(conjunto.telegram_bot_token, chat_id)
            return {"ok": True}

        logger.info("Token recibido: %s", token)

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
                await _send_owner_menu(
                    bot_token,
                    chat_id,
                    "Ahora seleccione con quién quiere hablar:",
                )
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

    propietario = crud.get_propietario_by_telegram_chat_id(db, chat_id)
    if not propietario:
        return {"ok": True}

    conjunto = crud.get_conjunto_by_id(db, propietario.conjunto_id)
    if not conjunto or not conjunto.telegram_bot_token:
        logger.warning("Propietario id=%s sin bot token asociado", propietario.id)
        return {"ok": True}

    destination = _destination_from_text(text)
    if destination:
        _active_destinations[chat_id] = destination
        crud.get_or_create_telegram_conversation(db, propietario, destination)
        await send_message_direct(
            conjunto.telegram_bot_token,
            chat_id,
            f"Escriba su mensaje para {_DESTINATION_LABELS[destination]}.",
            reply_markup=_MENU_MARKUP,
        )
        return {"ok": True}

    destination = _active_destinations.get(chat_id)
    if not destination:
        await _send_owner_menu(conjunto.telegram_bot_token, chat_id)
        return {"ok": True}

    conversation = crud.get_or_create_telegram_conversation(db, propietario, destination)
    crud.add_telegram_message(
        db,
        conversation,
        sender_role="propietario",
        text_value=text,
        read_by_staff=False,
    )
    await send_message_direct(
        conjunto.telegram_bot_token,
        chat_id,
        f"Mensaje enviado a {_DESTINATION_LABELS[destination]}.",
        reply_markup=_MENU_MARKUP,
    )
    return {"ok": True}


@router.get(
    "/conversaciones",
    response_model=list[schemas.TelegramConversationOut],
)
def listar_conversaciones(
    current_user=Depends(role_required(["admin", "vigilante"])),
    db: Session = Depends(get_db),
):
    return crud.list_telegram_conversations(
        db,
        conjunto_id=current_user.conjunto_id,
        destino_role=current_user.role,
    )


@router.get(
    "/conversaciones/{conversation_id}",
    response_model=schemas.TelegramConversationDetailOut,
)
def obtener_conversacion(
    conversation_id: int,
    current_user=Depends(role_required(["admin", "vigilante"])),
    db: Session = Depends(get_db),
):
    conversation = crud.get_telegram_conversation(
        db,
        conversation_id=conversation_id,
        conjunto_id=current_user.conjunto_id,
        destino_role=current_user.role,
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    return crud.get_telegram_conversation_detail(db, conversation)


@router.post(
    "/conversaciones/{conversation_id}/responder",
    response_model=schemas.TelegramMessageOut,
)
async def responder_conversacion(
    conversation_id: int,
    payload: schemas.TelegramConversationReplyIn,
    current_user=Depends(role_required(["admin", "vigilante"])),
    db: Session = Depends(get_db),
):
    conversation = crud.get_telegram_conversation(
        db,
        conversation_id=conversation_id,
        conjunto_id=current_user.conjunto_id,
        destino_role=current_user.role,
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")

    propietario = conversation.propietario
    if not propietario.telegram_chat_id:
        raise HTTPException(status_code=400, detail="El propietario no tiene Telegram vinculado")

    conjunto = crud.get_conjunto_by_id(db, current_user.conjunto_id)
    if not conjunto or not conjunto.telegram_bot_token:
        raise HTTPException(status_code=400, detail="El conjunto no tiene token de bot Telegram configurado")

    label = "Administración" if current_user.role == "admin" else "Vigilante"
    sent = await send_message_direct(
        conjunto.telegram_bot_token,
        propietario.telegram_chat_id,
        f"<b>{label}:</b>\n{escape(payload.mensaje)}",
        reply_markup=_MENU_MARKUP,
    )
    if not sent:
        raise HTTPException(status_code=502, detail="No se pudo enviar el mensaje por Telegram")

    return crud.add_telegram_message(
        db,
        conversation,
        sender_role=current_user.role,
        sender_username=current_user.username,
        text_value=payload.mensaje,
        read_by_staff=True,
    )


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
