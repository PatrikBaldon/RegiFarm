#!/usr/bin/env python3
"""
Script per eseguire la migrazione scenario_ripartizione sul database di produzione.
Può essere eseguito localmente (se DATABASE_URL punta a produzione) o su Fly.io via SSH.
"""

import sys
import os

# Aggiungi il path del backend
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import engine

def run_migration():
    """Esegue la migrazione per aggiungere scenario_ripartizione."""
    
    migration_sql = """
    BEGIN;

    -- Aggiungi colonna scenario_ripartizione se non esiste
    ALTER TABLE contratti_soccida
    ADD COLUMN IF NOT EXISTS scenario_ripartizione VARCHAR(50) NULL;

    -- Aggiungi commento alla colonna
    COMMENT ON COLUMN contratti_soccida.scenario_ripartizione IS 'Scenario ripartizione utili: ''vendita_diretta'' o ''diventano_proprieta''';

    -- Aggiungi constraint check per validare i valori (se non esiste già)
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 
            FROM pg_constraint 
            WHERE conname = 'ck_contratti_soccida_scenario_ripartizione'
        ) THEN
            ALTER TABLE contratti_soccida
            ADD CONSTRAINT ck_contratti_soccida_scenario_ripartizione
            CHECK (scenario_ripartizione IN ('vendita_diretta', 'diventano_proprieta') OR scenario_ripartizione IS NULL);
        END IF;
    END $$;

    COMMIT;
    """
    
    verification_sql = """
    SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
    FROM information_schema.columns
    WHERE table_name = 'contratti_soccida' 
      AND column_name = 'scenario_ripartizione';
    """
    
    constraint_check_sql = """
    SELECT 
        conname as constraint_name,
        pg_get_constraintdef(oid) as constraint_definition
    FROM pg_constraint
    WHERE conname = 'ck_contratti_soccida_scenario_ripartizione';
    """
    
    print("=" * 60)
    print("MIGRAZIONE: Aggiunta scenario_ripartizione a contratti_soccida")
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
            
            # Verifica colonna
            result = conn.execute(text(verification_sql))
            rows = result.fetchall()
            
            if rows:
                print("✅ Colonna 'scenario_ripartizione' trovata:")
                for row in rows:
                    print(f"   Nome: {row[0]}")
                    print(f"   Tipo: {row[1]}")
                    print(f"   Nullable: {row[2]}")
                    print(f"   Default: {row[3]}")
            else:
                print("❌ Colonna 'scenario_ripartizione' NON trovata!")
            
            print()
            
            # Verifica constraint
            result = conn.execute(text(constraint_check_sql))
            rows = result.fetchall()
            
            if rows:
                print("✅ Constraint 'ck_contratti_soccida_scenario_ripartizione' trovato:")
                for row in rows:
                    print(f"   Nome: {row[0]}")
                    print(f"   Definizione: {row[1]}")
            else:
                print("⚠️  Constraint 'ck_contratti_soccida_scenario_ripartizione' NON trovato!")
            
            print()
            print("=" * 60)
            print("✅ Migrazione completata!")
            print("=" * 60)
                
    except Exception as e:
        print(f"\n❌ Errore durante l'esecuzione: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    run_migration()

