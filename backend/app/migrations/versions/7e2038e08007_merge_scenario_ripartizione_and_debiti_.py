"""merge scenario_ripartizione and debiti_crediti_preferenze

Revision ID: 7e2038e08007
Revises: add_scenario_ripartizione, add_debiti_crediti_preferenze
Create Date: 2025-12-11 15:55:38.381879

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7e2038e08007'
down_revision = ('add_scenario_ripartizione', 'add_debiti_crediti_preferenze')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

