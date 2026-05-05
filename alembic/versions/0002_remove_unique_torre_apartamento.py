"""remove unique constraint torre apartamento

Revision ID: 0002_remove_unique_torre_apartamento
Revises: 0001_initial_schema
Create Date: 2026-05-04

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("uq_torre_apartamento", "propietarios", type_="unique")


def downgrade() -> None:
    op.create_unique_constraint(
        "uq_torre_apartamento", "propietarios", ["torre", "apartamento"]
    )
