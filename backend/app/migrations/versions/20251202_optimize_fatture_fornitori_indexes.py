"""Add composite indexes for fatture and fornitori performance optimization

Revision ID: optimize_fatture_fornitori_indexes
Revises: add_azienda_id_models
Create Date: 2025-12-02

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'opt_idx_fatture_fornitori'  # Nome abbreviato per limiti DB (32 char)
down_revision = 'add_azienda_id_models'  # Dopo add_azienda_id_models
branch_labels = None
depends_on = None


def upgrade():
    # ============ INDICI COMPOSITI PER FATTURE ============
    # Indice composito per query più comuni: filtra per azienda, esclude deleted, ordina per data
    op.create_index(
        'ix_fatture_amministrazione_azienda_deleted_data',
        'fatture_amministrazione',
        ['azienda_id', 'deleted_at', 'data_fattura'],
        unique=False
    )
    
    # Indice per query filtrate per tipo e azienda
    op.create_index(
        'ix_fatture_amministrazione_azienda_tipo_deleted',
        'fatture_amministrazione',
        ['azienda_id', 'tipo', 'deleted_at'],
        unique=False
    )
    
    # Indice per query filtrate per fornitore e stato pagamento
    op.create_index(
        'ix_fatture_amministrazione_fornitore_stato',
        'fatture_amministrazione',
        ['fornitore_id', 'stato_pagamento', 'deleted_at'],
        unique=False
    )
    
    # Indice per query filtrate per categoria
    op.create_index(
        'ix_fatture_amministrazione_azienda_categoria_deleted',
        'fatture_amministrazione',
        ['azienda_id', 'categoria', 'deleted_at'],
        unique=False
    )
    
    # ============ INDICI PER FORNITORI ============
    # Indice composito per query filtrate per azienda e deleted
    op.create_index(
        'ix_fornitori_azienda_deleted',
        'fornitori',
        ['azienda_id', 'deleted_at'],
        unique=False
    )
    
    # Indice per nome (usato spesso per ricerca/ordinamento)
    # Nota: crea solo se non esiste già (potrebbe essere già presente in altre migration)
    try:
        op.create_index(
            'ix_fornitori_nome',
            'fornitori',
            ['nome'],
            unique=False
        )
    except Exception:
        # Indice già esistente, continua
        pass


def downgrade():
    # Rimuovi indici in ordine inverso
    try:
        op.drop_index('ix_fornitori_nome', table_name='fornitori')
    except Exception:
        pass
    op.drop_index('ix_fornitori_azienda_deleted', table_name='fornitori')
    op.drop_index('ix_fatture_amministrazione_azienda_categoria_deleted', table_name='fatture_amministrazione')
    op.drop_index('ix_fatture_amministrazione_fornitore_stato', table_name='fatture_amministrazione')
    op.drop_index('ix_fatture_amministrazione_azienda_tipo_deleted', table_name='fatture_amministrazione')
    op.drop_index('ix_fatture_amministrazione_azienda_deleted_data', table_name='fatture_amministrazione')



