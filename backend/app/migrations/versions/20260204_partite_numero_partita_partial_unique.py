"""Partial unique index on numero_partita (WHERE deleted_at IS NULL)

Permette di riutilizzare lo stesso numero_partita dopo soft-delete:
le partite eliminate non bloccano più l'inserimento di nuove partite con lo stesso numero.

Revision ID: 20260204_partite_partial_unique
Revises: 20260131_partite_chiusura
Create Date: 2026-02-04

"""
from alembic import op

revision = "20260204_partite_partial_unique"
down_revision = "20260131_partite_chiusura"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rimuovi il vincolo UNIQUE globale su numero_partita
    op.drop_constraint("partite_animali_numero_partita_key", "partite_animali", type_="unique")

    # Crea indice UNIQUE parziale: solo per partite non eliminate (deleted_at IS NULL)
    # Così dopo soft-delete il numero_partita può essere riutilizzato
    op.execute(
        """
        CREATE UNIQUE INDEX partite_animali_numero_partita_unique_not_deleted
        ON partite_animali (numero_partita)
        WHERE deleted_at IS NULL
        """
    )


def downgrade() -> None:
    op.drop_index(
        "partite_animali_numero_partita_unique_not_deleted",
        table_name="partite_animali",
    )
    op.create_unique_constraint(
        "partite_animali_numero_partita_key",
        "partite_animali",
        ["numero_partita"],
    )
