"""Add extended anagrafica fields to fornitori."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20251109_fornitore_ext"
down_revision: Union[str, Sequence[str], None] = "20251108_add_fattura_metadata"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("fornitori") as batch_op:
        batch_op.alter_column("partita_iva", existing_type=sa.String(length=20), nullable=True)
        batch_op.drop_constraint("fornitori_partita_iva_key", type_="unique")

    op.add_column("fornitori", sa.Column("indirizzo_cap", sa.String(length=10), nullable=True))
    op.add_column("fornitori", sa.Column("indirizzo_comune", sa.String(length=120), nullable=True))
    op.add_column("fornitori", sa.Column("indirizzo_provincia", sa.String(length=10), nullable=True))
    op.add_column("fornitori", sa.Column("indirizzo_nazione", sa.String(length=5), nullable=True))
    op.add_column("fornitori", sa.Column("pec", sa.String(length=150), nullable=True))
    op.add_column("fornitori", sa.Column("fax", sa.String(length=50), nullable=True))
    op.add_column("fornitori", sa.Column("regime_fiscale", sa.String(length=20), nullable=True))
    op.add_column("fornitori", sa.Column("rea_ufficio", sa.String(length=50), nullable=True))
    op.add_column("fornitori", sa.Column("rea_numero", sa.String(length=50), nullable=True))
    op.add_column("fornitori", sa.Column("rea_capitale_sociale", sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column("fornitori", "rea_capitale_sociale")
    op.drop_column("fornitori", "rea_numero")
    op.drop_column("fornitori", "rea_ufficio")
    op.drop_column("fornitori", "regime_fiscale")
    op.drop_column("fornitori", "fax")
    op.drop_column("fornitori", "pec")
    op.drop_column("fornitori", "indirizzo_nazione")
    op.drop_column("fornitori", "indirizzo_provincia")
    op.drop_column("fornitori", "indirizzo_comune")
    op.drop_column("fornitori", "indirizzo_cap")

    with op.batch_alter_table("fornitori") as batch_op:
        batch_op.create_unique_constraint("fornitori_partita_iva_key", ["partita_iva"])


