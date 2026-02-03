"""add_polizze_attrezzature_tables

Revision ID: 20250115_polizze_attrezzature
Revises: 
Create Date: 2025-01-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20250115_polizze_attrezzature'
down_revision = None  # Will be set to latest migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create polizze_attrezzature table
    op.create_table(
        'polizze_attrezzature',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('attrezzatura_id', sa.Integer(), nullable=False),
        sa.Column('azienda_id', sa.Integer(), nullable=False),
        sa.Column('tipo_polizza', sa.String(length=20), nullable=False),
        sa.Column('numero_polizza', sa.String(length=100), nullable=False),
        sa.Column('compagnia', sa.String(length=200), nullable=False),
        sa.Column('data_inizio', sa.Date(), nullable=False),
        sa.Column('data_scadenza', sa.Date(), nullable=False),
        sa.Column('premio_annuale', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('importo_assicurato', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('coperture', sa.Text(), nullable=True),  # JSON stored as text
        sa.Column('numero_rate', sa.Integer(), nullable=True, server_default='1'),
        sa.Column('data_prossimo_pagamento', sa.Date(), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('allegato_path', sa.String(length=500), nullable=True),
        sa.Column('attiva', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['attrezzatura_id'], ['attrezzature.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['azienda_id'], ['aziende.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_polizze_attrezzature_attrezzatura_id'), 'polizze_attrezzature', ['attrezzatura_id'], unique=False)
    op.create_index(op.f('ix_polizze_attrezzature_azienda_id'), 'polizze_attrezzature', ['azienda_id'], unique=False)
    op.create_index(op.f('ix_polizze_attrezzature_numero_polizza'), 'polizze_attrezzature', ['numero_polizza'], unique=False)
    op.create_index(op.f('ix_polizze_attrezzature_data_inizio'), 'polizze_attrezzature', ['data_inizio'], unique=False)
    op.create_index(op.f('ix_polizze_attrezzature_data_scadenza'), 'polizze_attrezzature', ['data_scadenza'], unique=False)
    op.create_index(op.f('ix_polizze_attrezzature_deleted_at'), 'polizze_attrezzature', ['deleted_at'], unique=False)

    # Create polizza_pagamenti table
    op.create_table(
        'polizza_pagamenti',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('polizza_id', sa.Integer(), nullable=False),
        sa.Column('importo', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('data_pagamento', sa.Date(), nullable=False),
        sa.Column('numero_rate', sa.Integer(), nullable=True),
        sa.Column('rata_numero', sa.Integer(), nullable=True),
        sa.Column('prima_nota_movimento_id', sa.Integer(), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['polizza_id'], ['polizze_attrezzature.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['prima_nota_movimento_id'], ['pn_movimenti.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_polizza_pagamenti_polizza_id'), 'polizza_pagamenti', ['polizza_id'], unique=False)
    op.create_index(op.f('ix_polizza_pagamenti_prima_nota_movimento_id'), 'polizza_pagamenti', ['prima_nota_movimento_id'], unique=False)
    op.create_index(op.f('ix_polizza_pagamenti_data_pagamento'), 'polizza_pagamenti', ['data_pagamento'], unique=False)
    op.create_index(op.f('ix_polizza_pagamenti_deleted_at'), 'polizza_pagamenti', ['deleted_at'], unique=False)

    # Create polizza_rinnovi table
    op.create_table(
        'polizza_rinnovi',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('polizza_id', sa.Integer(), nullable=False),
        sa.Column('data_rinnovo', sa.Date(), nullable=False),
        sa.Column('premio_precedente', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('premio_nuovo', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('coperture_precedenti', sa.Text(), nullable=True),  # JSON stored as text
        sa.Column('coperture_nuove', sa.Text(), nullable=True),  # JSON stored as text
        sa.Column('note_cambiamenti', sa.Text(), nullable=True),
        sa.Column('nuova_data_inizio', sa.Date(), nullable=True),
        sa.Column('nuova_data_scadenza', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['polizza_id'], ['polizze_attrezzature.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_polizza_rinnovi_polizza_id'), 'polizza_rinnovi', ['polizza_id'], unique=False)
    op.create_index(op.f('ix_polizza_rinnovi_data_rinnovo'), 'polizza_rinnovi', ['data_rinnovo'], unique=False)
    op.create_index(op.f('ix_polizza_rinnovi_deleted_at'), 'polizza_rinnovi', ['deleted_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_polizza_rinnovi_deleted_at'), table_name='polizza_rinnovi')
    op.drop_index(op.f('ix_polizza_rinnovi_data_rinnovo'), table_name='polizza_rinnovi')
    op.drop_index(op.f('ix_polizza_rinnovi_polizza_id'), table_name='polizza_rinnovi')
    op.drop_table('polizza_rinnovi')
    
    op.drop_index(op.f('ix_polizza_pagamenti_deleted_at'), table_name='polizza_pagamenti')
    op.drop_index(op.f('ix_polizza_pagamenti_data_pagamento'), table_name='polizza_pagamenti')
    op.drop_index(op.f('ix_polizza_pagamenti_prima_nota_movimento_id'), table_name='polizza_pagamenti')
    op.drop_index(op.f('ix_polizza_pagamenti_polizza_id'), table_name='polizza_pagamenti')
    op.drop_table('polizza_pagamenti')
    
    op.drop_index(op.f('ix_polizze_attrezzature_deleted_at'), table_name='polizze_attrezzature')
    op.drop_index(op.f('ix_polizze_attrezzature_data_scadenza'), table_name='polizze_attrezzature')
    op.drop_index(op.f('ix_polizze_attrezzature_data_inizio'), table_name='polizze_attrezzature')
    op.drop_index(op.f('ix_polizze_attrezzature_numero_polizza'), table_name='polizze_attrezzature')
    op.drop_index(op.f('ix_polizze_attrezzature_azienda_id'), table_name='polizze_attrezzature')
    op.drop_index(op.f('ix_polizze_attrezzature_attrezzatura_id'), table_name='polizze_attrezzature')
    op.drop_table('polizze_attrezzature')

