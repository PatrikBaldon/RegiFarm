"""add terreni and related tables

Revision ID: 9a1b2c3d4e5f
Revises: 89df08758288
Create Date: 2025-10-30
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '9a1b2c3d4e5f'
down_revision = '563b79b3c1bc'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'terreni',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('azienda_id', sa.Integer(), sa.ForeignKey('aziende.id', ondelete='CASCADE'), index=True),
        sa.Column('denominazione', sa.String(length=150), nullable=False),
        sa.Column('localita', sa.String(length=200)),
        sa.Column('superficie', sa.Numeric(10, 2)),
        sa.Column('unita_misura', sa.String(length=10), server_default='ha'),
        sa.Column('di_proprieta', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('in_affitto', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('canone_mensile', sa.Numeric(12, 2)),
        sa.Column('canone_annuale', sa.Numeric(12, 2)),
        sa.Column('fattura_id', sa.Integer(), sa.ForeignKey('fatture.id')),
        sa.Column('note', sa.String(length=500)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True)),
        sa.Column('deleted_at', sa.DateTime(timezone=True), index=True),
    )

    op.create_table(
        'lavorazioni_terreno',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('terreno_id', sa.Integer(), sa.ForeignKey('terreni.id', ondelete='CASCADE'), index=True),
        sa.Column('data', sa.Date()),
        sa.Column('tipo', sa.String(length=50)),  # aratura, semina, trebbiatura, trinciatura, concimazione, etc.
        sa.Column('fattura_id', sa.Integer(), sa.ForeignKey('fatture.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('costo_totale', sa.Numeric(12, 2)),
        sa.Column('note', sa.String(length=500)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True)),
        sa.Column('deleted_at', sa.DateTime(timezone=True), index=True),
    )

    op.create_table(
        'raccolti_terreno',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('terreno_id', sa.Integer(), sa.ForeignKey('terreni.id', ondelete='CASCADE'), index=True),
        sa.Column('prodotto', sa.String(length=100), nullable=False),  # es: loietto, mais ceroso, frumento
        sa.Column('data_inizio', sa.Date()),
        sa.Column('data_fine', sa.Date()),
        sa.Column('resa_quantita', sa.Numeric(12, 3)),
        sa.Column('unita_misura', sa.String(length=10), server_default='q'),
        sa.Column('destinazione', sa.String(length=20)),  # venduto | autoconsumo
        sa.Column('prezzo_vendita', sa.Numeric(12, 2)),
        sa.Column('note', sa.String(length=500)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True)),
        sa.Column('deleted_at', sa.DateTime(timezone=True), index=True),
    )


def downgrade() -> None:
    op.drop_table('raccolti_terreno')
    op.drop_table('lavorazioni_terreno')
    op.drop_table('terreni')
