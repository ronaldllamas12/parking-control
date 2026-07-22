"""add finanzas module

Revision ID: 0011
Revises: 0010
Create Date: 2026-07-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "config_financiera",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("conjunto_id", sa.UUID(), sa.ForeignKey("conjuntos_residenciales.id"), nullable=False),
        sa.Column("cuota_mensual_centavos", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("dia_vencimiento", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_config_financiera_id", "config_financiera", ["id"])
    op.create_index("ix_config_financiera_conjunto_id", "config_financiera", ["conjunto_id"], unique=True)

    op.create_table(
        "concepto_movimiento",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("conjunto_id", sa.UUID(), sa.ForeignKey("conjuntos_residenciales.id"), nullable=False),
        sa.Column("nombre", sa.String(length=80), nullable=False),
        sa.Column("tipo", sa.String(length=20), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "tipo IN ('cargo', 'abono', 'ingreso', 'egreso')",
            name="ck_concepto_movimiento_tipo",
        ),
        sa.UniqueConstraint("conjunto_id", "nombre", "tipo", name="uq_concepto_conjunto_nombre_tipo"),
    )
    op.create_index("ix_concepto_movimiento_id", "concepto_movimiento", ["id"])
    op.create_index("ix_concepto_movimiento_conjunto_id", "concepto_movimiento", ["conjunto_id"])
    op.create_index("ix_concepto_movimiento_tipo", "concepto_movimiento", ["tipo"])
    op.create_index("ix_concepto_movimiento_activo", "concepto_movimiento", ["activo"])

    op.create_table(
        "movimiento_cartera",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("conjunto_id", sa.UUID(), sa.ForeignKey("conjuntos_residenciales.id"), nullable=False),
        sa.Column("propietario_id", sa.Integer(), sa.ForeignKey("propietarios.id"), nullable=False),
        sa.Column("concepto_id", sa.Integer(), sa.ForeignKey("concepto_movimiento.id"), nullable=True),
        sa.Column("tipo", sa.String(length=20), nullable=False),
        sa.Column("monto_centavos", sa.BigInteger(), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("periodo", sa.String(length=7), nullable=True),
        sa.Column("referencia", sa.String(length=120), nullable=True),
        sa.Column("notas", sa.String(length=500), nullable=True),
        sa.Column("created_by", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("tipo IN ('cargo', 'abono')", name="ck_movimiento_cartera_tipo"),
    )
    op.create_index("ix_movimiento_cartera_id", "movimiento_cartera", ["id"])
    op.create_index("ix_movimiento_cartera_conjunto_id", "movimiento_cartera", ["conjunto_id"])
    op.create_index("ix_movimiento_cartera_propietario_id", "movimiento_cartera", ["propietario_id"])
    op.create_index("ix_movimiento_cartera_concepto_id", "movimiento_cartera", ["concepto_id"])
    op.create_index("ix_movimiento_cartera_tipo", "movimiento_cartera", ["tipo"])
    op.create_index("ix_movimiento_cartera_fecha", "movimiento_cartera", ["fecha"])
    op.create_index("ix_movimiento_cartera_periodo", "movimiento_cartera", ["periodo"])

    op.create_table(
        "movimiento_caja",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("conjunto_id", sa.UUID(), sa.ForeignKey("conjuntos_residenciales.id"), nullable=False),
        sa.Column("concepto_id", sa.Integer(), sa.ForeignKey("concepto_movimiento.id"), nullable=True),
        sa.Column("tipo", sa.String(length=20), nullable=False),
        sa.Column("monto_centavos", sa.BigInteger(), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("periodo", sa.String(length=7), nullable=True),
        sa.Column("referencia", sa.String(length=120), nullable=True),
        sa.Column("notas", sa.String(length=500), nullable=True),
        sa.Column("created_by", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("tipo IN ('ingreso', 'egreso')", name="ck_movimiento_caja_tipo"),
    )
    op.create_index("ix_movimiento_caja_id", "movimiento_caja", ["id"])
    op.create_index("ix_movimiento_caja_conjunto_id", "movimiento_caja", ["conjunto_id"])
    op.create_index("ix_movimiento_caja_concepto_id", "movimiento_caja", ["concepto_id"])
    op.create_index("ix_movimiento_caja_tipo", "movimiento_caja", ["tipo"])
    op.create_index("ix_movimiento_caja_fecha", "movimiento_caja", ["fecha"])
    op.create_index("ix_movimiento_caja_periodo", "movimiento_caja", ["periodo"])

    op.create_table(
        "alerta_financiera",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("conjunto_id", sa.UUID(), sa.ForeignKey("conjuntos_residenciales.id"), nullable=False),
        sa.Column("propietario_id", sa.Integer(), sa.ForeignKey("propietarios.id"), nullable=True),
        sa.Column("tipo", sa.String(length=20), nullable=False),
        sa.Column("mensaje", sa.String(length=500), nullable=False),
        sa.Column("leida", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "tipo IN ('mora', 'vencimiento', 'sin_pago')",
            name="ck_alerta_financiera_tipo",
        ),
    )
    op.create_index("ix_alerta_financiera_id", "alerta_financiera", ["id"])
    op.create_index("ix_alerta_financiera_conjunto_id", "alerta_financiera", ["conjunto_id"])
    op.create_index("ix_alerta_financiera_propietario_id", "alerta_financiera", ["propietario_id"])
    op.create_index("ix_alerta_financiera_tipo", "alerta_financiera", ["tipo"])
    op.create_index("ix_alerta_financiera_leida", "alerta_financiera", ["leida"])
    op.create_index("ix_alerta_financiera_created_at", "alerta_financiera", ["created_at"])


def downgrade() -> None:
    op.drop_table("alerta_financiera")
    op.drop_table("movimiento_caja")
    op.drop_table("movimiento_cartera")
    op.drop_table("concepto_movimiento")
    op.drop_table("config_financiera")
