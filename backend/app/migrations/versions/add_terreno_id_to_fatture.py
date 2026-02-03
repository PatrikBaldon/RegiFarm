"""add_terreno_id_to_fatture

Revision ID: add_terreno_id_fatture
Revises: 14a7b1665634
Create Date: 2025-01-XX 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_terreno_id_fatture'
down_revision = '14a7b1665634'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Aggiungi terreno_id a fatture_emesse
    op.add_column('fatture_emesse', sa.Column('terreno_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_fatture_emesse_terreno',
        'fatture_emesse', 'terreni',
        ['terreno_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_fatture_emesse_terreno_id', 'fatture_emesse', ['terreno_id'])

    # Aggiungi terreno_id a fatture_amministrazione
    op.add_column('fatture_amministrazione', sa.Column('terreno_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_fatture_amministrazione_terreno',
        'fatture_amministrazione', 'terreni',
        ['terreno_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_fatture_amministrazione_terreno_id', 'fatture_amministrazione', ['terreno_id'])


def downgrade() -> None:
    # Rimuovi terreno_id da fatture_amministrazione
    op.drop_index('ix_fatture_amministrazione_terreno_id', table_name='fatture_amministrazione')
    op.drop_constraint('fk_fatture_amministrazione_terreno', 'fatture_amministrazione', type_='foreignkey')
    op.drop_column('fatture_amministrazione', 'terreno_id')

    # Rimuovi terreno_id da fatture_emesse
    op.drop_index('ix_fatture_emesse_terreno_id', table_name='fatture_emesse')
    op.drop_constraint('fk_fatture_emesse_terreno', 'fatture_emesse', type_='foreignkey')
    op.drop_column('fatture_emesse', 'terreno_id')

