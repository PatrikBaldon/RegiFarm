"""Update bonus fields in contratti_soccida

Revision ID: 20251122_update_bonus
Revises: 20251122_remove_forniture
Create Date: 2025-11-22 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '20251122_update_bonus'
down_revision = '20251122_remove_forniture'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('contratti_soccida')]
    
    # Rimuovi vecchio campo bonus_mortalita_zero_attivo se esiste
    if 'bonus_mortalita_zero_attivo' in columns:
        op.drop_column('contratti_soccida', 'bonus_mortalita_zero_attivo')
    
    # Aggiungi nuovi campi bonus
    if 'bonus_mortalita_attivo' not in columns:
        op.add_column('contratti_soccida', sa.Column('bonus_mortalita_attivo', sa.Boolean(), nullable=False, server_default='false'))
    
    if 'bonus_mortalita_percentuale' not in columns:
        op.add_column('contratti_soccida', sa.Column('bonus_mortalita_percentuale', sa.Numeric(5, 2), nullable=True))
    
    if 'bonus_incremento_attivo' not in columns:
        op.add_column('contratti_soccida', sa.Column('bonus_incremento_attivo', sa.Boolean(), nullable=False, server_default='false'))


def downgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('contratti_soccida')]
    
    # Rimuovi nuovi campi
    if 'bonus_mortalita_attivo' in columns:
        op.drop_column('contratti_soccida', 'bonus_mortalita_attivo')
    
    if 'bonus_mortalita_percentuale' in columns:
        op.drop_column('contratti_soccida', 'bonus_mortalita_percentuale')
    
    if 'bonus_incremento_attivo' in columns:
        op.drop_column('contratti_soccida', 'bonus_incremento_attivo')
    
    # Ripristina vecchio campo
    if 'bonus_mortalita_zero_attivo' not in columns:
        op.add_column('contratti_soccida', sa.Column('bonus_mortalita_zero_attivo', sa.Boolean(), nullable=False, server_default='false'))

