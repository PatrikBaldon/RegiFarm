"""Increase precision of superficie_coinvolta on cicli_terreno.

Revision ID: 20251116_superf_prec
Revises: 20251115_add_cicli_terreno
Create Date: 2025-11-16 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20251116_superf_prec"
down_revision = "20251115_add_cicli_terreno"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "cicli_terreno",
        "superficie_coinvolta",
        existing_type=sa.Numeric(10, 2),
        type_=sa.Numeric(12, 4),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "cicli_terreno",
        "superficie_coinvolta",
        existing_type=sa.Numeric(12, 4),
        type_=sa.Numeric(10, 2),
        existing_nullable=True,
    )
