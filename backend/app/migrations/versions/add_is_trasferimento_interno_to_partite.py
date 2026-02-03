"""add_is_trasferimento_interno_to_partite

Revision ID: a1b2c3d4e5f6
Revises: 02f09f3d980b
Create Date: 2025-01-28 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '02f09f3d980b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Aggiungi colonna is_trasferimento_interno alla tabella partite_animali
    op.add_column('partite_animali', 
        sa.Column('is_trasferimento_interno', sa.Boolean(), nullable=False, server_default='false')
    )


def downgrade() -> None:
    # Rimuovi colonna is_trasferimento_interno
    op.drop_column('partite_animali', 'is_trasferimento_interno')

