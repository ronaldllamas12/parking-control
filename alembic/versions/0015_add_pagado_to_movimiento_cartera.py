"""add pagado to movimiento_cartera

Revision ID: 0015
Revises: 0014
Create Date: 2026-08-04

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # NULL = legacy (pre-feature); False = explicitly unpaid; True = explicitly paid
    op.add_column(
        "movimiento_cartera",
        sa.Column("pagado", sa.Boolean(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("movimiento_cartera", "pagado")
