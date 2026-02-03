"""Add piani uscita tables

Revision ID: 20251115_add_piani_uscita
Revises: 20251114_partite_manual_fatture
Create Date: 2025-11-15 10:00:00
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20251115_add_piani_uscita"
down_revision = "20251114_partite_manual_fatture"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "piani_uscita",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("azienda_id", sa.Integer(), nullable=False),
        sa.Column("nome", sa.String(length=120), nullable=False),
        sa.Column("stato", sa.String(length=20), nullable=False, server_default="bozza"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("data_uscita", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["azienda_id"], ["aziende.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_piani_uscita_id"), "piani_uscita", ["id"], unique=False)
    op.create_index(op.f("ix_piani_uscita_azienda_id"), "piani_uscita", ["azienda_id"], unique=False)

    op.create_table(
        "piani_uscita_animali",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("piano_uscita_id", sa.Integer(), nullable=False),
        sa.Column("animale_id", sa.Integer(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["animale_id"],
            ["animali.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["piano_uscita_id"],
            ["piani_uscita.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("piano_uscita_id", "animale_id", name="uq_piano_uscita_animale"),
    )
    op.create_index(op.f("ix_piani_uscita_animali_id"), "piani_uscita_animali", ["id"], unique=False)
    op.create_index(
        op.f("ix_piani_uscita_animali_piano_uscita_id"), "piani_uscita_animali", ["piano_uscita_id"], unique=False
    )
    op.create_index(op.f("ix_piani_uscita_animali_animale_id"), "piani_uscita_animali", ["animale_id"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_piani_uscita_animali_animale_id"), table_name="piani_uscita_animali")
    op.drop_index(op.f("ix_piani_uscita_animali_piano_uscita_id"), table_name="piani_uscita_animali")
    op.drop_index(op.f("ix_piani_uscita_animali_id"), table_name="piani_uscita_animali")
    op.drop_table("piani_uscita_animali")
    op.drop_index(op.f("ix_piani_uscita_azienda_id"), table_name="piani_uscita")
    op.drop_index(op.f("ix_piani_uscita_id"), table_name="piani_uscita")
    op.drop_table("piani_uscita")

