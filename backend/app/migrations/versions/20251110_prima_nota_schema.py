"""Create Prima Nota v2 schema"""

from __future__ import annotations

from typing import Dict, Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20251110_prima_nota_schema"
down_revision: Union[str, Sequence[str], None] = "20251110_aziende_extended_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ENUM_DEFINITIONS: Dict[str, Sequence[str]] = {
    "pn_conto_tipo": ("cassa", "banca", "altro"),
    "pn_giroconto_strategia": ("automatico", "manuale"),
    "pn_categoria_tipo_operazione": ("entrata", "uscita", "giroconto"),
    "pn_movimento_tipo_operazione": ("entrata", "uscita", "giroconto"),
    "pn_movimento_stato": ("provvisorio", "definitivo"),
    "pn_movimento_origine": ("manuale", "automatico", "riconciliazione", "giroconto"),
    "pn_documento_tipo": ("fattura_emessa", "fattura_amministrazione", "nota_credito", "nota_debito", "altro"),
}


def upgrade() -> None:
    # Ensure enum types exist without raising if already present
    for enum_name, values in ENUM_DEFINITIONS.items():
        values_list = ", ".join(f"'{value}'" for value in values)
        op.execute(
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{enum_name}') THEN
                    CREATE TYPE {enum_name} AS ENUM ({values_list});
                END IF;
            END
            $$;
            """
        )

    # Create tables using raw SQL to prevent SQLAlchemy from managing enum DDL
    op.execute(
        """
        CREATE TABLE pn_conti (
            id SERIAL PRIMARY KEY,
            azienda_id INTEGER NOT NULL REFERENCES aziende(id) ON DELETE CASCADE,
            nome VARCHAR(120) NOT NULL,
            tipo pn_conto_tipo NOT NULL DEFAULT 'cassa',
            saldo_iniziale NUMERIC(12, 2) NOT NULL DEFAULT 0,
            saldo_attuale NUMERIC(12, 2) NOT NULL DEFAULT 0,
            attivo BOOLEAN NOT NULL DEFAULT TRUE,
            note TEXT,
            giroconto_strategia pn_giroconto_strategia NOT NULL DEFAULT 'automatico',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_pn_conti_azienda_nome UNIQUE (azienda_id, nome)
        )
        """
    )
    op.execute("CREATE INDEX ix_pn_conti_azienda_id ON pn_conti (azienda_id)")

    op.execute(
        """
        CREATE TABLE pn_categorie (
            id SERIAL PRIMARY KEY,
            azienda_id INTEGER REFERENCES aziende(id) ON DELETE CASCADE,
            nome VARCHAR(120) NOT NULL,
            codice VARCHAR(60),
            tipo_operazione pn_categoria_tipo_operazione NOT NULL,
            descrizione TEXT,
            ordine INTEGER NOT NULL DEFAULT 0,
            attiva BOOLEAN NOT NULL DEFAULT TRUE,
            creata_dal_sistema BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_pn_categoria_per_azienda UNIQUE (azienda_id, nome, tipo_operazione)
        )
        """
    )
    op.execute("CREATE INDEX ix_pn_categorie_azienda_id ON pn_categorie (azienda_id)")

    op.execute(
        """
        CREATE TABLE pn_preferenze (
            id SERIAL PRIMARY KEY,
            azienda_id INTEGER NOT NULL UNIQUE REFERENCES aziende(id) ON DELETE CASCADE,
            conto_predefinito_id INTEGER REFERENCES pn_conti(id) ON DELETE SET NULL,
            conto_incassi_id INTEGER REFERENCES pn_conti(id) ON DELETE SET NULL,
            conto_pagamenti_id INTEGER REFERENCES pn_conti(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    op.execute(
        """
        CREATE TABLE pn_movimenti (
            id SERIAL PRIMARY KEY,
            azienda_id INTEGER NOT NULL REFERENCES aziende(id) ON DELETE CASCADE,
            conto_id INTEGER NOT NULL REFERENCES pn_conti(id) ON DELETE CASCADE,
            conto_destinazione_id INTEGER REFERENCES pn_conti(id) ON DELETE CASCADE,
            categoria_id INTEGER REFERENCES pn_categorie(id) ON DELETE SET NULL,
            tipo_operazione pn_movimento_tipo_operazione NOT NULL,
            stato pn_movimento_stato NOT NULL DEFAULT 'definitivo',
            origine pn_movimento_origine NOT NULL DEFAULT 'manuale',
            data DATE NOT NULL,
            descrizione VARCHAR(500) NOT NULL,
            note TEXT,
            importo NUMERIC(12, 2) NOT NULL,
            quota_extra NUMERIC(12, 2),
            contropartita_nome VARCHAR(200),
            metodo_pagamento VARCHAR(80),
            documento_riferimento VARCHAR(120),
            riferimento_esterno VARCHAR(120),
            fattura_emessa_id INTEGER REFERENCES fatture_emesse(id) ON DELETE SET NULL,
            fattura_amministrazione_id INTEGER REFERENCES fatture_amministrazione(id) ON DELETE SET NULL,
            pagamento_id INTEGER REFERENCES pagamenti(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ,
            CONSTRAINT ck_pn_movimento_importo_non_negativo CHECK (importo >= 0)
        )
        """
    )
    op.execute("CREATE INDEX ix_pn_movimenti_azienda_id ON pn_movimenti (azienda_id)")
    op.execute("CREATE INDEX ix_pn_movimenti_conto_id ON pn_movimenti (conto_id)")
    op.execute(
        "CREATE INDEX ix_pn_movimenti_conto_destinazione_id ON pn_movimenti (conto_destinazione_id)"
    )
    op.execute("CREATE INDEX ix_pn_movimenti_categoria_id ON pn_movimenti (categoria_id)")
    op.execute("CREATE INDEX ix_pn_movimenti_data ON pn_movimenti (data)")
    op.execute("CREATE INDEX ix_pn_movimenti_deleted_at ON pn_movimenti (deleted_at)")
    op.execute(
        "CREATE INDEX ix_pn_movimenti_fattura_emessa_id ON pn_movimenti (fattura_emessa_id)"
    )
    op.execute(
        "CREATE INDEX ix_pn_movimenti_fattura_amministrazione_id ON pn_movimenti (fattura_amministrazione_id)"
    )
    op.execute("CREATE INDEX ix_pn_movimenti_pagamento_id ON pn_movimenti (pagamento_id)")

    op.execute(
        """
        CREATE TABLE pn_movimenti_documenti (
            id SERIAL PRIMARY KEY,
            movimento_id INTEGER NOT NULL REFERENCES pn_movimenti(id) ON DELETE CASCADE,
            documento_tipo pn_documento_tipo NOT NULL,
            documento_id INTEGER NOT NULL,
            importo NUMERIC(12, 2) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT ck_pn_mov_doc_importo_non_negativo CHECK (importo >= 0)
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_pn_movimenti_documenti_movimento_id ON pn_movimenti_documenti (movimento_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS pn_movimenti_documenti CASCADE")
    op.execute("DROP TABLE IF EXISTS pn_movimenti CASCADE")
    op.execute("DROP TABLE IF EXISTS pn_preferenze CASCADE")
    op.execute("DROP TABLE IF EXISTS pn_categorie CASCADE")
    op.execute("DROP TABLE IF EXISTS pn_conti CASCADE")

    for enum_name in reversed(list(ENUM_DEFINITIONS.keys())):
        op.execute(f"DROP TYPE IF EXISTS {enum_name} CASCADE")

