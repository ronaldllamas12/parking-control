"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-04

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_role"), "users", ["role"], unique=False)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    op.create_table(
        "propietarios",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uid", sa.String(length=16), nullable=False),
        sa.Column("nombre", sa.String(length=120), nullable=False),
        sa.Column("torre", sa.String(length=10), nullable=False),
        sa.Column("apartamento", sa.String(length=10), nullable=False),
        sa.Column("foto_url", sa.String(length=500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("torre", "apartamento", name="uq_torre_apartamento"),
    )
    op.create_index(
        op.f("ix_propietarios_apartamento"),
        "propietarios",
        ["apartamento"],
        unique=False,
    )
    op.create_index(op.f("ix_propietarios_id"), "propietarios", ["id"], unique=False)
    op.create_index(
        op.f("ix_propietarios_torre"), "propietarios", ["torre"], unique=False
    )
    op.create_index(op.f("ix_propietarios_uid"), "propietarios", ["uid"], unique=True)

    op.create_table(
        "historial_accesos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("propietario_id", sa.Integer(), nullable=False),
        sa.Column("propietario_uid", sa.String(length=16), nullable=False),
        sa.Column("fecha_hora", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["propietario_id"], ["propietarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_historial_accesos_fecha_hora"),
        "historial_accesos",
        ["fecha_hora"],
        unique=False,
    )
    op.create_index(
        op.f("ix_historial_accesos_id"), "historial_accesos", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_historial_accesos_propietario_id"),
        "historial_accesos",
        ["propietario_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_historial_accesos_propietario_uid"),
        "historial_accesos",
        ["propietario_uid"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_historial_accesos_propietario_uid"), table_name="historial_accesos"
    )
    op.drop_index(
        op.f("ix_historial_accesos_propietario_id"), table_name="historial_accesos"
    )
    op.drop_index(op.f("ix_historial_accesos_id"), table_name="historial_accesos")
    op.drop_index(
        op.f("ix_historial_accesos_fecha_hora"), table_name="historial_accesos"
    )
    op.drop_table("historial_accesos")

    op.drop_index(op.f("ix_propietarios_uid"), table_name="propietarios")
    op.drop_index(op.f("ix_propietarios_torre"), table_name="propietarios")
    op.drop_index(op.f("ix_propietarios_id"), table_name="propietarios")
    op.drop_index(op.f("ix_propietarios_apartamento"), table_name="propietarios")
    op.drop_table("propietarios")

    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_index(op.f("ix_users_role"), table_name="users")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_table("users")
