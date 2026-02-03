"""
Endpoint batch per inizializzazione dati Amministrazione
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.models.amministrazione import (
    FornitoreTipo,
    Attrezzatura,
    ContrattoSoccida,
)
from app.models.amministrazione import Fornitore
from app.models.terreni.terreno import Terreno

router = APIRouter()


@router.get("/init-data")
def get_amministrazione_init_data(
    azienda_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Endpoint batch per caricare tutti i dati iniziali del modulo Amministrazione
    in una singola chiamata. Riduce latenza e chiamate duplicate.
    """
    result = {}
    
    try:
        # Fornitori (tutti)
        fornitori = db.query(Fornitore).filter(Fornitore.deleted_at.is_(None)).all()
        result["fornitori"] = [
            {
                "id": f.id,
                "nome": f.nome,
                "partita_iva": f.partita_iva,
                "is_fornitore": f.is_fornitore,
                "is_cliente": f.is_cliente,
            }
            for f in fornitori
        ]
    except Exception as e:
        print(f"Errore caricamento fornitori: {e}")
        result["fornitori"] = []
    
    try:
        # Fornitori tipi (non hanno deleted_at, sono relazioni)
        fornitori_tipi = db.query(FornitoreTipo).all()
        result["fornitori_tipi"] = [
            {
                "id": ft.id,
                "fornitore_id": ft.fornitore_id,
                "categoria": ft.categoria,
                "macrocategoria": ft.macrocategoria,
                "note": ft.note,
            }
            for ft in fornitori_tipi
        ]
    except Exception as e:
        print(f"Errore caricamento fornitori tipi: {e}")
        result["fornitori_tipi"] = []
    
    try:
        # Attrezzature (per azienda se specificato)
        attr_query = db.query(Attrezzatura).filter(Attrezzatura.deleted_at.is_(None))
        if azienda_id:
            attr_query = attr_query.filter(Attrezzatura.azienda_id == azienda_id)
        attrezzature = attr_query.all()
        result["attrezzature"] = [
            {
                "id": a.id,
                "nome": a.nome,
                "tipo": str(a.tipo) if hasattr(a, 'tipo') else None,
                "marca": a.marca,
                "modello": a.modello,
            }
            for a in attrezzature
        ]
    except Exception as e:
        print(f"Errore caricamento attrezzature: {e}")
        result["attrezzature"] = []
    
    try:
        # Contratti soccida (per azienda se specificato)
        if azienda_id:
            from sqlalchemy.orm import joinedload
            contratti = db.query(ContrattoSoccida).options(
                joinedload(ContrattoSoccida.soccidante)
            ).filter(
                ContrattoSoccida.deleted_at.is_(None),
                ContrattoSoccida.azienda_id == azienda_id
            ).all()
            result["contratti_soccida"] = []
            for c in contratti:
                try:
                    soccidante_nome = None
                    if c.soccidante:
                        # Verifica che il soccidante non sia eliminato
                        if not (hasattr(c.soccidante, 'deleted_at') and c.soccidante.deleted_at):
                            soccidante_nome = c.soccidante.nome if hasattr(c.soccidante, 'nome') else None
                    
                    result["contratti_soccida"].append({
                        "id": c.id,
                        "numero_contratto": c.numero_contratto or None,
                        "soccidante_nome": soccidante_nome,
                        "attivo": getattr(c, 'attivo', True),
                    })
                except Exception as e:
                    print(f"Errore processando contratto {c.id}: {e}")
                    continue
        else:
            result["contratti_soccida"] = []
    except Exception as e:
        print(f"Errore caricamento contratti soccida: {e}")
        result["contratti_soccida"] = []
    
    try:
        # Terreni (per azienda se specificato)
        if azienda_id:
            terreni = db.query(Terreno).filter(
                Terreno.deleted_at.is_(None),
                Terreno.azienda_id == azienda_id
            ).all()
            result["terreni"] = [
                {
                    "id": t.id,
                    "denominazione": t.denominazione,
                    "superficie": float(t.superficie) if t.superficie else None,
                    "unita_misura": t.unita_misura,
                }
                for t in terreni
            ]
        else:
            result["terreni"] = []
    except Exception as e:
        print(f"Errore caricamento terreni: {e}")
        result["terreni"] = []
    
    # Conteggi rapidi
    result["counts"] = {
        "fornitori": len(result.get("fornitori", [])),
        "attrezzature": len(result.get("attrezzature", [])),
        "contratti_soccida": len(result.get("contratti_soccida", [])),
        "terreni": len(result.get("terreni", [])),
    }
    
    return result

