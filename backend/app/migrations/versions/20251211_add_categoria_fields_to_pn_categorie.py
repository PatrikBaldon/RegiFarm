"""add_categoria_fields_to_pn_categorie

Revision ID: add_categoria_fields_pn
Revises: add_categoria_id_fatture
Create Date: 2025-12-11 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_categoria_fields_pn'
down_revision = 'add_categoria_id_fatture'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Aggiungi colonne per terreno e attrezzatura
    op.add_column(
        'pn_categorie',
        sa.Column(
            'richiede_terreno',
            sa.Boolean(),
            nullable=False,
            server_default='false',
            comment="Indica se la categoria richiede l'associazione di un terreno"
        )
    )
    
    op.add_column(
        'pn_categorie',
        sa.Column(
            'richiede_attrezzatura',
            sa.Boolean(),
            nullable=False,
            server_default='false',
            comment="Indica se la categoria richiede l'associazione di un'attrezzatura"
        )
    )
    
    # Aggiungi colonna macrocategoria per compatibilità con sistema fatture
    op.add_column(
        'pn_categorie',
        sa.Column(
            'macrocategoria',
            sa.String(length=50),
            nullable=True,
            comment="Macrocategoria per compatibilità con sistema fatture"
        )
    )
    
    # Aggiungi indice per macrocategoria
    op.create_index(
        'ix_pn_categorie_macrocategoria',
        'pn_categorie',
        ['macrocategoria']
    )


def downgrade() -> None:
    # Rimuovi indice
    op.drop_index('ix_pn_categorie_macrocategoria', table_name='pn_categorie')
    
    # Rimuovi colonne
    op.drop_column('pn_categorie', 'macrocategoria')
    op.drop_column('pn_categorie', 'richiede_attrezzatura')
    op.drop_column('pn_categorie', 'richiede_terreno')

