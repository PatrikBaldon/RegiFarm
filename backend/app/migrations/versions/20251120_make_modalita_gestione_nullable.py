"""Make modalita_gestione nullable for partite

Revision ID: 20251120_modalita_nullable
Revises: 20251119_update_soccida_links
Create Date: 2025-11-20 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '20251120_modalita_nullable'
down_revision = '20251119_update_soccida_links'
branch_labels = None
depends_on = None


def upgrade():
    # Modifica la colonna modalita_gestione per permettere NULL
    # Prima rimuoviamo il default e il NOT NULL constraint
    op.alter_column(
        'partite_animali',
        'modalita_gestione',
        existing_type=postgresql.ENUM(
            'proprieta',
            'soccida_monetizzata',
            'soccida_fatturata',
            name='partita_modalita_gestione',
            create_type=False
        ),
        nullable=True,
        server_default=None
    )
    
    # Aggiorna tutte le partite esistenti in base alla nuova logica
    # Questa logica verrà applicata una sola volta durante la migration
    op.execute("""
        UPDATE partite_animali
        SET modalita_gestione = CASE
            -- Trasferimenti interni tra allevamenti gestiti: NULL
            -- (verificato tramite is_trasferimento_interno = true e entrambi i codici stalla sono gestiti)
            WHEN is_trasferimento_interno = true 
                AND codice_stalla IN (SELECT codice_stalla FROM sedi WHERE deleted_at IS NULL)
                AND codice_stalla_azienda IN (SELECT codice_stalla FROM sedi WHERE deleted_at IS NULL)
                AND codice_stalla != codice_stalla_azienda
            THEN NULL
            
            -- Uscite verso allevamenti non gestiti: NULL
            WHEN tipo = 'uscita' 
                AND is_trasferimento_interno = false
                AND codice_stalla NOT IN (SELECT codice_stalla FROM sedi WHERE deleted_at IS NULL)
            THEN NULL
            
            -- Partite associate a contratti soccida: mantieni soccida_monetizzata o soccida_fatturata
            -- (questo viene gestito dopo, quindi qui impostiamo a proprieta se non è già soccida)
            WHEN contratto_soccida_id IS NOT NULL 
                AND modalita_gestione IN ('soccida_monetizzata', 'soccida_fatturata')
            THEN modalita_gestione  -- Mantieni la modalità soccida esistente
            
            -- Tutti gli altri casi: 'proprieta'
            ELSE 'proprieta'
        END
        WHERE deleted_at IS NULL
    """)
    
    # Ora aggiorna le partite associate a contratti soccida con la modalità corretta del contratto
    op.execute("""
        UPDATE partite_animali p
        SET modalita_gestione = CASE
            WHEN c.monetizzata = true THEN 'soccida_monetizzata'
            ELSE 'soccida_fatturata'
        END
        FROM contratti_soccida c
        WHERE p.contratto_soccida_id = c.id
            AND p.deleted_at IS NULL
            AND c.deleted_at IS NULL
    """)


def downgrade():
    # Ripristina NOT NULL e default
    # Prima aggiorna i NULL a 'proprieta'
    op.execute("UPDATE partite_animali SET modalita_gestione = 'proprieta' WHERE modalita_gestione IS NULL")
    
    op.alter_column(
        'partite_animali',
        'modalita_gestione',
        existing_type=postgresql.ENUM(
            'proprieta',
            'soccida_monetizzata',
            'soccida_fatturata',
            name='partita_modalita_gestione',
            create_type=False
        ),
        nullable=False,
        server_default='proprieta'
    )

