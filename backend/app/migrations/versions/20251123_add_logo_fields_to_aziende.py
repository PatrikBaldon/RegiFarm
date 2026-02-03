"""Add logo fields to aziende

Revision ID: 20251123_add_logo_fields
Revises: 20251122_update_bonus
Create Date: 2025-11-23 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = "20251123_add_logo_fields"
down_revision = "20251122_update_bonus"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col["name"] for col in inspector.get_columns("aziende")]

    if "logo_storage_path" not in columns:
        op.add_column(
            "aziende",
            sa.Column("logo_storage_path", sa.String(length=255), nullable=True),
        )

    if "logo_public_url" not in columns:
        op.add_column(
            "aziende",
            sa.Column("logo_public_url", sa.String(length=500), nullable=True),
        )


def downgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col["name"] for col in inspector.get_columns("aziende")]

    if "logo_public_url" in columns:
        op.drop_column("aziende", "logo_public_url")

    if "logo_storage_path" in columns:
        op.drop_column("aziende", "logo_storage_path")

