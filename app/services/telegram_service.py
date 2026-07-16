import asyncio
import json
import logging
from urllib import request

from app import models
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


async def enviar_notificacion_telegram(
    db: Session, propietario_id: int, mensaje: str
) -> None:
    query = db.query(models.Propietario).filter(models.Propietario.id == propietario_id)
    current_conjunto_id = db.info.get("conjunto_id")
    if current_conjunto_id:
        query = query.filter(models.Propietario.conjunto_id == current_conjunto_id)

    propietario = query.first()
    if not propietario or not propietario.telegram_chat_id:
        return

    conjunto = (
        db.query(models.ConjuntoResidencial)
        .filter(models.ConjuntoResidencial.id == propietario.conjunto_id)
        .first()
    )
    if not conjunto or not conjunto.telegram_bot_token:
        return

    payload = json.dumps(
        {"chat_id": propietario.telegram_chat_id, "text": mensaje}
    ).encode("utf-8")
    telegram_request = request.Request(
        f"https://api.telegram.org/bot{conjunto.telegram_bot_token}/sendMessage",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    def _send() -> None:
        with request.urlopen(telegram_request, timeout=8) as response:
            response.read()

    try:
        await asyncio.to_thread(_send)
    except Exception:
        logger.exception(
            "No se pudo enviar notificacion Telegram propietario_id=%s conjunto_id=%s",
            propietario.id,
            propietario.conjunto_id,
        )
