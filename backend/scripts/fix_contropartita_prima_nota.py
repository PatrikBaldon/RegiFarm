"""
Script per popolare le contropartite mancanti nei movimenti Prima Nota.

Analizza i movimenti senza contropartita_nome e li popola basandosi su:
1. Fattura collegata (fornitore/cliente)
2. Descrizione del movimento
3. Altri campi disponibili
"""

import sys
import os
from pathlib import Path

# Aggiungi il path del backend
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from app.core.database import SessionLocal, engine
from sqlalchemy import text

def fix_contropartita_movimenti():
    """Popola le contropartite mancanti nei movimenti"""
    db = SessionLocal()
    
    try:
        # Trova movimenti senza contropartita con SQL diretto
        query = text("""
            SELECT 
                m.id,
                m.descrizione,
                m.tipo_operazione,
                m.fattura_amministrazione_id,
                m.conto_destinazione_id
            FROM pn_movimenti m
            WHERE m.deleted_at IS NULL
              AND (m.contropartita_nome IS NULL OR m.contropartita_nome = '')
            ORDER BY m.id
        """)
        
        movimenti = db.execute(query).fetchall()
        
        print(f"Trovati {len(movimenti)} movimenti senza contropartita")
        print("=" * 80)
        
        fixed_count = 0
        skipped_count = 0
        
        for movimento in movimenti:
            movimento_id = movimento.id
            descrizione = movimento.descrizione
            tipo_operazione = movimento.tipo_operazione
            fattura_id = movimento.fattura_amministrazione_id
            conto_dest_id = movimento.conto_destinazione_id
            
            contropartita = None
            
            # Strategia 1: Se ha fattura collegata, usa fornitore/cliente dalla fattura
            if fattura_id:
                fattura_query = text("""
                    SELECT 
                        f.tipo,
                        f.cliente_nome,
                        f.cliente_piva,
                        f.cliente_cf,
                        f.fornitore_id
                    FROM fatture_amministrazione f
                    WHERE f.id = :fattura_id
                """)
                fattura = db.execute(fattura_query, {"fattura_id": fattura_id}).fetchone()
                
                if fattura:
                    if fattura.tipo == 'entrata':
                        # Fattura emessa: contropartita è il cliente
                        contropartita = fattura.cliente_nome or fattura.cliente_piva or fattura.cliente_cf
                    elif fattura.tipo == 'uscita' and fattura.fornitore_id:
                        # Fattura ricevuta: contropartita è il fornitore
                        fornitore_query = text("""
                            SELECT nome
                            FROM fornitori
                            WHERE id = :fornitore_id
                        """)
                        fornitore = db.execute(fornitore_query, {"fornitore_id": fattura.fornitore_id}).fetchone()
                        if fornitore:
                            contropartita = fornitore.nome
            
            # Strategia 2: Se è un giroconto, la contropartita potrebbe essere il conto destinazione
            if not contropartita and tipo_operazione == 'giroconto' and conto_dest_id:
                conto_query = text("""
                    SELECT nome
                    FROM pn_conti
                    WHERE id = :conto_id
                """)
                conto = db.execute(conto_query, {"conto_id": conto_dest_id}).fetchone()
                if conto:
                    contropartita = conto.nome
            
            # Aggiorna se trovato
            if contropartita and contropartita.strip():
                update_query = text("""
                    UPDATE pn_movimenti
                    SET contropartita_nome = :contropartita
                    WHERE id = :id
                """)
                db.execute(update_query, {"contropartita": contropartita.strip(), "id": movimento_id})
                fixed_count += 1
                print(f"✅ ID {movimento_id}: '{descrizione[:50] if descrizione else 'N/A'}...' → Contropartita: {contropartita}")
            else:
                skipped_count += 1
                print(f"⚠️  ID {movimento_id}: '{descrizione[:50] if descrizione else 'N/A'}...' → Impossibile determinare contropartita")
        
        # Salva le modifiche
        if fixed_count > 0:
            db.commit()
            print("=" * 80)
            print(f"✅ Aggiornati {fixed_count} movimenti")
            print(f"⚠️  Saltati {skipped_count} movimenti (impossibile determinare contropartita)")
        else:
            print("=" * 80)
            print("ℹ️  Nessun movimento aggiornato")
        
        return fixed_count, skipped_count
        
    except Exception as e:
        db.rollback()
        print(f"❌ Errore: {e}")
        import traceback
        traceback.print_exc()
        return 0, 0
    finally:
        db.close()


def analyze_movimenti_senza_contropartita():
    """Analizza i movimenti senza contropartita"""
    db = SessionLocal()
    
    try:
        # Statistiche generali con SQL diretto
        total_query = text("SELECT COUNT(*) FROM pn_movimenti WHERE deleted_at IS NULL")
        total = db.execute(total_query).scalar()
        
        senza_query = text("""
            SELECT COUNT(*) 
            FROM pn_movimenti 
            WHERE deleted_at IS NULL
              AND (contropartita_nome IS NULL OR contropartita_nome = '')
        """)
        senza_contropartita = db.execute(senza_query).scalar()
        
        print("=" * 80)
        print("ANALISI MOVIMENTI PRIMA NOTA - CONTROPARTITE")
        print("=" * 80)
        print(f"Movimenti totali: {total}")
        print(f"Movimenti senza contropartita: {senza_contropartita}")
        print(f"Percentuale senza contropartita: {(senza_contropartita/total*100) if total > 0 else 0:.1f}%")
        print()
        
        # Analisi per tipo operazione
        tipo_query = text("""
            SELECT 
                tipo_operazione,
                COUNT(*) as count,
                COUNT(*) FILTER (WHERE fattura_amministrazione_id IS NOT NULL) as con_fattura,
                COUNT(*) FILTER (WHERE fattura_amministrazione_id IS NULL) as senza_fattura
            FROM pn_movimenti
            WHERE deleted_at IS NULL
              AND (contropartita_nome IS NULL OR contropartita_nome = '')
            GROUP BY tipo_operazione
            ORDER BY count DESC
        """)
        
        risultati = db.execute(tipo_query).fetchall()
        
        print("Distribuzione per tipo operazione:")
        total_con_fattura = 0
        total_senza_fattura = 0
        
        for row in risultati:
            tipo = row.tipo_operazione or 'sconosciuto'
            count = row.count
            con_fattura = row.con_fattura
            senza_fattura = row.senza_fattura
            total_con_fattura += con_fattura
            total_senza_fattura += senza_fattura
            print(f"  {tipo}: {count} (con fattura: {con_fattura}, senza: {senza_fattura})")
        
        print()
        print(f"Totale con fattura collegata: {total_con_fattura}")
        print(f"Totale senza fattura collegata: {total_senza_fattura}")
        print()
        
    finally:
        db.close()


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Popola contropartite mancanti nei movimenti Prima Nota')
    parser.add_argument('--analyze', action='store_true', help='Solo analisi, non modifica')
    parser.add_argument('--fix', action='store_true', help='Popola le contropartite mancanti')
    args = parser.parse_args()
    
    if args.analyze:
        analyze_movimenti_senza_contropartita()
    elif args.fix:
        analyze_movimenti_senza_contropartita()
        print()
        response = input("Vuoi procedere con la correzione? (s/n): ")
        if response.lower() == 's':
            fix_contropartita_movimenti()
        else:
            print("Operazione annullata")
    else:
        # Default: solo analisi
        analyze_movimenti_senza_contropartita()

