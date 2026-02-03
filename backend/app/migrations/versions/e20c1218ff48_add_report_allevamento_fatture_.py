"""add_report_allevamento_fatture_utilizzate

Revision ID: e20c1218ff48
Revises: 20251215_remove_unique_pn_id
Create Date: 2025-12-16 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'e20c1218ff48'
down_revision = '20251215_remove_unique_pn_id'
branch_labels = None
depends_on = None


def upgrade():
    # Create table report_allevamento_fatture_utilizzate
    op.create_table(
        'report_allevamento_fatture_utilizzate',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contratto_soccida_id', sa.Integer(), nullable=False),
        sa.Column('fattura_id', sa.Integer(), nullable=False),
        sa.Column('importo_utilizzato', sa.Numeric(12, 2), nullable=False),
        sa.Column('data_report', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['contratto_soccida_id'], ['contratti_soccida.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['fattura_id'], ['fatture_amministrazione.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_report_allevamento_fatture_utilizzate_contratto_soccida_id'), 'report_allevamento_fatture_utilizzate', ['contratto_soccida_id'], unique=False)
    op.create_index(op.f('ix_report_allevamento_fatture_utilizzate_fattura_id'), 'report_allevamento_fatture_utilizzate', ['fattura_id'], unique=False)
    op.create_index(op.f('ix_report_allevamento_fatture_utilizzate_data_report'), 'report_allevamento_fatture_utilizzate', ['data_report'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_report_allevamento_fatture_utilizzate_data_report'), table_name='report_allevamento_fatture_utilizzate')
    op.drop_index(op.f('ix_report_allevamento_fatture_utilizzate_fattura_id'), table_name='report_allevamento_fatture_utilizzate')
    op.drop_index(op.f('ix_report_allevamento_fatture_utilizzate_contratto_soccida_id'), table_name='report_allevamento_fatture_utilizzate')
    op.drop_table('report_allevamento_fatture_utilizzate')
