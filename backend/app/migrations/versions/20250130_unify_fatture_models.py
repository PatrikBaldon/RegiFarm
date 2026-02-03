"""Unify FatturaEmessa into FatturaAmministrazione

Revision ID: 20250130_unify_fatture
Revises: 20250129_righe_json
Create Date: 2025-01-30 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20250130_unify_fatture'
down_revision = '20250129_righe_json'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Aggiungi colonne mancanti a fatture_amministrazione
    op.add_column('fatture_amministrazione', sa.Column('azienda_id', sa.Integer(), nullable=True))
    op.add_column('fatture_amministrazione', sa.Column('cliente_id', sa.Integer(), nullable=True))
    op.add_column('fatture_amministrazione', sa.Column('cliente_nome', sa.String(length=200), nullable=True))
    op.add_column('fatture_amministrazione', sa.Column('cliente_piva', sa.String(length=50), nullable=True))
    op.add_column('fatture_amministrazione', sa.Column('cliente_cf', sa.String(length=50), nullable=True))
    op.add_column('fatture_amministrazione', sa.Column('importo_incassato', sa.Numeric(12, 2), server_default='0', nullable=False))
    op.add_column('fatture_amministrazione', sa.Column('aliquota_iva', sa.Numeric(5, 2), server_default='0', nullable=False))
    op.add_column('fatture_amministrazione', sa.Column('data_incasso', sa.Date(), nullable=True))
    
    # Aggiungi foreign keys
    op.create_foreign_key('fk_fatture_amministrazione_azienda', 'fatture_amministrazione', 'aziende', ['azienda_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_fatture_amministrazione_cliente', 'fatture_amministrazione', 'fornitori', ['cliente_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_fatture_amministrazione_azienda_id', 'fatture_amministrazione', ['azienda_id'])
    op.create_index('ix_fatture_amministrazione_cliente_id', 'fatture_amministrazione', ['cliente_id'])
    
    # 2. Aggiorna enum StatoPagamento per includere tutti i valori
    # Nota: PostgreSQL non supporta ALTER TYPE facilmente, quindi usiamo un approccio più sicuro
    # I valori verranno gestiti a livello applicativo
    
    # 3. Migra dati da fatture_emesse a fatture_amministrazione
    op.execute("""
        INSERT INTO fatture_amministrazione (
            azienda_id, tipo, numero, data_fattura, data_registrazione,
            cliente_id, cliente_nome, cliente_piva, cliente_cf,
            importo_totale, importo_iva, importo_netto, importo_incassato,
            aliquota_iva, stato_pagamento, data_scadenza, data_incasso,
            categoria, macrocategoria, terreno_id, contratto_soccida_id,
            note, allegato_path, dati_xml, xml_raw, righe,
            created_at, updated_at, deleted_at
        )
        SELECT 
            azienda_id, 'entrata' as tipo, numero, data_fattura, data_registrazione,
            cliente_id, cliente_nome, cliente_piva, cliente_cf,
            importo_totale, importo_iva, importo_netto, importo_incassato,
            aliquota_iva,
            CASE 
                WHEN stato_pagamento = 'da_incassare' THEN 'da_incassare'
                WHEN stato_pagamento = 'incassata' THEN 'incassata'
                WHEN stato_pagamento = 'scaduta' THEN 'scaduta'
                WHEN stato_pagamento = 'parziale' THEN 'parziale'
                WHEN stato_pagamento = 'annullata' THEN 'annullata'
                ELSE 'da_incassare'
            END as stato_pagamento,
            data_scadenza, data_incasso,
            categoria, macrocategoria, terreno_id, contratto_soccida_id,
            note, allegato_path, dati_xml, xml_raw, righe,
            created_at, updated_at, deleted_at
        FROM fatture_emesse
        WHERE deleted_at IS NULL
    """)
    
    # 4. Aggiorna pagamenti per riferirsi a fatture_amministrazione invece di fatture_emesse
    # Usa un JOIN più sicuro per trovare la fattura migrata corrispondente
    op.execute("""
        UPDATE pagamenti p
        SET fattura_amministrazione_id = fa.id
        FROM fatture_emesse fe
        INNER JOIN fatture_amministrazione fa ON (
            fa.azienda_id = fe.azienda_id
            AND fa.numero = fe.numero
            AND fa.data_fattura = fe.data_fattura
            AND fa.tipo = 'entrata'
            AND fa.created_at = fe.created_at
        )
        WHERE p.fattura_emessa_id = fe.id
        AND p.fattura_amministrazione_id IS NULL
    """)
    
    # 5. Rimuovi foreign key da pagamenti a fatture_emesse (mantieni colonna per compatibilità)
    op.drop_constraint('pagamenti_fattura_emessa_id_fkey', 'pagamenti', type_='foreignkey')
    
    # 6. Rimuovi foreign key da aziende a fatture_emesse
    op.drop_constraint('fatture_emesse_azienda_id_fkey', 'fatture_emesse', type_='foreignkey')
    
    # 7. Rimuovi foreign key da contratti_soccida a fatture_emesse (se esiste)
    # Nota: potrebbe non esistere se è solo una relazione ORM
    
    # 8. Rinomina tabella fatture_emesse per backup (opzionale, o elimina dopo verifica)
    # op.rename_table('fatture_emesse', 'fatture_emesse_backup')


def downgrade():
    # Ripristina foreign key da pagamenti a fatture_emesse
    op.create_foreign_key('pagamenti_fattura_emessa_id_fkey', 'pagamenti', 'fatture_emesse', ['fattura_emessa_id'], ['id'], ondelete='SET NULL')
    
    # Ripristina foreign key da aziende
    op.create_foreign_key('fatture_emesse_azienda_id_fkey', 'fatture_emesse', 'aziende', ['azienda_id'], ['id'], ondelete='CASCADE')
    
    # Rimuovi colonne aggiunte
    op.drop_index('ix_fatture_amministrazione_cliente_id', table_name='fatture_amministrazione')
    op.drop_index('ix_fatture_amministrazione_azienda_id', table_name='fatture_amministrazione')
    op.drop_constraint('fk_fatture_amministrazione_cliente', 'fatture_amministrazione', type_='foreignkey')
    op.drop_constraint('fk_fatture_amministrazione_azienda', 'fatture_amministrazione', type_='foreignkey')
    op.drop_column('fatture_amministrazione', 'data_incasso')
    op.drop_column('fatture_amministrazione', 'aliquota_iva')
    op.drop_column('fatture_amministrazione', 'importo_incassato')
    op.drop_column('fatture_amministrazione', 'cliente_cf')
    op.drop_column('fatture_amministrazione', 'cliente_piva')
    op.drop_column('fatture_amministrazione', 'cliente_nome')
    op.drop_column('fatture_amministrazione', 'cliente_id')
    op.drop_column('fatture_amministrazione', 'azienda_id')
    
    # Nota: I dati migrati da fatture_emesse non possono essere facilmente ripristinati
    # senza un backup separato

