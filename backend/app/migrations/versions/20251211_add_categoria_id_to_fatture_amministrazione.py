"""add_categoria_id_to_fatture_amministrazione

Revision ID: add_categoria_id_fatture
Revises: 7e2038e08007
Create Date: 2025-12-11 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_categoria_id_fatture'
down_revision = '7e2038e08007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Aggiungi colonna categoria_id a fatture_amministrazione
    op.add_column(
        'fatture_amministrazione',
        sa.Column(
            'categoria_id',
            sa.Integer(),
            nullable=True,
            comment="ID categoria Prima Nota unificata"
        )
    )
    
    # Aggiungi foreign key a pn_categorie
    op.create_foreign_key(
        'fk_fatture_amministrazione_categoria_id',
        'fatture_amministrazione',
        'pn_categorie',
        ['categoria_id'],
        ['id'],
        ondelete='SET NULL'
    )
    
    # Aggiungi indice per performance
    op.create_index(
        'ix_fatture_amministrazione_categoria_id',
        'fatture_amministrazione',
        ['categoria_id']
    )


def downgrade() -> None:
    # Rimuovi indice
    op.drop_index('ix_fatture_amministrazione_categoria_id', table_name='fatture_amministrazione')
    
    # Rimuovi foreign key
    op.drop_constraint('fk_fatture_amministrazione_categoria_id', 'fatture_amministrazione', type_='foreignkey')
    
    # Rimuovi colonna
    op.drop_column('fatture_amministrazione', 'categoria_id')

