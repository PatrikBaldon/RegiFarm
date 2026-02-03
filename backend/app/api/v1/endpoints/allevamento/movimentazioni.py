"""
Movimentazioni endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.core.database import get_db
from app.models.allevamento import Movimentazione, Animale, Box
from app.schemas.allevamento.movimentazione import MovimentazioneCreate, MovimentazioneResponse

router = APIRouter()

@router.post("/movimentazioni", response_model=MovimentazioneResponse, status_code=status.HTTP_201_CREATED)
async def create_movimentazione(movimentazione: MovimentazioneCreate, db: Session = Depends(get_db)):
    """Create a new movimentazione and move animale"""
    # Get animale
    animale = db.query(Animale).filter(
        Animale.id == movimentazione.animale_id,
        Animale.deleted_at.is_(None)
    ).first()
    if not animale:
        raise HTTPException(status_code=404, detail="Animale not found")
    
    # Get destination box
    box_a = db.query(Box).filter(
        Box.id == movimentazione.a_box_id,
        Box.deleted_at.is_(None)
    ).first()
    if not box_a:
        raise HTTPException(status_code=404, detail="Box di destinazione not found")
    
    # Check capacity
    occupazione = len([a for a in box_a.animali if a.stato == 'presente'])
    if occupazione >= box_a.capacita:
        raise HTTPException(status_code=400, detail="Box di destinazione già pieno")
    
    # Get source box (if specified)
    da_box_id = animale.box_id if not movimentazione.da_box_id else movimentazione.da_box_id
    
    # Create movimentazione
    db_movimentazione = Movimentazione(
        animale_id=movimentazione.animale_id,
        da_box_id=da_box_id,
        a_box_id=movimentazione.a_box_id,
        motivo=movimentazione.motivo,
        note=movimentazione.note,
        operatore_id=movimentazione.operatore_id
    )
    db.add(db_movimentazione)
    
    # Update animale box
    animale.box_id = movimentazione.a_box_id
    animale.data_inserimento_box = datetime.utcnow()
    # Aggiorna data_ultima_pesata con la data di trasferimento
    animale.data_ultima_pesata = datetime.utcnow().date()
    
    # Flush per assicurare che le modifiche siano visibili nelle query successive
    db.flush()
    
    # Update box stato
    if da_box_id:
        box_da = db.query(Box).filter(Box.id == da_box_id).first()
        if box_da:
            # Conta animali presenti nel box di origine (escludendo quello che stiamo spostando)
            occupazione_da = db.query(Animale).filter(
                Animale.box_id == box_da.id,
                Animale.stato == 'presente',
                Animale.id != movimentazione.animale_id,
                Animale.deleted_at.is_(None)
            ).count()
            if occupazione_da == 0:
                box_da.stato = 'libero'
    
    # Conta animali presenti nel box di destinazione (incluso quello che stiamo spostando)
    occupazione_a = db.query(Animale).filter(
        Animale.box_id == box_a.id,
        Animale.stato == 'presente',
        Animale.deleted_at.is_(None)
    ).count()
    if occupazione_a > 0:
        box_a.stato = 'occupato'
    
    db.commit()
    db.refresh(db_movimentazione)
    return db_movimentazione


@router.get("/movimentazioni/{animale_id}", response_model=List[MovimentazioneResponse])
async def get_movimentazioni_animale(animale_id: int, db: Session = Depends(get_db)):
    """Get all movimentazioni for an animale"""
    return db.query(Movimentazione).filter(
        Movimentazione.animale_id == animale_id
    ).order_by(Movimentazione.data_ora.desc()).all()


