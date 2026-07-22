import asyncio
import json
import logging
from urllib import error as urllib_error
from urllib import request

from app import models
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# ── Internal helpers ──────────────────────────────────────────────────────────

_TELEGRAM_API = "https://api.telegram.org/bot{token}/{method}"

# Simple in-process cache to avoid hammering getMe for every link generation
_bot_username_cache: dict[str, str] = {}


def _tg_url(token: str, method: str) -> str:
    return _TELEGRAM_API.format(token=token, method=method)


def _do_post(url: str, payload: dict) -> dict:
    """Synchronous helper — run inside asyncio.to_thread."""
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with request.urlopen(req, timeout=8) as resp:
        return json.loads(resp.read())


def _do_get(url: str) -> dict:
    req = request.Request(url, method="GET")
    with request.urlopen(req, timeout=8) as resp:
        return json.loads(resp.read())


# ── Public async API ──────────────────────────────────────────────────────────

async def get_bot_username(bot_token: str) -> str | None:
    """Return the bot's @username via getMe, with in-process caching."""
    if bot_token in _bot_username_cache:
        return _bot_username_cache[bot_token]

    def _fetch() -> str | None:
        try:
            result = _do_get(_tg_url(bot_token, "getMe"))
            return result.get("result", {}).get("username")
        except Exception:
            return None

    username = await asyncio.to_thread(_fetch)
    if username:
        _bot_username_cache[bot_token] = username
    return username


async def send_message_direct(
    bot_token: str,
    chat_id: str | int,
    text: str,
    parse_mode: str = "HTML",
    reply_markup: dict | None = None,
) -> bool:
    """Send a plain text message to a chat using a specific bot token."""
    payload = {"chat_id": chat_id, "text": text, "parse_mode": parse_mode}
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup

    def _send() -> None:
        _do_post(_tg_url(bot_token, "sendMessage"), payload)

    try:
        await asyncio.to_thread(_send)
        return True
    except Exception:
        logger.exception(
            "Error sending Telegram message bot=...%s chat_id=%s",
            bot_token[-6:],
            chat_id,
        )
        return False


async def set_telegram_webhook(
    bot_token: str,
    webhook_url: str,
    secret_token: str | None = None,
) -> dict:
    """Register a webhook URL with Telegram for the given bot token."""
    payload: dict = {"url": webhook_url, "allowed_updates": ["message"]}
    if secret_token:
        payload["secret_token"] = secret_token

    def _call() -> dict:
        return _do_post(_tg_url(bot_token, "setWebhook"), payload)

    try:
        return await asyncio.to_thread(_call)
    except Exception as exc:
        logger.exception("Error setting Telegram webhook")
        raise RuntimeError(f"Telegram setWebhook failed: {exc}") from exc


async def get_webhook_info(bot_token: str) -> dict:
    """Return current webhook info via getWebhookInfo."""
    def _call() -> dict:
        return _do_get(_tg_url(bot_token, "getWebhookInfo"))

    try:
        return await asyncio.to_thread(_call)
    except Exception as exc:
        logger.exception("Error getting Telegram webhook info")
        raise RuntimeError(f"Telegram getWebhookInfo failed: {exc}") from exc


# ── Existing notification helper (unchanged) ──────────────────────────────────

async def enviar_notificacion_telegram(
    db: Session, propietario_id: int, mensaje: str
) -> bool:
    query = db.query(models.Propietario).filter(models.Propietario.id == propietario_id)
    current_conjunto_id = db.info.get("conjunto_id")
    if current_conjunto_id:
        query = query.filter(models.Propietario.conjunto_id == current_conjunto_id)

    propietario = query.first()
    if not propietario or not propietario.telegram_chat_id:
        return False

    conjunto = (
        db.query(models.ConjuntoResidencial)
        .filter(models.ConjuntoResidencial.id == propietario.conjunto_id)
        .first()
    )
    if not conjunto or not conjunto.telegram_bot_token:
        return False

    return await send_message_direct(
        conjunto.telegram_bot_token,
        propietario.telegram_chat_id,
        mensaje,
    )
