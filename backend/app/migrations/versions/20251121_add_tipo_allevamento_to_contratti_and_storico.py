"""Add tipo allevamento to contratti and storico

Revision ID: 20251121_tipo_allevamento
Revises: 20251120_modalita_nullable
Create Date: 2025-11-21 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '20251121_tipo_allevamento'
down_revision = '20251120_modalita_nullable'
branch_labels = None
depends_on = None


def upgrade():
    # Prima rimuovi eventuali campi vecchi se esistono (per cleanup)
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('contratti_soccida')]
    
    # Rimuovi campi vecchi se esistono
    if 'tipo_allevamento_svezzamento' in columns:
        op.drop_column('contratti_soccida', 'tipo_allevamento_svezzamento')
    if 'tipo_allevamento_ingrasso' in columns:
        op.drop_column('contratti_soccida', 'tipo_allevamento_ingrasso')
    if 'prezzo_svezzamento' in columns:
        op.drop_column('contratti_soccida', 'prezzo_svezzamento')
    if 'prezzo_ingrasso' in columns:
        op.drop_column('contratti_soccida', 'prezzo_ingrasso')
    if 'percentuale_scarto_ingresso_svezzamento' in columns:
        op.drop_column('contratti_soccida', 'percentuale_scarto_ingresso_svezzamento')
    if 'percentuale_scarto_uscita_svezzamento' in columns:
        op.drop_column('contratti_soccida', 'percentuale_scarto_uscita_svezzamento')
    if 'percentuale_scarto_ingresso_ingrasso' in columns:
        op.drop_column('contratti_soccida', 'percentuale_scarto_ingresso_ingrasso')
    if 'percentuale_scarto_uscita_ingrasso' in columns:
        op.drop_column('contratti_soccida', 'percentuale_scarto_uscita_ingrasso')
    
    # Aggiungi campo tipo_allevamento al contratto soccida (un solo tipo per contratto)
    # Solo se non esiste già
    if 'tipo_allevamento' not in columns:
        op.add_column('contratti_soccida', sa.Column('tipo_allevamento', sa.String(length=20), nullable=True))
    
    # Aggiungi prezzo per tipo allevamento
    # Solo se non esiste già
    if 'prezzo_allevamento' not in columns:
        op.add_column('contratti_soccida', sa.Column('prezzo_allevamento', sa.Numeric(precision=10, scale=2), nullable=True))
    
    # Aggiungi constraint per tipo_allevamento (solo se non esiste già)
    try:
        op.create_check_constraint(
            'contratti_soccida_tipo_allevamento_check',
            'contratti_soccida',
            "tipo_allevamento IN ('svezzamento', 'ingrasso', 'universale') OR tipo_allevamento IS NULL"
        )
    except Exception:
        # Constraint già esistente, ignora
        pass
    
    # Crea tabella storico_tipo_allevamento
    op.create_table(
        'storico_tipo_allevamento',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('animale_id', sa.Integer(), nullable=False),
        sa.Column('contratto_soccida_id', sa.Integer(), nullable=True),
        sa.Column('tipo_allevamento_precedente', sa.String(length=20), nullable=True),
        sa.Column('tipo_allevamento_nuovo', sa.String(length=20), nullable=False),
        sa.Column('peso_ingresso', sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column('data_cambio', sa.Date(), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('annullato', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('data_annullamento', sa.DateTime(timezone=True), nullable=True),
        sa.Column('motivo_annullamento', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['animale_id'], ['animali.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['contratto_soccida_id'], ['contratti_soccida.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("tipo_allevamento_precedente IN ('svezzamento', 'ingrasso', 'universale') OR tipo_allevamento_precedente IS NULL", name='storico_tipo_allevamento_tipo_precedente_check'),
        sa.CheckConstraint("tipo_allevamento_nuovo IN ('svezzamento', 'ingrasso', 'universale')", name='storico_tipo_allevamento_tipo_nuovo_check')
    )
    op.create_index(op.f('ix_storico_tipo_allevamento_animale_id'), 'storico_tipo_allevamento', ['animale_id'], unique=False)
    op.create_index(op.f('ix_storico_tipo_allevamento_contratto_soccida_id'), 'storico_tipo_allevamento', ['contratto_soccida_id'], unique=False)


def downgrade():
    # Rimuovi tabella storico
    op.drop_index(op.f('ix_storico_tipo_allevamento_contratto_soccida_id'), table_name='storico_tipo_allevamento')
    op.drop_index(op.f('ix_storico_tipo_allevamento_animale_id'), table_name='storico_tipo_allevamento')
    op.drop_table('storico_tipo_allevamento')
    
    # Rimuovi constraint
    op.drop_constraint('contratti_soccida_tipo_allevamento_check', 'contratti_soccida', type_='check')
    
    # Rimuovi colonne da contratti_soccida
    op.drop_column('contratti_soccida', 'prezzo_allevamento')
    op.drop_column('contratti_soccida', 'tipo_allevamento')

