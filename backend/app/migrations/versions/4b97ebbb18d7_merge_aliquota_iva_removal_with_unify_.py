"""merge aliquota_iva removal with unify_fatture

Revision ID: 4b97ebbb18d7
Revises: 20250130_unify_fatture, 20251124_remove_aliquota_iva
Create Date: 2025-11-24 09:00:25.857530

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4b97ebbb18d7'
down_revision = ('20250130_unify_fatture', '20251124_remove_aliquota_iva')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

