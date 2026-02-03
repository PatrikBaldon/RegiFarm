"""Merge valore animale and categoria fields migrations."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20251213_merge_valore_categoria"
down_revision: Union[str, Sequence[str], None] = ("20251213_add_valore_to_animali", "add_categoria_fields_pn")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Merge migration - no changes needed, just merges the two branches
    pass


def downgrade() -> None:
    # Merge migration - no changes needed
    pass

