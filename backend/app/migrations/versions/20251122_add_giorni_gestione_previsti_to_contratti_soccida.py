"""Add giorni_gestione_previsti to contratti_soccida

Revision ID: 20251122_giorni_gestione
Revises: 20251121_tipo_allevamento
Create Date: 2025-11-22 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '20251122_giorni_gestione'
down_revision = '20251121_tipo_allevamento'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('contratti_soccida')]
    
    # Aggiungi campo giorni_gestione_previsti se non esiste
    if 'giorni_gestione_previsti' not in columns:
        op.add_column('contratti_soccida', sa.Column('giorni_gestione_previsti', sa.Integer(), nullable=True))


def downgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('contratti_soccida')]
    
    # Rimuovi campo giorni_gestione_previsti se esiste
    if 'giorni_gestione_previsti' in columns:
        op.drop_column('contratti_soccida', 'giorni_gestione_previsti')

