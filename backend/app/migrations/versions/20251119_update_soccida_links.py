"""Update soccida model fields and add cross-module FKs

Revision ID: 20251119_update_soccida_links
Revises: 20251118_add_soccida_contratti
Create Date: 2025-11-19 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20251119_update_soccida_links'
down_revision = '20251118_soccida_contratti'
branch_labels = None
depends_on = None


def upgrade():
    # 1) Extend contratti_soccida with new legal/operational fields
    with op.batch_alter_table('contratti_soccida') as batch_op:
        batch_op.add_column(sa.Column('specie_bestiame', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('numero_capi_previsti', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('direzione_tecnica_soccidante', sa.Boolean(), server_default=sa.text('true'), nullable=False))
        batch_op.add_column(sa.Column('monetizzata', sa.Boolean(), server_default=sa.text('true'), nullable=False))
        batch_op.add_column(sa.Column('percentuale_riparto_base', sa.Numeric(5, 2), nullable=True))
        batch_op.add_column(sa.Column('bonus_mortalita_zero_attivo', sa.Boolean(), server_default=sa.text('false'), nullable=False))
        batch_op.add_column(sa.Column('bonus_incremento_kg_soglia', sa.Numeric(6, 2), nullable=True))
        batch_op.add_column(sa.Column('bonus_incremento_percentuale', sa.Numeric(5, 2), nullable=True))
        batch_op.add_column(sa.Column('franchigia_mortalita_giorni', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('forniture_interne_modello', sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column('mercuriale_riferimento', sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column('traccia_iva_indetraibile', sa.Boolean(), server_default=sa.text('true'), nullable=False))
        batch_op.add_column(sa.Column('data_prima_consegna', sa.Date(), nullable=True))
        batch_op.add_column(sa.Column('rinnovo_per_consegna', sa.Boolean(), server_default=sa.text('true'), nullable=False))
        batch_op.add_column(sa.Column('preavviso_disdetta_giorni', sa.Integer(), server_default=sa.text('90'), nullable=False))

    # 2) Add contratto_soccida_id FK to related tables (nullable, SET NULL on delete)
    # Use short constraint names to respect PostgreSQL 63-char limit
    op.add_column('fatture_emesse', sa.Column('contratto_soccida_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        constraint_name='fk_fem_cs_id',
        source_table='fatture_emesse',
        referent_table='contratti_soccida',
        local_cols=['contratto_soccida_id'],
        remote_cols=['id'],
        ondelete='SET NULL',
    )

    op.add_column('fatture_amministrazione', sa.Column('contratto_soccida_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        constraint_name='fk_fam_cs_id',
        source_table='fatture_amministrazione',
        referent_table='contratti_soccida',
        local_cols=['contratto_soccida_id'],
        remote_cols=['id'],
        ondelete='SET NULL',
    )

    op.add_column('pn_movimenti', sa.Column('contratto_soccida_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        constraint_name='fk_pnm_cs_id',
        source_table='pn_movimenti',
        referent_table='contratti_soccida',
        local_cols=['contratto_soccida_id'],
        remote_cols=['id'],
        ondelete='SET NULL',
    )

    op.add_column('partite_animali', sa.Column('contratto_soccida_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        constraint_name='fk_par_cs_id',
        source_table='partite_animali',
        referent_table='contratti_soccida',
        local_cols=['contratto_soccida_id'],
        remote_cols=['id'],
        ondelete='SET NULL',
    )

    op.add_column('decessi', sa.Column('contratto_soccida_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        constraint_name='fk_dec_cs_id',
        source_table='decessi',
        referent_table='contratti_soccida',
        local_cols=['contratto_soccida_id'],
        remote_cols=['id'],
        ondelete='SET NULL',
    )

    # 3) Decessi: fattura_smaltimento_id -> FK to fatture_amministrazione
    with op.batch_alter_table('decessi') as batch_op:
        # Add column if not exists (in case column existed without FK)
        if not _has_column('decessi', 'fattura_smaltimento_id'):
            batch_op.add_column(sa.Column('fattura_smaltimento_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            constraint_name='fk_dec_fsm_id',
            referent_table='fatture_amministrazione',
            local_cols=['fattura_smaltimento_id'],
            remote_cols=['id'],
            ondelete='SET NULL',
        )


def downgrade():
    # 3) Drop Decessi FK
    with op.batch_alter_table('decessi') as batch_op:
        _drop_fk_if_exists('decessi', 'fk_dec_fsm_id')
        _drop_column_if_exists('decessi', 'fattura_smaltimento_id')

    # 2) Drop FKs and columns on related tables (short names)
    _drop_fk_if_exists('fatture_emesse', 'fk_fem_cs_id')
    _drop_column_if_exists('fatture_emesse', 'contratto_soccida_id')

    _drop_fk_if_exists('fatture_amministrazione', 'fk_fam_cs_id')
    _drop_column_if_exists('fatture_amministrazione', 'contratto_soccida_id')

    _drop_fk_if_exists('pn_movimenti', 'fk_pnm_cs_id')
    _drop_column_if_exists('pn_movimenti', 'contratto_soccida_id')

    _drop_fk_if_exists('partite_animali', 'fk_par_cs_id')
    _drop_column_if_exists('partite_animali', 'contratto_soccida_id')

    _drop_fk_if_exists('decessi', 'fk_dec_cs_id')
    _drop_column_if_exists('decessi', 'contratto_soccida_id')

    # 1) Drop added columns from contratti_soccida
    cols = [
        'specie_bestiame',
        'numero_capi_previsti',
        'direzione_tecnica_soccidante',
        'monetizzata',
        'percentuale_riparto_base',
        'bonus_mortalita_zero_attivo',
        'bonus_incremento_kg_soglia',
        'bonus_incremento_percentuale',
        'franchigia_mortalita_giorni',
        'forniture_interne_modello',
        'mercuriale_riferimento',
        'traccia_iva_indetraibile',
        'data_prima_consegna',
        'rinnovo_per_consegna',
        'preavviso_disdetta_giorni',
    ]
    with op.batch_alter_table('contratti_soccida') as batch_op:
        for c in cols:
            _drop_column_if_exists('contratti_soccida', c, batch_op=batch_op)


# Helper utilities (best-effort checks for downgrade safety)
def _has_column(table_name: str, column_name: str) -> bool:
    insp = sa.inspect(op.get_bind())
    cols = [col['name'] for col in insp.get_columns(table_name)]
    return column_name in cols


def _drop_fk_if_exists(table_name: str, fk_name: str):
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    fks = [fk['name'] for fk in inspector.get_foreign_keys(table_name)]
    if fk_name in fks:
        op.drop_constraint(fk_name, table_name, type_='foreignkey')


def _drop_column_if_exists(table_name: str, column_name: str, batch_op=None):
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = [col['name'] for col in inspector.get_columns(table_name)]
    if column_name in cols:
        if batch_op is not None:
            batch_op.drop_column(column_name)
        else:
            op.drop_column(table_name, column_name)


