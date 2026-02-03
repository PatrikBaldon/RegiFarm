"""Add data_chiusura to partite_animali for saldo a chiusura soccida

Revision ID: 20260131_partite_chiusura
Revises: fd0e537a0e63
Create Date: 2026-01-31

"""
from alembic import op
import sqlalchemy as sa

revision = "20260131_partite_chiusura"
down_revision = "fd0e537a0e63"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "partite_animali",
        sa.Column("data_chiusura", sa.Date(), nullable=True),
    )
    op.create_index(
        "ix_partite_animali_data_chiusura",
        "partite_animali",
        ["data_chiusura"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_partite_animali_data_chiusura", table_name="partite_animali")
    op.drop_column("partite_animali", "data_chiusura")
