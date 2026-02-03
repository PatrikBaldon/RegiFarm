"""Add macrocategoria to fornitori_tipi

Revision ID: 20250128_macrocategoria
Revises: 20251123_add_logo_fields
Create Date: 2025-01-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20250128_macrocategoria"
down_revision: Union[str, None] = "20251123_add_logo_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Aggiungi colonna macrocategoria alla tabella fornitori_tipi
    op.add_column(
        "fornitori_tipi",
        sa.Column("macrocategoria", sa.String(length=50), nullable=True)
    )
    # Aggiungi indice per macrocategoria
    op.create_index(
        "ix_fornitori_tipi_macrocategoria",
        "fornitori_tipi",
        ["macrocategoria"]
    )


def downgrade() -> None:
    # Rimuovi indice
    op.drop_index("ix_fornitori_tipi_macrocategoria", table_name="fornitori_tipi")
    # Rimuovi colonna
    op.drop_column("fornitori_tipi", "macrocategoria")

