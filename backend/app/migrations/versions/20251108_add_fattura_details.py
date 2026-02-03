"""Add detailed tables for fatture amministrazione import."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20251108_add_fattura_details"
down_revision: Union[str, Sequence[str], None] = ("add_veterinario_aziende", "f7g8h9i0j1k2")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "fatture_amministrazione",
        sa.Column("divisa", sa.String(length=5), nullable=True),
    )
    op.add_column(
        "fatture_amministrazione",
        sa.Column("tipo_documento", sa.String(length=10), nullable=True),
    )
    op.add_column(
        "fatture_amministrazione",
        sa.Column("condizioni_pagamento", sa.String(length=10), nullable=True),
    )

    op.create_table(
        "fatture_amministrazione_linee",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("fattura_id", sa.Integer(), nullable=False),
        sa.Column("numero_linea", sa.Integer(), nullable=True),
        sa.Column("descrizione", sa.Text(), nullable=True),
        sa.Column("quantita", sa.Numeric(14, 4), nullable=True),
        sa.Column("unita_misura", sa.String(length=20), nullable=True),
        sa.Column("data_inizio_periodo", sa.Date(), nullable=True),
        sa.Column("data_fine_periodo", sa.Date(), nullable=True),
        sa.Column("prezzo_unitario", sa.Numeric(14, 4), nullable=True),
        sa.Column("prezzo_totale", sa.Numeric(14, 2), nullable=True),
        sa.Column("aliquota_iva", sa.Numeric(6, 2), nullable=True),
        sa.Column("natura", sa.String(length=10), nullable=True),
        sa.Column("tipo_cessione_prestazione", sa.String(length=20), nullable=True),
        sa.Column("riferimento_amministrazione", sa.String(length=100), nullable=True),
        sa.Column("codice_articolo", sa.String(length=100), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["fattura_id"],
            ["fatture_amministrazione.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_fatture_amministrazione_linee_id"),
        "fatture_amministrazione_linee",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_fatture_amministrazione_linee_fattura_id"),
        "fatture_amministrazione_linee",
        ["fattura_id"],
        unique=False,
    )

    op.create_table(
        "fatture_amministrazione_riepiloghi",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("fattura_id", sa.Integer(), nullable=False),
        sa.Column("aliquota_iva", sa.Numeric(6, 2), nullable=True),
        sa.Column("natura", sa.String(length=10), nullable=True),
        sa.Column("imponibile", sa.Numeric(14, 2), nullable=True),
        sa.Column("imposta", sa.Numeric(14, 2), nullable=True),
        sa.Column("esigibilita_iva", sa.String(length=5), nullable=True),
        sa.Column("riferimento_normativo", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["fattura_id"],
            ["fatture_amministrazione.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_fatture_amministrazione_riepiloghi_id"),
        "fatture_amministrazione_riepiloghi",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_fatture_amministrazione_riepiloghi_fattura_id"),
        "fatture_amministrazione_riepiloghi",
        ["fattura_id"],
        unique=False,
    )

    op.create_table(
        "fatture_amministrazione_pagamenti",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("fattura_id", sa.Integer(), nullable=False),
        sa.Column("modalita_pagamento", sa.String(length=10), nullable=True),
        sa.Column("data_riferimento", sa.Date(), nullable=True),
        sa.Column("giorni_termine", sa.Integer(), nullable=True),
        sa.Column("data_scadenza", sa.Date(), nullable=True),
        sa.Column("importo", sa.Numeric(14, 2), nullable=True),
        sa.Column("codice_pagamento", sa.String(length=255), nullable=True),
        sa.Column("iban", sa.String(length=34), nullable=True),
        sa.Column("banca", sa.String(length=200), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["fattura_id"],
            ["fatture_amministrazione.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_fatture_amministrazione_pagamenti_id"),
        "fatture_amministrazione_pagamenti",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_fatture_amministrazione_pagamenti_fattura_id"),
        "fatture_amministrazione_pagamenti",
        ["fattura_id"],
        unique=False,
    )

    op.create_table(
        "fatture_amministrazione_ricezioni",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("fattura_id", sa.Integer(), nullable=False),
        sa.Column("riferimento_numero_linea", sa.Integer(), nullable=True),
        sa.Column("id_documento", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["fattura_id"],
            ["fatture_amministrazione.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_fatture_amministrazione_ricezioni_id"),
        "fatture_amministrazione_ricezioni",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_fatture_amministrazione_ricezioni_fattura_id"),
        "fatture_amministrazione_ricezioni",
        ["fattura_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_fatture_amministrazione_ricezioni_fattura_id"),
        table_name="fatture_amministrazione_ricezioni",
    )
    op.drop_index(
        op.f("ix_fatture_amministrazione_ricezioni_id"),
        table_name="fatture_amministrazione_ricezioni",
    )
    op.drop_table("fatture_amministrazione_ricezioni")

    op.drop_index(
        op.f("ix_fatture_amministrazione_pagamenti_fattura_id"),
        table_name="fatture_amministrazione_pagamenti",
    )
    op.drop_index(
        op.f("ix_fatture_amministrazione_pagamenti_id"),
        table_name="fatture_amministrazione_pagamenti",
    )
    op.drop_table("fatture_amministrazione_pagamenti")

    op.drop_index(
        op.f("ix_fatture_amministrazione_riepiloghi_fattura_id"),
        table_name="fatture_amministrazione_riepiloghi",
    )
    op.drop_index(
        op.f("ix_fatture_amministrazione_riepiloghi_id"),
        table_name="fatture_amministrazione_riepiloghi",
    )
    op.drop_table("fatture_amministrazione_riepiloghi")

    op.drop_index(
        op.f("ix_fatture_amministrazione_linee_fattura_id"),
        table_name="fatture_amministrazione_linee",
    )
    op.drop_index(
        op.f("ix_fatture_amministrazione_linee_id"),
        table_name="fatture_amministrazione_linee",
    )
    op.drop_table("fatture_amministrazione_linee")

    op.drop_column("fatture_amministrazione", "condizioni_pagamento")
    op.drop_column("fatture_amministrazione", "tipo_documento")
    op.drop_column("fatture_amministrazione", "divisa")


