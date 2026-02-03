"""
Polizze Attrezzature endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date
from decimal import Decimal

from app.core.database import get_db
from app.models.amministrazione import (
    PolizzaAttrezzatura,
    PolizzaPagamento,
    PolizzaRinnovo,
    Attrezzatura,
)
from app.models.allevamento.azienda import Azienda
from app.schemas.amministrazione.polizza_attrezzatura import (
    PolizzaAttrezzaturaCreate,
    PolizzaAttrezzaturaResponse,
    PolizzaAttrezzaturaUpdate,
    PolizzaPagamentoCreate,
    PolizzaPagamentoResponse,
    PolizzaPagamentoUpdate,
    PolizzaRinnovoCreate,
    PolizzaRinnovoResponse,
    PolizzaRinnovoUpdate,
)
from app.services.amministrazione.prima_nota_automation import ensure_prima_nota_for_pagamento
from app.models.amministrazione.pn import PNMovimento, PNTipoOperazione, PNMovimentoOrigine, PNStatoMovimento
from app.schemas.amministrazione.pn import PNMovimentoCreate
from app.services.amministrazione.prima_nota_service import create_movimento as pn_create_movimento

router = APIRouter()


# ============ POLIZZE ATTREZZATURE ============
@router.get("/polizze-attrezzature", response_model=List[PolizzaAttrezzaturaResponse])
async def get_polizze_attrezzature(
    azienda_id: Optional[int] = Query(None, description="ID azienda"),
    attrezzatura_id: Optional[int] = Query(None, description="ID attrezzatura"),
    tipo_polizza: Optional[str] = None,
    attiva: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all polizze attrezzature con filtri"""
    query = db.query(PolizzaAttrezzatura).filter(
        PolizzaAttrezzatura.deleted_at.is_(None)
    )
    
    if azienda_id:
        query = query.filter(PolizzaAttrezzatura.azienda_id == azienda_id)
    if attrezzatura_id:
        query = query.filter(PolizzaAttrezzatura.attrezzatura_id == attrezzatura_id)
    if tipo_polizza:
        query = query.filter(PolizzaAttrezzatura.tipo_polizza == tipo_polizza)
    if attiva is not None:
        query = query.filter(PolizzaAttrezzatura.attiva == attiva)
    
    return query.order_by(PolizzaAttrezzatura.data_scadenza).offset(skip).limit(limit).all()


@router.get("/polizze-attrezzature/{polizza_id}", response_model=PolizzaAttrezzaturaResponse)
async def get_polizza_attrezzatura(polizza_id: int, db: Session = Depends(get_db)):
    """Get a specific polizza attrezzatura"""
    polizza = db.query(PolizzaAttrezzatura).filter(
        PolizzaAttrezzatura.id == polizza_id,
        PolizzaAttrezzatura.deleted_at.is_(None)
    ).first()
    if not polizza:
        raise HTTPException(status_code=404, detail="Polizza attrezzatura non trovata")
    return polizza


@router.post("/polizze-attrezzature", response_model=PolizzaAttrezzaturaResponse, status_code=status.HTTP_201_CREATED)
async def create_polizza_attrezzatura(
    polizza: PolizzaAttrezzaturaCreate,
    db: Session = Depends(get_db)
):
    """Create a new polizza attrezzatura"""
    # Verifica attrezzatura
    attrezzatura = db.query(Attrezzatura).filter(Attrezzatura.id == polizza.attrezzatura_id).first()
    if not attrezzatura:
        raise HTTPException(status_code=404, detail="Attrezzatura non trovata")
    
    # Verifica azienda
    azienda = db.query(Azienda).filter(Azienda.id == polizza.azienda_id).first()
    if not azienda:
        raise HTTPException(status_code=404, detail="Azienda non trovata")
    
    # Converti coperture da lista a JSON string se presente
    polizza_data = polizza.dict()
    if polizza_data.get('coperture'):
        import json
        polizza_data['coperture'] = json.dumps(polizza_data['coperture'])
    
    db_polizza = PolizzaAttrezzatura(**polizza_data)
    db.add(db_polizza)
    db.commit()
    db.refresh(db_polizza)
    
    # Converti coperture da JSON a lista per la risposta
    if db_polizza.coperture:
        if isinstance(db_polizza.coperture, str):
            import json
            db_polizza.coperture = json.loads(db_polizza.coperture)
    
    return db_polizza


@router.put("/polizze-attrezzature/{polizza_id}", response_model=PolizzaAttrezzaturaResponse)
async def update_polizza_attrezzatura(
    polizza_id: int,
    update: PolizzaAttrezzaturaUpdate,
    db: Session = Depends(get_db)
):
    """Update a polizza attrezzatura"""
    db_polizza = db.query(PolizzaAttrezzatura).filter(
        PolizzaAttrezzatura.id == polizza_id,
        PolizzaAttrezzatura.deleted_at.is_(None)
    ).first()
    if not db_polizza:
        raise HTTPException(status_code=404, detail="Polizza attrezzatura non trovata")
    
    update_data = update.dict(exclude_unset=True)
    
    # Converti coperture da lista a JSON string se presente
    if 'coperture' in update_data and update_data['coperture']:
        import json
        update_data['coperture'] = json.dumps(update_data['coperture'])
    
    for key, value in update_data.items():
        setattr(db_polizza, key, value)
    
    db.commit()
    db.refresh(db_polizza)
    
    # Converti coperture da JSON a lista per la risposta
    if db_polizza.coperture:
        if isinstance(db_polizza.coperture, str):
            import json
            db_polizza.coperture = json.loads(db_polizza.coperture)
    
    return db_polizza


@router.delete("/polizze-attrezzature/{polizza_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_polizza_attrezzatura(polizza_id: int, db: Session = Depends(get_db)):
    """Soft delete a polizza attrezzatura"""
    db_polizza = db.query(PolizzaAttrezzatura).filter(
        PolizzaAttrezzatura.id == polizza_id,
        PolizzaAttrezzatura.deleted_at.is_(None)
    ).first()
    if not db_polizza:
        raise HTTPException(status_code=404, detail="Polizza attrezzatura non trovata")
    
    db_polizza.deleted_at = datetime.utcnow()
    db.commit()
    return None


# ============ POLIZZA PAGAMENTI ============
@router.get("/polizza-pagamenti", response_model=List[PolizzaPagamentoResponse])
async def get_polizza_pagamenti(
    polizza_id: Optional[int] = Query(None, description="ID polizza"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all pagamenti polizza"""
    query = db.query(PolizzaPagamento).filter(
        PolizzaPagamento.deleted_at.is_(None)
    )
    
    if polizza_id:
        query = query.filter(PolizzaPagamento.polizza_id == polizza_id)
    
    return query.order_by(PolizzaPagamento.data_pagamento.desc()).offset(skip).limit(limit).all()


@router.post("/polizza-pagamenti", response_model=PolizzaPagamentoResponse, status_code=status.HTTP_201_CREATED)
async def create_polizza_pagamento(
    pagamento: PolizzaPagamentoCreate,
    db: Session = Depends(get_db)
):
    """Create a new pagamento polizza (collegato automaticamente a Prima Nota)"""
    # Verifica polizza
    polizza = db.query(PolizzaAttrezzatura).filter(
        PolizzaAttrezzatura.id == pagamento.polizza_id,
        PolizzaAttrezzatura.deleted_at.is_(None)
    ).first()
    if not polizza:
        raise HTTPException(status_code=404, detail="Polizza non trovata")
    
    # Crea pagamento
    db_pagamento = PolizzaPagamento(**pagamento.dict())
    db.add(db_pagamento)
    db.flush()
    
    # Crea movimento Prima Nota automaticamente
    # Nota: Il conto e la categoria verranno determinati automaticamente dal servizio
    movimento_payload = PNMovimentoCreate(
        azienda_id=polizza.azienda_id,
        conto_id=None,  # Sarà determinato automaticamente dal servizio
        categoria_id=None,  # Sarà determinato automaticamente dal servizio
        tipo_operazione=PNTipoOperazione.USCITA,
        stato=PNStatoMovimento.DEFINITIVO,
        origine=PNMovimentoOrigine.AUTOMATICO,
        data=pagamento.data_pagamento,
        descrizione=f"Pagamento polizza {polizza.numero_polizza} - {polizza.compagnia}",
        importo=pagamento.importo,
        contropartita_nome=polizza.compagnia,
        note=f"Polizza: {polizza.tipo_polizza.value} - {polizza.numero_polizza}",
    )
    
    movimento_response = pn_create_movimento(db, movimento_payload)
    db_pagamento.prima_nota_movimento_id = movimento_response.id
    
    db.commit()
    db.refresh(db_pagamento)
    return db_pagamento


@router.put("/polizza-pagamenti/{pagamento_id}", response_model=PolizzaPagamentoResponse)
async def update_polizza_pagamento(
    pagamento_id: int,
    update: PolizzaPagamentoUpdate,
    db: Session = Depends(get_db)
):
    """Update a polizza pagamento"""
    db_pagamento = db.query(PolizzaPagamento).filter(
        PolizzaPagamento.id == pagamento_id,
        PolizzaPagamento.deleted_at.is_(None)
    ).first()
    if not db_pagamento:
        raise HTTPException(status_code=404, detail="Pagamento polizza non trovato")
    
    for key, value in update.dict(exclude_unset=True).items():
        setattr(db_pagamento, key, value)
    
    db.commit()
    db.refresh(db_pagamento)
    return db_pagamento


@router.delete("/polizza-pagamenti/{pagamento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_polizza_pagamento(pagamento_id: int, db: Session = Depends(get_db)):
    """Soft delete a polizza pagamento"""
    db_pagamento = db.query(PolizzaPagamento).filter(
        PolizzaPagamento.id == pagamento_id,
        PolizzaPagamento.deleted_at.is_(None)
    ).first()
    if not db_pagamento:
        raise HTTPException(status_code=404, detail="Pagamento polizza non trovato")
    
    db_pagamento.deleted_at = datetime.utcnow()
    db.commit()
    return None


# ============ POLIZZA RINNOVI ============
@router.post("/polizza-rinnovi", response_model=PolizzaRinnovoResponse, status_code=status.HTTP_201_CREATED)
async def create_polizza_rinnovo(
    rinnovo: PolizzaRinnovoCreate,
    db: Session = Depends(get_db)
):
    """Create a new rinnovo polizza (aggiorna anche la polizza)"""
    # Verifica polizza
    polizza = db.query(PolizzaAttrezzatura).filter(
        PolizzaAttrezzatura.id == rinnovo.polizza_id,
        PolizzaAttrezzatura.deleted_at.is_(None)
    ).first()
    if not polizza:
        raise HTTPException(status_code=404, detail="Polizza non trovata")
    
    # Salva dati precedenti
    premio_precedente = polizza.premio_annuale
    coperture_precedenti = polizza.coperture
    
    # Crea record rinnovo
    rinnovo_data = rinnovo.dict()
    if rinnovo_data.get('coperture_precedenti'):
        import json
        rinnovo_data['coperture_precedenti'] = json.dumps(rinnovo_data['coperture_precedenti'])
    if rinnovo_data.get('coperture_nuove'):
        import json
        rinnovo_data['coperture_nuove'] = json.dumps(rinnovo_data['coperture_nuove'])
    
    db_rinnovo = PolizzaRinnovo(**rinnovo_data)
    db.add(db_rinnovo)
    db.flush()
    
    # Aggiorna polizza con nuovi dati
    if rinnovo.premio_nuovo:
        polizza.premio_annuale = rinnovo.premio_nuovo
    if rinnovo.nuova_data_inizio:
        polizza.data_inizio = rinnovo.nuova_data_inizio
    if rinnovo.nuova_data_scadenza:
        polizza.data_scadenza = rinnovo.nuova_data_scadenza
    if rinnovo.coperture_nuove:
        import json
        polizza.coperture = json.dumps(rinnovo.coperture_nuove)
    
    db.commit()
    db.refresh(db_rinnovo)
    
    # Converti coperture da JSON a lista per la risposta
    if db_rinnovo.coperture_precedenti:
        if isinstance(db_rinnovo.coperture_precedenti, str):
            import json
            db_rinnovo.coperture_precedenti = json.loads(db_rinnovo.coperture_precedenti)
    if db_rinnovo.coperture_nuove:
        if isinstance(db_rinnovo.coperture_nuove, str):
            import json
            db_rinnovo.coperture_nuove = json.loads(db_rinnovo.coperture_nuove)
    
    return db_rinnovo


@router.get("/polizza-rinnovi", response_model=List[PolizzaRinnovoResponse])
async def get_polizza_rinnovi(
    polizza_id: Optional[int] = Query(None, description="ID polizza"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all rinnovi polizza"""
    query = db.query(PolizzaRinnovo).filter(
        PolizzaRinnovo.deleted_at.is_(None)
    )
    
    if polizza_id:
        query = query.filter(PolizzaRinnovo.polizza_id == polizza_id)
    
    return query.order_by(PolizzaRinnovo.data_rinnovo.desc()).offset(skip).limit(limit).all()

