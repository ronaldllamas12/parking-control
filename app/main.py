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

app = FastAPI(title="API Parqueadero", version="1.0.0")
register_exception_handlers(app)

# ── CORS ─────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list or ["http://localhost:5173"],
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
