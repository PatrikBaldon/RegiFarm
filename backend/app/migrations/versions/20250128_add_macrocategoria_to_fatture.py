"""Add macrocategoria to fatture_amministrazione and fatture_emesse

Revision ID: 20250128_macrocategoria_fatture
Revises: 20250128_macrocategoria
Create Date: 2025-01-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20250128_macrocategoria_fatture"
down_revision: Union[str, None] = "20250128_macrocategoria"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Aggiungi colonna macrocategoria alla tabella fatture_amministrazione
    op.add_column(
        "fatture_amministrazione",
        sa.Column("macrocategoria", sa.String(length=50), nullable=True)
    )
    # Aggiungi indice per macrocategoria
    op.create_index(
        "ix_fatture_amministrazione_macrocategoria",
        "fatture_amministrazione",
        ["macrocategoria"]
    )
    
    # Aggiungi colonna macrocategoria alla tabella fatture_emesse
    op.add_column(
        "fatture_emesse",
        sa.Column("macrocategoria", sa.String(length=50), nullable=True)
    )
    # Aggiungi indice per macrocategoria
    op.create_index(
        "ix_fatture_emesse_macrocategoria",
        "fatture_emesse",
        ["macrocategoria"]
    )


def downgrade() -> None:
    # Rimuovi indici
    op.drop_index("ix_fatture_emesse_macrocategoria", table_name="fatture_emesse")
    op.drop_index("ix_fatture_amministrazione_macrocategoria", table_name="fatture_amministrazione")
    # Rimuovi colonne
    op.drop_column("fatture_emesse", "macrocategoria")
    op.drop_column("fatture_amministrazione", "macrocategoria")

