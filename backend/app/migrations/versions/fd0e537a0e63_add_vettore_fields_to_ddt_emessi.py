"""add_vettore_fields_to_ddt_emessi

Revision ID: fd0e537a0e63
Revises: 20260104_ddt_emessi
Create Date: 2026-01-04 16:07:52.758860

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'fd0e537a0e63'
down_revision = '20260104_ddt_emessi'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add vettore fields to ddt_emessi table
    op.add_column('ddt_emessi', sa.Column('vettore_ragione_sociale', sa.String(length=200), nullable=True))
    op.add_column('ddt_emessi', sa.Column('vettore_sede_legale', sa.String(length=500), nullable=True))
    op.add_column('ddt_emessi', sa.Column('vettore_partita_iva', sa.String(length=50), nullable=True))
    op.add_column('ddt_emessi', sa.Column('vettore_licenza', sa.String(length=100), nullable=True))
    op.add_column('ddt_emessi', sa.Column('vettore_targhe', sa.String(length=200), nullable=True))
    op.add_column('ddt_emessi', sa.Column('vettore_autista', sa.String(length=200), nullable=True))


def downgrade() -> None:
    # Remove vettore fields from ddt_emessi table
    op.drop_column('ddt_emessi', 'vettore_autista')
    op.drop_column('ddt_emessi', 'vettore_targhe')
    op.drop_column('ddt_emessi', 'vettore_licenza')
    op.drop_column('ddt_emessi', 'vettore_partita_iva')
    op.drop_column('ddt_emessi', 'vettore_sede_legale')
    op.drop_column('ddt_emessi', 'vettore_ragione_sociale')

