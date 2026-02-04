"""Add codice_stalla_decesso to gruppi_decessi

Permette di distinguere più gruppi di decessi nello stesso giorno
che avvengono in stalle diverse (es. 2 decessi in stalla A e 3 in stalla B).

Revision ID: 20260204_gruppi_stalla
Revises: 20260204_partite_partial_unique
Create Date: 2026-02-04

"""
from alembic import op
import sqlalchemy as sa

revision = "20260204_gruppi_stalla"
down_revision = "20260204_partite_partial_unique"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "gruppi_decessi",
        sa.Column("codice_stalla_decesso", sa.String(length=50), nullable=True),
    )
    op.create_index(
        op.f("ix_gruppi_decessi_codice_stalla_decesso"),
        "gruppi_decessi",
        ["codice_stalla_decesso"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_gruppi_decessi_codice_stalla_decesso"),
        table_name="gruppi_decessi",
    )
    op.drop_column("gruppi_decessi", "codice_stalla_decesso")
