"""Add fattura links to partite_animali"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20251114_partite_manual_fatture"
down_revision = "20251113_partite_finanzia_ext"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "partite_animali",
        sa.Column("fattura_amministrazione_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "partite_animali",
        sa.Column("fattura_emessa_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_partite_animali_fattura_amministrazione_id",
        "partite_animali",
        ["fattura_amministrazione_id"],
    )
    op.create_index(
        "ix_partite_animali_fattura_emessa_id",
        "partite_animali",
        ["fattura_emessa_id"],
    )
    op.create_foreign_key(
        "fk_partite_animali_fattura_amministrazione_id",
        "partite_animali",
        "fatture_amministrazione",
        ["fattura_amministrazione_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_partite_animali_fattura_emessa_id",
        "partite_animali",
        "fatture_emesse",
        ["fattura_emessa_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_partite_animali_fattura_emessa_id",
        "partite_animali",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_partite_animali_fattura_amministrazione_id",
        "partite_animali",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_partite_animali_fattura_emessa_id",
        table_name="partite_animali",
    )
    op.drop_index(
        "ix_partite_animali_fattura_amministrazione_id",
        table_name="partite_animali",
    )
    op.drop_column("partite_animali", "fattura_emessa_id")
    op.drop_column("partite_animali", "fattura_amministrazione_id")

