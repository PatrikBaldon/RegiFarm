"""add_partita_animale_animali_join_table

Revision ID: abc123def456
Revises: f1d8be9292ec
Create Date: 2025-11-03 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'abc123def456'
down_revision = 'f1d8be9292ec'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Crea la tabella di join per tracciare animali nelle partite
    op.create_table('partita_animale_animali',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('partita_animale_id', sa.Integer(), nullable=False),
        sa.Column('animale_id', sa.Integer(), nullable=False),
        sa.Column('peso', sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['partita_animale_id'], ['partite_animali.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['animale_id'], ['animali.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('partita_animale_id', 'animale_id', name='uq_partita_animale_animale')
    )
    op.create_index(op.f('ix_partita_animale_animali_partita_animale_id'), 'partita_animale_animali', ['partita_animale_id'], unique=False)
    op.create_index(op.f('ix_partita_animale_animali_animale_id'), 'partita_animale_animali', ['animale_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_partita_animale_animali_animale_id'), table_name='partita_animale_animali')
    op.drop_index(op.f('ix_partita_animale_animali_partita_animale_id'), table_name='partita_animale_animali')
    op.drop_table('partita_animale_animali')

