"""Remove aliquota_iva from fatture_amministrazione

Revision ID: 20251124_remove_aliquota_iva
Revises: 20251123_add_logo_fields
Create Date: 2025-11-24 08:58:34.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20251124_remove_aliquota_iva'
down_revision = '20251123_add_logo_fields'
branch_labels = None
depends_on = None


def upgrade():
    # Rimuovi colonna aliquota_iva da fatture_amministrazione
    # L'aliquota IVA è ora gestita solo a livello di singole righe (fatture_amministrazione_linee)
    op.drop_column('fatture_amministrazione', 'aliquota_iva')


def downgrade():
    # Ripristina colonna aliquota_iva (con default 0)
    op.add_column('fatture_amministrazione', 
                  sa.Column('aliquota_iva', sa.Numeric(5, 2), server_default='0', nullable=False))

