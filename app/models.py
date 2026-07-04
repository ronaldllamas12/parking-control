from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    username: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, index=True)


class Propietario(Base):
    __tablename__ = "propietarios"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    uid: Mapped[str] = mapped_column(
        String(16), unique=True, nullable=False, index=True
    )
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    numero_contacto: Mapped[str | None] = mapped_column(String(30), nullable=True)
    torre: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    apartamento: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    foto_url: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    accesos: Mapped[list["HistorialAcceso"]] = relationship(
        back_populates="propietario", cascade="all, delete-orphan"
    )


class HistorialAcceso(Base):
    __tablename__ = "historial_accesos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    propietario_id: Mapped[int] = mapped_column(
        ForeignKey("propietarios.id"), nullable=False, index=True
    )
    propietario_uid: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    vigilante_username: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True
    )
    fecha_hora: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    propietario: Mapped[Propietario] = relationship(back_populates="accesos")
