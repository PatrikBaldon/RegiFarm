"""Add attrezzatura references to fatture and prima nota movements.

Revision ID: 20251117_attrezz_link
Revises: 20251116_superf_prec
Create Date: 2025-11-17 09:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20251117_attrezz_link"
down_revision = "20251116_superf_prec"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "fatture_amministrazione",
        sa.Column("attrezzatura_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_fatture_amministrazione_attrezzatura_id",
        "fatture_amministrazione",
        ["attrezzatura_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_fatture_amministrazione_attrezzatura",
        "fatture_amministrazione",
        "attrezzature",
        ["attrezzatura_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column(
        "prima_nota",
        sa.Column("attrezzatura_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_prima_nota_attrezzatura_id",
        "prima_nota",
        ["attrezzatura_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_prima_nota_attrezzatura",
        "prima_nota",
        "attrezzature",
        ["attrezzatura_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column(
        "pn_movimenti",
        sa.Column("attrezzatura_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_pn_movimenti_attrezzatura_id",
        "pn_movimenti",
        ["attrezzatura_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_pn_movimenti_attrezzatura",
        "pn_movimenti",
        "attrezzature",
        ["attrezzatura_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_pn_movimenti_attrezzatura", "pn_movimenti", type_="foreignkey")
    op.drop_index("ix_pn_movimenti_attrezzatura_id", table_name="pn_movimenti")
    op.drop_column("pn_movimenti", "attrezzatura_id")

    op.drop_constraint("fk_prima_nota_attrezzatura", "prima_nota", type_="foreignkey")
    op.drop_index("ix_prima_nota_attrezzatura_id", table_name="prima_nota")
    op.drop_column("prima_nota", "attrezzatura_id")

    op.drop_constraint(
        "fk_fatture_amministrazione_attrezzatura",
        "fatture_amministrazione",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_fatture_amministrazione_attrezzatura_id",
        table_name="fatture_amministrazione",
    )
    op.drop_column("fatture_amministrazione", "attrezzatura_id")

