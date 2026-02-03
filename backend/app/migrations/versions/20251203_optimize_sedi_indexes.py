"""Add composite index for sedi performance optimization

Revision ID: optimize_sedi_indexes
Revises: optimize_fatture_fornitori_indexes
Create Date: 2025-12-03

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'opt_idx_sedi'
down_revision = 'opt_idx_fatture_fornitori'  # Dopo optimize_fatture_fornitori_indexes
branch_labels = None
depends_on = None


def upgrade():
    # ============ INDICE COMPOSITO PER SEDI ============
    # Indice composito per query più comuni: filtra per azienda e esclude deleted
    # Questo è usato in quasi tutte le query sulle sedi
    op.create_index(
        'ix_sedi_azienda_deleted',
        'sedi',
        ['azienda_id', 'deleted_at'],
        unique=False
    )


def downgrade():
    # Rimuovi indice
    op.drop_index('ix_sedi_azienda_deleted', table_name='sedi')

