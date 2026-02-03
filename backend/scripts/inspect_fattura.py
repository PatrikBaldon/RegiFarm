#!/usr/bin/env python3
"""
Script per ispezionare i dati di una fattura dal database
Mostra la struttura completa della fattura e delle sue righe
"""
import sys
import os
import json
from pathlib import Path

# Aggiungi il path del backend al PYTHONPATH
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from sqlalchemy.orm import Session, selectinload
from app.core.database import SessionLocal

# Importa tutti i modelli necessari per evitare errori di relazione
from app.models.amministrazione.fattura_amministrazione import FatturaAmministrazione
from app.models.amministrazione.fattura_amministrazione_linea import FatturaAmministrazioneLinea
from app.models.amministrazione.fattura_emessa import FatturaEmessa  # Per risolvere le relazioni
from app.models.amministrazione.partita_animale import PartitaAnimale  # Per risolvere le relazioni

def inspect_fattura(fattura_id: int):
    """Ispeziona una fattura e mostra tutti i suoi dati"""
    db: Session = SessionLocal()
    
    try:
        # Carica la fattura con tutte le relazioni
        fattura = (
            db.query(FatturaAmministrazione)
            .options(
                selectinload(FatturaAmministrazione.linee),
                selectinload(FatturaAmministrazione.fornitore),
            )
            .filter(FatturaAmministrazione.id == fattura_id)
            .first()
        )
        
        if not fattura:
            print(f"❌ Fattura {fattura_id} non trovata")
            return
        
        print("=" * 80)
        print(f"📄 FATTURA ID: {fattura.id}")
        print("=" * 80)
        print(f"Numero: {fattura.numero}")
        print(f"Fornitore: {fattura.fornitore.nome if fattura.fornitore else 'N/A'}")
        print(f"Data fattura: {fattura.data_fattura}")
        print(f"Importo totale: {fattura.importo_totale}")
        print(f"Importo netto: {fattura.importo_netto}")
        print(f"Tipo: {fattura.tipo}")
        print(f"Categoria: {fattura.categoria}")
        print(f"Macrocategoria: {fattura.macrocategoria}")
        print()
        
        # Mostra righe JSON se presente
        if fattura.righe:
            print("=" * 80)
            print("📋 RIGHE JSON (campo 'righe'):")
            print("=" * 80)
            if isinstance(fattura.righe, str):
                righe_json = json.loads(fattura.righe)
            else:
                righe_json = fattura.righe
            
            if isinstance(righe_json, list) and len(righe_json) > 0:
                for i, riga in enumerate(righe_json, 1):
                    print(f"\n--- Riga JSON {i} ---")
                    print(json.dumps(riga, indent=2, default=str))
            else:
                print("Nessuna riga JSON presente")
            print()
        
        # Mostra dati_xml se presente
        if fattura.dati_xml:
            print("=" * 80)
            print("📋 DATI XML (campo 'dati_xml'):")
            print("=" * 80)
            dati_xml = fattura.dati_xml
            if isinstance(dati_xml, dict):
                if 'linee' in dati_xml:
                    print("\n--- Linee da dati_xml.linee ---")
                    for i, linea in enumerate(dati_xml['linee'], 1):
                        print(f"\nLinea {i}:")
                        print(json.dumps(linea, indent=2, default=str))
                elif 'dettaglio_linee' in dati_xml:
                    print("\n--- Linee da dati_xml.dettaglio_linee ---")
                    for i, linea in enumerate(dati_xml['dettaglio_linee'], 1):
                        print(f"\nLinea {i}:")
                        print(json.dumps(linea, indent=2, default=str))
            print()
        
        # Mostra righe dalla relazione linee
        print("=" * 80)
        print(f"📋 RIGHE RELAZIONE (tabella 'fatture_amministrazione_linee'): {len(fattura.linee)} righe")
        print("=" * 80)
        if fattura.linee:
            for i, linea in enumerate(fattura.linee, 1):
                print(f"\n--- Riga Relazione {i} (ID: {linea.id}) ---")
                print(f"  numero_linea: {linea.numero_linea}")
                print(f"  descrizione: {linea.descrizione}")
                print(f"  quantita: {linea.quantita}")
                print(f"  unita_misura: {linea.unita_misura}")
                print(f"  prezzo_unitario: {linea.prezzo_unitario}")
                print(f"  prezzo_totale: {linea.prezzo_totale}")
                print(f"  aliquota_iva: {linea.aliquota_iva}")
                print(f"  natura: {linea.natura}")
        else:
            print("Nessuna riga nella relazione linee")
        print()
        
        # Riepilogo
        print("=" * 80)
        print("📊 RIEPILOGO:")
        print("=" * 80)
        print(f"Righe JSON: {len(fattura.righe) if fattura.righe else 0}")
        print(f"Righe relazione: {len(fattura.linee)}")
        if fattura.dati_xml:
            linee_xml = 0
            if isinstance(fattura.dati_xml, dict):
                if 'linee' in fattura.dati_xml:
                    linee_xml = len(fattura.dati_xml['linee'])
                elif 'dettaglio_linee' in fattura.dati_xml:
                    linee_xml = len(fattura.dati_xml['dettaglio_linee'])
            print(f"Righe dati_xml: {linee_xml}")
        
    except Exception as e:
        print(f"❌ Errore: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

def search_fatture_by_fornitore(fornitore_nome: str):
    """Cerca fatture per nome fornitore"""
    db: Session = SessionLocal()
    
    try:
        from app.models.amministrazione.fornitore import Fornitore
        
        # Cerca il fornitore
        fornitore = db.query(Fornitore).filter(
            Fornitore.nome.ilike(f"%{fornitore_nome}%")
        ).first()
        
        if not fornitore:
            print(f"❌ Fornitore '{fornitore_nome}' non trovato")
            return
        
        print(f"✅ Fornitore trovato: {fornitore.nome} (ID: {fornitore.id})")
        print()
        
        # Cerca le fatture
        fatture = (
            db.query(FatturaAmministrazione)
            .filter(FatturaAmministrazione.fornitore_id == fornitore.id)
            .order_by(FatturaAmministrazione.id.desc())
            .limit(10)
            .all()
        )
        
        if not fatture:
            print(f"❌ Nessuna fattura trovata per il fornitore '{fornitore_nome}'")
            return
        
        print(f"📋 Trovate {len(fatture)} fatture:")
        for f in fatture:
            print(f"  - ID: {f.id}, Numero: {f.numero}, Data: {f.data_fattura}, Totale: {f.importo_totale}")
        print()
        
        # Ispeziona la prima fattura (o quella con ID 25 se presente)
        fattura_25 = next((f for f in fatture if f.id == 25), None)
        if fattura_25:
            print("🔍 Ispezionando fattura ID 25:")
            print()
            inspect_fattura(25)
        elif fatture:
            print(f"🔍 Ispezionando la prima fattura (ID: {fatture[0].id}):")
            print()
            inspect_fattura(fatture[0].id)
            
    except Exception as e:
        print(f"❌ Errore: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python inspect_fattura.py <fattura_id>")
        print("   or: python inspect_fattura.py --fornitore <nome_fornitore>")
        print("Example: python inspect_fattura.py 25")
        print("Example: python inspect_fattura.py --fornitore 'Finesso Antonio'")
        sys.exit(1)
    
    if sys.argv[1] == "--fornitore":
        if len(sys.argv) < 3:
            print("❌ Specifica il nome del fornitore")
            sys.exit(1)
        search_fatture_by_fornitore(sys.argv[2])
    else:
        fattura_id = int(sys.argv[1])
        inspect_fattura(fattura_id)
