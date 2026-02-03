#!/usr/bin/env python3
"""
Script per creare il conto 'Soccida monetizzata - Acconti' per tutte le aziende
che hanno contratti soccida monetizzati attivi ma non hanno ancora il conto.
"""

import sys
import os

# Aggiungi il path del backend
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import engine


def create_conto_soccida_monetizzata():
    """Crea il conto 'Soccida monetizzata - Acconti' per tutte le aziende che ne hanno bisogno."""
    
    migration_sql = """
    BEGIN;

    -- Crea il conto 'Soccida monetizzata - Acconti' per ogni azienda con contratti monetizzati attivi
    DO $$
    DECLARE
        azienda_record RECORD;
        conto_soccida_id INTEGER;
        contratti_count INTEGER;
    BEGIN
        -- Itera su tutte le aziende con contratti soccida monetizzati attivi
        FOR azienda_record IN 
            SELECT DISTINCT a.id, a.nome
            FROM aziende a
            INNER JOIN contratti_soccida cs ON cs.azienda_id = a.id
            WHERE a.deleted_at IS NULL
              AND cs.deleted_at IS NULL
              AND cs.attivo = true
              AND cs.monetizzata = true
        LOOP
            -- Verifica se il conto esiste già
            SELECT id INTO conto_soccida_id
            FROM pn_conti
            WHERE azienda_id = azienda_record.id
              AND LOWER(nome) = 'soccida monetizzata - acconti'
            LIMIT 1;
            
            -- Conta i contratti monetizzati attivi per questa azienda
            SELECT COUNT(*) INTO contratti_count
            FROM contratti_soccida
            WHERE azienda_id = azienda_record.id
              AND deleted_at IS NULL
              AND attivo = true
              AND monetizzata = true;
            
            IF conto_soccida_id IS NULL THEN
                -- Crea il conto
                INSERT INTO pn_conti (
                    azienda_id, 
                    nome, 
                    tipo, 
                    saldo_iniziale, 
                    saldo_attuale, 
                    attivo, 
                    giroconto_strategia,
                    note,
                    created_at, 
                    updated_at
                )
                VALUES (
                    azienda_record.id, 
                    'Soccida monetizzata - Acconti', 
                    'altro', 
                    0, 
                    0, 
                    true, 
                    'automatico',
                    'Conto automatico per tracciare acconti ricevuti da contratti soccida monetizzati',
                    NOW(), 
                    NOW()
                )
                RETURNING id INTO conto_soccida_id;
                
                RAISE NOTICE 'Creato conto "Soccida monetizzata - Acconti" per azienda % (%) - % contratti monetizzati attivi', 
                    azienda_record.id, azienda_record.nome, contratti_count;
            ELSE
                RAISE NOTICE 'Conto già esistente per azienda % (%) - % contratti monetizzati attivi', 
                    azienda_record.id, azienda_record.nome, contratti_count;
            END IF;
        END LOOP;
    END $$;

    COMMIT;
    """
    
    verification_sql = """
    SELECT 
        a.id as azienda_id,
        a.nome as azienda_nome,
        COUNT(DISTINCT cs.id) as contratti_monetizzati_attivi,
        c.id as conto_id,
        c.nome as conto_nome,
        CASE 
            WHEN c.id IS NOT NULL THEN 'OK'
            ELSE 'MANCANTE'
        END as stato
    FROM aziende a
    INNER JOIN contratti_soccida cs ON cs.azienda_id = a.id
    LEFT JOIN pn_conti c ON c.azienda_id = a.id 
        AND LOWER(c.nome) = 'soccida monetizzata - acconti'
    WHERE a.deleted_at IS NULL
      AND cs.deleted_at IS NULL
      AND cs.attivo = true
      AND cs.monetizzata = true
    GROUP BY a.id, a.nome, c.id, c.nome
    ORDER BY a.id;
    """
    
    print("=" * 70)
    print("MIGRAZIONE: Creazione conto 'Soccida monetizzata - Acconti'")
    print("=" * 70)
    print()
    
    try:
        with engine.connect() as conn:
            print("📝 Esecuzione migrazione...")
            conn.execute(text(migration_sql))
            conn.commit()
            print("✅ Migrazione completata con successo!")
            print()
            
            print("=" * 70)
            print("VERIFICA RISULTATI")
            print("=" * 70)
            print()
            
            result = conn.execute(text(verification_sql))
            rows = result.fetchall()
            
            if rows:
                print(f"Trovate {len(rows)} aziende con contratti soccida monetizzati attivi:")
                print()
                tutte_ok = True
                for row in rows:
                    stato = "✅" if row[5] == "OK" else "❌"
                    if row[5] != "OK":
                        tutte_ok = False
                    print(f"{stato} Azienda {row[0]} ({row[1]}):")
                    print(f"   Contratti monetizzati attivi: {row[2]}")
                    print(f"   Conto: {row[4] if row[4] else 'MANCANTE'}")
                    print()
                
                if tutte_ok:
                    print("✅ Tutte le aziende hanno il conto configurato correttamente!")
                else:
                    print("⚠️  Alcune aziende non hanno il conto configurato")
            else:
                print("ℹ️  Nessuna azienda con contratti soccida monetizzati attivi trovata")
                
    except Exception as e:
        print(f"\n❌ Errore durante l'esecuzione: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    create_conto_soccida_monetizzata()

