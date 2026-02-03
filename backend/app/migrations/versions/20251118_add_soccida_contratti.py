"""Add soccida contratti support

Revision ID: 20251118_soccida_contratti
Revises: 20251117_attrezz_link
Create Date: 2025-11-18

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20251118_soccida_contratti'
down_revision = '20251117_attrezz_link'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Aggiungi campi is_fornitore e is_cliente alla tabella fornitori
    # Un fornitore può essere sia fornitore che cliente contemporaneamente
    op.add_column('fornitori', sa.Column('is_fornitore', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('fornitori', sa.Column('is_cliente', sa.Boolean(), nullable=False, server_default='false'))
    op.create_index('ix_fornitori_is_fornitore', 'fornitori', ['is_fornitore'])
    op.create_index('ix_fornitori_is_cliente', 'fornitori', ['is_cliente'])
    
    # Crea tabella contratti_soccida
    op.create_table(
        'contratti_soccida',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('azienda_id', sa.Integer(), nullable=False),
        sa.Column('soccidante_id', sa.Integer(), nullable=False),
        sa.Column('numero_contratto', sa.String(length=50), nullable=True),
        sa.Column('data_inizio', sa.Date(), nullable=False),
        sa.Column('data_fine', sa.Date(), nullable=True),
        sa.Column('tipologia', sa.String(length=50), nullable=False),
        sa.Column('modalita_remunerazione', sa.String(length=50), nullable=False),
        sa.Column('quota_giornaliera', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('prezzo_per_kg', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('percentuale_remunerazione', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('percentuale_soccidante', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('mangimi_a_carico_soccidante', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('medicinali_a_carico_soccidante', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('quota_decesso_tipo', sa.String(length=20), nullable=True),
        sa.Column('quota_decesso_valore', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('termine_responsabilita_soccidario_giorni', sa.Integer(), nullable=True),
        sa.Column('copertura_totale_soccidante', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('percentuale_aggiunta_arrivo', sa.Numeric(precision=5, scale=2), nullable=True, server_default='0'),
        sa.Column('percentuale_sottrazione_uscita', sa.Numeric(precision=5, scale=2), nullable=True, server_default='0'),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('condizioni_particolari', sa.Text(), nullable=True),
        sa.Column('attivo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['azienda_id'], ['aziende.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['soccidante_id'], ['fornitori.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_index('ix_contratti_soccida_id', 'contratti_soccida', ['id'])
    op.create_index('ix_contratti_soccida_azienda_id', 'contratti_soccida', ['azienda_id'])
    op.create_index('ix_contratti_soccida_soccidante_id', 'contratti_soccida', ['soccidante_id'])
    op.create_index('ix_contratti_soccida_tipologia', 'contratti_soccida', ['tipologia'])
    op.create_index('ix_contratti_soccida_attivo', 'contratti_soccida', ['attivo'])
    op.create_index('ix_contratti_soccida_numero_contratto', 'contratti_soccida', ['numero_contratto'])
    op.create_index('ix_contratti_soccida_deleted_at', 'contratti_soccida', ['deleted_at'])
    
    # Aggiungi constraint per tipologia
    op.create_check_constraint(
        'ck_contratti_soccida_tipologia',
        'contratti_soccida',
        "tipologia IN ('semplice', 'parziaria', 'con_pascolo', 'monetizzato')"
    )
    
    # Aggiungi constraint per modalita_remunerazione
    op.create_check_constraint(
        'ck_contratti_soccida_modalita_remunerazione',
        'contratti_soccida',
        "modalita_remunerazione IN ('ripartizione_utili', 'quota_giornaliera', 'prezzo_kg', 'percentuale')"
    )
    
    # Aggiungi constraint per quota_decesso_tipo
    op.create_check_constraint(
        'ck_contratti_soccida_quota_decesso_tipo',
        'contratti_soccida',
        "quota_decesso_tipo IN ('fissa', 'per_capo', 'percentuale') OR quota_decesso_tipo IS NULL"
    )
    
    # Aggiungi campo contratto_soccida_id alla tabella animali
    op.add_column('animali', sa.Column('contratto_soccida_id', sa.Integer(), nullable=True))
    op.create_index('ix_animali_contratto_soccida_id', 'animali', ['contratto_soccida_id'])
    op.create_foreign_key(
        'fk_animali_contratto_soccida',
        'animali',
        'contratti_soccida',
        ['contratto_soccida_id'],
        ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    # Rimuovi campo contratto_soccida_id da animali
    op.drop_constraint('fk_animali_contratto_soccida', 'animali', type_='foreignkey')
    op.drop_index('ix_animali_contratto_soccida_id', table_name='animali')
    op.drop_column('animali', 'contratto_soccida_id')
    
    # Rimuovi tabella contratti_soccida
    op.drop_constraint('ck_contratti_soccida_quota_decesso_tipo', 'contratti_soccida', type_='check')
    op.drop_constraint('ck_contratti_soccida_modalita_remunerazione', 'contratti_soccida', type_='check')
    op.drop_constraint('ck_contratti_soccida_tipologia', 'contratti_soccida', type_='check')
    op.drop_index('ix_contratti_soccida_deleted_at', table_name='contratti_soccida')
    op.drop_index('ix_contratti_soccida_numero_contratto', table_name='contratti_soccida')
    op.drop_index('ix_contratti_soccida_attivo', table_name='contratti_soccida')
    op.drop_index('ix_contratti_soccida_tipologia', table_name='contratti_soccida')
    op.drop_index('ix_contratti_soccida_soccidante_id', table_name='contratti_soccida')
    op.drop_index('ix_contratti_soccida_azienda_id', table_name='contratti_soccida')
    op.drop_index('ix_contratti_soccida_id', table_name='contratti_soccida')
    op.drop_table('contratti_soccida')
    
    # Rimuovi campi is_fornitore e is_cliente da fornitori
    op.drop_index('ix_fornitori_is_cliente', table_name='fornitori')
    op.drop_index('ix_fornitori_is_fornitore', table_name='fornitori')
    op.drop_column('fornitori', 'is_cliente')
    op.drop_column('fornitori', 'is_fornitore')

