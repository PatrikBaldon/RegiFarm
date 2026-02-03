"""Add distribution metadata to registro_alimentazione and create dettagli table."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20251109_registro_alim_dist"
down_revision: Union[str, Sequence[str], None] = "20251109_fornitore_ext"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "registro_alimentazione",
        sa.Column("quantita_totale", sa.Numeric(12, 4), nullable=True),
    )
    op.add_column(
        "registro_alimentazione",
        sa.Column("target_tipo", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "registro_alimentazione",
        sa.Column("target_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "registro_alimentazione",
        sa.Column("tipo_alimento", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "registro_alimentazione",
        sa.Column("componente_alimentare_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "registro_alimentazione",
        sa.Column("mangime_confezionato_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "registro_alimentazione",
        sa.Column("numero_capi", sa.Integer(), nullable=True),
    )
    op.add_column(
        "registro_alimentazione",
        sa.Column("quota_per_capo", sa.Numeric(12, 4), nullable=True),
    )
    op.add_column(
        "registro_alimentazione",
        sa.Column("giorni_permanenza_min", sa.Integer(), nullable=True),
    )
    op.add_column(
        "registro_alimentazione",
        sa.Column("giorni_permanenza_max", sa.Integer(), nullable=True),
    )
    op.add_column(
        "registro_alimentazione",
        sa.Column("azienda_id", sa.Integer(), nullable=True),
    )

    op.create_foreign_key(
        "fk_registro_alimentazione_componente",
        "registro_alimentazione",
        "componenti_alimentari",
        ["componente_alimentare_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_registro_alimentazione_mangime",
        "registro_alimentazione",
        "mangimi_confezionati",
        ["mangime_confezionato_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_registro_alimentazione_azienda",
        "registro_alimentazione",
        "aziende",
        ["azienda_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "registro_alimentazione_dettagli",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("registro_id", sa.Integer(), nullable=False),
        sa.Column("box_id", sa.Integer(), nullable=True),
        sa.Column("numero_capi", sa.Integer(), nullable=False),
        sa.Column("quantita", sa.Numeric(12, 4), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.Column("note", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["registro_id"], ["registro_alimentazione.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["box_id"], ["box.id"], ondelete="SET NULL"),
    )
    op.create_index(
        "ix_registro_alimentazione_dettagli_registro",
        "registro_alimentazione_dettagli",
        ["registro_id"],
    )
    op.create_index(
        "ix_registro_alimentazione_dettagli_box",
        "registro_alimentazione_dettagli",
        ["box_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_registro_alimentazione_dettagli_box", table_name="registro_alimentazione_dettagli")
    op.drop_index("ix_registro_alimentazione_dettagli_registro", table_name="registro_alimentazione_dettagli")
    op.drop_table("registro_alimentazione_dettagli")

    op.drop_constraint("fk_registro_alimentazione_azienda", "registro_alimentazione", type_="foreignkey")
    op.drop_constraint("fk_registro_alimentazione_mangime", "registro_alimentazione", type_="foreignkey")
    op.drop_constraint("fk_registro_alimentazione_componente", "registro_alimentazione", type_="foreignkey")

    op.drop_column("registro_alimentazione", "azienda_id")
    op.drop_column("registro_alimentazione", "giorni_permanenza_max")
    op.drop_column("registro_alimentazione", "giorni_permanenza_min")
    op.drop_column("registro_alimentazione", "quota_per_capo")
    op.drop_column("registro_alimentazione", "numero_capi")
    op.drop_column("registro_alimentazione", "componente_alimentare_id")
    op.drop_column("registro_alimentazione", "mangime_confezionato_id")
    op.drop_column("registro_alimentazione", "tipo_alimento")
    op.drop_column("registro_alimentazione", "target_id")
    op.drop_column("registro_alimentazione", "target_tipo")
    op.drop_column("registro_alimentazione", "quantita_totale")
