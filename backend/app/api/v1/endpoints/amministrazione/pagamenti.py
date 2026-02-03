"""
Pagamenti endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from decimal import Decimal

from app.core.database import get_db
from app.models.amministrazione import Pagamento, FatturaAmministrazione
from app.models.allevamento.azienda import Azienda
from app.schemas.amministrazione import (
    PagamentoCreate,
    PagamentoResponse,
    PagamentoUpdate,
)
from app.services.amministrazione.prima_nota_automation import (
    ensure_prima_nota_for_pagamento,
    soft_delete_prima_nota_for_pagamento,
)

router = APIRouter()


@router.post("/pagamenti", response_model=PagamentoResponse, status_code=status.HTTP_201_CREATED)
async def create_pagamento(pagamento: PagamentoCreate, db: Session = Depends(get_db)):
    """Create a new pagamento"""
    azienda = db.query(Azienda).filter(Azienda.id == pagamento.azienda_id).first()
    if not azienda:
        raise HTTPException(status_code=404, detail="Azienda non trovata")
    
    if pagamento.fattura_amministrazione_id:
        from app.models.amministrazione.fattura_amministrazione import TipoFattura, StatoPagamento
        
        fattura = db.query(FatturaAmministrazione).filter(
            FatturaAmministrazione.id == pagamento.fattura_amministrazione_id
        ).first()
        if fattura:
            if fattura.tipo == TipoFattura.ENTRATA:
                fattura.importo_incassato = (fattura.importo_incassato or Decimal('0')) + pagamento.importo
                if fattura.importo_incassato >= fattura.importo_totale:
                    fattura.stato_pagamento = StatoPagamento.INCASSATA
                    fattura.data_incasso = pagamento.data_pagamento
                elif fattura.importo_incassato > 0:
                    fattura.stato_pagamento = StatoPagamento.PARZIALE
            else:
                fattura.importo_pagato = (fattura.importo_pagato or Decimal('0')) + pagamento.importo
                if fattura.importo_pagato >= fattura.importo_totale:
                    fattura.stato_pagamento = StatoPagamento.PAGATA
                    fattura.data_pagamento = pagamento.data_pagamento
                elif fattura.importo_pagato > 0:
                    fattura.stato_pagamento = StatoPagamento.PARZIALE
    
    db_pagamento = Pagamento(**pagamento.dict())
    db.add(db_pagamento)
    db.flush()
    ensure_prima_nota_for_pagamento(db, db_pagamento)
    db.commit()
    db.refresh(db_pagamento)
    return db_pagamento


@router.put("/pagamenti/{pagamento_id}", response_model=PagamentoResponse)
async def update_pagamento(
    pagamento_id: int,
    update: PagamentoUpdate,
    db: Session = Depends(get_db)
):
    """Update a pagamento"""
    db_pagamento = db.query(Pagamento).filter(
        Pagamento.id == pagamento_id,
        Pagamento.deleted_at.is_(None)
    ).first()
    if not db_pagamento:
        raise HTTPException(status_code=404, detail="Pagamento non trovato")
    
    for key, value in update.dict(exclude_unset=True).items():
        setattr(db_pagamento, key, value)
    
    db.flush()
    ensure_prima_nota_for_pagamento(db, db_pagamento)
    db.commit()
    db.refresh(db_pagamento)
    return db_pagamento


@router.delete("/pagamenti/{pagamento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pagamento(pagamento_id: int, db: Session = Depends(get_db)):
    """Soft delete a pagamento"""
    db_pagamento = db.query(Pagamento).filter(
        Pagamento.id == pagamento_id,
        Pagamento.deleted_at.is_(None)
    ).first()
    if not db_pagamento:
        raise HTTPException(status_code=404, detail="Pagamento non trovato")
    
    db_pagamento.deleted_at = datetime.utcnow()
    soft_delete_prima_nota_for_pagamento(db, pagamento_id)
    db.commit()
    return None

