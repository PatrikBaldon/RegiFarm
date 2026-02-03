"""add_ddt_emessi_table

Revision ID: 20260104_ddt_emessi
Revises: 20260103_merge_heads
Create Date: 2026-01-04

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260104_ddt_emessi'
down_revision = '20260103_merge_heads'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create ddt_emessi table
    op.create_table(
        'ddt_emessi',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('azienda_id', sa.Integer(), nullable=False),
        sa.Column('numero_progressivo', sa.Integer(), nullable=False),
        sa.Column('anno', sa.Integer(), nullable=False),
        sa.Column('numero', sa.String(length=50), nullable=False),
        sa.Column('data', sa.Date(), nullable=False),
        sa.Column('cliente_id', sa.Integer(), nullable=True),
        sa.Column('destinatario_nome', sa.String(length=200), nullable=True),
        sa.Column('destinatario_indirizzo', sa.String(length=500), nullable=True),
        sa.Column('destinatario_cap', sa.String(length=10), nullable=True),
        sa.Column('destinatario_comune', sa.String(length=120), nullable=True),
        sa.Column('destinatario_provincia', sa.String(length=10), nullable=True),
        sa.Column('destinatario_nazione', sa.String(length=5), nullable=True, server_default='IT'),
        sa.Column('destinatario_piva', sa.String(length=50), nullable=True),
        sa.Column('destinatario_cf', sa.String(length=50), nullable=True),
        sa.Column('luogo_destinazione', sa.String(length=200), nullable=True),
        sa.Column('causale_trasporto', sa.String(length=200), nullable=True),
        sa.Column('aspetto_beni', sa.String(length=200), nullable=True),
        sa.Column('numero_colli', sa.Integer(), nullable=True),
        sa.Column('peso_lordo', sa.Numeric(precision=10, scale=3), nullable=True),
        sa.Column('peso_netto', sa.Numeric(precision=10, scale=3), nullable=True),
        sa.Column('data_inizio_trasporto', sa.DateTime(timezone=True), nullable=True),
        sa.Column('trasporto_a_mezzo', sa.String(length=50), nullable=True),
        sa.Column('vettore', sa.String(length=200), nullable=True),
        sa.Column('data_ritiro', sa.Date(), nullable=True),
        sa.Column('articoli', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('annotazioni', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['azienda_id'], ['aziende.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['cliente_id'], ['fornitori.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ddt_emessi_azienda_id'), 'ddt_emessi', ['azienda_id'], unique=False)
    op.create_index(op.f('ix_ddt_emessi_numero_progressivo'), 'ddt_emessi', ['numero_progressivo'], unique=False)
    op.create_index(op.f('ix_ddt_emessi_anno'), 'ddt_emessi', ['anno'], unique=False)
    op.create_index(op.f('ix_ddt_emessi_numero'), 'ddt_emessi', ['numero'], unique=False)
    op.create_index(op.f('ix_ddt_emessi_data'), 'ddt_emessi', ['data'], unique=False)
    op.create_index(op.f('ix_ddt_emessi_cliente_id'), 'ddt_emessi', ['cliente_id'], unique=False)
    op.create_index(op.f('ix_ddt_emessi_deleted_at'), 'ddt_emessi', ['deleted_at'], unique=False)
    
    # Create unique constraint on (azienda_id, anno, numero_progressivo) to prevent duplicates
    op.create_index('ix_ddt_emessi_azienda_anno_progressivo', 'ddt_emessi', ['azienda_id', 'anno', 'numero_progressivo'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_ddt_emessi_azienda_anno_progressivo', table_name='ddt_emessi')
    op.drop_index(op.f('ix_ddt_emessi_deleted_at'), table_name='ddt_emessi')
    op.drop_index(op.f('ix_ddt_emessi_cliente_id'), table_name='ddt_emessi')
    op.drop_index(op.f('ix_ddt_emessi_data'), table_name='ddt_emessi')
    op.drop_index(op.f('ix_ddt_emessi_numero'), table_name='ddt_emessi')
    op.drop_index(op.f('ix_ddt_emessi_anno'), table_name='ddt_emessi')
    op.drop_index(op.f('ix_ddt_emessi_numero_progressivo'), table_name='ddt_emessi')
    op.drop_index(op.f('ix_ddt_emessi_azienda_id'), table_name='ddt_emessi')
    op.drop_table('ddt_emessi')

