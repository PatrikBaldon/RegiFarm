"""Add azienda_id to terreni related tables"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "20251111_terreni_add_azienda_id"
down_revision = "20251110_prima_nota_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # lavorazioni_terreno
    op.add_column(
        "lavorazioni_terreno",
        sa.Column("azienda_id", sa.Integer(), nullable=True),
    )
    op.create_index("ix_lavorazioni_terreno_azienda_id", "lavorazioni_terreno", ["azienda_id"])
    op.create_foreign_key(
        "fk_lavorazioni_terreno_azienda",
        "lavorazioni_terreno",
        "aziende",
        ["azienda_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.execute(
        """
        UPDATE lavorazioni_terreno lt
        SET azienda_id = t.azienda_id
        FROM terreni t
        WHERE lt.terreno_id = t.id
        """
    )
    op.alter_column("lavorazioni_terreno", "azienda_id", existing_type=sa.Integer(), nullable=False)

    # raccolti_terreno
    op.add_column(
        "raccolti_terreno",
        sa.Column("azienda_id", sa.Integer(), nullable=True),
    )
    op.create_index("ix_raccolti_terreno_azienda_id", "raccolti_terreno", ["azienda_id"])
    op.create_foreign_key(
        "fk_raccolti_terreno_azienda",
        "raccolti_terreno",
        "aziende",
        ["azienda_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.execute(
        """
        UPDATE raccolti_terreno rt
        SET azienda_id = t.azienda_id
        FROM terreni t
        WHERE rt.terreno_id = t.id
        """
    )
    op.alter_column("raccolti_terreno", "azienda_id", existing_type=sa.Integer(), nullable=False)

    # prodotti_derivati
    op.add_column(
        "prodotti_derivati",
        sa.Column("azienda_id", sa.Integer(), nullable=True),
    )
    op.create_index("ix_prodotti_derivati_azienda_id", "prodotti_derivati", ["azienda_id"])
    op.create_foreign_key(
        "fk_prodotti_derivati_azienda",
        "prodotti_derivati",
        "aziende",
        ["azienda_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.execute(
        """
        UPDATE prodotti_derivati pd
        SET azienda_id = rt.azienda_id
        FROM raccolti_terreno rt
        WHERE pd.raccolto_id = rt.id
        """
    )
    op.alter_column("prodotti_derivati", "azienda_id", existing_type=sa.Integer(), nullable=False)


def downgrade() -> None:
    # prodotti_derivati
    op.alter_column("prodotti_derivati", "azienda_id", existing_type=sa.Integer(), nullable=True)
    op.drop_constraint("fk_prodotti_derivati_azienda", "prodotti_derivati", type_="foreignkey")
    op.drop_index("ix_prodotti_derivati_azienda_id", table_name="prodotti_derivati")
    op.drop_column("prodotti_derivati", "azienda_id")

    # raccolti_terreno
    op.alter_column("raccolti_terreno", "azienda_id", existing_type=sa.Integer(), nullable=True)
    op.drop_constraint("fk_raccolti_terreno_azienda", "raccolti_terreno", type_="foreignkey")
    op.drop_index("ix_raccolti_terreno_azienda_id", table_name="raccolti_terreno")
    op.drop_column("raccolti_terreno", "azienda_id")

    # lavorazioni_terreno
    op.alter_column("lavorazioni_terreno", "azienda_id", existing_type=sa.Integer(), nullable=True)
    op.drop_constraint("fk_lavorazioni_terreno_azienda", "lavorazioni_terreno", type_="foreignkey")
    op.drop_index("ix_lavorazioni_terreno_azienda_id", table_name="lavorazioni_terreno")
    op.drop_column("lavorazioni_terreno", "azienda_id")
