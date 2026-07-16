"""add admin local access features

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-16

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "conjuntos_residenciales",
        sa.Column("telegram_bot_token", sa.String(length=255), nullable=True),
    )

    op.add_column(
        "zonas_acceso",
        sa.Column(
            "acceso_universal",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.create_index(
        op.f("ix_zonas_acceso_acceso_universal"),
        "zonas_acceso",
        ["acceso_universal"],
        unique=False,
    )

    op.add_column(
        "propietarios",
        sa.Column("telegram_chat_id", sa.String(length=80), nullable=True),
    )

    op.add_column(
        "historial_accesos",
        sa.Column(
            "estado_intento",
            sa.String(length=20),
            nullable=False,
            server_default="concedido",
        ),
    )
    op.add_column(
        "historial_accesos",
        sa.Column("motivo", sa.String(length=255), nullable=True),
    )
    op.create_index(
        op.f("ix_historial_accesos_estado_intento"),
        "historial_accesos",
        ["estado_intento"],
        unique=False,
    )
    op.create_check_constraint(
        "ck_historial_accesos_estado_intento",
        "historial_accesos",
        "estado_intento IN ('concedido', 'denegado')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_historial_accesos_estado_intento",
        "historial_accesos",
        type_="check",
    )
    op.drop_index(
        op.f("ix_historial_accesos_estado_intento"),
        table_name="historial_accesos",
    )
    op.drop_column("historial_accesos", "motivo")
    op.drop_column("historial_accesos", "estado_intento")

    op.drop_column("propietarios", "telegram_chat_id")

    op.drop_index(op.f("ix_zonas_acceso_acceso_universal"), table_name="zonas_acceso")
    op.drop_column("zonas_acceso", "acceso_universal")

    op.drop_column("conjuntos_residenciales", "telegram_bot_token")
