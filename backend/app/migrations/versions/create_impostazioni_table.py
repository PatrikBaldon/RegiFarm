"""create_impostazioni_table

Revision ID: create_impostazioni
Revises: add_terreno_id_fatture
Create Date: 2025-01-XX 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'create_impostazioni'
down_revision = 'add_terreno_id_fatture'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'impostazioni',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('modulo', sa.String(length=50), nullable=False),
        sa.Column('configurazione', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True)),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_impostazioni_id', 'impostazioni', ['id'])
    op.create_index('ix_impostazioni_modulo', 'impostazioni', ['modulo'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_impostazioni_modulo', table_name='impostazioni')
    op.drop_index('ix_impostazioni_id', table_name='impostazioni')
    op.drop_table('impostazioni')

