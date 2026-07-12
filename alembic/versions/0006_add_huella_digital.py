"""add huella_digital table and huella_registrada field

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-11

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "propietarios",
        sa.Column(
            "huella_registrada",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    op.create_table(
        "huellas_digitales",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column(
            "propietario_id",
            sa.Integer(),
            sa.ForeignKey("propietarios.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("propietario_uid", sa.String(length=16), nullable=False),
        sa.Column("template_b64", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        op.f("ix_huellas_digitales_propietario_id"),
        "huellas_digitales",
        ["propietario_id"],
        unique=True,
    )
    op.create_index(
        op.f("ix_huellas_digitales_propietario_uid"),
        "huellas_digitales",
        ["propietario_uid"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_huellas_digitales_propietario_uid"), table_name="huellas_digitales"
    )
    op.drop_index(
        op.f("ix_huellas_digitales_propietario_id"), table_name="huellas_digitales"
    )
    op.drop_table("huellas_digitales")
    op.drop_column("propietarios", "huella_registrada")
