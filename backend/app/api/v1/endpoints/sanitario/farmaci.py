"""Farmaci e Lotti endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, func
from typing import List, Optional
from datetime import datetime, date

from app.core.database import get_db
from app.models.sanitario import Farmaco, LottoFarmaco
from app.schemas.sanitario.farmaco import FarmacoCreate, FarmacoUpdate, FarmacoResponse
from app.schemas.sanitario.lotto_farmaco import LottoFarmacoCreate, LottoFarmacoUpdate, LottoFarmacoResponse

router = APIRouter()

# ============ FARMACI ============
@router.get("/farmaci", response_model=List[FarmacoResponse])
async def get_farmaci(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all farmaci"""
    query = db.query(Farmaco).filter(Farmaco.deleted_at.is_(None))
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Farmaco.nome_commerciale.ilike(search_term)) |
            (Farmaco.principio_attivo.ilike(search_term))
        )
    
    return query.offset(skip).limit(limit).all()


@router.get("/farmaci/{farmaco_id}", response_model=FarmacoResponse)
async def get_farmaco(farmaco_id: int, db: Session = Depends(get_db)):
    """Get a specific farmaco"""
    farmaco = db.query(Farmaco).filter(
        Farmaco.id == farmaco_id,
        Farmaco.deleted_at.is_(None)
    ).first()
    if not farmaco:
        raise HTTPException(status_code=404, detail="Farmaco not found")
    return farmaco


@router.post("/farmaci", response_model=FarmacoResponse, status_code=status.HTTP_201_CREATED)
async def create_farmaco(farmaco: FarmacoCreate, db: Session = Depends(get_db)):
    """Create a new farmaco"""
    db_farmaco = Farmaco(**farmaco.dict())
    db.add(db_farmaco)
    db.commit()
    db.refresh(db_farmaco)
    return db_farmaco


@router.put("/farmaci/{farmaco_id}", response_model=FarmacoResponse)
async def update_farmaco(
    farmaco_id: int,
    farmaco: FarmacoUpdate,
    db: Session = Depends(get_db)
):
    """Update a farmaco"""
    db_farmaco = db.query(Farmaco).filter(
        Farmaco.id == farmaco_id,
        Farmaco.deleted_at.is_(None)
    ).first()
    if not db_farmaco:
        raise HTTPException(status_code=404, detail="Farmaco not found")
    
    update_data = farmaco.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_farmaco, field, value)
    
    db.commit()
    db.refresh(db_farmaco)
    return db_farmaco


@router.delete("/farmaci/{farmaco_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_farmaco(farmaco_id: int, db: Session = Depends(get_db)):
    """Soft delete a farmaco"""
    db_farmaco = db.query(Farmaco).filter(
        Farmaco.id == farmaco_id,
        Farmaco.deleted_at.is_(None)
    ).first()
    if not db_farmaco:
        raise HTTPException(status_code=404, detail="Farmaco not found")
    
    db_farmaco.deleted_at = datetime.now()
    db.commit()
    return None


# ============ LOTTI FARMACO (MAGAZZINO) ============
@router.get("/lotti-farmaco", response_model=List[LottoFarmacoResponse])
async def get_lotti_farmaco(
    azienda_id: Optional[int] = None,
    farmaco_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all lotti farmaco (magazzino)"""
    query = db.query(LottoFarmaco).filter(LottoFarmaco.deleted_at.is_(None))
    
    if azienda_id is not None:
        query = query.filter(LottoFarmaco.azienda_id == azienda_id)
    if farmaco_id is not None:
        query = query.filter(LottoFarmaco.farmaco_id == farmaco_id)
    
    return query.offset(skip).limit(limit).all()


@router.get("/lotti-farmaco/{lotto_id}", response_model=LottoFarmacoResponse)
async def get_lotto_farmaco(lotto_id: int, db: Session = Depends(get_db)):
    """Get a specific lotto farmaco"""
    lotto = db.query(LottoFarmaco).filter(
        LottoFarmaco.id == lotto_id,
        LottoFarmaco.deleted_at.is_(None)
    ).first()
    if not lotto:
        raise HTTPException(status_code=404, detail="Lotto farmaco not found")
    return lotto


@router.post("/lotti-farmaco", response_model=LottoFarmacoResponse, status_code=status.HTTP_201_CREATED)
async def create_lotto_farmaco(lotto: LottoFarmacoCreate, db: Session = Depends(get_db)):
    """Create a new lotto farmaco (aggiunge o aumenta quantità)"""
    # Verifica che il farmaco esista
    farmaco = db.query(Farmaco).filter(
        Farmaco.id == lotto.farmaco_id,
        Farmaco.deleted_at.is_(None)
    ).first()
    if not farmaco:
        raise HTTPException(status_code=404, detail="Farmaco not found")
    
    # Cerca se esiste già un lotto con stesso farmaco, azienda e lotto
    existing_lotto = db.query(LottoFarmaco).filter(
        and_(
            LottoFarmaco.azienda_id == lotto.azienda_id,
            LottoFarmaco.farmaco_id == lotto.farmaco_id,
            LottoFarmaco.lotto == lotto.lotto,
            LottoFarmaco.deleted_at.is_(None)
        )
    ).first()
    
    if existing_lotto:
        # Se esiste, aumenta la quantità
        existing_lotto.quantita_iniziale += lotto.quantita_iniziale
        existing_lotto.quantita_rimanente += lotto.quantita_iniziale
        
        # Aggiorna altri campi se forniti
        if lotto.scadenza:
            existing_lotto.scadenza = lotto.scadenza
        if lotto.fornitore:
            existing_lotto.fornitore = lotto.fornitore
        if lotto.numero_fattura:
            existing_lotto.numero_fattura = lotto.numero_fattura
        if lotto.data_acquisto:
            existing_lotto.data_acquisto = lotto.data_acquisto
        if lotto.note:
            existing_lotto.note = lotto.note
        
        db.commit()
        db.refresh(existing_lotto)
        return existing_lotto
    else:
        # Crea nuovo lotto
        if lotto.quantita_rimanente is None:
            lotto.quantita_rimanente = lotto.quantita_iniziale
        
        db_lotto = LottoFarmaco(**lotto.dict())
        db.add(db_lotto)
        db.commit()
        db.refresh(db_lotto)
        return db_lotto


@router.put("/lotti-farmaco/{lotto_id}", response_model=LottoFarmacoResponse)
async def update_lotto_farmaco(
    lotto_id: int,
    lotto: LottoFarmacoUpdate,
    db: Session = Depends(get_db)
):
    """Update a lotto farmaco"""
    db_lotto = db.query(LottoFarmaco).filter(
        LottoFarmaco.id == lotto_id,
        LottoFarmaco.deleted_at.is_(None)
    ).first()
    if not db_lotto:
        raise HTTPException(status_code=404, detail="Lotto farmaco not found")
    
    update_data = lotto.dict(exclude_unset=True)
    
    # Se si aggiorna quantita_iniziale, aggiorna anche rimanente (diff)
    if 'quantita_iniziale' in update_data:
        diff = update_data['quantita_iniziale'] - db_lotto.quantita_iniziale
        if 'quantita_rimanente' not in update_data:
            update_data['quantita_rimanente'] = db_lotto.quantita_rimanente + diff
    
    for field, value in update_data.items():
        setattr(db_lotto, field, value)
    
    db.commit()
    db.refresh(db_lotto)
    return db_lotto


@router.delete("/lotti-farmaco/{lotto_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lotto_farmaco(lotto_id: int, db: Session = Depends(get_db)):
    """Soft delete a lotto farmaco"""
    db_lotto = db.query(LottoFarmaco).filter(
        LottoFarmaco.id == lotto_id,
        LottoFarmaco.deleted_at.is_(None)
    ).first()
    if not db_lotto:
        raise HTTPException(status_code=404, detail="Lotto farmaco not found")
    
    db_lotto.deleted_at = datetime.now()
    db.commit()
    return None


@router.get("/lotti-farmaco/azienda/{azienda_id}/giacenze", response_model=List[LottoFarmacoResponse])
async def get_giacenze_azienda(azienda_id: int, db: Session = Depends(get_db)):
    """Get tutte le giacenze di un'azienda con quantità rimanente > 0"""
    lotti = db.query(LottoFarmaco).filter(
        and_(
            LottoFarmaco.azienda_id == azienda_id,
            LottoFarmaco.quantita_rimanente > 0,
            LottoFarmaco.deleted_at.is_(None)
        )
    ).all()
    return lotti


