"""
Script per rimuovere record duplicati dalla tabella pn_movimenti.

I duplicati vengono identificati basandosi su:
- fattura_amministrazione_id + tipo_operazione (per movimenti automatici da fatture)
- pagamento_id (per movimenti da pagamenti)
- fattura_emessa_id + tipo_operazione (per movimenti da fatture emesse)
- conto_id + data + importo + descrizione + tipo_operazione (per movimenti manuali simili)

Mantiene sempre il record più vecchio (ID minore) e fa soft delete degli altri.
"""

import sys
import os
from datetime import datetime
from sqlalchemy import text

# Aggiungi il path del backend al PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal


def find_and_delete_duplicates_by_fattura_fornitore(db, dry_run=True):
    """Trova e elimina duplicati basati su numero fattura + fornitore"""
    
    print("Cerca duplicati per numero fattura + fornitore...")
    
    # Strategia: 
    # 1. Se c'è un movimento CON fattura_amministrazione_id collegato, elimina tutti quelli SENZA
    # 2. Se non c'è movimento con fattura collegata, mantieni quello con più campi compilati
    
    query = text("""
        WITH fatture_con_movimento_collegato AS (
            -- Fatture che hanno almeno un movimento con fattura_amministrazione_id collegato
            SELECT DISTINCT
                f.numero as fattura_numero,
                f.fornitore_id
            FROM pn_movimenti m
            INNER JOIN fatture_amministrazione f ON m.fattura_amministrazione_id = f.id
            WHERE m.deleted_at IS NULL
        ),
        movimenti_da_eliminare AS (
            -- Movimenti senza fattura collegata che corrispondono a fatture che hanno già un movimento collegato
            SELECT DISTINCT m.id
            FROM pn_movimenti m
            INNER JOIN fatture_amministrazione f ON (
                -- Match numero fattura nella descrizione (vari pattern comuni)
                m.descrizione LIKE '%' || f.numero || '%'
                OR m.descrizione LIKE '%Fattura ' || f.numero || '%'
                OR m.descrizione LIKE '%Fatt. ' || f.numero || '%'
                OR m.descrizione LIKE '%Fattura n. ' || f.numero || '%'
                OR m.descrizione LIKE '%Fattura n° ' || f.numero || '%'
            )
            INNER JOIN fatture_con_movimento_collegato fc ON (
                f.numero = fc.fattura_numero
                AND f.fornitore_id = fc.fornitore_id
            )
            WHERE m.deleted_at IS NULL
              AND m.fattura_amministrazione_id IS NULL
        )
        SELECT id FROM movimenti_da_eliminare
    """)
    
    result = db.execute(query)
    ids_to_delete = [row[0] for row in result]
    count = len(ids_to_delete)
    print(f"  Trovati {count} duplicati")
    
    if count > 0:
        if not dry_run:
            delete_query = text("""
                UPDATE pn_movimenti
                SET deleted_at = NOW()
                WHERE id = ANY(:ids)
            """)
            db.execute(delete_query, {"ids": ids_to_delete})
            db.commit()
            print(f"  ✅ Eliminati {count} duplicati")
        else:
            # Mostra dettagli in dry-run
            detail_query = text("""
                SELECT 
                    m.id,
                    f.numero as fattura_numero,
                    f.fornitore_id,
                    m.fattura_amministrazione_id,
                    m.descrizione
                FROM pn_movimenti m
                LEFT JOIN fatture_amministrazione f ON m.fattura_amministrazione_id = f.id
                WHERE m.id = ANY(:ids)
                ORDER BY f.numero, f.fornitore_id, m.id
            """)
            details = db.execute(detail_query, {"ids": ids_to_delete}).fetchall()
            print(f"  Dettagli duplicati da eliminare:")
            for row in details[:10]:  # Mostra max 10
                print(f"    - ID {row[0]}: Fattura {row[1]}, Fornitore {row[2]}, Fattura collegata: {row[3] is not None}, Desc: {row[4][:50]}")
            if len(details) > 10:
                print(f"    ... e altri {len(details) - 10} record")
    
    return count


def find_and_delete_duplicates(db, dry_run=True):
    """Trova e elimina duplicati usando SQL raw"""
    
    total_deleted = 0
    
    # 0. Duplicati per numero fattura + fornitore (NUOVO - priorità)
    deleted = find_and_delete_duplicates_by_fattura_fornitore(db, dry_run=dry_run)
    total_deleted += deleted
    
    # 1. Duplicati per fattura_amministrazione_id + tipo_operazione
    print("Cerca duplicati per fattura_amministrazione_id + tipo_operazione...")
    query = text("""
        WITH duplicates AS (
            SELECT 
                fattura_amministrazione_id,
                tipo_operazione,
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY fattura_amministrazione_id, tipo_operazione 
                    ORDER BY id ASC
                ) as rn
            FROM pn_movimenti
            WHERE fattura_amministrazione_id IS NOT NULL
              AND deleted_at IS NULL
        )
        SELECT id
        FROM duplicates
        WHERE rn > 1
    """)
    
    result = db.execute(query)
    ids_to_delete = [row[0] for row in result]
    count = len(ids_to_delete)
    print(f"  Trovati {count} duplicati")
    
    if count > 0:
        if not dry_run:
            delete_query = text("""
                UPDATE pn_movimenti
                SET deleted_at = NOW()
                WHERE id = ANY(:ids)
            """)
            db.execute(delete_query, {"ids": ids_to_delete})
            db.commit()
            print(f"  ✅ Eliminati {count} duplicati")
        total_deleted += count
    
    # 2. Duplicati per pagamento_id
    print("Cerca duplicati per pagamento_id...")
    query = text("""
        WITH duplicates AS (
            SELECT 
                pagamento_id,
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY pagamento_id 
                    ORDER BY id ASC
                ) as rn
            FROM pn_movimenti
            WHERE pagamento_id IS NOT NULL
              AND deleted_at IS NULL
        )
        SELECT id
        FROM duplicates
        WHERE rn > 1
    """)
    
    result = db.execute(query)
    ids_to_delete = [row[0] for row in result]
    count = len(ids_to_delete)
    print(f"  Trovati {count} duplicati")
    
    if count > 0:
        if not dry_run:
            delete_query = text("""
                UPDATE pn_movimenti
                SET deleted_at = NOW()
                WHERE id = ANY(:ids)
            """)
            db.execute(delete_query, {"ids": ids_to_delete})
            db.commit()
            print(f"  ✅ Eliminati {count} duplicati")
        total_deleted += count
    
    # 3. Duplicati per fattura_emessa_id + tipo_operazione
    print("Cerca duplicati per fattura_emessa_id + tipo_operazione...")
    query = text("""
        WITH duplicates AS (
            SELECT 
                fattura_emessa_id,
                tipo_operazione,
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY fattura_emessa_id, tipo_operazione 
                    ORDER BY id ASC
                ) as rn
            FROM pn_movimenti
            WHERE fattura_emessa_id IS NOT NULL
              AND deleted_at IS NULL
        )
        SELECT id
        FROM duplicates
        WHERE rn > 1
    """)
    
    result = db.execute(query)
    ids_to_delete = [row[0] for row in result]
    count = len(ids_to_delete)
    print(f"  Trovati {count} duplicati")
    
    if count > 0:
        if not dry_run:
            delete_query = text("""
                UPDATE pn_movimenti
                SET deleted_at = NOW()
                WHERE id = ANY(:ids)
            """)
            db.execute(delete_query, {"ids": ids_to_delete})
            db.commit()
            print(f"  ✅ Eliminati {count} duplicati")
        total_deleted += count
    
    # 4. Duplicati per campi manuali (conto + data + importo + descrizione + tipo_operazione)
    print("Cerca duplicati per campi manuali (conto + data + importo + descrizione + tipo_operazione)...")
    query = text("""
        WITH duplicates AS (
            SELECT 
                conto_id,
                data,
                importo,
                descrizione,
                tipo_operazione,
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY conto_id, data, importo, descrizione, tipo_operazione 
                    ORDER BY id ASC
                ) as rn
            FROM pn_movimenti
            WHERE fattura_amministrazione_id IS NULL
              AND fattura_emessa_id IS NULL
              AND pagamento_id IS NULL
              AND deleted_at IS NULL
        )
        SELECT id
        FROM duplicates
        WHERE rn > 1
    """)
    
    result = db.execute(query)
    ids_to_delete = [row[0] for row in result]
    count = len(ids_to_delete)
    print(f"  Trovati {count} duplicati")
    
    if count > 0:
        if not dry_run:
            delete_query = text("""
                UPDATE pn_movimenti
                SET deleted_at = NOW()
                WHERE id = ANY(:ids)
            """)
            db.execute(delete_query, {"ids": ids_to_delete})
            db.commit()
            print(f"  ✅ Eliminati {count} duplicati")
        total_deleted += count
    
    return total_deleted


def main():
    """Funzione principale"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Rimuove record duplicati da pn_movimenti')
    parser.add_argument('--dry-run', action='store_true', help='Mostra cosa verrebbe eliminato senza eliminare')
    parser.add_argument('--execute', action='store_true', help='Esegue effettivamente l\'eliminazione')
    args = parser.parse_args()
    
    if not args.dry_run and not args.execute:
        print("ERRORE: Devi specificare --dry-run o --execute")
        parser.print_help()
        return
    
    dry_run = args.dry_run
    
    db = SessionLocal()
    try:
        print("=" * 80)
        print("RIMOZIONE DUPLICATI PRIMA NOTA")
        print("=" * 80)
        print()
        
        if dry_run:
            print("MODO: DRY RUN (nessuna modifica verrà applicata)")
        else:
            print("MODO: ESECUZIONE (i duplicati verranno eliminati)")
        print()
        
        total_deleted = find_and_delete_duplicates(db, dry_run=dry_run)
        
        print()
        print("=" * 80)
        if dry_run:
            print(f"RIEPILOGO (DRY RUN):")
            print(f"  Record che verrebbero eliminati: {total_deleted}")
            print()
            print("Per eseguire l'eliminazione, usa: python scripts/remove_duplicate_prima_nota.py --execute")
        else:
            print(f"RIEPILOGO:")
            print(f"  ✅ Record eliminati: {total_deleted}")
        
    except Exception as e:
        print(f"ERRORE: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == '__main__':
    main()
