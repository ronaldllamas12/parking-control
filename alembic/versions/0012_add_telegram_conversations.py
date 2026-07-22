"""add telegram conversations

Revision ID: 0012
Revises: 0011
Create Date: 2026-07-22

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "telegram_conversations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("conjunto_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("propietario_id", sa.Integer(), nullable=False),
        sa.Column("destino_role", sa.String(length=20), nullable=False),
        sa.Column("estado", sa.String(length=20), server_default="abierta", nullable=False),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "destino_role IN ('admin', 'vigilante')",
            name="ck_telegram_conversations_destino_role",
        ),
        sa.CheckConstraint(
            "estado IN ('abierta', 'cerrada')",
            name="ck_telegram_conversations_estado",
        ),
        sa.ForeignKeyConstraint(["conjunto_id"], ["conjuntos_residenciales.id"]),
        sa.ForeignKeyConstraint(["propietario_id"], ["propietarios.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "propietario_id",
            "destino_role",
            name="uq_telegram_conversations_propietario_destino",
        ),
    )
    op.create_index(op.f("ix_telegram_conversations_id"), "telegram_conversations", ["id"])
    op.create_index(
        op.f("ix_telegram_conversations_conjunto_id"),
        "telegram_conversations",
        ["conjunto_id"],
    )
    op.create_index(
        op.f("ix_telegram_conversations_propietario_id"),
        "telegram_conversations",
        ["propietario_id"],
    )
    op.create_index(
        op.f("ix_telegram_conversations_destino_role"),
        "telegram_conversations",
        ["destino_role"],
    )
    op.create_index(
        op.f("ix_telegram_conversations_estado"),
        "telegram_conversations",
        ["estado"],
    )
    op.create_index(
        op.f("ix_telegram_conversations_last_message_at"),
        "telegram_conversations",
        ["last_message_at"],
    )

    op.create_table(
        "telegram_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("conversation_id", sa.Integer(), nullable=False),
        sa.Column("conjunto_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("propietario_id", sa.Integer(), nullable=False),
        sa.Column("sender_role", sa.String(length=20), nullable=False),
        sa.Column("sender_username", sa.String(length=50), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("read_by_staff", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "sender_role IN ('propietario', 'admin', 'vigilante')",
            name="ck_telegram_messages_sender_role",
        ),
        sa.ForeignKeyConstraint(["conversation_id"], ["telegram_conversations.id"]),
        sa.ForeignKeyConstraint(["conjunto_id"], ["conjuntos_residenciales.id"]),
        sa.ForeignKeyConstraint(["propietario_id"], ["propietarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_telegram_messages_id"), "telegram_messages", ["id"])
    op.create_index(
        op.f("ix_telegram_messages_conversation_id"),
        "telegram_messages",
        ["conversation_id"],
    )
    op.create_index(
        op.f("ix_telegram_messages_conjunto_id"),
        "telegram_messages",
        ["conjunto_id"],
    )
    op.create_index(
        op.f("ix_telegram_messages_propietario_id"),
        "telegram_messages",
        ["propietario_id"],
    )
    op.create_index(
        op.f("ix_telegram_messages_sender_role"),
        "telegram_messages",
        ["sender_role"],
    )
    op.create_index(
        op.f("ix_telegram_messages_read_by_staff"),
        "telegram_messages",
        ["read_by_staff"],
    )
    op.create_index(
        op.f("ix_telegram_messages_created_at"),
        "telegram_messages",
        ["created_at"],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_telegram_messages_created_at"), table_name="telegram_messages")
    op.drop_index(op.f("ix_telegram_messages_read_by_staff"), table_name="telegram_messages")
    op.drop_index(op.f("ix_telegram_messages_sender_role"), table_name="telegram_messages")
    op.drop_index(op.f("ix_telegram_messages_propietario_id"), table_name="telegram_messages")
    op.drop_index(op.f("ix_telegram_messages_conjunto_id"), table_name="telegram_messages")
    op.drop_index(op.f("ix_telegram_messages_conversation_id"), table_name="telegram_messages")
    op.drop_index(op.f("ix_telegram_messages_id"), table_name="telegram_messages")
    op.drop_table("telegram_messages")

    op.drop_index(op.f("ix_telegram_conversations_last_message_at"), table_name="telegram_conversations")
    op.drop_index(op.f("ix_telegram_conversations_estado"), table_name="telegram_conversations")
    op.drop_index(op.f("ix_telegram_conversations_destino_role"), table_name="telegram_conversations")
    op.drop_index(op.f("ix_telegram_conversations_propietario_id"), table_name="telegram_conversations")
    op.drop_index(op.f("ix_telegram_conversations_conjunto_id"), table_name="telegram_conversations")
    op.drop_index(op.f("ix_telegram_conversations_id"), table_name="telegram_conversations")
    op.drop_table("telegram_conversations")
