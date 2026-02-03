"""Add conto_debiti_fornitori_id and conto_crediti_clienti_id to pn_preferenze

Revision ID: add_debiti_crediti_preferenze
Revises: 20251110_prima_nota_schema
Create Date: 2025-01-03

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_debiti_crediti_preferenze'
down_revision = ('add_azienda_id_impostazioni', '20251110_prima_nota_schema')  # Merge delle due head revisions
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Aggiungi i nuovi campi alla tabella pn_preferenze
    op.execute("""
        ALTER TABLE pn_preferenze
        ADD COLUMN IF NOT EXISTS conto_debiti_fornitori_id INTEGER REFERENCES pn_conti(id) ON DELETE SET NULL
    """)
    op.execute("""
        ALTER TABLE pn_preferenze
        ADD COLUMN IF NOT EXISTS conto_crediti_clienti_id INTEGER REFERENCES pn_conti(id) ON DELETE SET NULL
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE pn_preferenze DROP COLUMN IF EXISTS conto_debiti_fornitori_id")
    op.execute("ALTER TABLE pn_preferenze DROP COLUMN IF EXISTS conto_crediti_clienti_id")

