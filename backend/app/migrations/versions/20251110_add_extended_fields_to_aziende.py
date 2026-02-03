"""Add extended address and contact fields to aziende."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20251110_aziende_extended_fields"
down_revision: Union[str, Sequence[str], None] = "20251109_registro_alim_dist"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("aziende", sa.Column("indirizzo_cap", sa.String(length=10), nullable=True))
    op.add_column("aziende", sa.Column("indirizzo_comune", sa.String(length=120), nullable=True))
    op.add_column("aziende", sa.Column("indirizzo_provincia", sa.String(length=10), nullable=True))
    op.add_column("aziende", sa.Column("indirizzo_nazione", sa.String(length=5), nullable=True))
    op.add_column("aziende", sa.Column("pec", sa.String(length=150), nullable=True))
    op.add_column("aziende", sa.Column("codice_sdi", sa.String(length=10), nullable=True))
    op.add_column("aziende", sa.Column("rea_ufficio", sa.String(length=50), nullable=True))
    op.add_column("aziende", sa.Column("rea_numero", sa.String(length=50), nullable=True))
    op.add_column("aziende", sa.Column("rea_capitale_sociale", sa.String(length=50), nullable=True))
    op.add_column("aziende", sa.Column("referente_nome", sa.String(length=120), nullable=True))
    op.add_column("aziende", sa.Column("referente_email", sa.String(length=150), nullable=True))
    op.add_column("aziende", sa.Column("referente_telefono", sa.String(length=50), nullable=True))
    op.add_column("aziende", sa.Column("sito_web", sa.String(length=150), nullable=True))
    op.add_column("aziende", sa.Column("iban", sa.String(length=34), nullable=True))


def downgrade() -> None:
    op.drop_column("aziende", "iban")
    op.drop_column("aziende", "sito_web")
    op.drop_column("aziende", "referente_telefono")
    op.drop_column("aziende", "referente_email")
    op.drop_column("aziende", "referente_nome")
    op.drop_column("aziende", "rea_capitale_sociale")
    op.drop_column("aziende", "rea_numero")
    op.drop_column("aziende", "rea_ufficio")
    op.drop_column("aziende", "codice_sdi")
    op.drop_column("aziende", "pec")
    op.drop_column("aziende", "indirizzo_nazione")
    op.drop_column("aziende", "indirizzo_provincia")
    op.drop_column("aziende", "indirizzo_comune")
    op.drop_column("aziende", "indirizzo_cap")

