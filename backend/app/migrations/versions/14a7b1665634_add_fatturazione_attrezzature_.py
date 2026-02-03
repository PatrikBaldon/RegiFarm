"""add_fatturazione_attrezzature_assicurazioni_tables

Revision ID: 14a7b1665634
Revises: abc123def456
Create Date: 2025-11-03 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '14a7b1665634'
down_revision = 'abc123def456'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ============ FATTURE EMESSE ============
    op.create_table('fatture_emesse',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('azienda_id', sa.Integer(), nullable=False),
        sa.Column('numero', sa.String(length=50), nullable=False),
        sa.Column('data_fattura', sa.Date(), nullable=False),
        sa.Column('data_registrazione', sa.Date(), nullable=False, server_default=sa.text('CURRENT_DATE')),
        sa.Column('cliente_id', sa.Integer(), nullable=True),
        sa.Column('cliente_nome', sa.String(length=200), nullable=True),
        sa.Column('cliente_piva', sa.String(length=50), nullable=True),
        sa.Column('cliente_cf', sa.String(length=50), nullable=True),
        sa.Column('importo_totale', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('importo_iva', sa.Numeric(precision=12, scale=2), server_default='0', nullable=True),
        sa.Column('importo_netto', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('importo_incassato', sa.Numeric(precision=12, scale=2), server_default='0', nullable=True),
        sa.Column('stato_pagamento', sa.String(length=20), nullable=False, server_default='da_incassare'),
        sa.Column('data_scadenza', sa.Date(), nullable=True),
        sa.Column('data_incasso', sa.Date(), nullable=True),
        sa.Column('aliquota_iva', sa.Numeric(precision=5, scale=2), server_default='0', nullable=True),
        sa.Column('categoria', sa.String(length=100), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('allegato_path', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['azienda_id'], ['aziende.id'], ),
        sa.ForeignKeyConstraint(['cliente_id'], ['fornitori.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_fatture_emesse_id'), 'fatture_emesse', ['id'], unique=False)
    op.create_index(op.f('ix_fatture_emesse_azienda_id'), 'fatture_emesse', ['azienda_id'], unique=False)
    op.create_index(op.f('ix_fatture_emesse_numero'), 'fatture_emesse', ['numero'], unique=False)
    op.create_index(op.f('ix_fatture_emesse_data_fattura'), 'fatture_emesse', ['data_fattura'], unique=False)
    op.create_index(op.f('ix_fatture_emesse_data_scadenza'), 'fatture_emesse', ['data_scadenza'], unique=False)
    op.create_index(op.f('ix_fatture_emesse_cliente_id'), 'fatture_emesse', ['cliente_id'], unique=False)
    op.create_index(op.f('ix_fatture_emesse_categoria'), 'fatture_emesse', ['categoria'], unique=False)
    op.create_index(op.f('ix_fatture_emesse_deleted_at'), 'fatture_emesse', ['deleted_at'], unique=False)

    # ============ PAGAMENTI ============
    op.create_table('pagamenti',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('azienda_id', sa.Integer(), nullable=False),
        sa.Column('tipo', sa.String(length=20), nullable=False),
        sa.Column('fattura_emessa_id', sa.Integer(), nullable=True),
        sa.Column('fattura_amministrazione_id', sa.Integer(), nullable=True),
        sa.Column('importo', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('data_pagamento', sa.Date(), nullable=False),
        sa.Column('data_valuta', sa.Date(), nullable=True),
        sa.Column('metodo', sa.String(length=20), nullable=False, server_default='contanti'),
        sa.Column('numero_riferimento', sa.String(length=100), nullable=True),
        sa.Column('banca', sa.String(length=200), nullable=True),
        sa.Column('iban', sa.String(length=34), nullable=True),
        sa.Column('descrizione', sa.String(length=500), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['azienda_id'], ['aziende.id'], ),
        sa.ForeignKeyConstraint(['fattura_emessa_id'], ['fatture_emesse.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['fattura_amministrazione_id'], ['fatture_amministrazione.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_pagamenti_id'), 'pagamenti', ['id'], unique=False)
    op.create_index(op.f('ix_pagamenti_azienda_id'), 'pagamenti', ['azienda_id'], unique=False)
    op.create_index(op.f('ix_pagamenti_fattura_emessa_id'), 'pagamenti', ['fattura_emessa_id'], unique=False)
    op.create_index(op.f('ix_pagamenti_fattura_amministrazione_id'), 'pagamenti', ['fattura_amministrazione_id'], unique=False)
    op.create_index(op.f('ix_pagamenti_data_pagamento'), 'pagamenti', ['data_pagamento'], unique=False)
    op.create_index(op.f('ix_pagamenti_deleted_at'), 'pagamenti', ['deleted_at'], unique=False)

    # ============ PRIMA NOTA ============
    op.create_table('prima_nota',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('azienda_id', sa.Integer(), nullable=False),
        sa.Column('tipo', sa.String(length=20), nullable=False),
        sa.Column('categoria', sa.String(length=20), nullable=False, server_default='altro'),
        sa.Column('data', sa.Date(), nullable=False),
        sa.Column('importo', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('descrizione', sa.String(length=500), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('fattura_emessa_id', sa.Integer(), nullable=True),
        sa.Column('fattura_amministrazione_id', sa.Integer(), nullable=True),
        sa.Column('pagamento_id', sa.Integer(), nullable=True),
        sa.Column('metodo_pagamento', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['azienda_id'], ['aziende.id'], ),
        sa.ForeignKeyConstraint(['fattura_emessa_id'], ['fatture_emesse.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['fattura_amministrazione_id'], ['fatture_amministrazione.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['pagamento_id'], ['pagamenti.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_prima_nota_id'), 'prima_nota', ['id'], unique=False)
    op.create_index(op.f('ix_prima_nota_azienda_id'), 'prima_nota', ['azienda_id'], unique=False)
    op.create_index(op.f('ix_prima_nota_data'), 'prima_nota', ['data'], unique=False)
    op.create_index(op.f('ix_prima_nota_fattura_emessa_id'), 'prima_nota', ['fattura_emessa_id'], unique=False)
    op.create_index(op.f('ix_prima_nota_fattura_amministrazione_id'), 'prima_nota', ['fattura_amministrazione_id'], unique=False)
    op.create_index(op.f('ix_prima_nota_deleted_at'), 'prima_nota', ['deleted_at'], unique=False)

    # ============ ATTREZZATURE ============
    op.create_table('attrezzature',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('azienda_id', sa.Integer(), nullable=False),
        sa.Column('nome', sa.String(length=200), nullable=False),
        sa.Column('tipo', sa.String(length=20), nullable=False, server_default='altro'),
        sa.Column('marca', sa.String(length=100), nullable=True),
        sa.Column('modello', sa.String(length=100), nullable=True),
        sa.Column('numero_serie', sa.String(length=100), nullable=True),
        sa.Column('targa', sa.String(length=20), nullable=True),
        sa.Column('data_acquisto', sa.Date(), nullable=True),
        sa.Column('costo_acquisto', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('fornitore_id', sa.Integer(), nullable=True),
        sa.Column('valore_residuo', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('durata_ammortamento_anni', sa.Integer(), nullable=True),
        sa.Column('metodo_ammortamento', sa.String(length=50), nullable=True),
        sa.Column('attiva', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['azienda_id'], ['aziende.id'], ),
        sa.ForeignKeyConstraint(['fornitore_id'], ['fornitori.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_attrezzature_id'), 'attrezzature', ['id'], unique=False)
    op.create_index(op.f('ix_attrezzature_azienda_id'), 'attrezzature', ['azienda_id'], unique=False)
    op.create_index(op.f('ix_attrezzature_numero_serie'), 'attrezzature', ['numero_serie'], unique=False)
    op.create_index(op.f('ix_attrezzature_targa'), 'attrezzature', ['targa'], unique=False)
    op.create_index(op.f('ix_attrezzature_deleted_at'), 'attrezzature', ['deleted_at'], unique=False)

    # ============ SCADENZE ATTREZZATURE ============
    op.create_table('scadenze_attrezzature',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('attrezzatura_id', sa.Integer(), nullable=False),
        sa.Column('tipo', sa.String(length=20), nullable=False),
        sa.Column('descrizione', sa.String(length=200), nullable=False),
        sa.Column('data_scadenza', sa.Date(), nullable=False),
        sa.Column('data_ultimo_rinnovo', sa.Date(), nullable=True),
        sa.Column('costo', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('numero_polizza', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['attrezzatura_id'], ['attrezzature.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_scadenze_attrezzature_id'), 'scadenze_attrezzature', ['id'], unique=False)
    op.create_index(op.f('ix_scadenze_attrezzature_attrezzatura_id'), 'scadenze_attrezzature', ['attrezzatura_id'], unique=False)
    op.create_index(op.f('ix_scadenze_attrezzature_data_scadenza'), 'scadenze_attrezzature', ['data_scadenza'], unique=False)
    op.create_index(op.f('ix_scadenze_attrezzature_deleted_at'), 'scadenze_attrezzature', ['deleted_at'], unique=False)

    # ============ AMMORTAMENTI ============
    op.create_table('ammortamenti',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('attrezzatura_id', sa.Integer(), nullable=False),
        sa.Column('azienda_id', sa.Integer(), nullable=False),
        sa.Column('anno', sa.Integer(), nullable=False),
        sa.Column('mese', sa.Integer(), nullable=True),
        sa.Column('quota_ammortamento', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('valore_residuo', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['attrezzatura_id'], ['attrezzature.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['azienda_id'], ['aziende.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ammortamenti_id'), 'ammortamenti', ['id'], unique=False)
    op.create_index(op.f('ix_ammortamenti_attrezzatura_id'), 'ammortamenti', ['attrezzatura_id'], unique=False)
    op.create_index(op.f('ix_ammortamenti_azienda_id'), 'ammortamenti', ['azienda_id'], unique=False)
    op.create_index(op.f('ix_ammortamenti_anno'), 'ammortamenti', ['anno'], unique=False)
    op.create_index(op.f('ix_ammortamenti_deleted_at'), 'ammortamenti', ['deleted_at'], unique=False)

    # ============ ASSICURAZIONI AZIENDALI ============
    op.create_table('assicurazioni_aziendali',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('azienda_id', sa.Integer(), nullable=False),
        sa.Column('tipo', sa.String(length=20), nullable=False),
        sa.Column('numero_polizza', sa.String(length=100), nullable=False),
        sa.Column('compagnia', sa.String(length=200), nullable=False),
        sa.Column('data_inizio', sa.Date(), nullable=False),
        sa.Column('data_scadenza', sa.Date(), nullable=False),
        sa.Column('premio_annuale', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('importo_assicurato', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('numero_rate', sa.Integer(), server_default='1', nullable=True),
        sa.Column('data_prossimo_pagamento', sa.Date(), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('allegato_path', sa.String(length=500), nullable=True),
        sa.Column('attiva', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['azienda_id'], ['aziende.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_assicurazioni_aziendali_id'), 'assicurazioni_aziendali', ['id'], unique=False)
    op.create_index(op.f('ix_assicurazioni_aziendali_azienda_id'), 'assicurazioni_aziendali', ['azienda_id'], unique=False)
    op.create_index(op.f('ix_assicurazioni_aziendali_numero_polizza'), 'assicurazioni_aziendali', ['numero_polizza'], unique=False)
    op.create_index(op.f('ix_assicurazioni_aziendali_data_inizio'), 'assicurazioni_aziendali', ['data_inizio'], unique=False)
    op.create_index(op.f('ix_assicurazioni_aziendali_data_scadenza'), 'assicurazioni_aziendali', ['data_scadenza'], unique=False)
    op.create_index(op.f('ix_assicurazioni_aziendali_deleted_at'), 'assicurazioni_aziendali', ['deleted_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_assicurazioni_aziendali_deleted_at'), table_name='assicurazioni_aziendali')
    op.drop_index(op.f('ix_assicurazioni_aziendali_data_scadenza'), table_name='assicurazioni_aziendali')
    op.drop_index(op.f('ix_assicurazioni_aziendali_data_inizio'), table_name='assicurazioni_aziendali')
    op.drop_index(op.f('ix_assicurazioni_aziendali_numero_polizza'), table_name='assicurazioni_aziendali')
    op.drop_index(op.f('ix_assicurazioni_aziendali_azienda_id'), table_name='assicurazioni_aziendali')
    op.drop_index(op.f('ix_assicurazioni_aziendali_id'), table_name='assicurazioni_aziendali')
    op.drop_table('assicurazioni_aziendali')

    op.drop_index(op.f('ix_ammortamenti_deleted_at'), table_name='ammortamenti')
    op.drop_index(op.f('ix_ammortamenti_anno'), table_name='ammortamenti')
    op.drop_index(op.f('ix_ammortamenti_azienda_id'), table_name='ammortamenti')
    op.drop_index(op.f('ix_ammortamenti_attrezzatura_id'), table_name='ammortamenti')
    op.drop_index(op.f('ix_ammortamenti_id'), table_name='ammortamenti')
    op.drop_table('ammortamenti')

    op.drop_index(op.f('ix_scadenze_attrezzature_deleted_at'), table_name='scadenze_attrezzature')
    op.drop_index(op.f('ix_scadenze_attrezzature_data_scadenza'), table_name='scadenze_attrezzature')
    op.drop_index(op.f('ix_scadenze_attrezzature_attrezzatura_id'), table_name='scadenze_attrezzature')
    op.drop_index(op.f('ix_scadenze_attrezzature_id'), table_name='scadenze_attrezzature')
    op.drop_table('scadenze_attrezzature')

    op.drop_index(op.f('ix_attrezzature_deleted_at'), table_name='attrezzature')
    op.drop_index(op.f('ix_attrezzature_targa'), table_name='attrezzature')
    op.drop_index(op.f('ix_attrezzature_numero_serie'), table_name='attrezzature')
    op.drop_index(op.f('ix_attrezzature_azienda_id'), table_name='attrezzature')
    op.drop_index(op.f('ix_attrezzature_id'), table_name='attrezzature')
    op.drop_table('attrezzature')

    op.drop_index(op.f('ix_prima_nota_deleted_at'), table_name='prima_nota')
    op.drop_index(op.f('ix_prima_nota_fattura_amministrazione_id'), table_name='prima_nota')
    op.drop_index(op.f('ix_prima_nota_fattura_emessa_id'), table_name='prima_nota')
    op.drop_index(op.f('ix_prima_nota_data'), table_name='prima_nota')
    op.drop_index(op.f('ix_prima_nota_azienda_id'), table_name='prima_nota')
    op.drop_index(op.f('ix_prima_nota_id'), table_name='prima_nota')
    op.drop_table('prima_nota')

    op.drop_index(op.f('ix_pagamenti_deleted_at'), table_name='pagamenti')
    op.drop_index(op.f('ix_pagamenti_data_pagamento'), table_name='pagamenti')
    op.drop_index(op.f('ix_pagamenti_fattura_amministrazione_id'), table_name='pagamenti')
    op.drop_index(op.f('ix_pagamenti_fattura_emessa_id'), table_name='pagamenti')
    op.drop_index(op.f('ix_pagamenti_azienda_id'), table_name='pagamenti')
    op.drop_index(op.f('ix_pagamenti_id'), table_name='pagamenti')
    op.drop_table('pagamenti')

    op.drop_index(op.f('ix_fatture_emesse_deleted_at'), table_name='fatture_emesse')
    op.drop_index(op.f('ix_fatture_emesse_categoria'), table_name='fatture_emesse')
    op.drop_index(op.f('ix_fatture_emesse_cliente_id'), table_name='fatture_emesse')
    op.drop_index(op.f('ix_fatture_emesse_data_scadenza'), table_name='fatture_emesse')
    op.drop_index(op.f('ix_fatture_emesse_data_fattura'), table_name='fatture_emesse')
    op.drop_index(op.f('ix_fatture_emesse_numero'), table_name='fatture_emesse')
    op.drop_index(op.f('ix_fatture_emesse_azienda_id'), table_name='fatture_emesse')
    op.drop_index(op.f('ix_fatture_emesse_id'), table_name='fatture_emesse')
    op.drop_table('fatture_emesse')
