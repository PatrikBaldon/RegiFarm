"""add_righe_json_to_fatture

Revision ID: 20250129_righe_json
Revises: 20250128_macrocategoria
Create Date: 2025-01-29 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20250129_righe_json'
down_revision = '20250128_macrocategoria_fatture'
branch_labels = None
depends_on = None


def upgrade():
    # Aggiungi colonna righe (JSON) a fatture_amministrazione
    op.add_column('fatture_amministrazione', sa.Column('righe', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    
    # Aggiungi colonna righe (JSON) a fatture_emesse
    op.add_column('fatture_emesse', sa.Column('righe', postgresql.JSON(astext_type=sa.Text()), nullable=True))


def downgrade():
    # Rimuovi colonna righe da fatture_emesse
    op.drop_column('fatture_emesse', 'righe')
    
    # Rimuovi colonna righe da fatture_amministrazione
    op.drop_column('fatture_amministrazione', 'righe')

