"""add contact and vigilante history

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-04

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "propietarios",
        sa.Column("numero_contacto", sa.String(length=30), nullable=True),
    )
    op.add_column(
        "historial_accesos",
        sa.Column("vigilante_username", sa.String(length=50), nullable=True),
    )
    op.create_index(
        op.f("ix_historial_accesos_vigilante_username"),
        "historial_accesos",
        ["vigilante_username"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_historial_accesos_vigilante_username"),
        table_name="historial_accesos",
    )
    op.drop_column("historial_accesos", "vigilante_username")
    op.drop_column("propietarios", "numero_contacto")
