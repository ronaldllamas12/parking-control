"""add salones sociales

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-02

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "salones_sociales",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("conjunto_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nombre", sa.String(length=120), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("capacidad", sa.Integer(), server_default="0", nullable=False),
        sa.Column("imagen_url", sa.String(length=500), nullable=True),
        sa.Column("estado", sa.String(length=20), server_default="activo", nullable=False),
        sa.Column("color_calendario", sa.String(length=20), server_default="#0f766e", nullable=False),
        sa.Column("precio_sin_aseo_centavos", sa.BigInteger(), server_default="13000000", nullable=False),
        sa.Column("precio_con_aseo_centavos", sa.BigInteger(), server_default="16000000", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("estado IN ('activo', 'inactivo')", name="ck_salones_sociales_estado"),
        sa.ForeignKeyConstraint(["conjunto_id"], ["conjuntos_residenciales.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("conjunto_id", "nombre", name="uq_salones_sociales_conjunto_nombre"),
    )
    op.create_index(op.f("ix_salones_sociales_id"), "salones_sociales", ["id"])
    op.create_index(op.f("ix_salones_sociales_conjunto_id"), "salones_sociales", ["conjunto_id"])
    op.create_index(op.f("ix_salones_sociales_nombre"), "salones_sociales", ["nombre"])
    op.create_index(op.f("ix_salones_sociales_estado"), "salones_sociales", ["estado"])

    op.create_table(
        "salones_sociales_reservas",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("conjunto_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("salon_id", sa.Integer(), nullable=False),
        sa.Column("propietario_id", sa.Integer(), nullable=True),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("active_slot_key", sa.String(length=10), nullable=True),
        sa.Column("tipo", sa.String(length=20), nullable=False),
        sa.Column("estado", sa.String(length=30), nullable=False),
        sa.Column("incluye_aseo", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("precio_centavos", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("pago_estado", sa.String(length=20), server_default="pendiente", nullable=False),
        sa.Column("comprobante_url", sa.String(length=500), nullable=True),
        sa.Column("referencia_pago", sa.String(length=120), nullable=True),
        sa.Column("notas", sa.String(length=500), nullable=True),
        sa.Column("cancel_reason", sa.String(length=255), nullable=True),
        sa.Column("created_by", sa.String(length=50), nullable=True),
        sa.Column("approved_by", sa.String(length=50), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("tipo IN ('reserva', 'bloqueo')", name="ck_salones_reservas_tipo"),
        sa.CheckConstraint(
            "estado IN ('pendiente_pago', 'pendiente_aprobacion', 'confirmado', 'cancelado', 'no_disponible', 'mantenimiento', 'evento_privado')",
            name="ck_salones_reservas_estado",
        ),
        sa.CheckConstraint(
            "pago_estado IN ('pendiente', 'reportado', 'validado', 'rechazado')",
            name="ck_salones_reservas_pago_estado",
        ),
        sa.ForeignKeyConstraint(["conjunto_id"], ["conjuntos_residenciales.id"]),
        sa.ForeignKeyConstraint(["propietario_id"], ["propietarios.id"]),
        sa.ForeignKeyConstraint(["salon_id"], ["salones_sociales.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("salon_id", "active_slot_key", name="uq_salones_reservas_slot_activo"),
    )
    op.create_index(op.f("ix_salones_sociales_reservas_id"), "salones_sociales_reservas", ["id"])
    op.create_index(op.f("ix_salones_sociales_reservas_conjunto_id"), "salones_sociales_reservas", ["conjunto_id"])
    op.create_index(op.f("ix_salones_sociales_reservas_salon_id"), "salones_sociales_reservas", ["salon_id"])
    op.create_index(op.f("ix_salones_sociales_reservas_propietario_id"), "salones_sociales_reservas", ["propietario_id"])
    op.create_index(op.f("ix_salones_sociales_reservas_fecha"), "salones_sociales_reservas", ["fecha"])
    op.create_index(op.f("ix_salones_sociales_reservas_active_slot_key"), "salones_sociales_reservas", ["active_slot_key"])
    op.create_index(op.f("ix_salones_sociales_reservas_tipo"), "salones_sociales_reservas", ["tipo"])
    op.create_index(op.f("ix_salones_sociales_reservas_estado"), "salones_sociales_reservas", ["estado"])
    op.create_index(op.f("ix_salones_sociales_reservas_pago_estado"), "salones_sociales_reservas", ["pago_estado"])
    op.create_index(op.f("ix_salones_sociales_reservas_created_at"), "salones_sociales_reservas", ["created_at"])


def downgrade() -> None:
    op.drop_index(op.f("ix_salones_sociales_reservas_created_at"), table_name="salones_sociales_reservas")
    op.drop_index(op.f("ix_salones_sociales_reservas_pago_estado"), table_name="salones_sociales_reservas")
    op.drop_index(op.f("ix_salones_sociales_reservas_estado"), table_name="salones_sociales_reservas")
    op.drop_index(op.f("ix_salones_sociales_reservas_tipo"), table_name="salones_sociales_reservas")
    op.drop_index(op.f("ix_salones_sociales_reservas_active_slot_key"), table_name="salones_sociales_reservas")
    op.drop_index(op.f("ix_salones_sociales_reservas_fecha"), table_name="salones_sociales_reservas")
    op.drop_index(op.f("ix_salones_sociales_reservas_propietario_id"), table_name="salones_sociales_reservas")
    op.drop_index(op.f("ix_salones_sociales_reservas_salon_id"), table_name="salones_sociales_reservas")
    op.drop_index(op.f("ix_salones_sociales_reservas_conjunto_id"), table_name="salones_sociales_reservas")
    op.drop_index(op.f("ix_salones_sociales_reservas_id"), table_name="salones_sociales_reservas")
    op.drop_table("salones_sociales_reservas")

    op.drop_index(op.f("ix_salones_sociales_estado"), table_name="salones_sociales")
    op.drop_index(op.f("ix_salones_sociales_nombre"), table_name="salones_sociales")
    op.drop_index(op.f("ix_salones_sociales_conjunto_id"), table_name="salones_sociales")
    op.drop_index(op.f("ix_salones_sociales_id"), table_name="salones_sociales")
    op.drop_table("salones_sociales")
