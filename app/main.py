import logging

from app import crud
from app.api import (acceso, admin, auth, propietarios, registros_acceso,
                     superadmin, telegram, zonas)
from app.config import get_settings
from app.database import SessionLocal
from app.exceptions import register_exception_handlers
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

settings = get_settings()


def _normalize_origins(origins: list[str]) -> list[str]:
    # FastAPI CORS expects exact origin match; remove trailing slashes to avoid mismatches.
    return [origin.rstrip("/") for origin in origins if origin.strip()]

app = FastAPI(title="API Parqueadero", version="1.0.0")
register_exception_handlers(app)

default_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://parking-control-pied.vercel.app",
]
allowed_origins = _normalize_origins(settings.cors_origins_list or default_origins)

# ── CORS ─────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https://[a-zA-Z0-9-]+\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── ROUTERS CON PREFIJO GLOBAL ───────────────────────
app.include_router(auth.router, prefix="/api/v1")
app.include_router(superadmin.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(zonas.router, prefix="/api/v1")
app.include_router(propietarios.router, prefix="/api/v1")
app.include_router(registros_acceso.router, prefix="/api/v1")
app.include_router(acceso.router, prefix="/api/v1")
app.include_router(telegram.router, prefix="/api/v1")


@app.on_event("startup")
def ensure_superadmin_user() -> None:
    if not settings.superadmin_password:
        return

    db = SessionLocal()
    try:
        existing = crud.get_user_by_username(db, settings.superadmin_username)
        if not existing:
            crud.create_user(
                db,
                username=settings.superadmin_username,
                password=settings.superadmin_password,
                role="superadmin",
                conjunto_id=None,
            )
            logging.info("Super Admin inicial creado usuario=%s", settings.superadmin_username)
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "API funcionando 🚀"}
