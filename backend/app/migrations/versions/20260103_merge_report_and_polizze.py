"""Merge heads: report_allevamento_fatture and polizze_attrezzature

Revision ID: 20260103_merge_heads
Revises: e20c1218ff48, 20250115_polizze_attrezzature
Create Date: 2026-01-03 22:06:44.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260103_merge_heads'
down_revision = ('e20c1218ff48', '20250115_polizze_attrezzature')
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Merge migration - no changes needed, just merges the two branches
    pass


def downgrade() -> None:
    # Merge migration - no changes needed
    pass



