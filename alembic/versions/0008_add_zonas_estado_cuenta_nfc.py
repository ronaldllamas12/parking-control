"""add access zones, account status and nfc identifiers

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-14

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_cuenta_propietario') THEN
                CREATE TYPE estado_cuenta_propietario AS ENUM ('al_dia', 'en_mora');
            END IF;
        END$$;
        """
    )

    op.create_table(
        "zonas_acceso",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("conjunto_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nombre", sa.String(length=80), nullable=False),
        sa.Column("activa", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["conjunto_id"], ["conjuntos_residenciales.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("conjunto_id", "nombre", name="uq_zonas_acceso_conjunto_nombre"),
    )
    op.create_index(op.f("ix_zonas_acceso_id"), "zonas_acceso", ["id"], unique=False)
    op.create_index(op.f("ix_zonas_acceso_conjunto_id"), "zonas_acceso", ["conjunto_id"], unique=False)
    op.create_index(op.f("ix_zonas_acceso_nombre"), "zonas_acceso", ["nombre"], unique=False)

    op.add_column(
        "propietarios",
        sa.Column(
            "estado_cuenta",
            postgresql.ENUM("al_dia", "en_mora", name="estado_cuenta_propietario", create_type=False),
            nullable=False,
            server_default="al_dia",
        ),
    )
    op.add_column(
        "propietarios",
        sa.Column("amenidades_suspendidas", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("propietarios", sa.Column("nfc_tag_id", sa.String(length=120), nullable=True))
    op.create_index(op.f("ix_propietarios_estado_cuenta"), "propietarios", ["estado_cuenta"], unique=False)
    op.create_index(op.f("ix_propietarios_amenidades_suspendidas"), "propietarios", ["amenidades_suspendidas"], unique=False)
    op.create_index(op.f("ix_propietarios_nfc_tag_id"), "propietarios", ["nfc_tag_id"], unique=False)
    op.create_unique_constraint(
        "uq_propietarios_conjunto_nfc_tag_id",
        "propietarios",
        ["conjunto_id", "nfc_tag_id"],
    )

    op.execute(
        """
        INSERT INTO zonas_acceso (conjunto_id, nombre)
        SELECT c.id, 'Parqueadero'
        FROM conjuntos_residenciales c
        WHERE NOT EXISTS (
            SELECT 1 FROM zonas_acceso z
            WHERE z.conjunto_id = c.id AND lower(z.nombre) = 'parqueadero'
        )
        """
    )

    op.add_column("historial_accesos", sa.Column("zona_id", sa.Integer(), nullable=True))
    op.execute(
        """
        UPDATE historial_accesos h
        SET zona_id = z.id
        FROM zonas_acceso z
        WHERE z.conjunto_id = h.conjunto_id
          AND lower(z.nombre) = 'parqueadero'
          AND h.zona_id IS NULL
        """
    )
    op.alter_column("historial_accesos", "zona_id", nullable=False)
    op.create_foreign_key("fk_historial_accesos_zona_id", "historial_accesos", "zonas_acceso", ["zona_id"], ["id"])
    op.create_index(op.f("ix_historial_accesos_zona_id"), "historial_accesos", ["zona_id"], unique=False)

    op.execute("ALTER TABLE zonas_acceso ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE zonas_acceso FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation_zonas_acceso
        ON zonas_acceso
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
    op.drop_index(op.f("ix_historial_accesos_zona_id"), table_name="historial_accesos")
    op.drop_constraint("fk_historial_accesos_zona_id", "historial_accesos", type_="foreignkey")
    op.drop_column("historial_accesos", "zona_id")

    op.drop_constraint("uq_propietarios_conjunto_nfc_tag_id", "propietarios", type_="unique")
    op.drop_index(op.f("ix_propietarios_nfc_tag_id"), table_name="propietarios")
    op.drop_index(op.f("ix_propietarios_amenidades_suspendidas"), table_name="propietarios")
    op.drop_index(op.f("ix_propietarios_estado_cuenta"), table_name="propietarios")
    op.drop_column("propietarios", "nfc_tag_id")
    op.drop_column("propietarios", "amenidades_suspendidas")
    op.drop_column("propietarios", "estado_cuenta")

    op.execute("DROP POLICY IF EXISTS tenant_isolation_zonas_acceso ON zonas_acceso")
    op.execute("ALTER TABLE zonas_acceso NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE zonas_acceso DISABLE ROW LEVEL SECURITY")
    op.drop_index(op.f("ix_zonas_acceso_nombre"), table_name="zonas_acceso")
    op.drop_index(op.f("ix_zonas_acceso_conjunto_id"), table_name="zonas_acceso")
    op.drop_index(op.f("ix_zonas_acceso_id"), table_name="zonas_acceso")
    op.drop_table("zonas_acceso")
    op.execute("DROP TYPE IF EXISTS estado_cuenta_propietario")
