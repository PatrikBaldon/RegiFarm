"""add_azienda_id_to_impostazioni

Revision ID: add_azienda_id_impostazioni
Revises: 20251203_add_missing_deleted_at_indexes
Create Date: 2025-12-09 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_azienda_id_impostazioni'
down_revision = 'add_missing_deleted_idx'  # Dopo 20251203_add_missing_deleted_at_indexes
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Aggiungi colonna azienda_id
    op.add_column('impostazioni', sa.Column('azienda_id', sa.Integer(), nullable=True))
    
    # Crea foreign key
    op.create_foreign_key(
        'fk_impostazioni_azienda_id',
        'impostazioni', 'aziende',
        ['azienda_id'], ['id'],
        ondelete='CASCADE'
    )
    
    # Rimuovi l'indice unique su modulo (ora sarà unique su azienda_id + modulo)
    op.drop_index('ix_impostazioni_modulo', table_name='impostazioni')
    
    # Crea nuovo indice unique su (azienda_id, modulo)
    op.create_index(
        'ix_impostazioni_azienda_modulo',
        'impostazioni',
        ['azienda_id', 'modulo'],
        unique=True
    )
    
    # Crea indice su azienda_id per performance
    op.create_index('ix_impostazioni_azienda_id', 'impostazioni', ['azienda_id'])
    
    # Per i record esistenti, imposta azienda_id = 1 (default per retrocompatibilità)
    # Nota: in produzione potrebbe essere necessario un'operazione più sofisticata
    op.execute("UPDATE impostazioni SET azienda_id = 1 WHERE azienda_id IS NULL")
    
    # Rendi azienda_id NOT NULL dopo aver popolato i valori
    op.alter_column('impostazioni', 'azienda_id', nullable=False)


def downgrade() -> None:
    # Rimuovi indici
    op.drop_index('ix_impostazioni_azienda_id', table_name='impostazioni')
    op.drop_index('ix_impostazioni_azienda_modulo', table_name='impostazioni')
    
    # Rimuovi foreign key
    op.drop_constraint('fk_impostazioni_azienda_id', 'impostazioni', type_='foreignkey')
    
    # Rimuovi colonna
    op.drop_column('impostazioni', 'azienda_id')
    
    # Ricrea indice originale
    op.create_index('ix_impostazioni_modulo', 'impostazioni', ['modulo'], unique=True)

