"""Add financial movements for partite and extend prima nota"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op


# revision identifiers, used by Alembic.
revision = "20251113_partite_finanzia_ext"
down_revision = "20251112_onboarding_supabase"
branch_labels = None
depends_on = None


def _create_enum_if_not_exists(type_name: str, values: list[str]) -> None:
    formatted_values = ", ".join(f"'{value}'" for value in values)
    op.execute(
        f"""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = '{type_name}'
            ) THEN
                CREATE TYPE {type_name} AS ENUM ({formatted_values});
            END IF;
        END
        $$;
        """
    )


def _drop_enum_if_exists(type_name: str) -> None:
    op.execute(f"DROP TYPE IF EXISTS {type_name} CASCADE;")


def upgrade() -> None:
    # Ensure enums exist
    _create_enum_if_not_exists(
        "partita_modalita_gestione",
        ["proprieta", "soccida_monetizzata", "soccida_fatturata"],
    )
    _create_enum_if_not_exists(
        "partita_movimento_direzione",
        ["entrata", "uscita"],
    )
    _create_enum_if_not_exists(
        "partita_movimento_tipo",
        ["acconto", "saldo", "mortalita", "altro"],
    )

    # Extend partite_animali
    op.add_column(
        "partite_animali",
        sa.Column(
            "modalita_gestione",
            postgresql.ENUM(
                "proprieta",
                "soccida_monetizzata",
                "soccida_fatturata",
                name="partita_modalita_gestione",
                create_type=False,
            ),
            nullable=False,
            server_default="proprieta",
        ),
    )
    op.add_column(
        "partite_animali",
        sa.Column("costo_unitario", sa.Numeric(12, 2), nullable=True),
    )
    op.add_column(
        "partite_animali",
        sa.Column("valore_totale", sa.Numeric(12, 2), nullable=True),
    )
    op.execute("UPDATE partite_animali SET modalita_gestione = 'proprieta' WHERE modalita_gestione IS NULL")

    # Extend pn_movimenti
    op.add_column(
        "pn_movimenti",
        sa.Column("partita_id", sa.Integer(), nullable=True),
    )
    op.create_index("ix_pn_movimenti_partita_id", "pn_movimenti", ["partita_id"])
    op.create_foreign_key(
        "fk_pn_movimenti_partita_id",
        "pn_movimenti",
        "partite_animali",
        ["partita_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Create partita_movimenti_finanziari
    op.create_table(
        "partita_movimenti_finanziari",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("partita_id", sa.Integer(), sa.ForeignKey("partite_animali.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "direzione",
            postgresql.ENUM(
                "entrata",
                "uscita",
                name="partita_movimento_direzione",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "tipo",
            postgresql.ENUM(
                "acconto",
                "saldo",
                "mortalita",
                "altro",
                name="partita_movimento_tipo",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "modalita",
            postgresql.ENUM(
                "proprieta",
                "soccida_monetizzata",
                "soccida_fatturata",
                name="partita_modalita_gestione",
                create_type=False,
            ),
            nullable=True,
        ),
        sa.Column("data", sa.Date(), nullable=False),
        sa.Column("importo", sa.Numeric(12, 2), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "fattura_amministrazione_id",
            sa.Integer(),
            sa.ForeignKey("fatture_amministrazione.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "fattura_emessa_id",
            sa.Integer(),
            sa.ForeignKey("fatture_emesse.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "pn_movimento_id",
            sa.Integer(),
            sa.ForeignKey("pn_movimenti.id", ondelete="SET NULL"),
            nullable=True,
            unique=True,
        ),
        sa.Column("riferimento_documento", sa.String(length=120), nullable=True),
        sa.Column("attivo", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index(
        "ix_partita_movimenti_finanziari_partita_id",
        "partita_movimenti_finanziari",
        ["partita_id"],
    )
    op.create_index(
        "ix_partita_movimenti_finanziari_data",
        "partita_movimenti_finanziari",
        ["data"],
    )

    # Create pn_conti_iban
    op.create_table(
        "pn_conti_iban",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("conto_id", sa.Integer(), sa.ForeignKey("pn_conti.id", ondelete="CASCADE"), nullable=False),
        sa.Column("iban", sa.String(length=34), nullable=False),
        sa.Column("descrizione", sa.String(length=120), nullable=True),
        sa.Column("predefinito", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
        sa.Column("attivo", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.UniqueConstraint("conto_id", "iban", name="uq_pn_conti_iban_conto"),
    )
    op.create_index("ix_pn_conti_iban_conto_id", "pn_conti_iban", ["conto_id"])


def downgrade() -> None:
    # Drop IBAN table
    op.drop_index("ix_pn_conti_iban_conto_id", table_name="pn_conti_iban")
    op.drop_table("pn_conti_iban")

    # Drop partita movimenti finanziari
    op.drop_index("ix_partita_movimenti_finanziari_data", table_name="partita_movimenti_finanziari")
    op.drop_index("ix_partita_movimenti_finanziari_partita_id", table_name="partita_movimenti_finanziari")
    op.drop_table("partita_movimenti_finanziari")

    # Drop pn_movimenti partita relation
    op.drop_constraint("fk_pn_movimenti_partita_id", "pn_movimenti", type_="foreignkey")
    op.drop_index("ix_pn_movimenti_partita_id", table_name="pn_movimenti")
    op.drop_column("pn_movimenti", "partita_id")

    # Remove added columns from partite_animali
    op.drop_column("partite_animali", "valore_totale")
    op.drop_column("partite_animali", "costo_unitario")
    op.drop_column("partite_animali", "modalita_gestione")

    # Drop enums
    _drop_enum_if_exists("partita_movimento_tipo")
    _drop_enum_if_exists("partita_movimento_direzione")
    _drop_enum_if_exists("partita_modalita_gestione")

