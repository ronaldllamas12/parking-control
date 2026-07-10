"""add webauthn tables

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-09

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "webauthn_credentials",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("credential_id", sa.String(length=512), nullable=False, unique=True),
        sa.Column("public_key", sa.String(length=2000), nullable=False),
        sa.Column("sign_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index(op.f("ix_webauthn_credentials_user_id"), "webauthn_credentials", ["user_id"], unique=False)

    op.create_table(
        "webauthn_challenges",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("state", sa.LargeBinary(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f("ix_webauthn_challenges_username"), "webauthn_challenges", ["username"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_webauthn_challenges_username"), table_name="webauthn_challenges")
    op.drop_table("webauthn_challenges")
    op.drop_index(op.f("ix_webauthn_credentials_user_id"), table_name="webauthn_credentials")
    op.drop_table("webauthn_credentials")
