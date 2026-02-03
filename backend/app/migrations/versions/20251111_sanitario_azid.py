"""Add azienda_id to sanitario tables"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "20251111_sanitario_azid"
down_revision = "20251111_terreni_add_azienda_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # farmaci
    op.add_column(
        "farmaci",
        sa.Column("azienda_id", sa.Integer(), nullable=True),
    )
    op.create_index("ix_farmaci_azienda_id", "farmaci", ["azienda_id"])
    op.create_foreign_key(
        "fk_farmaci_azienda",
        "farmaci",
        "aziende",
        ["azienda_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # somministrazioni
    op.add_column(
        "somministrazioni",
        sa.Column("azienda_id", sa.Integer(), nullable=True),
    )
    op.create_index("ix_somministrazioni_azienda_id", "somministrazioni", ["azienda_id"])
    op.create_foreign_key(
        "fk_somministrazioni_azienda",
        "somministrazioni",
        "aziende",
        ["azienda_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.execute(
        """
        UPDATE somministrazioni s
        SET azienda_id = a.azienda_id
        FROM animali a
        WHERE s.animale_id = a.id
        """
    )
    op.alter_column("somministrazioni", "azienda_id", existing_type=sa.Integer(), nullable=False)


def downgrade() -> None:
    op.alter_column("somministrazioni", "azienda_id", existing_type=sa.Integer(), nullable=True)
    op.drop_constraint("fk_somministrazioni_azienda", "somministrazioni", type_="foreignkey")
    op.drop_index("ix_somministrazioni_azienda_id", table_name="somministrazioni")
    op.drop_column("somministrazioni", "azienda_id")

    op.drop_constraint("fk_farmaci_azienda", "farmaci", type_="foreignkey")
    op.drop_index("ix_farmaci_azienda_id", table_name="farmaci")
    op.drop_column("farmaci", "azienda_id")
