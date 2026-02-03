"""Add valore field to animali table."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20251213_add_valore_to_animali"
down_revision: Union[str, Sequence[str], None] = "add_categoria_id_fatture"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "animali",
        sa.Column(
            "valore",
            sa.Numeric(precision=12, scale=2),
            nullable=True,
            comment="Valore economico specifico dell'animale (in euro)"
        )
    )


def downgrade() -> None:
    op.drop_column("animali", "valore")

