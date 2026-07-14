from datetime import datetime, timedelta, timezone
from typing import Annotated, Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import bcrypt as _bcrypt
from jose import JWTError, jwt
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import crud, schemas
from app.config import get_settings
from app.database import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")
settings = get_settings()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return _bcrypt.checkpw(plain_password.encode(), hashed_password.encode())


def get_password_hash(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def authenticate_user(db: Session, username: str, password: str):
    user = crud.get_user_by_username(db, username=username)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if user.role != "superadmin" and (user.conjunto is None or not user.conjunto.activo):
        return None
    return user


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.algorithm)


def _credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autorizado",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.algorithm]
        )
        username: str | None = payload.get("sub")
        role: str | None = payload.get("role")
        conjunto_id = payload.get("conjunto_id")
        if username is None or role is None:
            raise _credentials_exception()
        token_data = schemas.TokenData(
            username=username, role=role, conjunto_id=conjunto_id
        )
    except JWTError as exc:
        raise _credentials_exception() from exc

    user = crud.get_user_by_username(db, username=token_data.username)
    if user is None:
        raise _credentials_exception()
    if user.role != token_data.role:
        raise _credentials_exception()
    if user.role != "superadmin":
        if user.conjunto_id is None:
            raise _credentials_exception()
        if user.conjunto is None or not user.conjunto.activo:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Conjunto residencial inactivo",
            )
        if str(user.conjunto_id) != str(token_data.conjunto_id):
            raise _credentials_exception()
        db.info["conjunto_id"] = user.conjunto_id
        db.execute(
            text("SELECT set_config('app.current_conjunto_id', :conjunto_id, false)"),
            {"conjunto_id": str(user.conjunto_id)},
        )
    else:
        db.execute(
            text("SELECT set_config('app.current_conjunto_id', 'superadmin', false)")
        )
    return user


def role_required(allowed_roles: list[str]) -> Callable:
    def dependency(user=Depends(get_current_user)):
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=403, detail="No tienes permisos para esta operacion"
            )
        if user.role != "superadmin" and user.conjunto_id is None:
            raise HTTPException(status_code=403, detail="Usuario sin conjunto asignado")
        return user

    return dependency
