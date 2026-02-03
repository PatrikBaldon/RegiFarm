#!/usr/bin/env python3
"""
Script per aggiornare le aziende esistenti con i conti Debiti verso fornitori e Crediti verso clienti.
Esegui questo script dopo aver aggiunto le colonne a pn_preferenze.
"""

import sys
import os

# Aggiungi il path del backend
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.amministrazione.pn import PNConto, PNPreferenze, PNContoTipo, PNGirocontoStrategia
from app.models.allevamento.azienda import Azienda
from decimal import Decimal

ZERO = Decimal("0")


def update_aziende_esistenti():
    """Aggiorna tutte le aziende esistenti con i nuovi conti."""
    db: Session = SessionLocal()
    
    try:
        # Ottieni tutte le aziende attive
        aziende = db.query(Azienda).filter(Azienda.deleted_at.is_(None)).all()
        
        print(f"Trovate {len(aziende)} aziende da aggiornare\n")
        
        for azienda in aziende:
            print(f"Elaborando azienda {azienda.id}: {azienda.nome}")
            
            # Crea o trova il conto "Debiti verso fornitori"
            conto_debiti = (
                db.query(PNConto)
                .filter(
                    PNConto.azienda_id == azienda.id,
                    db.func.lower(PNConto.nome) == 'debiti verso fornitori'
                )
                .first()
            )
            
            if not conto_debiti:
                conto_debiti = PNConto(
                    azienda_id=azienda.id,
                    nome='Debiti verso fornitori',
                    tipo=PNContoTipo.ALTRO.value,
                    saldo_iniziale=ZERO,
                    saldo_attuale=ZERO,
                    attivo=True,
                    giroconto_strategia=PNGirocontoStrategia.AUTOMATICO.value,
                )
                db.add(conto_debiti)
                db.flush()
                print(f"  ✓ Creato conto 'Debiti verso fornitori' (ID: {conto_debiti.id})")
            else:
                print(f"  → Conto 'Debiti verso fornitori' già esistente (ID: {conto_debiti.id})")
            
            # Crea o trova il conto "Crediti verso clienti"
            conto_crediti = (
                db.query(PNConto)
                .filter(
                    PNConto.azienda_id == azienda.id,
                    db.func.lower(PNConto.nome) == 'crediti verso clienti'
                )
                .first()
            )
            
            if not conto_crediti:
                conto_crediti = PNConto(
                    azienda_id=azienda.id,
                    nome='Crediti verso clienti',
                    tipo=PNContoTipo.ALTRO.value,
                    saldo_iniziale=ZERO,
                    saldo_attuale=ZERO,
                    attivo=True,
                    giroconto_strategia=PNGirocontoStrategia.AUTOMATICO.value,
                )
                db.add(conto_crediti)
                db.flush()
                print(f"  ✓ Creato conto 'Crediti verso clienti' (ID: {conto_crediti.id})")
            else:
                print(f"  → Conto 'Crediti verso clienti' già esistente (ID: {conto_crediti.id})")
            
            # Aggiorna o crea le preferenze
            preferenze = (
                db.query(PNPreferenze)
                .filter(PNPreferenze.azienda_id == azienda.id)
                .first()
            )
            
            if not preferenze:
                preferenze = PNPreferenze(
                    azienda_id=azienda.id,
                    conto_debiti_fornitori_id=conto_debiti.id,
                    conto_crediti_clienti_id=conto_crediti.id,
                )
                db.add(preferenze)
                print(f"  ✓ Create preferenze con conti collegati")
            else:
                if not preferenze.conto_debiti_fornitori_id:
                    preferenze.conto_debiti_fornitori_id = conto_debiti.id
                if not preferenze.conto_crediti_clienti_id:
                    preferenze.conto_crediti_clienti_id = conto_crediti.id
                print(f"  ✓ Aggiornate preferenze con conti collegati")
            
            db.flush()
            print()
        
        db.commit()
        print("✅ Aggiornamento completato con successo!")
        
        # Verifica finale
        print("\n=== VERIFICA FINALE ===")
        aziende_verifica = (
            db.query(Azienda)
            .filter(Azienda.deleted_at.is_(None))
            .all()
        )
        
        tutte_ok = True
        for azienda in aziende_verifica:
            preferenze = (
                db.query(PNPreferenze)
                .filter(PNPreferenze.azienda_id == azienda.id)
                .first()
            )
            
            if preferenze:
                conto_debiti = db.get(PNConto, preferenze.conto_debiti_fornitori_id) if preferenze.conto_debiti_fornitori_id else None
                conto_crediti = db.get(PNConto, preferenze.conto_crediti_clienti_id) if preferenze.conto_crediti_clienti_id else None
                
                status = "✅" if (conto_debiti and conto_crediti) else "❌"
                if not (conto_debiti and conto_crediti):
                    tutte_ok = False
                
                print(f"{status} Azienda {azienda.id} ({azienda.nome}):")
                print(f"   Debiti: {conto_debiti.nome if conto_debiti else 'MANCANTE'}")
                print(f"   Crediti: {conto_crediti.nome if conto_crediti else 'MANCANTE'}")
            else:
                print(f"❌ Azienda {azienda.id} ({azienda.nome}): Preferenze mancanti")
                tutte_ok = False
        
        if tutte_ok:
            print("\n✅ Tutte le aziende sono configurate correttamente!")
        else:
            print("\n⚠️  Alcune aziende non sono configurate correttamente")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ Errore durante l'aggiornamento: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 60)
    print("Aggiornamento Aziende: Debiti verso fornitori e Crediti verso clienti")
    print("=" * 60)
    print()
    update_aziende_esistenti()

