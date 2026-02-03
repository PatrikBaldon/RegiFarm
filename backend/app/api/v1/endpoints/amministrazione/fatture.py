"""
Fatture Amministrazione endpoints (ricevute ed emesse)
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import or_
from typing import List, Optional
from datetime import datetime, date
from pydantic import BaseModel

from app.core.database import get_db
from app.models.amministrazione import (
    FatturaAmministrazione,
    FatturaAmministrazionePagamento,
    FornitoreTipo,
)
from app.models.allevamento.azienda import Azienda
from app.schemas.amministrazione import (
    FatturaAmministrazioneCreate,
    FatturaAmministrazioneResponse,
    FatturaAmministrazioneUpdate,
)
from app.services.amministrazione.prima_nota_automation import (
    ensure_prima_nota_for_fattura_amministrazione,
    sync_categoria_fattura_to_movimento,
)
from app.services.amministrazione.classificatore_fatture import ClassificatoreFatture
# ML RIMOSSO: sklearn/numpy/pandas causavano OOM su Fly.io con memoria limitata
from .common import build_pagamento_from_payload

router = APIRouter()


class PredizioneCategoriaRequest(BaseModel):
    fornitore_id: Optional[int] = None
    cliente_id: Optional[int] = None
    importo_totale: Optional[float] = None
    numero_fattura: Optional[str] = None
    tipo: str = 'uscita'
    descrizione_linee: Optional[List[str]] = None
    attrezzatura_id: Optional[int] = None
    terreno_id: Optional[int] = None


# ============ FATTURE RICEVUTE (USCITA) ============
@router.get("/fatture", response_model=List[FatturaAmministrazioneResponse])
async def get_fatture_amministrazione(
    tipo: Optional[str] = None,
    categoria: Optional[str] = None,
    stato_pagamento: Optional[str] = None,
    attrezzatura_id: Optional[int] = None,
    data_da: Optional[date] = None,
    data_a: Optional[date] = None,
    azienda_id: Optional[int] = None,
    include_relations: bool = False,
    skip: int = 0,
    limit: int = 1000,  # Aumentato da 100 a 1000 per matchare il frontend
    db: Session = Depends(get_db)
):
    """Get all fatture amministrazione with filters
    
    Ottimizzazioni:
    - Usa joinedload per relazioni base (fornitore, azienda) per evitare N+1 queries
    - Aumentato limite default a 1000 per matchare frontend
    - Query ottimizzata per usare indici compositi
    """
    from sqlalchemy.orm import joinedload
    
    # Query base con filtri ottimizzati - applica filtri più selettivi per primi
    query = db.query(FatturaAmministrazione).filter(
        FatturaAmministrazione.deleted_at.is_(None)
    )
    
    # Filtra per azienda_id per primo (se presente) per sfruttare indici compositi
    if azienda_id:
        query = query.filter(FatturaAmministrazione.azienda_id == azienda_id)
    
    # Carica sempre le relazioni base per evitare N+1 queries (sono dati leggeri)
    query = query.options(
        joinedload(FatturaAmministrazione.fornitore),
        joinedload(FatturaAmministrazione.azienda),
    )
    
    # Carica relazioni pesanti solo se richiesto
    if include_relations:
        query = query.options(
            selectinload(FatturaAmministrazione.linee),
            selectinload(FatturaAmministrazione.riepiloghi),
            selectinload(FatturaAmministrazione.pagamenti_programmati),
            selectinload(FatturaAmministrazione.ricezioni),
            selectinload(FatturaAmministrazione.attrezzatura),
        )
    
    # Applica altri filtri (in ordine di selettività)
    if tipo:
        query = query.filter(FatturaAmministrazione.tipo == tipo)
    if categoria:
        query = query.filter(FatturaAmministrazione.categoria == categoria)
    if stato_pagamento:
        query = query.filter(FatturaAmministrazione.stato_pagamento == stato_pagamento)
    if attrezzatura_id:
        query = query.filter(FatturaAmministrazione.attrezzatura_id == attrezzatura_id)
    if data_da:
        query = query.filter(FatturaAmministrazione.data_fattura >= data_da)
    if data_a:
        query = query.filter(FatturaAmministrazione.data_fattura <= data_a)
    
    # Limita il risultato per sicurezza
    if limit > 5000:
        limit = 5000
    
    return query.order_by(FatturaAmministrazione.data_fattura.desc()).offset(skip).limit(limit).all()


@router.get("/fatture/{fattura_id}", response_model=FatturaAmministrazioneResponse)
async def get_fattura_amministrazione(fattura_id: int, db: Session = Depends(get_db)):
    """Get a specific fattura amministrazione"""
    fattura = (
        db.query(FatturaAmministrazione)
        .options(
            selectinload(FatturaAmministrazione.linee),
            selectinload(FatturaAmministrazione.riepiloghi),
            selectinload(FatturaAmministrazione.pagamenti_programmati),
            selectinload(FatturaAmministrazione.ricezioni),
            selectinload(FatturaAmministrazione.attrezzatura),
        )
        .filter(FatturaAmministrazione.id == fattura_id)
        .first()
    )
    if not fattura:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    return fattura


@router.post("/fatture", response_model=FatturaAmministrazioneResponse, status_code=status.HTTP_201_CREATED)
async def create_fattura_amministrazione(fattura: FatturaAmministrazioneCreate, db: Session = Depends(get_db)):
    """Create a new fattura amministrazione"""
    azienda_id = fattura.azienda_id
    if not azienda_id:
        default_azienda = db.query(Azienda).first()
        if default_azienda:
            azienda_id = default_azienda.id
            fattura.azienda_id = azienda_id
    
    if not fattura.importo_netto:
        fattura.importo_netto = fattura.importo_totale - fattura.importo_iva
    
    if fattura.importo_pagato == 0:
        fattura.stato_pagamento = "da_pagare"
    elif fattura.importo_pagato >= fattura.importo_netto:
        fattura.stato_pagamento = "pagata"
        if not fattura.data_pagamento:
            fattura.data_pagamento = date.today()
    else:
        fattura.stato_pagamento = "parziale"

    if not fattura.categoria and fattura.fornitore_id:
        tipo_default = (
            db.query(FornitoreTipo)
            .filter(FornitoreTipo.fornitore_id == fattura.fornitore_id)
            .order_by(FornitoreTipo.updated_at.desc().nullslast(), FornitoreTipo.created_at.desc())
            .first()
        )
        if tipo_default:
            fattura.categoria = tipo_default.categoria
            if tipo_default.macrocategoria and not fattura.macrocategoria:
                fattura.macrocategoria = tipo_default.macrocategoria
    
    pagamenti_input = fattura.pagamenti_programmati or []
    fattura_data = fattura.dict(exclude={"pagamenti_programmati"})
    db_fattura = FatturaAmministrazione(**fattura_data)
    db.add(db_fattura)
    db.flush()
    for pagamento_input in pagamenti_input:
        pagamento_entity = build_pagamento_from_payload(pagamento_input)
        if pagamento_entity:
            db_fattura.pagamenti_programmati.append(pagamento_entity)
    ensure_prima_nota_for_fattura_amministrazione(db, db_fattura, azienda_id)
    db.commit()
    db.refresh(db_fattura)
    return db_fattura


@router.put("/fatture/{fattura_id}", response_model=FatturaAmministrazioneResponse)
async def update_fattura_amministrazione(
    fattura_id: int,
    update: FatturaAmministrazioneUpdate,
    db: Session = Depends(get_db)
):
    """Update a fattura amministrazione"""
    db_fattura = (
        db.query(FatturaAmministrazione)
        .options(
            selectinload(FatturaAmministrazione.linee),
            selectinload(FatturaAmministrazione.riepiloghi),
            selectinload(FatturaAmministrazione.pagamenti_programmati),
            selectinload(FatturaAmministrazione.ricezioni),
        )
        .filter(FatturaAmministrazione.id == fattura_id)
        .first()
    )
    if not db_fattura:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    
    update_dict = update.dict(exclude_unset=True)
    pagamenti_payload = update_dict.pop('pagamenti_programmati', None)
    
    if 'importo_totale' in update_dict or 'importo_iva' in update_dict:
        importo_totale = update_dict.get('importo_totale', db_fattura.importo_totale)
        importo_iva = update_dict.get('importo_iva', db_fattura.importo_iva)
        update_dict['importo_netto'] = importo_totale - importo_iva
    
    if 'importo_pagato' in update_dict:
        importo_netto = update_dict.get('importo_netto', db_fattura.importo_netto)
        importo_pagato = update_dict['importo_pagato']
        
        if importo_pagato == 0:
            update_dict['stato_pagamento'] = "da_pagare"
        elif importo_pagato >= importo_netto:
            update_dict['stato_pagamento'] = "pagata"
            if not update_dict.get('data_pagamento'):
                update_dict['data_pagamento'] = date.today()
        else:
            update_dict['stato_pagamento'] = "parziale"
    
    # Salva se la categoria è stata modificata per sincronizzazione
    categoria_changed = 'categoria' in update_dict or 'categoria_id' in update_dict
    categoria_before = db_fattura.categoria
    categoria_id_before = getattr(db_fattura, 'categoria_id', None)
    
    for field, value in update_dict.items():
        setattr(db_fattura, field, value)
    
    if pagamenti_payload is not None:
        db_fattura.pagamenti_programmati.clear()
        db.flush()
        for pagamento_input in pagamenti_payload:
            pagamento_entity = build_pagamento_from_payload(pagamento_input)
            if pagamento_entity:
                db_fattura.pagamenti_programmati.append(pagamento_entity)
    
    db.flush()
    
    # Se la categoria è cambiata, sincronizza con il movimento Prima Nota
    if categoria_changed:
        categoria_after = db_fattura.categoria
        categoria_id_after = getattr(db_fattura, 'categoria_id', None)
        if categoria_before != categoria_after or categoria_id_before != categoria_id_after:
            sync_categoria_fattura_to_movimento(db, db_fattura, db_fattura.azienda_id)
    
    ensure_prima_nota_for_fattura_amministrazione(db, db_fattura, None)
    db.commit()
    db.refresh(db_fattura)
    return db_fattura


@router.delete("/fatture/{fattura_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fattura_amministrazione(fattura_id: int, db: Session = Depends(get_db)):
    """Soft delete a fattura amministrazione"""
    db_fattura = db.query(FatturaAmministrazione).filter(FatturaAmministrazione.id == fattura_id).first()
    if not db_fattura:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    
    db.delete(db_fattura)
    db.commit()
    return None


@router.post("/fatture/predici-categoria")
async def predici_categoria_fattura(
    request: PredizioneCategoriaRequest,
    azienda_id: Optional[int] = Query(None, description="ID azienda (non usato, ML rimosso)"),
    use_ml: bool = Query(False, description="ML rimosso per risparmiare memoria"),
    db: Session = Depends(get_db)
):
    """
    Predice macrocategoria e categoria per una nuova fattura.
    
    Usa il classificatore rule-based.
    
    NOTA: ML rimosso per risparmiare memoria su Fly.io.
    sklearn/numpy/pandas occupavano ~200-300MB di RAM.
    """
    # ML RIMOSSO: sklearn/numpy/pandas causavano OOM su Fly.io
    # Usa direttamente il classificatore rule-based
    classificatore = ClassificatoreFatture(db)
    risultato = classificatore.predici(
        fornitore_id=request.fornitore_id,
        cliente_id=request.cliente_id,
        importo_totale=request.importo_totale,
        numero_fattura=request.numero_fattura,
        descrizione_linee=request.descrizione_linee,
        tipo=request.tipo,
        attrezzatura_id=request.attrezzatura_id,
        terreno_id=request.terreno_id
    )
    risultato['method'] = 'rule-based'
    return risultato


# ============ FATTURE EMESSE (ENTRATA) ============
@router.get("/fatture-emesse", response_model=List[FatturaAmministrazioneResponse])
async def get_fatture_emesse(
    azienda_id: int = Query(..., description="ID azienda"),
    stato_pagamento: Optional[str] = None,
    data_da: Optional[date] = None,
    data_a: Optional[date] = None,
    skip: int = 0,
    limit: int = 1000,  # Aumentato per matchare frontend
    db: Session = Depends(get_db)
):
    """Get all fatture emesse (tipo=entrata) con filtri
    
    Ottimizzazioni:
    - Usa joinedload per relazioni base (cliente, azienda) per evitare N+1 queries
    - Query ottimizzata per usare indici compositi
    """
    from app.models.amministrazione.fattura_amministrazione import TipoFattura
    from sqlalchemy.orm import joinedload
    
    query = db.query(FatturaAmministrazione).filter(
        FatturaAmministrazione.azienda_id == azienda_id,
        FatturaAmministrazione.tipo == TipoFattura.ENTRATA,
        FatturaAmministrazione.deleted_at.is_(None)
    )
    
    # Carica sempre le relazioni base per evitare N+1 queries
    query = query.options(
        joinedload(FatturaAmministrazione.cliente),
        joinedload(FatturaAmministrazione.azienda),
    )
    
    if stato_pagamento:
        query = query.filter(FatturaAmministrazione.stato_pagamento == stato_pagamento)
    if data_da:
        query = query.filter(FatturaAmministrazione.data_fattura >= data_da)
    if data_a:
        query = query.filter(FatturaAmministrazione.data_fattura <= data_a)
    
    # Limita per sicurezza
    if limit > 5000:
        limit = 5000
    
    return query.order_by(FatturaAmministrazione.data_fattura.desc()).offset(skip).limit(limit).all()


@router.get("/fatture-emesse/{fattura_id}", response_model=FatturaAmministrazioneResponse)
async def get_fattura_emessa(fattura_id: int, db: Session = Depends(get_db)):
    """Get a specific fattura emessa (tipo=entrata)"""
    from app.models.amministrazione.fattura_amministrazione import TipoFattura
    
    fattura = db.query(FatturaAmministrazione).filter(
        FatturaAmministrazione.id == fattura_id,
        FatturaAmministrazione.tipo == TipoFattura.ENTRATA,
        FatturaAmministrazione.deleted_at.is_(None)
    ).first()
    if not fattura:
        raise HTTPException(status_code=404, detail="Fattura emessa non trovata")
    
    return fattura


@router.post("/fatture-emesse", response_model=FatturaAmministrazioneResponse, status_code=status.HTTP_201_CREATED)
async def create_fattura_emessa(fattura: FatturaAmministrazioneCreate, db: Session = Depends(get_db)):
    """Create a new fattura emessa (tipo=entrata)"""
    from app.models.amministrazione.fattura_amministrazione import TipoFattura
    
    if not fattura.azienda_id:
        raise HTTPException(status_code=400, detail="azienda_id è obbligatorio per fatture emesse")
    
    azienda = db.query(Azienda).filter(Azienda.id == fattura.azienda_id).first()
    if not azienda:
        raise HTTPException(status_code=404, detail="Azienda non trovata")
    
    fattura_dict = fattura.dict()
    fattura_dict['tipo'] = TipoFattura.ENTRATA
    
    db_fattura = FatturaAmministrazione(**fattura_dict)
    db.add(db_fattura)
    db.flush()
    ensure_prima_nota_for_fattura_amministrazione(db, db_fattura, azienda.id)
    db.commit()
    db.refresh(db_fattura)
    return db_fattura


@router.put("/fatture-emesse/{fattura_id}", response_model=FatturaAmministrazioneResponse)
async def update_fattura_emessa(
    fattura_id: int,
    update: FatturaAmministrazioneUpdate,
    db: Session = Depends(get_db)
):
    """Update a fattura emessa (tipo=entrata)"""
    from app.models.amministrazione.fattura_amministrazione import TipoFattura
    
    db_fattura = db.query(FatturaAmministrazione).filter(
        FatturaAmministrazione.id == fattura_id,
        FatturaAmministrazione.tipo == TipoFattura.ENTRATA,
        FatturaAmministrazione.deleted_at.is_(None)
    ).first()
    if not db_fattura:
        raise HTTPException(status_code=404, detail="Fattura emessa non trovata")
    
    # Salva se la categoria è stata modificata per sincronizzazione
    categoria_changed = 'categoria' in update.dict(exclude_unset=True) or 'categoria_id' in update.dict(exclude_unset=True)
    categoria_before = db_fattura.categoria
    categoria_id_before = getattr(db_fattura, 'categoria_id', None)
    
    for key, value in update.dict(exclude_unset=True).items():
        setattr(db_fattura, key, value)
    
    db_fattura.tipo = TipoFattura.ENTRATA
    
    db.flush()
    
    # Se la categoria è cambiata, sincronizza con il movimento Prima Nota
    if categoria_changed:
        categoria_after = db_fattura.categoria
        categoria_id_after = getattr(db_fattura, 'categoria_id', None)
        if categoria_before != categoria_after or categoria_id_before != categoria_id_after:
            sync_categoria_fattura_to_movimento(db, db_fattura, db_fattura.azienda_id)
    
    ensure_prima_nota_for_fattura_amministrazione(db, db_fattura, db_fattura.azienda_id)
    db.commit()
    db.refresh(db_fattura)
    return db_fattura


@router.delete("/fatture-emesse/{fattura_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fattura_emessa(fattura_id: int, db: Session = Depends(get_db)):
    """Soft delete a fattura emessa (tipo=entrata)"""
    from app.models.amministrazione.fattura_amministrazione import TipoFattura
    
    db_fattura = db.query(FatturaAmministrazione).filter(
        FatturaAmministrazione.id == fattura_id,
        FatturaAmministrazione.tipo == TipoFattura.ENTRATA,
        FatturaAmministrazione.deleted_at.is_(None)
    ).first()
    if not db_fattura:
        raise HTTPException(status_code=404, detail="Fattura emessa non trovata")
    
    db_fattura.deleted_at = datetime.utcnow()
    db.commit()
    return None

