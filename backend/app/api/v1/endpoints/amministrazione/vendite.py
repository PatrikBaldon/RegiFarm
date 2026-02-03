"""
Vendite Prodotti e Prodotti Derivati endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date

from app.core.database import get_db
from app.models.amministrazione import VenditaProdottoAgricolo, ProdottoDerivato
from app.schemas.amministrazione import (
    VenditaProdottoAgricoloCreate,
    VenditaProdottoAgricoloResponse,
    VenditaProdottoAgricoloUpdate,
    ProdottoDerivatoCreate,
    ProdottoDerivatoResponse,
    ProdottoDerivatoUpdate,
)

router = APIRouter()


# ============ VENDITE PRODOTTI AGRICOLI ============
@router.get("/vendite-prodotti", response_model=List[VenditaProdottoAgricoloResponse])
async def get_vendite_prodotti(
    azienda_id: Optional[int] = None,
    prodotto: Optional[str] = None,
    data_da: Optional[date] = None,
    data_a: Optional[date] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all vendite prodotti agricoli with filters"""
    query = db.query(VenditaProdottoAgricolo).filter(VenditaProdottoAgricolo.deleted_at.is_(None))
    
    if azienda_id:
        query = query.filter(VenditaProdottoAgricolo.azienda_id == azienda_id)
    if prodotto:
        query = query.filter(VenditaProdottoAgricolo.prodotto.ilike(f"%{prodotto}%"))
    if data_da:
        query = query.filter(VenditaProdottoAgricolo.data_vendita >= data_da)
    if data_a:
        query = query.filter(VenditaProdottoAgricolo.data_vendita <= data_a)
    
    return query.order_by(VenditaProdottoAgricolo.data_vendita.desc()).offset(skip).limit(limit).all()


@router.get("/vendite-prodotti/{vendita_id}", response_model=VenditaProdottoAgricoloResponse)
async def get_vendita_prodotto(vendita_id: int, db: Session = Depends(get_db)):
    """Get a specific vendita prodotto"""
    vendita = db.query(VenditaProdottoAgricolo).filter(VenditaProdottoAgricolo.id == vendita_id).first()
    if not vendita:
        raise HTTPException(status_code=404, detail="Vendita prodotto non trovata")
    return vendita


@router.post("/vendite-prodotti", response_model=VenditaProdottoAgricoloResponse, status_code=status.HTTP_201_CREATED)
async def create_vendita_prodotto(vendita: VenditaProdottoAgricoloCreate, db: Session = Depends(get_db)):
    """Create a new vendita prodotto"""
    if not vendita.importo_totale:
        vendita.importo_totale = vendita.quantita * vendita.prezzo_unitario
    
    if vendita.costi_terreno_totale and vendita.margine is None:
        vendita.margine = vendita.importo_totale - vendita.costi_terreno_totale
    
    db_vendita = VenditaProdottoAgricolo(**vendita.dict())
    db.add(db_vendita)
    db.commit()
    db.refresh(db_vendita)
    return db_vendita


@router.put("/vendite-prodotti/{vendita_id}", response_model=VenditaProdottoAgricoloResponse)
async def update_vendita_prodotto(
    vendita_id: int,
    update: VenditaProdottoAgricoloUpdate,
    db: Session = Depends(get_db)
):
    """Update a vendita prodotto"""
    db_vendita = db.query(VenditaProdottoAgricolo).filter(VenditaProdottoAgricolo.id == vendita_id).first()
    if not db_vendita:
        raise HTTPException(status_code=404, detail="Vendita prodotto non trovata")
    
    update_dict = update.dict(exclude_unset=True)
    update_dict.pop('pagamenti_programmati', None)
    
    if 'quantita' in update_dict or 'prezzo_unitario' in update_dict:
        quantita = update_dict.get('quantita', db_vendita.quantita)
        prezzo = update_dict.get('prezzo_unitario', db_vendita.prezzo_unitario)
        update_dict['importo_totale'] = quantita * prezzo
    
    if 'importo_totale' in update_dict or 'costi_terreno_totale' in update_dict:
        importo = update_dict.get('importo_totale', db_vendita.importo_totale)
        costi = update_dict.get('costi_terreno_totale', db_vendita.costi_terreno_totale)
        update_dict['margine'] = importo - costi
    
    for field, value in update_dict.items():
        setattr(db_vendita, field, value)
    
    db.commit()
    db.refresh(db_vendita)
    return db_vendita


@router.delete("/vendite-prodotti/{vendita_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vendita_prodotto(vendita_id: int, db: Session = Depends(get_db)):
    """Soft delete a vendita prodotto"""
    db_vendita = db.query(VenditaProdottoAgricolo).filter(VenditaProdottoAgricolo.id == vendita_id).first()
    if not db_vendita:
        raise HTTPException(status_code=404, detail="Vendita prodotto non trovata")
    
    db_vendita.deleted_at = datetime.utcnow()
    db.commit()
    return None


# ============ PRODOTTI DERIVATI ============
@router.get("/prodotti-derivati", response_model=List[ProdottoDerivatoResponse])
async def get_prodotti_derivati(
    raccolto_id: Optional[int] = None,
    destinazione: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all prodotti derivati with filters"""
    query = db.query(ProdottoDerivato).filter(ProdottoDerivato.deleted_at.is_(None))
    
    if raccolto_id:
        query = query.filter(ProdottoDerivato.raccolto_id == raccolto_id)
    if destinazione:
        query = query.filter(ProdottoDerivato.destinazione == destinazione)
    
    return query.offset(skip).limit(limit).all()


@router.get("/prodotti-derivati/{prodotto_id}", response_model=ProdottoDerivatoResponse)
async def get_prodotto_derivato(prodotto_id: int, db: Session = Depends(get_db)):
    """Get a specific prodotto derivato"""
    prodotto = db.query(ProdottoDerivato).filter(ProdottoDerivato.id == prodotto_id).first()
    if not prodotto:
        raise HTTPException(status_code=404, detail="Prodotto derivato non trovato")
    return prodotto


@router.post("/prodotti-derivati", response_model=ProdottoDerivatoResponse, status_code=status.HTTP_201_CREATED)
async def create_prodotto_derivato(prodotto: ProdottoDerivatoCreate, db: Session = Depends(get_db)):
    """Create a new prodotto derivato"""
    db_prodotto = ProdottoDerivato(**prodotto.dict())
    db.add(db_prodotto)
    db.commit()
    db.refresh(db_prodotto)
    return db_prodotto


@router.put("/prodotti-derivati/{prodotto_id}", response_model=ProdottoDerivatoResponse)
async def update_prodotto_derivato(
    prodotto_id: int,
    update: ProdottoDerivatoUpdate,
    db: Session = Depends(get_db)
):
    """Update a prodotto derivato"""
    db_prodotto = db.query(ProdottoDerivato).filter(ProdottoDerivato.id == prodotto_id).first()
    if not db_prodotto:
        raise HTTPException(status_code=404, detail="Prodotto derivato non trovato")
    
    for field, value in update.dict(exclude_unset=True).items():
        setattr(db_prodotto, field, value)
    
    db.commit()
    db.refresh(db_prodotto)
    return db_prodotto


@router.delete("/prodotti-derivati/{prodotto_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prodotto_derivato(prodotto_id: int, db: Session = Depends(get_db)):
    """Soft delete a prodotto derivato"""
    db_prodotto = db.query(ProdottoDerivato).filter(ProdottoDerivato.id == prodotto_id).first()
    if not db_prodotto:
        raise HTTPException(status_code=404, detail="Prodotto derivato non trovato")
    
    db_prodotto.deleted_at = datetime.utcnow()
    db.commit()
    return None

