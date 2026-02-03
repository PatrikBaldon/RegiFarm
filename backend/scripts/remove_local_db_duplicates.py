"""
Script per rimuovere duplicati dal database locale SQLite.

Elimina i duplicati mantenendo sempre il record con più dati completi
(priorità: record con fattura collegata > record senza fattura).
"""

import sys
import os
import sqlite3
from pathlib import Path

def get_local_db_path():
    """Trova il percorso del database locale SQLite"""
    possible_paths = [
        os.path.expanduser("~/Library/Application Support/Electron/regifarm_local.db"),
        os.path.expanduser("~/Library/Application Support/regifarm-pro/regifarm_local.db"),
        os.path.expanduser("~/AppData/Roaming/Electron/regifarm_local.db"),
        os.path.expanduser("~/AppData/Roaming/regifarm-pro/regifarm_local.db"),
        os.path.expanduser("~/.config/Electron/regifarm_local.db"),
        os.path.expanduser("~/.config/regifarm-pro/regifarm_local.db"),
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            return path
    
    return None


def remove_duplicates(db_path, dry_run=True):
    """Rimuove duplicati dal database locale"""
    
    if not db_path or not os.path.exists(db_path):
        print("❌ Database locale non trovato!")
        return 0
    
    print(f"📂 Database locale: {db_path}")
    print()
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Verifica se la tabella esiste
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='pn_movimenti'")
        if not cursor.fetchone():
            print("❌ Tabella pn_movimenti non trovata")
            return 0
        
        # Trova duplicati per contenuto
        print("🔍 Cerca duplicati per contenuto (stessa descrizione + data + importo + azienda)...")
        cursor.execute("""
            SELECT 
                descrizione,
                data,
                importo,
                azienda_id,
                COUNT(*) as count,
                GROUP_CONCAT(id) as ids
            FROM pn_movimenti
            WHERE deleted_at IS NULL
            GROUP BY descrizione, data, importo, azienda_id
            HAVING COUNT(*) > 1
            ORDER BY count DESC
        """)
        duplicates = cursor.fetchall()
        count = len(duplicates)
        print(f"  Trovati {count} gruppi di duplicati")
        
        if count == 0:
            print("  ✅ Nessun duplicato trovato")
            return 0
        
        total_to_delete = 0
        details = []
        
        # Per ogni gruppo di duplicati, identifica quale mantenere
        for dup in duplicates:
            desc, data, importo, azienda_id, dup_count, ids_str = dup
            ids = [int(x) for x in ids_str.split(',')]
            
            # Ottieni dettagli di tutti i record duplicati
            placeholders = ','.join(['?'] * len(ids))
            cursor.execute(f"""
                SELECT id, fattura_amministrazione_id, contropartita_nome
                FROM pn_movimenti
                WHERE id IN ({placeholders})
                ORDER BY 
                    CASE WHEN fattura_amministrazione_id IS NOT NULL THEN 0 ELSE 1 END,
                    id DESC
            """, ids)
            records = cursor.fetchall()
            
            # Il primo record è quello da mantenere (ha fattura o ID più alto)
            keep_id = records[0][0]
            to_delete = [r[0] for r in records[1:]]
            
            total_to_delete += len(to_delete)
            details.append({
                'keep': keep_id,
                'delete': to_delete,
                'desc': desc[:50],
                'data': data,
                'importo': importo
            })
        
        if total_to_delete > 0:
            if not dry_run:
                # Elimina i duplicati (soft delete)
                for detail in details:
                    if detail['delete']:
                        placeholders = ','.join(['?'] * len(detail['delete']))
                        cursor.execute(f"""
                            UPDATE pn_movimenti
                            SET deleted_at = datetime('now'),
                                sync_status = 'pending'
                            WHERE id IN ({placeholders})
                        """, detail['delete'])
                
                conn.commit()
                print(f"  ✅ Eliminati {total_to_delete} duplicati")
            else:
                # Mostra dettagli in dry-run
                print(f"  Dettagli duplicati da eliminare:")
                for detail in details[:20]:  # Mostra max 20
                    print(f"    Mantieni ID {detail['keep']}: '{detail['desc']}...'")
                    print(f"      Elimina IDs: {', '.join(map(str, detail['delete']))}")
                if len(details) > 20:
                    print(f"    ... e altri {len(details) - 20} gruppi")
        
        return total_to_delete
        
    finally:
        conn.close()


def main():
    """Funzione principale"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Rimuove duplicati dal database locale SQLite')
    parser.add_argument('--dry-run', action='store_true', help='Mostra cosa verrebbe eliminato senza eliminare')
    parser.add_argument('--execute', action='store_true', help='Esegue effettivamente l\'eliminazione')
    args = parser.parse_args()
    
    if not args.dry_run and not args.execute:
        print("ERRORE: Devi specificare --dry-run o --execute")
        parser.print_help()
        return
    
    dry_run = args.dry_run
    
    db_path = get_local_db_path()
    if not db_path:
        print("❌ Database locale non trovato!")
        print("\nAssicurati che l'app Electron sia stata avviata almeno una volta.")
        return
    
    print("=" * 80)
    print("RIMOZIONE DUPLICATI DATABASE LOCALE")
    print("=" * 80)
    print()
    
    if dry_run:
        print("MODO: DRY RUN (nessuna modifica verrà applicata)")
    else:
        print("MODO: ESECUZIONE (i duplicati verranno eliminati)")
    print()
    
    total_deleted = remove_duplicates(db_path, dry_run=dry_run)
    
    print()
    print("=" * 80)
    if dry_run:
        print(f"RIEPILOGO (DRY RUN):")
        print(f"  Record che verrebbero eliminati: {total_deleted}")
        print()
        print("Per eseguire l'eliminazione, usa: python scripts/remove_local_db_duplicates.py --execute")
    else:
        print(f"RIEPILOGO:")
        print(f"  ✅ Record eliminati: {total_deleted}")
        print()
        print("💡 CONSIGLIO: Riavvia l'app Electron per forzare una sincronizzazione completa")


if __name__ == '__main__':
    main()
