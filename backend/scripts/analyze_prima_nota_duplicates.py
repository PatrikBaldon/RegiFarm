"""
Script per analizzare i duplicati nella tabella pn_movimenti.

Mostra statistiche dettagliate e identifica i pattern di duplicati.
"""

import sys
import os
from sqlalchemy import text

# Aggiungi il path del backend al PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal


def analyze_movimenti(db):
    """Analizza i movimenti e identifica duplicati"""
    
    print("=" * 80)
    print("ANALISI MOVIMENTI PRIMA NOTA")
    print("=" * 80)
    print()
    
    # Statistiche generali
    print("📊 STATISTICHE GENERALI")
    print("-" * 80)
    
    query = text("""
        SELECT 
            COUNT(*) as totali,
            COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as attivi,
            COUNT(CASE WHEN fattura_amministrazione_id IS NOT NULL THEN 1 END) as con_fattura_collegata,
            COUNT(CASE WHEN fattura_amministrazione_id IS NULL AND deleted_at IS NULL THEN 1 END) as senza_fattura_collegata
        FROM pn_movimenti
    """)
    stats = db.execute(query).fetchone()
    print(f"  Totale movimenti: {stats[0]}")
    print(f"  Movimenti attivi (non eliminati): {stats[1]}")
    print(f"  Con fattura collegata: {stats[2]}")
    print(f"  Senza fattura collegata: {stats[3]}")
    print()
    
    # Duplicati per fattura_amministrazione_id + tipo_operazione
    print("🔍 DUPLICATI PER FATTURA_AMMINISTRAZIONE_ID + TIPO_OPERAZIONE")
    print("-" * 80)
    query = text("""
        WITH duplicates AS (
            SELECT 
                fattura_amministrazione_id,
                tipo_operazione,
                COUNT(*) as count,
                array_agg(id ORDER BY id) as ids
            FROM pn_movimenti
            WHERE fattura_amministrazione_id IS NOT NULL
              AND deleted_at IS NULL
            GROUP BY fattura_amministrazione_id, tipo_operazione
            HAVING COUNT(*) > 1
        )
        SELECT 
            d.fattura_amministrazione_id,
            f.numero as fattura_numero,
            f.fornitore_id,
            d.tipo_operazione,
            d.count,
            d.ids
        FROM duplicates d
        LEFT JOIN fatture_amministrazione f ON d.fattura_amministrazione_id = f.id
        ORDER BY d.count DESC
        LIMIT 20
    """)
    result = db.execute(query).fetchall()
    if result:
        print(f"  Trovati {len(result)} gruppi di duplicati:")
        for row in result:
            print(f"    Fattura {row[1]} (ID: {row[0]}), Fornitore {row[2]}, Tipo: {row[3]} -> {row[4]} movimenti (IDs: {row[5][:5]}{'...' if len(row[5]) > 5 else ''})")
    else:
        print("  ✅ Nessun duplicato trovato")
    print()
    
    # Duplicati per numero fattura + fornitore (senza fattura collegata)
    print("🔍 DUPLICATI PER NUMERO FATTURA + FORNITORE (SENZA FATTURA COLLEGATA)")
    print("-" * 80)
    query = text("""
        WITH movimenti_senza_fattura AS (
            SELECT DISTINCT
                m.id,
                f.numero as fattura_numero,
                f.fornitore_id,
                m.descrizione,
                m.importo,
                m.data
            FROM pn_movimenti m
            INNER JOIN fatture_amministrazione f ON (
                m.descrizione LIKE '%' || f.numero || '%'
                OR m.descrizione LIKE '%Fattura ' || f.numero || '%'
                OR m.descrizione LIKE '%Fatt. ' || f.numero || '%'
            )
            WHERE m.deleted_at IS NULL
              AND m.fattura_amministrazione_id IS NULL
        ),
        gruppi AS (
            SELECT 
                fattura_numero,
                fornitore_id,
                COUNT(*) as count,
                array_agg(id ORDER BY id) as ids,
                array_agg(descrizione ORDER BY id) as descrizioni
            FROM movimenti_senza_fattura
            GROUP BY fattura_numero, fornitore_id
            HAVING COUNT(*) > 1
        )
        SELECT * FROM gruppi
        ORDER BY count DESC
        LIMIT 20
    """)
    result = db.execute(query).fetchall()
    if result:
        print(f"  Trovati {len(result)} gruppi di duplicati:")
        for row in result:
            print(f"    Fattura {row[0]}, Fornitore {row[1]} -> {row[2]} movimenti (IDs: {row[3][:5]}{'...' if len(row[3]) > 5 else ''})")
            print(f"      Esempio descrizione: {row[4][0][:60]}...")
    else:
        print("  ✅ Nessun duplicato trovato")
    print()
    
    # Duplicati per conto + data + importo + descrizione + tipo_operazione (movimenti manuali)
    print("🔍 DUPLICATI PER CAMPI MANUALI (CONTO + DATA + IMPORTO + DESCRIZIONE + TIPO)")
    print("-" * 80)
    query = text("""
        WITH duplicates AS (
            SELECT 
                conto_id,
                data,
                importo,
                descrizione,
                tipo_operazione,
                COUNT(*) as count,
                array_agg(id ORDER BY id) as ids
            FROM pn_movimenti
            WHERE fattura_amministrazione_id IS NULL
              AND fattura_emessa_id IS NULL
              AND pagamento_id IS NULL
              AND deleted_at IS NULL
            GROUP BY conto_id, data, importo, descrizione, tipo_operazione
            HAVING COUNT(*) > 1
        )
        SELECT * FROM duplicates
        ORDER BY count DESC
        LIMIT 20
    """)
    result = db.execute(query).fetchall()
    if result:
        print(f"  Trovati {len(result)} gruppi di duplicati:")
        for row in result:
            print(f"    Conto {row[0]}, Data {row[1]}, Importo {row[2]}, Tipo {row[4]} -> {row[5]} movimenti")
            print(f"      Descrizione: {row[3][:60]}...")
            print(f"      IDs: {row[6][:5]}{'...' if len(row[6]) > 5 else ''}")
    else:
        print("  ✅ Nessun duplicato trovato")
    print()
    
    # Movimenti con stessa descrizione e importo (possibili duplicati esatti)
    print("🔍 DUPLICATI ESATTI (STESSA DESCRIZIONE + IMPORTO + DATA + CONTO)")
    print("-" * 80)
    query = text("""
        WITH duplicates AS (
            SELECT 
                conto_id,
                data,
                importo,
                descrizione,
                COUNT(*) as count,
                array_agg(id ORDER BY id) as ids,
                array_agg(fattura_amministrazione_id ORDER BY id) as fatture_ids
            FROM pn_movimenti
            WHERE deleted_at IS NULL
            GROUP BY conto_id, data, importo, descrizione
            HAVING COUNT(*) > 1
        )
        SELECT * FROM duplicates
        ORDER BY count DESC
        LIMIT 20
    """)
    result = db.execute(query).fetchall()
    if result:
        print(f"  Trovati {len(result)} gruppi di duplicati esatti:")
        total_duplicates = 0
        for row in result:
            print(f"    Conto {row[0]}, Data {row[1]}, Importo {row[2]} -> {row[4]} movimenti")
            print(f"      Descrizione: {row[3][:60]}...")
            print(f"      IDs: {row[5]}")
            print(f"      Fatture collegate: {[fid for fid in row[6] if fid is not None]}")
            total_duplicates += row[4] - 1  # -1 perché uno va mantenuto
        print(f"\n  Totale duplicati da eliminare: {total_duplicates}")
    else:
        print("  ✅ Nessun duplicato trovato")
    print()
    
    # Verifica se ci sono movimenti con stesso ID (impossibile ma verifichiamo)
    print("🔍 VERIFICA ID DUPLICATI")
    print("-" * 80)
    query = text("""
        SELECT id, COUNT(*) as count
        FROM pn_movimenti
        GROUP BY id
        HAVING COUNT(*) > 1
    """)
    result = db.execute(query).fetchall()
    if result:
        print(f"  ⚠️  Trovati {len(result)} ID duplicati (questo non dovrebbe essere possibile!)")
        for row in result:
            print(f"    ID {row[0]}: {row[1]} occorrenze")
    else:
        print("  ✅ Nessun ID duplicato")
    print()
    
    # Verifica movimenti con stessa fattura ma tipo_operazione diverso (potrebbero sembrare duplicati)
    print("🔍 MOVIMENTI CON STESSA FATTURA MA TIPO_OPERAZIONE DIVERSO")
    print("-" * 80)
    query = text("""
        SELECT 
            fattura_amministrazione_id,
            COUNT(DISTINCT tipo_operazione) as tipi_count,
            array_agg(DISTINCT tipo_operazione) as tipi,
            COUNT(*) as count
        FROM pn_movimenti
        WHERE fattura_amministrazione_id IS NOT NULL
          AND deleted_at IS NULL
        GROUP BY fattura_amministrazione_id
        HAVING COUNT(DISTINCT tipo_operazione) > 1
        ORDER BY count DESC
        LIMIT 10
    """)
    result = db.execute(query).fetchall()
    if result:
        print(f"  Trovati {len(result)} fatture con movimenti di tipo diverso:")
        for row in result:
            print(f"    Fattura ID {row[0]}: {row[3]} movimenti con tipi {row[2]}")
    else:
        print("  ✅ Nessun caso trovato")
    print()
    
    # Verifica movimenti con stessa fattura, stesso tipo, ma conto diverso
    print("🔍 MOVIMENTI CON STESSA FATTURA + TIPO MA CONTO DIVERSO")
    print("-" * 80)
    query = text("""
        SELECT 
            fattura_amministrazione_id,
            tipo_operazione,
            COUNT(DISTINCT conto_id) as conti_count,
            array_agg(DISTINCT conto_id) as conti,
            COUNT(*) as count
        FROM pn_movimenti
        WHERE fattura_amministrazione_id IS NOT NULL
          AND deleted_at IS NULL
        GROUP BY fattura_amministrazione_id, tipo_operazione
        HAVING COUNT(DISTINCT conto_id) > 1
        ORDER BY count DESC
        LIMIT 10
    """)
    result = db.execute(query).fetchall()
    if result:
        print(f"  Trovati {len(result)} gruppi con stesso fattura+tipo ma conto diverso:")
        for row in result:
            print(f"    Fattura ID {row[0]}, Tipo {row[1]}: {row[4]} movimenti su conti {row[3]}")
    else:
        print("  ✅ Nessun caso trovato")
    print()
    
    # Dettagli di alcuni movimenti per capire meglio
    print("📋 ESEMPI DI MOVIMENTI (primi 10)")
    print("-" * 80)
    query = text("""
        SELECT 
            m.id,
            m.fattura_amministrazione_id,
            m.conto_id,
            m.data,
            m.descrizione,
            m.importo,
            m.tipo_operazione,
            f.numero as fattura_numero,
            f.fornitore_id
        FROM pn_movimenti m
        LEFT JOIN fatture_amministrazione f ON m.fattura_amministrazione_id = f.id
        WHERE m.deleted_at IS NULL
        ORDER BY m.id DESC
        LIMIT 10
    """)
    result = db.execute(query).fetchall()
    for row in result:
        print(f"  ID {row[0]}: {row[4][:50]}...")
        print(f"    Data: {row[3]}, Importo: {row[5]}, Tipo: {row[6]}")
        print(f"    Fattura collegata: {row[1] if row[1] else 'NO'} ({row[7] if row[7] else 'N/A'})")
        print(f"    Conto: {row[2]}")
        print()
    
    # Verifica se ci sono movimenti eliminati che potrebbero essere ripristinati
    print("🗑️  MOVIMENTI ELIMINATI (deleted_at IS NOT NULL)")
    print("-" * 80)
    query = text("""
        SELECT COUNT(*) as count
        FROM pn_movimenti
        WHERE deleted_at IS NOT NULL
    """)
    result = db.execute(query).scalar()
    print(f"  Totale movimenti eliminati: {result}")
    if result > 0:
        query2 = text("""
            SELECT 
                COUNT(*) as count,
                DATE(deleted_at) as data_eliminazione
            FROM pn_movimenti
            WHERE deleted_at IS NOT NULL
            GROUP BY DATE(deleted_at)
            ORDER BY data_eliminazione DESC
            LIMIT 5
        """)
        result2 = db.execute(query2).fetchall()
        print("  Eliminati per data:")
        for row in result2:
            print(f"    {row[1]}: {row[0]} movimenti")
    print()
    
    # Verifica movimenti con stessa fattura su conti diversi (potrebbero sembrare duplicati)
    print("🔍 MOVIMENTI CON STESSA FATTURA SU CONTI DIVERSI")
    print("-" * 80)
    query = text("""
        SELECT 
            f.numero as fattura_numero,
            f.fornitore_id,
            COUNT(DISTINCT m.conto_id) as conti_count,
            array_agg(DISTINCT m.conto_id) as conti,
            COUNT(*) as count,
            array_agg(m.id ORDER BY m.id) as ids
        FROM pn_movimenti m
        INNER JOIN fatture_amministrazione f ON m.fattura_amministrazione_id = f.id
        WHERE m.deleted_at IS NULL
        GROUP BY f.numero, f.fornitore_id
        HAVING COUNT(DISTINCT m.conto_id) > 1
        ORDER BY count DESC
        LIMIT 20
    """)
    result = db.execute(query).fetchall()
    if result:
        print(f"  Trovati {len(result)} fatture con movimenti su conti diversi:")
        for row in result:
            print(f"    Fattura {row[0]}, Fornitore {row[1]}: {row[4]} movimenti su conti {row[3]} (IDs: {row[5][:5]}{'...' if len(row[5]) > 5 else ''})")
    else:
        print("  ✅ Nessun caso trovato")
    print()
    
    # Verifica movimenti con descrizioni molto simili (potrebbero essere duplicati)
    print("🔍 MOVIMENTI CON DESCRIZIONI SIMILI (possibili duplicati)")
    print("-" * 80)
    query = text("""
        WITH movimenti_desc AS (
            SELECT 
                id,
                descrizione,
                importo,
                data,
                conto_id,
                tipo_operazione,
                fattura_amministrazione_id,
                -- Normalizza descrizione (rimuovi spazi extra, lowercase)
                LOWER(TRIM(REGEXP_REPLACE(descrizione, '\\s+', ' ', 'g'))) as desc_norm
            FROM pn_movimenti
            WHERE deleted_at IS NULL
        ),
        gruppi_simili AS (
            SELECT 
                desc_norm,
                COUNT(*) as count,
                array_agg(id ORDER BY id) as ids,
                array_agg(importo ORDER BY id) as importi,
                array_agg(data ORDER BY id) as date
            FROM movimenti_desc
            GROUP BY desc_norm
            HAVING COUNT(*) > 1
        )
        SELECT * FROM gruppi_simili
        ORDER BY count DESC
        LIMIT 20
    """)
    result = db.execute(query).fetchall()
    if result:
        print(f"  Trovati {len(result)} gruppi con descrizioni identiche (normalizzate):")
        for row in result:
            print(f"    Descrizione: \"{row[0][:60]}...\"")
            print(f"      {row[1]} movimenti (IDs: {row[2]}, Importi: {row[3]}, Date: {row[4]})")
    else:
        print("  ✅ Nessun caso trovato")
    print()
    
    # Lista completa di tutti i movimenti attivi per verifica manuale
    print("📋 LISTA COMPLETA MOVIMENTI ATTIVI (per verifica)")
    print("-" * 80)
    query = text("""
        SELECT 
            m.id,
            m.fattura_amministrazione_id,
            f.numero as fattura_numero,
            f.fornitore_id,
            m.conto_id,
            m.data,
            m.descrizione,
            m.importo,
            m.tipo_operazione
        FROM pn_movimenti m
        LEFT JOIN fatture_amministrazione f ON m.fattura_amministrazione_id = f.id
        WHERE m.deleted_at IS NULL
        ORDER BY m.fattura_amministrazione_id NULLS LAST, m.data DESC, m.id DESC
        LIMIT 50
    """)
    result = db.execute(query).fetchall()
    print(f"  Primi 50 movimenti attivi:")
    print(f"  {'ID':<6} {'Fattura ID':<12} {'Numero':<15} {'Fornitore':<10} {'Conto':<6} {'Data':<12} {'Importo':<12} {'Tipo':<10} {'Descrizione':<40}")
    print("  " + "-" * 120)
    for row in result:
        print(f"  {row[0]:<6} {str(row[1] if row[1] else 'NULL'):<12} {str(row[2] if row[2] else 'N/A'):<15} {str(row[3] if row[3] else 'N/A'):<10} {str(row[4] if row[4] else 'NULL'):<6} {str(row[5]):<12} {str(row[7]):<12} {str(row[8]):<10} {row[6][:40]}")
    print()


def main():
    """Funzione principale"""
    db = SessionLocal()
    try:
        analyze_movimenti(db)
    except Exception as e:
        print(f"ERRORE: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == '__main__':
    main()

