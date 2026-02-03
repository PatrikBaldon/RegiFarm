"""remove_codice_from_box_and_stabilimenti

Revision ID: f1d8be9292ec
Revises: 59dcb80eca6e
Create Date: 2025-11-03 17:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f1d8be9292ec'
down_revision = '59dcb80eca6e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rimuovi i constraint unique che usano codice
    op.drop_constraint('uq_box_stabilimento_codice', 'box', type_='unique')
    op.drop_constraint('uq_stabilimento_sede_codice', 'stabilimenti', type_='unique')
    
    # Rimuovi le colonne codice
    op.drop_column('box', 'codice')
    op.drop_column('stabilimenti', 'codice')
    
    # Aggiungi nuovi constraint unique usando nome
    op.create_unique_constraint('uq_box_stabilimento_nome', 'box', ['stabilimento_id', 'nome'])
    op.create_unique_constraint('uq_stabilimento_sede_nome', 'stabilimenti', ['sede_id', 'nome'])


def downgrade() -> None:
    # Rimuovi i constraint unique che usano nome
    op.drop_constraint('uq_box_stabilimento_nome', 'box', type_='unique')
    op.drop_constraint('uq_stabilimento_sede_nome', 'stabilimenti', type_='unique')
    
    # Aggiungi le colonne codice
    op.add_column('box', sa.Column('codice', sa.String(length=20), nullable=False, server_default=''))
    op.add_column('stabilimenti', sa.Column('codice', sa.String(length=20), nullable=False, server_default=''))
    
    # Rimuovi i default server dopo l'aggiunta
    op.alter_column('box', 'codice', server_default=None)
    op.alter_column('stabilimenti', 'codice', server_default=None)
    
    # Aggiungi i constraint unique originali
    op.create_unique_constraint('uq_box_stabilimento_codice', 'box', ['stabilimento_id', 'codice'])
    op.create_unique_constraint('uq_stabilimento_sede_codice', 'stabilimenti', ['sede_id', 'codice'])
