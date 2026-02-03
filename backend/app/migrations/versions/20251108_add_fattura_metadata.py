"""Add XML metadata storage for fatture."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20251108_add_fattura_metadata"
down_revision: Union[str, Sequence[str], None] = "20251108_add_fattura_details"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "fatture_amministrazione",
        sa.Column("dati_xml", sa.JSON(), nullable=True),
    )
    op.add_column(
        "fatture_amministrazione",
        sa.Column("xml_raw", sa.Text(), nullable=True),
    )
    op.add_column(
        "fatture_emesse",
        sa.Column("dati_xml", sa.JSON(), nullable=True),
    )
    op.add_column(
        "fatture_emesse",
        sa.Column("xml_raw", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("fatture_emesse", "xml_raw")
    op.drop_column("fatture_emesse", "dati_xml")
    op.drop_column("fatture_amministrazione", "xml_raw")
    op.drop_column("fatture_amministrazione", "dati_xml")


