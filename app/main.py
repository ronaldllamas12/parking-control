import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, propietarios, acceso
from app.config import get_settings
from app.exceptions import register_exception_handlers

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
app.include_router(propietarios.router, prefix="/api/v1")
app.include_router(acceso.router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "API funcionando 🚀"}
