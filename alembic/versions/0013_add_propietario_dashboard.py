"""add propietario dashboard

Revision ID: 0013
Revises: 0012
Create Date: 2026-07-27

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_users_role_conjunto_scope", "users", type_="check")
    op.add_column("users", sa.Column("propietario_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_users_propietario_id"), "users", ["propietario_id"], unique=True)
    op.create_foreign_key(
        "fk_users_propietario_id_propietarios",
        "users",
        "propietarios",
        ["propietario_id"],
        ["id"],
    )
    op.create_check_constraint(
        "ck_users_role_conjunto_scope",
        "users",
        "(role = 'superadmin' AND conjunto_id IS NULL) OR "
        "(role IN ('admin', 'vigilante', 'propietario') AND conjunto_id IS NOT NULL)",
    )

    op.add_column("config_financiera", sa.Column("payment_link_url", sa.String(length=500), nullable=True))

    op.create_table(
        "comprobantes_pago",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("conjunto_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("propietario_id", sa.Integer(), nullable=False),
        sa.Column("imagen_url", sa.String(length=500), nullable=False),
        sa.Column("mensaje", sa.String(length=500), nullable=True),
        sa.Column("referencia", sa.String(length=120), nullable=True),
        sa.Column("monto_centavos", sa.BigInteger(), nullable=True),
        sa.Column("estado", sa.String(length=20), server_default="recibido", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "estado IN ('recibido', 'en_revision', 'aprobado', 'rechazado')",
            name="ck_comprobantes_pago_estado",
        ),
        sa.ForeignKeyConstraint(["conjunto_id"], ["conjuntos_residenciales.id"]),
        sa.ForeignKeyConstraint(["propietario_id"], ["propietarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_comprobantes_pago_id"), "comprobantes_pago", ["id"])
    op.create_index(op.f("ix_comprobantes_pago_conjunto_id"), "comprobantes_pago", ["conjunto_id"])
    op.create_index(op.f("ix_comprobantes_pago_propietario_id"), "comprobantes_pago", ["propietario_id"])
    op.create_index(op.f("ix_comprobantes_pago_estado"), "comprobantes_pago", ["estado"])
    op.create_index(op.f("ix_comprobantes_pago_created_at"), "comprobantes_pago", ["created_at"])


def downgrade() -> None:
    op.drop_index(op.f("ix_comprobantes_pago_created_at"), table_name="comprobantes_pago")
    op.drop_index(op.f("ix_comprobantes_pago_estado"), table_name="comprobantes_pago")
    op.drop_index(op.f("ix_comprobantes_pago_propietario_id"), table_name="comprobantes_pago")
    op.drop_index(op.f("ix_comprobantes_pago_conjunto_id"), table_name="comprobantes_pago")
    op.drop_index(op.f("ix_comprobantes_pago_id"), table_name="comprobantes_pago")
    op.drop_table("comprobantes_pago")
    op.drop_column("config_financiera", "payment_link_url")

    op.drop_constraint("ck_users_role_conjunto_scope", "users", type_="check")
    op.drop_constraint("fk_users_propietario_id_propietarios", "users", type_="foreignkey")
    op.drop_index(op.f("ix_users_propietario_id"), table_name="users")
    op.drop_column("users", "propietario_id")
    op.create_check_constraint(
        "ck_users_role_conjunto_scope",
        "users",
        "(role = 'superadmin' AND conjunto_id IS NULL) OR "
        "(role IN ('admin', 'vigilante') AND conjunto_id IS NOT NULL)",
    )
