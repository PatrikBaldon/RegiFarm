"""Add Supabase onboarding structures"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20251112_onboarding_supabase"
down_revision = "20251111_sanitario_azid"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Aziende - link to Supabase user (primary contact)
    op.add_column(
        "aziende",
        sa.Column("supabase_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_unique_constraint(
        "uq_aziende_supabase_user_id", "aziende", ["supabase_user_id"]
    )

    # Tabella utenti aziendali collegati a Supabase Auth
    op.create_table(
        "aziende_utenti",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("auth_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=150), nullable=False),
        sa.Column("ruolo", sa.String(length=50), nullable=False),
        sa.Column(
            "stato",
            sa.String(length=20),
            nullable=False,
            server_default="invited",
        ),
        sa.Column("invite_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("first_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "azienda_id",
            sa.Integer(),
            sa.ForeignKey("aziende.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            onupdate=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("auth_user_id", name="uq_aziende_utenti_auth_user_id"),
    )
    op.create_index(
        "ix_aziende_utenti_azienda_id", "aziende_utenti", ["azienda_id"], unique=False
    )
    op.create_index(
        "ix_aziende_utenti_email", "aziende_utenti", ["email"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_aziende_utenti_email", table_name="aziende_utenti")
    op.drop_index("ix_aziende_utenti_azienda_id", table_name="aziende_utenti")
    op.drop_table("aziende_utenti")
    op.drop_constraint(
        "uq_aziende_supabase_user_id", "aziende", type_="unique"
    )
    op.drop_column("aziende", "supabase_user_id")

