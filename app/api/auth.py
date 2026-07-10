import base64
import logging
import os
from datetime import timedelta
from typing import Dict

from app import schemas
from app.config import get_settings
from app.database import get_db
from app.exceptions import AppException
from app.models import User, WebAuthnChallenge, WebAuthnCredential
from app.schemas import (WebAuthnAssertionOptions, WebAuthnAssertionVerifyIn,
                         WebAuthnRegisterOptions, WebAuthnRegisterVerifyIn)
from app.security import authenticate_user, create_access_token
from fastapi import APIRouter, Body, Depends, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

try:
    import pickle

    from fido2 import cbor
    from fido2.server import Fido2Server
    from fido2.utils import websafe_decode, websafe_encode
    from fido2.webauthn import (PublicKeyCredentialRpEntity,
                                PublicKeyCredentialUserEntity)
except Exception:
    Fido2Server = None  # type: ignore

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()
logger = logging.getLogger(__name__)

# Challenge persistence uses DB table WebAuthnChallenge


def _base64url(b: bytes | str) -> str:
    # accept bytes or already-encoded str
    if isinstance(b, (bytes, bytearray)):
        res = websafe_encode(b)
        return res.decode('utf-8') if isinstance(res, (bytes, bytearray)) else res
    if isinstance(b, str):
        return b
    # fallback
    res = websafe_encode(bytes(b))
    return res.decode('utf-8') if isinstance(res, (bytes, bytearray)) else res


def _ensure_bytes_from_b64(u: str) -> bytes:
    # websafe_decode returns bytes if available
    try:
        return websafe_decode(u)
    except Exception:
        # fallback
        rem = len(u) % 4
        if rem:
            u += "=" * (4 - rem)
        return base64.urlsafe_b64decode(u)


@router.post("/token", response_model=schemas.Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        logger.warning("Login fallido para usuario=%s", form_data.username)
        raise AppException(status_code=401, detail="Usuario o contrasena incorrectos")

    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires,
    )
    logger.info("Login exitoso usuario=%s role=%s", user.username, user.role)
    return schemas.Token(access_token=access_token)


@router.post("/webauthn/assertion/options", response_model=WebAuthnAssertionOptions)
def webauthn_assertion_options(payload: dict = Body(...), db: Session = Depends(get_db), request: Request = None):
    if Fido2Server is None:
        raise AppException(status_code=500, detail="WebAuthn server library not installed")

    username = payload.get("username")
    if not username:
        raise AppException(status_code=400, detail="username required")

    # Ensure user exists
    user = db.query(User).filter_by(username=username).first()
    if not user:
        raise AppException(status_code=404, detail="Usuario no encontrado")

    if Fido2Server is None:
        raise AppException(status_code=500, detail="WebAuthn server library not installed")

    rp = PublicKeyCredentialRpEntity(name="Control de Acceso", id=(request.url.hostname if request else "localhost"))
    server = Fido2Server(rp)

    # Build registered keys list
    rows = db.query(WebAuthnCredential).filter_by(user_id=user.id).all()
    registered = []
    allow = []
    for r in rows:
        cred_id_bytes = _ensure_bytes_from_b64(r.credential_id)
        registered.append({"type": "public-key", "id": cred_id_bytes})
        allow.append({"type": "public-key", "id": _base64url(cred_id_bytes)})

    options, state = server.authenticate_begin(registered)

    # persist state as CBOR in DB
    # Persist internal state using pickle (handles None and enums)
    state_bytes = pickle.dumps(state)
    # upsert challenge/state
    existing = db.query(WebAuthnChallenge).filter_by(username=username).first()
    if existing:
        existing.state = state_bytes
    else:
        nc = WebAuthnChallenge(username=username, state=state_bytes)
        db.add(nc)
    db.commit()

    # Convert options.challenge to base64url for frontend
    # `options` is a CredentialRequestOptions object with a `public_key` field
    pk = options.public_key

    resp: dict = {
        "challenge": _base64url(pk.challenge),
        "timeout": pk.timeout,
        "rpId": pk.rp_id,
        "userVerification": None if pk.user_verification is None else str(pk.user_verification),
    }

    if pk.allow_credentials:
        allow_creds = []
        for c in pk.allow_credentials:
            # c.id is bytes
            allow_creds.append({"type": "public-key", "id": _base64url(c.id)})
        resp["allowCredentials"] = allow_creds

    return WebAuthnAssertionOptions(**resp)


@router.post("/webauthn/assertion/verify", response_model=schemas.Token)
def webauthn_assertion_verify(body: WebAuthnAssertionVerifyIn, db: Session = Depends(get_db), request: Request = None):
    if Fido2Server is None:
        raise AppException(status_code=500, detail="WebAuthn server library not installed")

    # Lookup credential by rawId (rawId is base64url in client)
    try:
        raw_id_bytes = _ensure_bytes_from_b64(body.rawId)
    except Exception:
        raise AppException(status_code=400, detail="rawId inválido")

    cred = db.query(WebAuthnCredential).filter_by(credential_id=_base64url(raw_id_bytes)).first()
    if not cred:
        raise AppException(status_code=404, detail="Credential not found")

    # Retrieve stored state
    chal = db.query(WebAuthnChallenge).filter_by(username=db.query(User).filter(User.id == cred.user_id).first().username).first()
    if not chal:
        raise AppException(status_code=400, detail="No challenge/state for user")
    try:
        state = pickle.loads(chal.state)
    except Exception:
        raise AppException(status_code=400, detail="Invalid stored state")

    rp = PublicKeyCredentialRpEntity(name="Control de Acceso", id=(request.url.hostname if request else "localhost"))
    server = Fido2Server(rp)

    # Extract client response bytes
    client_data = _ensure_bytes_from_b64(body.response.get("clientDataJSON"))
    authenticator_data = _ensure_bytes_from_b64(body.response.get("authenticatorData"))
    signature = _ensure_bytes_from_b64(body.response.get("signature"))

    # Build credential list for verification
    # fido2 expects a list of credential sources with id and public_key
    try:
        stored_pubkey = _ensure_bytes_from_b64(cred.public_key)
    except Exception:
        stored_pubkey = cred.public_key.encode()

    sources = [
        {
            "credential_id": _ensure_bytes_from_b64(cred.credential_id),
            "public_key": stored_pubkey,
            "sign_count": cred.sign_count,
        }
    ]

    try:
        auth_data = server.authenticate_complete(state, sources, client_data, authenticator_data, signature)
    except Exception as e:
        logger.exception("WebAuthn authenticate failed: %s", e)
        raise AppException(status_code=400, detail="Autenticacion WebAuthn fallida")

    # Update sign_count in DB if available
    try:
        new_count = auth_data.get("sign_count") if isinstance(auth_data, dict) else None
        if new_count is not None:
            cred.sign_count = new_count
            db.add(cred)
            db.commit()
    except Exception:
        db.rollback()

    # Issue token
    user = db.query(User).filter_by(id=cred.user_id).first()
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires,
    )

    # remove stored state
    try:
        db.delete(chal)
        db.commit()
    except Exception:
        db.rollback()

    return schemas.Token(access_token=access_token)


@router.post("/webauthn/register/options", response_model=WebAuthnRegisterOptions)
def webauthn_register_options(payload: dict = Body(...), db: Session = Depends(get_db), request: Request = None):
    if Fido2Server is None:
        raise AppException(status_code=500, detail="WebAuthn server library not installed")

    username = payload.get("username")
    if not username:
        raise AppException(status_code=400, detail="username required")

    user = db.query(User).filter_by(username=username).first()
    if not user:
        raise AppException(status_code=404, detail="Usuario no encontrado")

    rp = PublicKeyCredentialRpEntity(request.url.hostname if request else "localhost", "Control de Acceso")
    server = Fido2Server(rp)

    user_entity = PublicKeyCredentialUserEntity(id=str(user.id).encode("utf-8"), name=user.username, display_name=user.username)
    options, state = server.register_begin(user_entity, credentials=[])

    state_bytes = pickle.dumps(state)
    existing = db.query(WebAuthnChallenge).filter_by(username=username).first()
    if existing:
        existing.state = state_bytes
    else:
        db.add(WebAuthnChallenge(username=username, state=state_bytes))
    db.commit()

    # options is a PublicKeyCredentialCreationOptions wrapper with `public_key`
    pk = options.public_key

    resp: dict = {
        "challenge": _base64url(pk.challenge),
        "rp": {"name": pk.rp.name, "id": pk.rp.id},
        "user": {"id": _base64url(pk.user.id), "name": pk.user.name, "displayName": pk.user.display_name},
        "pubKeyCredParams": pk.pub_key_cred_params,
        "timeout": pk.timeout,
        "attestation": getattr(pk, "attestation", None),
    }

    if getattr(pk, "exclude_credentials", None):
        excl = []
        for c in pk.exclude_credentials:
            excl.append({"type": "public-key", "id": _base64url(c.id)})
        resp["excludeCredentials"] = excl

    return WebAuthnRegisterOptions(**resp)


@router.post("/webauthn/register/verify", response_model=schemas.Token)
def webauthn_register_verify(body: WebAuthnRegisterVerifyIn, db: Session = Depends(get_db), request: Request = None):
    if Fido2Server is None:
        raise AppException(status_code=500, detail="WebAuthn server library not installed")

    username = body.username
    if not username:
        raise AppException(status_code=400, detail="username required")

    chal = db.query(WebAuthnChallenge).filter_by(username=username).first()
    if not chal:
        raise AppException(status_code=400, detail="No challenge for user")
    try:
        state = pickle.loads(chal.state)
    except Exception:
        raise AppException(status_code=400, detail="Invalid stored state")

    rp = PublicKeyCredentialRpEntity(request.url.hostname if request else "localhost", "Control de Acceso")
    server = Fido2Server(rp)

    client_data = _ensure_bytes_from_b64(body.response.get("clientDataJSON"))
    att_obj = _ensure_bytes_from_b64(body.response.get("attestationObject"))

    try:
        reg_res = server.register_complete(state, client_data, att_obj)
    except Exception as e:
        logger.exception("WebAuthn register failed: %s", e)
        raise AppException(status_code=400, detail="Registro WebAuthn fallido")

    # reg_res typically contains credential_data with id, public_key, sign_count
    cred_data = reg_res.credential_data
    credential_id_b64 = _base64url(cred_data.credential_id)
    # store public_key as cbor-encoded bytes
    try:
        pubkey_cbor = cbor.encode(cred_data.credential_public_key)
    except Exception:
        pubkey_cbor = cbor.encode(cred_data.credential_public_key.__dict__)

    new_cred = WebAuthnCredential(user_id=db.query(User).filter_by(username=username).first().id, credential_id=credential_id_b64, public_key=_base64url(pubkey_cbor), sign_count=cred_data.sign_count)
    db.add(new_cred)
    # remove challenge
    db.delete(chal)
    db.commit()

    # Issue token after successful registration
    user = db.query(User).filter_by(username=username).first()
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires,
    )
    return schemas.Token(access_token=access_token)
