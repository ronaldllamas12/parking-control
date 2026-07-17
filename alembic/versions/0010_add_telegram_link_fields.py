"""add telegram link fields

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-16

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "propietarios",
        sa.Column("telegram_link_token", sa.String(length=100), nullable=True),
    )
    op.create_unique_constraint(
        "uq_propietarios_telegram_link_token",
        "propietarios",
        ["telegram_link_token"],
    )
    op.create_index(
        op.f("ix_propietarios_telegram_link_token"),
        "propietarios",
        ["telegram_link_token"],
        unique=False,
    )
    op.add_column(
        "propietarios",
        sa.Column(
            "telegram_link_token_created_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "propietarios",
        sa.Column("telegram_linked_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("propietarios", "telegram_linked_at")
    op.drop_column("propietarios", "telegram_link_token_created_at")
    op.drop_index(
        op.f("ix_propietarios_telegram_link_token"),
        table_name="propietarios",
    )
    op.drop_constraint(
        "uq_propietarios_telegram_link_token",
        "propietarios",
        type_="unique",
    )
    op.drop_column("propietarios", "telegram_link_token")
