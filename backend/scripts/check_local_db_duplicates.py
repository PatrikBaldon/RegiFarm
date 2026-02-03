"""
Script per verificare duplicati nel database locale SQLite dell'app Electron.

Questo script legge direttamente il database SQLite locale per identificare duplicati.
"""

import sys
import os
import sqlite3
from pathlib import Path

def get_local_db_path():
    """Trova il percorso del database locale SQLite"""
    # Percorsi possibili per il database Electron
    possible_paths = [
        # macOS
        os.path.expanduser("~/Library/Application Support/Electron/regifarm_local.db"),
        os.path.expanduser("~/Library/Application Support/regifarm-pro/regifarm_local.db"),
        # Windows
        os.path.expanduser("~/AppData/Roaming/Electron/regifarm_local.db"),
        os.path.expanduser("~/AppData/Roaming/regifarm-pro/regifarm_local.db"),
        # Linux
        os.path.expanduser("~/.config/Electron/regifarm_local.db"),
        os.path.expanduser("~/.config/regifarm-pro/regifarm_local.db"),
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            return path
    
    return None


def analyze_local_db(db_path):
    """Analizza il database locale per duplicati"""
    
    if not db_path or not os.path.exists(db_path):
        print("❌ Database locale non trovato!")
        print("\nPercorsi cercati:")
        for path in [
            os.path.expanduser("~/Library/Application Support/Electron/regifarm_local.db"),
            os.path.expanduser("~/Library/Application Support/regifarm-pro/regifarm_local.db"),
        ]:
            print(f"  - {path}")
        return
    
    print(f"📂 Database locale trovato: {db_path}")
    print()
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # Verifica se la tabella esiste
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='pn_movimenti'")
        if not cursor.fetchone():
            print("❌ Tabella pn_movimenti non trovata nel database locale")
            return
        
        # Statistiche generali
        print("=" * 80)
        print("ANALISI DATABASE LOCALE SQLite")
        print("=" * 80)
        print()
        
        cursor.execute("""
            SELECT 
                COUNT(*) as totali,
                COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as attivi,
                COUNT(CASE WHEN fattura_amministrazione_id IS NOT NULL THEN 1 END) as con_fattura,
                COUNT(CASE WHEN fattura_amministrazione_id IS NULL AND deleted_at IS NULL THEN 1 END) as senza_fattura
            FROM pn_movimenti
        """)
        stats = cursor.fetchone()
        print("📊 STATISTICHE GENERALI")
        print("-" * 80)
        print(f"  Totale movimenti: {stats['totali']}")
        print(f"  Movimenti attivi: {stats['attivi']}")
        print(f"  Con fattura collegata: {stats['con_fattura']}")
        print(f"  Senza fattura collegata: {stats['senza_fattura']}")
        print()
        
        # Duplicati per fattura_amministrazione_id + tipo_operazione
        print("🔍 DUPLICATI PER FATTURA_AMMINISTRAZIONE_ID + TIPO_OPERAZIONE")
        print("-" * 80)
        cursor.execute("""
            SELECT 
                fattura_amministrazione_id,
                tipo_operazione,
                COUNT(*) as count,
                GROUP_CONCAT(id) as ids
            FROM pn_movimenti
            WHERE fattura_amministrazione_id IS NOT NULL
              AND deleted_at IS NULL
            GROUP BY fattura_amministrazione_id, tipo_operazione
            HAVING COUNT(*) > 1
            ORDER BY count DESC
            LIMIT 20
        """)
        result = cursor.fetchall()
        if result:
            print(f"  Trovati {len(result)} gruppi di duplicati:")
            for row in result:
                print(f"    Fattura ID {row['fattura_amministrazione_id']}, Tipo {row['tipo_operazione']}: {row['count']} movimenti (IDs: {row['ids']})")
        else:
            print("  ✅ Nessun duplicato trovato")
        print()
        
        # Duplicati esatti (stessa descrizione + importo + data + conto)
        print("🔍 DUPLICATI ESATTI (STESSA DESCRIZIONE + IMPORTO + DATA + CONTO)")
        print("-" * 80)
        cursor.execute("""
            SELECT 
                conto_id,
                data,
                importo,
                descrizione,
                COUNT(*) as count,
                GROUP_CONCAT(id) as ids
            FROM pn_movimenti
            WHERE deleted_at IS NULL
            GROUP BY conto_id, data, importo, descrizione
            HAVING COUNT(*) > 1
            ORDER BY count DESC
            LIMIT 20
        """)
        result = cursor.fetchall()
        if result:
            print(f"  Trovati {len(result)} gruppi di duplicati esatti:")
            for row in result:
                print(f"    Conto {row['conto_id']}, Data {row['data']}, Importo {row['importo']}")
                print(f"      Descrizione: {row['descrizione'][:60]}...")
                print(f"      {row['count']} movimenti (IDs: {row['ids']})")
        else:
            print("  ✅ Nessun duplicato trovato")
        print()
        
        # Lista movimenti attivi
        print("📋 PRIMI 20 MOVIMENTI ATTIVI")
        print("-" * 80)
        cursor.execute("""
            SELECT 
                id,
                fattura_amministrazione_id,
                conto_id,
                data,
                descrizione,
                importo,
                tipo_operazione
            FROM pn_movimenti
            WHERE deleted_at IS NULL
            ORDER BY id DESC
            LIMIT 20
        """)
        result = cursor.fetchall()
        for row in result:
            print(f"  ID {row['id']}: {row['descrizione'][:50]}...")
            print(f"    Fattura: {row['fattura_amministrazione_id']}, Conto: {row['conto_id']}, Data: {row['data']}, Importo: {row['importo']}")
        print()
        
    finally:
        conn.close()


def main():
    """Funzione principale"""
    db_path = get_local_db_path()
    analyze_local_db(db_path)


if __name__ == '__main__':
    main()

