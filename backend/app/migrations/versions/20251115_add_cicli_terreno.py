"""add cicli terreno tables

Revision ID: 20251115_add_cicli_terreno
Revises: 20251115_add_piani_uscita
Create Date: 2025-11-15 12:00:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20251115_add_cicli_terreno"
down_revision = "20251115_add_piani_uscita"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cicli_terreno",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("azienda_id", sa.Integer(), nullable=False),
        sa.Column("terreno_id", sa.Integer(), nullable=False),
        sa.Column("coltura", sa.String(length=120), nullable=False),
        sa.Column("anno", sa.Integer(), nullable=True),
        sa.Column("data_inizio", sa.Date(), nullable=True),
        sa.Column("data_fine", sa.Date(), nullable=True),
        sa.Column("superficie_coinvolta", sa.Numeric(10, 2), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["azienda_id"], ["aziende.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["terreno_id"], ["terreni.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_cicli_terreno_id"), "cicli_terreno", ["id"], unique=False)
    op.create_index(op.f("ix_cicli_terreno_azienda_id"), "cicli_terreno", ["azienda_id"], unique=False)
    op.create_index(op.f("ix_cicli_terreno_terreno_id"), "cicli_terreno", ["terreno_id"], unique=False)
    op.create_index(op.f("ix_cicli_terreno_anno"), "cicli_terreno", ["anno"], unique=False)
    op.create_index(op.f("ix_cicli_terreno_deleted_at"), "cicli_terreno", ["deleted_at"], unique=False)

    op.create_table(
        "cicli_terreno_fasi",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ciclo_id", sa.Integer(), nullable=False),
        sa.Column("nome", sa.String(length=120), nullable=False),
        sa.Column("tipo", sa.String(length=30), nullable=False),
        sa.Column("ordine", sa.Integer(), nullable=True),
        sa.Column("data_inizio", sa.Date(), nullable=True),
        sa.Column("data_fine", sa.Date(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["ciclo_id"], ["cicli_terreno.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_cicli_terreno_fasi_id"), "cicli_terreno_fasi", ["id"], unique=False)
    op.create_index(op.f("ix_cicli_terreno_fasi_ciclo_id"), "cicli_terreno_fasi", ["ciclo_id"], unique=False)
    op.create_index(op.f("ix_cicli_terreno_fasi_tipo"), "cicli_terreno_fasi", ["tipo"], unique=False)

    op.create_table(
        "cicli_terreno_costi",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ciclo_id", sa.Integer(), nullable=False),
        sa.Column("fase_id", sa.Integer(), nullable=True),
        sa.Column("azienda_id", sa.Integer(), nullable=False),
        sa.Column("terreno_id", sa.Integer(), nullable=False),
        sa.Column("source_type", sa.String(length=20), nullable=False, server_default="manuale"),
        sa.Column("descrizione", sa.String(length=180), nullable=False),
        sa.Column("data", sa.Date(), nullable=True),
        sa.Column("importo", sa.Numeric(12, 2), nullable=True),
        sa.Column("fattura_amministrazione_id", sa.Integer(), nullable=True),
        sa.Column("lavorazione_id", sa.Integer(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["azienda_id"], ["aziende.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["ciclo_id"], ["cicli_terreno.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["fase_id"], ["cicli_terreno_fasi.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["terreno_id"], ["terreni.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["fattura_amministrazione_id"], ["fatture_amministrazione.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["lavorazione_id"], ["lavorazioni_terreno.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_cicli_terreno_costi_id"), "cicli_terreno_costi", ["id"], unique=False)
    op.create_index(op.f("ix_cicli_terreno_costi_ciclo_id"), "cicli_terreno_costi", ["ciclo_id"], unique=False)
    op.create_index(op.f("ix_cicli_terreno_costi_fase_id"), "cicli_terreno_costi", ["fase_id"], unique=False)
    op.create_index(op.f("ix_cicli_terreno_costi_azienda_id"), "cicli_terreno_costi", ["azienda_id"], unique=False)
    op.create_index(op.f("ix_cicli_terreno_costi_terreno_id"), "cicli_terreno_costi", ["terreno_id"], unique=False)
    op.create_index(
        op.f("ix_cicli_terreno_costi_fattura_amministrazione_id"),
        "cicli_terreno_costi",
        ["fattura_amministrazione_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_cicli_terreno_costi_lavorazione_id"),
        "cicli_terreno_costi",
        ["lavorazione_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_cicli_terreno_costi_lavorazione_id"), table_name="cicli_terreno_costi")
    op.drop_index(op.f("ix_cicli_terreno_costi_fattura_amministrazione_id"), table_name="cicli_terreno_costi")
    op.drop_index(op.f("ix_cicli_terreno_costi_terreno_id"), table_name="cicli_terreno_costi")
    op.drop_index(op.f("ix_cicli_terreno_costi_azienda_id"), table_name="cicli_terreno_costi")
    op.drop_index(op.f("ix_cicli_terreno_costi_fase_id"), table_name="cicli_terreno_costi")
    op.drop_index(op.f("ix_cicli_terreno_costi_ciclo_id"), table_name="cicli_terreno_costi")
    op.drop_index(op.f("ix_cicli_terreno_costi_id"), table_name="cicli_terreno_costi")
    op.drop_table("cicli_terreno_costi")

    op.drop_index(op.f("ix_cicli_terreno_fasi_tipo"), table_name="cicli_terreno_fasi")
    op.drop_index(op.f("ix_cicli_terreno_fasi_ciclo_id"), table_name="cicli_terreno_fasi")
    op.drop_index(op.f("ix_cicli_terreno_fasi_id"), table_name="cicli_terreno_fasi")
    op.drop_table("cicli_terreno_fasi")

    op.drop_index(op.f("ix_cicli_terreno_deleted_at"), table_name="cicli_terreno")
    op.drop_index(op.f("ix_cicli_terreno_anno"), table_name="cicli_terreno")
    op.drop_index(op.f("ix_cicli_terreno_terreno_id"), table_name="cicli_terreno")
    op.drop_index(op.f("ix_cicli_terreno_azienda_id"), table_name="cicli_terreno")
    op.drop_index(op.f("ix_cicli_terreno_id"), table_name="cicli_terreno")
    op.drop_table("cicli_terreno")

