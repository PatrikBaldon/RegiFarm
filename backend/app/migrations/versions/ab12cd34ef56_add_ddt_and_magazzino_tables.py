"""
add ddt and magazzino tables

Revision ID: ab12cd34ef56
Revises: 9a1b2c3d4e5f
Create Date: 2025-10-30 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'ab12cd34ef56'
down_revision = '9a1b2c3d4e5f'
branch_labels = None
depends_on = None


def upgrade() -> None:
	op.create_table(
		'ddt',
		sa.Column('id', sa.Integer(), primary_key=True),
		sa.Column('data', sa.Date(), nullable=False),
		sa.Column('numero', sa.String(length=50), nullable=False),
		sa.Column('fornitore_id', sa.Integer(), nullable=True),
		sa.Column('note', sa.Text(), nullable=True),
		sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
		sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
		sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
	)
	op.create_index('ix_ddt_id', 'ddt', ['id'])
	op.create_index('ix_ddt_numero', 'ddt', ['numero'])
	op.create_index('ix_ddt_deleted_at', 'ddt', ['deleted_at'])
	op.create_foreign_key('fk_ddt_fornitore', 'ddt', 'fornitori', ['fornitore_id'], ['id'], ondelete='SET NULL')

	op.create_table(
		'ddt_righe',
		sa.Column('id', sa.Integer(), primary_key=True),
		sa.Column('ddt_id', sa.Integer(), nullable=False),
		sa.Column('componente_alimentare_id', sa.Integer(), nullable=True),
		sa.Column('mangime_confezionato_id', sa.Integer(), nullable=True),
		sa.Column('quantita', sa.Numeric(12, 4), nullable=False),
		sa.Column('unita_misura', sa.String(length=20), nullable=False),
		sa.Column('prezzo_unitario', sa.Numeric(12, 4), nullable=True),
		sa.Column('lotto', sa.String(length=100), nullable=True),
		sa.Column('scadenza', sa.Date(), nullable=True),
		sa.Column('note', sa.Text(), nullable=True),
		sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
		sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
		sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
	)
	op.create_index('ix_ddt_righe_id', 'ddt_righe', ['id'])
	op.create_index('ix_ddt_righe_ddt_id', 'ddt_righe', ['ddt_id'])
	op.create_index('ix_ddt_righe_deleted_at', 'ddt_righe', ['deleted_at'])
	op.create_foreign_key('fk_ddt_righe_ddt', 'ddt_righe', 'ddt', ['ddt_id'], ['id'], ondelete='CASCADE')
	op.create_foreign_key('fk_ddt_righe_comp', 'ddt_righe', 'componenti_alimentari', ['componente_alimentare_id'], ['id'], ondelete='SET NULL')
	op.create_foreign_key('fk_ddt_righe_mangime', 'ddt_righe', 'mangimi_confezionati', ['mangime_confezionato_id'], ['id'], ondelete='SET NULL')

	op.create_table(
		'magazzino_movimenti',
		sa.Column('id', sa.Integer(), primary_key=True),
		sa.Column('data', sa.Date(), nullable=False),
		sa.Column('tipo', sa.String(length=20), nullable=False),
		sa.Column('componente_alimentare_id', sa.Integer(), nullable=True),
		sa.Column('mangime_confezionato_id', sa.Integer(), nullable=True),
		sa.Column('quantita', sa.Numeric(12, 4), nullable=False),
		sa.Column('unita_misura', sa.String(length=20), nullable=False),
		sa.Column('causale', sa.String(length=100), nullable=True),
		sa.Column('ddt_riga_id', sa.Integer(), nullable=True),
		sa.Column('note', sa.Text(), nullable=True),
		sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
		sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
		sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
	)
	op.create_index('ix_mag_mov_id', 'magazzino_movimenti', ['id'])
	op.create_index('ix_mag_mov_deleted_at', 'magazzino_movimenti', ['deleted_at'])
	op.create_foreign_key('fk_mag_mov_comp', 'magazzino_movimenti', 'componenti_alimentari', ['componente_alimentare_id'], ['id'], ondelete='SET NULL')
	op.create_foreign_key('fk_mag_mov_mangime', 'magazzino_movimenti', 'mangimi_confezionati', ['mangime_confezionato_id'], ['id'], ondelete='SET NULL')
	op.create_foreign_key('fk_mag_mov_ddt_riga', 'magazzino_movimenti', 'ddt_righe', ['ddt_riga_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
	op.drop_constraint('fk_mag_mov_ddt_riga', 'magazzino_movimenti', type_='foreignkey')
	op.drop_constraint('fk_mag_mov_mangime', 'magazzino_movimenti', type_='foreignkey')
	op.drop_constraint('fk_mag_mov_comp', 'magazzino_movimenti', type_='foreignkey')
	op.drop_index('ix_mag_mov_deleted_at', table_name='magazzino_movimenti')
	op.drop_index('ix_mag_mov_id', table_name='magazzino_movimenti')
	op.drop_table('magazzino_movimenti')

	op.drop_constraint('fk_ddt_righe_mangime', 'ddt_righe', type_='foreignkey')
	op.drop_constraint('fk_ddt_righe_comp', 'ddt_righe', type_='foreignkey')
	op.drop_constraint('fk_ddt_righe_ddt', 'ddt_righe', type_='foreignkey')
	op.drop_index('ix_ddt_righe_deleted_at', table_name='ddt_righe')
	op.drop_index('ix_ddt_righe_ddt_id', table_name='ddt_righe')
	op.drop_index('ix_ddt_righe_id', table_name='ddt_righe')
	op.drop_table('ddt_righe')

	op.drop_constraint('fk_ddt_fornitore', 'ddt', type_='foreignkey')
	op.drop_index('ix_ddt_deleted_at', table_name='ddt')
	op.drop_index('ix_ddt_numero', table_name='ddt')
	op.drop_index('ix_ddt_id', table_name='ddt')
	op.drop_table('ddt')
