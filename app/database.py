from typing import Generator

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker, with_loader_criteria

from app.config import get_settings

settings = get_settings()

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _tenant_scoped_classes():
    from app.models import HistorialAcceso, HuellaDigital, Propietario

    return (Propietario, HistorialAcceso, HuellaDigital)


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
