"""add_codice_stalla_azienda_to_partite

Revision ID: 59dcb80eca6e
Revises: a1b2c3d4e5f6
Create Date: 2025-11-03 13:26:17.806825

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '59dcb80eca6e'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Aggiungi colonna codice_stalla_azienda alla tabella partite_animali
    op.add_column('partite_animali', 
        sa.Column('codice_stalla_azienda', sa.String(length=20), nullable=True)
    )
    # Aggiungi indice per migliorare le query
    op.create_index('ix_partite_animali_codice_stalla_azienda', 'partite_animali', ['codice_stalla_azienda'])


def downgrade() -> None:
    # Rimuovi indice
    op.drop_index('ix_partite_animali_codice_stalla_azienda', table_name='partite_animali')
    # Rimuovi colonna
    op.drop_column('partite_animali', 'codice_stalla_azienda')

