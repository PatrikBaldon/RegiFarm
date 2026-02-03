#!/usr/bin/env python3
"""
Script per eseguire la migrazione SQL direttamente sul database.
"""

import sys
import os

# Aggiungi il path del backend
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import engine

def execute_migration():
    """Esegue la migrazione SQL completa."""
    
    migration_sql = """
    BEGIN;

    -- STEP 1: Aggiungi le colonne a pn_preferenze
    ALTER TABLE pn_preferenze
    ADD COLUMN IF NOT EXISTS conto_debiti_fornitori_id INTEGER REFERENCES pn_conti(id) ON DELETE SET NULL;

    ALTER TABLE pn_preferenze
    ADD COLUMN IF NOT EXISTS conto_crediti_clienti_id INTEGER REFERENCES pn_conti(id) ON DELETE SET NULL;

    -- STEP 2: Crea i conti e aggiorna le preferenze per tutte le aziende esistenti
    DO $$
    DECLARE
        azienda_record RECORD;
        conto_debiti_id INTEGER;
        conto_crediti_id INTEGER;
    BEGIN
        -- Itera su tutte le aziende attive
        FOR azienda_record IN SELECT id FROM aziende WHERE deleted_at IS NULL
        LOOP
            -- Crea o trova il conto "Debiti verso fornitori"
            SELECT id INTO conto_debiti_id
            FROM pn_conti
            WHERE azienda_id = azienda_record.id
              AND LOWER(nome) = 'debiti verso fornitori'
            LIMIT 1;
            
            IF conto_debiti_id IS NULL THEN
                INSERT INTO pn_conti (azienda_id, nome, tipo, saldo_iniziale, saldo_attuale, attivo, giroconto_strategia, created_at, updated_at)
                VALUES (azienda_record.id, 'Debiti verso fornitori', 'altro', 0, 0, true, 'automatico', NOW(), NOW())
                RETURNING id INTO conto_debiti_id;
            END IF;
            
            -- Crea o trova il conto "Crediti verso clienti"
            SELECT id INTO conto_crediti_id
            FROM pn_conti
            WHERE azienda_id = azienda_record.id
              AND LOWER(nome) = 'crediti verso clienti'
            LIMIT 1;
            
            IF conto_crediti_id IS NULL THEN
                INSERT INTO pn_conti (azienda_id, nome, tipo, saldo_iniziale, saldo_attuale, attivo, giroconto_strategia, created_at, updated_at)
                VALUES (azienda_record.id, 'Crediti verso clienti', 'altro', 0, 0, true, 'automatico', NOW(), NOW())
                RETURNING id INTO conto_crediti_id;
            END IF;
            
            -- Aggiorna o crea le preferenze per questa azienda
            INSERT INTO pn_preferenze (azienda_id, conto_debiti_fornitori_id, conto_crediti_clienti_id, created_at, updated_at)
            VALUES (azienda_record.id, conto_debiti_id, conto_crediti_id, NOW(), NOW())
            ON CONFLICT (azienda_id) 
            DO UPDATE SET
                conto_debiti_fornitori_id = COALESCE(EXCLUDED.conto_debiti_fornitori_id, pn_preferenze.conto_debiti_fornitori_id),
                conto_crediti_clienti_id = COALESCE(EXCLUDED.conto_crediti_clienti_id, pn_preferenze.conto_crediti_clienti_id),
                updated_at = NOW();
            
            RAISE NOTICE 'Aggiornata azienda %: Debiti=% Crediti=%', azienda_record.id, conto_debiti_id, conto_crediti_id;
        END LOOP;
    END $$;

    COMMIT;
    """
    
    verification_sql = """
    SELECT 
        a.id as azienda_id,
        a.nome as azienda_nome,
        p.conto_debiti_fornitori_id,
        cd.nome as conto_debiti_nome,
        p.conto_crediti_clienti_id,
        cc.nome as conto_crediti_nome,
        CASE 
            WHEN p.conto_debiti_fornitori_id IS NOT NULL 
             AND p.conto_crediti_clienti_id IS NOT NULL 
             AND cd.id IS NOT NULL 
             AND cc.id IS NOT NULL 
            THEN 'OK'
            ELSE 'MANCANTE'
        END as stato
    FROM aziende a
    LEFT JOIN pn_preferenze p ON p.azienda_id = a.id
    LEFT JOIN pn_conti cd ON cd.id = p.conto_debiti_fornitori_id
    LEFT JOIN pn_conti cc ON cc.id = p.conto_crediti_clienti_id
    WHERE a.deleted_at IS NULL
    ORDER BY a.id;
    """
    
    print("=" * 60)
    print("ESECUZIONE MIGRAZIONE: Debiti verso fornitori e Crediti verso clienti")
    print("=" * 60)
    print()
    
    try:
        with engine.connect() as conn:
            print("📝 Esecuzione migrazione...")
            conn.execute(text(migration_sql))
            conn.commit()
            print("✅ Migrazione completata con successo!")
            print()
            
            print("=" * 60)
            print("VERIFICA RISULTATI")
            print("=" * 60)
            print()
            
            result = conn.execute(text(verification_sql))
            rows = result.fetchall()
            
            if rows:
                print(f"Trovate {len(rows)} aziende:")
                print()
                tutte_ok = True
                for row in rows:
                    stato = "✅" if row[6] == "OK" else "❌"
                    if row[6] != "OK":
                        tutte_ok = False
                    print(f"{stato} Azienda {row[0]} ({row[1]}):")
                    print(f"   Debiti: {row[3] if row[3] else 'MANCANTE'}")
                    print(f"   Crediti: {row[5] if row[5] else 'MANCANTE'}")
                    print()
                
                if tutte_ok:
                    print("✅ Tutte le aziende sono configurate correttamente!")
                else:
                    print("⚠️  Alcune aziende non sono configurate correttamente")
            else:
                print("⚠️  Nessuna azienda trovata")
                
    except Exception as e:
        print(f"\n❌ Errore durante l'esecuzione: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    execute_migration()

