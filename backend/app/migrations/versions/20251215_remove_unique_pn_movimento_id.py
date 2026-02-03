"""Remove unique constraint from pn_movimento_id in partita_movimenti_finanziari

This allows multiple partite to be linked to the same PNMovimento.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20251215_remove_unique_pn_id"
down_revision = "20251213_merge_valore_categoria"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rimuovi il vincolo unique da pn_movimento_id
    # Prima rimuovi l'indice unique se esiste
    op.execute("""
        DO $$
        BEGIN
            -- Rimuovi il vincolo unique se esiste
            IF EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'partita_movimenti_finanziari_pn_movimento_id_key'
            ) THEN
                ALTER TABLE partita_movimenti_finanziari 
                DROP CONSTRAINT partita_movimenti_finanziari_pn_movimento_id_key;
            END IF;
        END $$;
    """)
    
    # Crea un indice normale (non unique) per migliorare le performance delle query
    op.create_index(
        "ix_partita_movimenti_finanziari_pn_movimento_id",
        "partita_movimenti_finanziari",
        ["pn_movimento_id"],
        unique=False,
    )


def downgrade() -> None:
    # Rimuovi l'indice normale
    op.drop_index(
        "ix_partita_movimenti_finanziari_pn_movimento_id",
        table_name="partita_movimenti_finanziari",
    )
    
    # Ricrea il vincolo unique
    op.create_unique_constraint(
        "partita_movimenti_finanziari_pn_movimento_id_key",
        "partita_movimenti_finanziari",
        ["pn_movimento_id"],
    )

