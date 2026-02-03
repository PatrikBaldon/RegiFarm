"""
merge heads for ddt/magazzino and alimentazione note additions

Revision ID: c0ffee123456
Revises: 5638ef08af37, ab12cd34ef56
Create Date: 2025-10-30 10:05:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c0ffee123456'
down_revision = ('5638ef08af37', 'ab12cd34ef56')
branch_labels = None
depends_on = None


def upgrade() -> None:
	pass


def downgrade() -> None:
	pass
