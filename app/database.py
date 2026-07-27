from typing import Generator

from app.config import get_settings
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import (Session, declarative_base, sessionmaker,
                            with_loader_criteria)

settings = get_settings()

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    pool_timeout=10,          # fail fast if no connection is available in 10 s
    pool_recycle=1800,        # recycle connections every 30 min
    connect_args={"connect_timeout": 10},  # TCP-level connect timeout
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _tenant_scoped_classes():
    from app.models import (AlertaFinanciera, ComprobantePago,
                            ConceptoMovimiento, ConfigFinanciera,
                            HistorialAcceso, HuellaDigital, MovimientoCaja,
                            MovimientoCartera, Propietario,
                            TelegramConversation, TelegramMessage, ZonaAcceso)

    return (
        Propietario,
        HistorialAcceso,
        HuellaDigital,
        ZonaAcceso,
        ConfigFinanciera,
        ConceptoMovimiento,
        MovimientoCartera,
        MovimientoCaja,
        AlertaFinanciera,
        ComprobantePago,
        TelegramConversation,
        TelegramMessage,
    )


@event.listens_for(Session, "do_orm_execute")
def _add_tenant_criteria(execute_state):
    if not execute_state.is_select:
        return

    conjunto_id = execute_state.session.info.get("conjunto_id")
    if not conjunto_id:
        return

    options = [
        with_loader_criteria(
            model,
            lambda cls: cls.conjunto_id == conjunto_id,
            include_aliases=True,
        )
        for model in _tenant_scoped_classes()
    ]
    execute_state.statement = execute_state.statement.options(*options)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        try:
            db.rollback()
            db.execute(text("SELECT set_config('app.current_conjunto_id', '', false)"))
            db.commit()
        except Exception:
            pass
        db.close()
