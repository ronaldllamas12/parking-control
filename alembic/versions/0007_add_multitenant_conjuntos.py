"""add multitenant conjuntos residenciales

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-14

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    op.create_table(
        "conjuntos_residenciales",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("nombre", sa.String(length=120), nullable=False),
        sa.Column("direccion", sa.String(length=255), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre", name="uq_conjuntos_residenciales_nombre"),
    )
    op.create_index(
        op.f("ix_conjuntos_residenciales_id"),
        "conjuntos_residenciales",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_conjuntos_residenciales_activo"),
        "conjuntos_residenciales",
        ["activo"],
        unique=False,
    )

    op.add_column(
        "users",
        sa.Column("conjunto_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "propietarios",
        sa.Column("conjunto_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "historial_accesos",
        sa.Column("conjunto_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "huellas_digitales",
        sa.Column("conjunto_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.execute(
        """
        INSERT INTO conjuntos_residenciales (nombre, direccion)
        VALUES ('Conjunto Principal', 'Migrado desde instalacion monotenante')
        ON CONFLICT (nombre) DO NOTHING
        """
    )
    op.execute(
        """
        UPDATE users
        SET conjunto_id = (
            SELECT id FROM conjuntos_residenciales
            WHERE nombre = 'Conjunto Principal'
            LIMIT 1
        )
        WHERE role IN ('admin', 'vigilante') AND conjunto_id IS NULL
        """
    )
    op.execute(
        """
        UPDATE propietarios
        SET conjunto_id = (
            SELECT id FROM conjuntos_residenciales
            WHERE nombre = 'Conjunto Principal'
            LIMIT 1
        )
        WHERE conjunto_id IS NULL
        """
    )
    op.execute(
        """
        UPDATE historial_accesos h
        SET conjunto_id = p.conjunto_id
        FROM propietarios p
        WHERE h.propietario_id = p.id AND h.conjunto_id IS NULL
        """
    )
    op.execute(
        """
        UPDATE huellas_digitales h
        SET conjunto_id = p.conjunto_id
        FROM propietarios p
        WHERE h.propietario_id = p.id AND h.conjunto_id IS NULL
        """
    )

    op.alter_column("propietarios", "conjunto_id", nullable=False)
    op.alter_column("historial_accesos", "conjunto_id", nullable=False)
    op.alter_column("huellas_digitales", "conjunto_id", nullable=False)

    op.create_foreign_key(
        "fk_users_conjunto_id",
        "users",
        "conjuntos_residenciales",
        ["conjunto_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_propietarios_conjunto_id",
        "propietarios",
        "conjuntos_residenciales",
        ["conjunto_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_historial_accesos_conjunto_id",
        "historial_accesos",
        "conjuntos_residenciales",
        ["conjunto_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_huellas_digitales_conjunto_id",
        "huellas_digitales",
        "conjuntos_residenciales",
        ["conjunto_id"],
        ["id"],
    )

    op.create_index(op.f("ix_users_conjunto_id"), "users", ["conjunto_id"], unique=False)
    op.create_index(
        op.f("ix_propietarios_conjunto_id"),
        "propietarios",
        ["conjunto_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_historial_accesos_conjunto_id"),
        "historial_accesos",
        ["conjunto_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_huellas_digitales_conjunto_id"),
        "huellas_digitales",
        ["conjunto_id"],
        unique=False,
    )

    op.drop_index(op.f("ix_propietarios_uid"), table_name="propietarios")
    op.create_index(op.f("ix_propietarios_uid"), "propietarios", ["uid"], unique=False)
    op.create_unique_constraint(
        "uq_propietarios_conjunto_uid",
        "propietarios",
        ["conjunto_id", "uid"],
    )
    op.create_check_constraint(
        "ck_users_role_conjunto_scope",
        "users",
        "(role = 'superadmin' AND conjunto_id IS NULL) OR "
        "(role IN ('admin', 'vigilante') AND conjunto_id IS NOT NULL)",
    )

    for table in ("propietarios", "historial_accesos", "huellas_digitales"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation_{table}
            ON {table}
            USING (
                current_setting('app.current_conjunto_id', true) = 'superadmin'
                OR conjunto_id::text = current_setting('app.current_conjunto_id', true)
            )
            WITH CHECK (
                current_setting('app.current_conjunto_id', true) = 'superadmin'
                OR conjunto_id::text = current_setting('app.current_conjunto_id', true)
            )
            """
        )


def downgrade() -> None:
    for table in ("huellas_digitales", "historial_accesos", "propietarios"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_{table} ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    op.drop_constraint("ck_users_role_conjunto_scope", "users", type_="check")
    op.drop_constraint("uq_propietarios_conjunto_uid", "propietarios", type_="unique")
    op.drop_index(op.f("ix_propietarios_uid"), table_name="propietarios")
    op.create_index(op.f("ix_propietarios_uid"), "propietarios", ["uid"], unique=True)

    op.drop_index(op.f("ix_huellas_digitales_conjunto_id"), table_name="huellas_digitales")
    op.drop_index(op.f("ix_historial_accesos_conjunto_id"), table_name="historial_accesos")
    op.drop_index(op.f("ix_propietarios_conjunto_id"), table_name="propietarios")
    op.drop_index(op.f("ix_users_conjunto_id"), table_name="users")

    op.drop_constraint("fk_huellas_digitales_conjunto_id", "huellas_digitales", type_="foreignkey")
    op.drop_constraint("fk_historial_accesos_conjunto_id", "historial_accesos", type_="foreignkey")
    op.drop_constraint("fk_propietarios_conjunto_id", "propietarios", type_="foreignkey")
    op.drop_constraint("fk_users_conjunto_id", "users", type_="foreignkey")

    op.drop_column("huellas_digitales", "conjunto_id")
    op.drop_column("historial_accesos", "conjunto_id")
    op.drop_column("propietarios", "conjunto_id")
    op.drop_column("users", "conjunto_id")

    op.drop_index(op.f("ix_conjuntos_residenciales_activo"), table_name="conjuntos_residenciales")
    op.drop_index(op.f("ix_conjuntos_residenciales_id"), table_name="conjuntos_residenciales")
    op.drop_table("conjuntos_residenciales")
