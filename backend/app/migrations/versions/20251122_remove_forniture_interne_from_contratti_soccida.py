"""Remove forniture_interne_modello and mercuriale_riferimento from contratti_soccida

Revision ID: 20251122_remove_forniture
Revises: 20251122_giorni_gestione
Create Date: 2025-11-22 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '20251122_remove_forniture'
down_revision = '20251122_giorni_gestione'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('contratti_soccida')]
    
    # Rimuovi campo forniture_interne_modello se esiste
    if 'forniture_interne_modello' in columns:
        op.drop_column('contratti_soccida', 'forniture_interne_modello')
    
    # Rimuovi campo mercuriale_riferimento se esiste
    if 'mercuriale_riferimento' in columns:
        op.drop_column('contratti_soccida', 'mercuriale_riferimento')


def downgrade():
    # Ripristina i campi (se necessario per rollback)
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('contratti_soccida')]
    
    if 'forniture_interne_modello' not in columns:
        op.add_column('contratti_soccida', sa.Column('forniture_interne_modello', sa.String(length=30), nullable=True))
    
    if 'mercuriale_riferimento' not in columns:
        op.add_column('contratti_soccida', sa.Column('mercuriale_riferimento', sa.String(length=120), nullable=True))

