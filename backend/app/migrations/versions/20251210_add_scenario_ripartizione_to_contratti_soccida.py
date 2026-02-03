"""add_scenario_ripartizione_to_contratti_soccida

Revision ID: add_scenario_ripartizione
Revises: add_azienda_id_impostazioni
Create Date: 2025-12-10 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_scenario_ripartizione'
down_revision = 'add_azienda_id_impostazioni'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Aggiungi colonna scenario_ripartizione a contratti_soccida
    # Scenario ripartizione utili: 'vendita_diretta' o 'diventano_proprieta'
    op.add_column(
        'contratti_soccida',
        sa.Column(
            'scenario_ripartizione',
            sa.String(length=50),
            nullable=True,
            comment="Scenario ripartizione utili: 'vendita_diretta' o 'diventano_proprieta'"
        )
    )
    
    # Aggiungi constraint check per validare i valori
    op.create_check_constraint(
        'ck_contratti_soccida_scenario_ripartizione',
        'contratti_soccida',
        "scenario_ripartizione IN ('vendita_diretta', 'diventano_proprieta') OR scenario_ripartizione IS NULL"
    )


def downgrade() -> None:
    # Rimuovi constraint
    op.drop_constraint('ck_contratti_soccida_scenario_ripartizione', 'contratti_soccida', type_='check')
    
    # Rimuovi colonna
    op.drop_column('contratti_soccida', 'scenario_ripartizione')

