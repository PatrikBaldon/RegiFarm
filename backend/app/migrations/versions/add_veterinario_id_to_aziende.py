"""add_veterinario_id_to_aziende

Revision ID: add_veterinario_aziende
Revises: create_impostazioni
Create Date: 2025-01-XX 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_veterinario_aziende'
down_revision = 'create_impostazioni'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Aggiungi veterinario_id a aziende
    op.add_column('aziende', sa.Column('veterinario_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_aziende_veterinario',
        'aziende', 'fornitori',
        ['veterinario_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_aziende_veterinario_id', 'aziende', ['veterinario_id'])


def downgrade() -> None:
    op.drop_index('ix_aziende_veterinario_id', table_name='aziende')
    op.drop_constraint('fk_aziende_veterinario', 'aziende', type_='foreignkey')
    op.drop_column('aziende', 'veterinario_id')

