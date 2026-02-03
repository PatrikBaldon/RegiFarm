"""add gruppo_decessi table

Revision ID: f7g8h9i0j1k2
Revises: 59dcb80eca6e
Create Date: 2024-01-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = 'f7g8h9i0j1k2'
down_revision = '59dcb80eca6e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    existing_tables = set(inspector.get_table_names())
    if 'gruppi_decessi' not in existing_tables:
        op.create_table(
            'gruppi_decessi',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('azienda_id', sa.Integer(), nullable=False),
            sa.Column('data_uscita', sa.Date(), nullable=False),
            sa.Column('numero_certificato_smaltimento', sa.String(length=100), nullable=True),
            sa.Column('fattura_smaltimento_id', sa.Integer(), nullable=True),
            sa.Column('valore_economico_totale', sa.Numeric(precision=10, scale=2), nullable=True),
            sa.Column('a_carico', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('file_anagrafe_origine', sa.String(length=500), nullable=True),
            sa.Column('data_importazione', sa.DateTime(timezone=True), nullable=True),
            sa.Column('note', sa.String(length=500), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['azienda_id'], ['aziende.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['fattura_smaltimento_id'], ['fatture_amministrazione.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_gruppi_decessi_id'), 'gruppi_decessi', ['id'], unique=False)
        op.create_index(op.f('ix_gruppi_decessi_azienda_id'), 'gruppi_decessi', ['azienda_id'], unique=False)
        op.create_index(op.f('ix_gruppi_decessi_data_uscita'), 'gruppi_decessi', ['data_uscita'], unique=False)
        op.create_index(op.f('ix_gruppi_decessi_numero_certificato_smaltimento'), 'gruppi_decessi', ['numero_certificato_smaltimento'], unique=False)
        op.create_index(op.f('ix_gruppi_decessi_fattura_smaltimento_id'), 'gruppi_decessi', ['fattura_smaltimento_id'], unique=False)
        op.create_index(op.f('ix_gruppi_decessi_deleted_at'), 'gruppi_decessi', ['deleted_at'], unique=False)

    columns = {col['name'] for col in inspector.get_columns('decessi')}
    if 'gruppo_decessi_id' not in columns:
        op.add_column('decessi', sa.Column('gruppo_decessi_id', sa.Integer(), nullable=True))
        op.create_foreign_key(
            'fk_decessi_gruppo_decessi_id',
            'decessi',
            'gruppi_decessi',
            ['gruppo_decessi_id'],
            ['id'],
            ondelete='SET NULL'
        )
        op.create_index(op.f('ix_decessi_gruppo_decessi_id'), 'decessi', ['gruppo_decessi_id'], unique=False)


def downgrade() -> None:
    # Rimuovi colonna gruppo_decessi_id da decessi
    op.drop_index(op.f('ix_decessi_gruppo_decessi_id'), table_name='decessi')
    op.drop_constraint('fk_decessi_gruppo_decessi_id', 'decessi', type_='foreignkey')
    op.drop_column('decessi', 'gruppo_decessi_id')

    # Rimuovi tabella gruppi_decessi
    op.drop_index(op.f('ix_gruppi_decessi_deleted_at'), table_name='gruppi_decessi')
    op.drop_index(op.f('ix_gruppi_decessi_fattura_smaltimento_id'), table_name='gruppi_decessi')
    op.drop_index(op.f('ix_gruppi_decessi_numero_certificato_smaltimento'), table_name='gruppi_decessi')
    op.drop_index(op.f('ix_gruppi_decessi_data_uscita'), table_name='gruppi_decessi')
    op.drop_index(op.f('ix_gruppi_decessi_azienda_id'), table_name='gruppi_decessi')
    op.drop_index(op.f('ix_gruppi_decessi_id'), table_name='gruppi_decessi')
    op.drop_table('gruppi_decessi')

