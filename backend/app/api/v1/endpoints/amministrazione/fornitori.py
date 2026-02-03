"""
Fornitori endpoints (CRUD Fornitori + Fornitori Tipi)
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.models.amministrazione import FornitoreTipo, Fornitore
from app.schemas.amministrazione import (
    FornitoreTipoCreate,
    FornitoreTipoResponse,
    FornitoreTipoUpdate,
    FornitoreCreate,
    FornitoreUpdate,
    FornitoreResponse,
)
from .common import apply_default_categoria_to_fatture

router = APIRouter()

# --- FORNITORI CRUD ---
@router.get("/fornitori/", response_model=List[FornitoreResponse])
def list_fornitori(
    skip: int = 0,
    limit: int = 10000,  # Aumentato per matchare richiesta frontend
    include_tipi: bool = False,
    azienda_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Get all fornitori with optional relations.
    
    Args:
        include_tipi: If True, loads fornitore tipi relationship for each fornitore
        azienda_id: Optional filter by azienda_id
        limit: Maximum number of results (default 10000, max 10000)
    """
    from sqlalchemy.orm import selectinload
    
    query = db.query(Fornitore).filter(
        Fornitore.deleted_at.is_(None)
    )
    
    # Filtra per azienda se specificato (ottimizza query con indice)
    if azienda_id:
        query = query.filter(Fornitore.azienda_id == azienda_id)
    
    # Carica tipi se richiesto
    if include_tipi:
        query = query.options(selectinload(Fornitore.tipi))
    
    # Limita per sicurezza
    if limit > 10000:
        limit = 10000
    
    return query.order_by(Fornitore.nome).offset(skip).limit(limit).all()

@router.get("/fornitori/{fornitore_id}", response_model=FornitoreResponse)
def get_fornitore(fornitore_id: int, db: Session = Depends(get_db)):
	fornitore = db.query(Fornitore).filter(
		Fornitore.id == fornitore_id,
		Fornitore.deleted_at.is_(None)
	).first()
	if not fornitore:
		raise HTTPException(status_code=404, detail="Fornitore non trovato")
	return fornitore

@router.post("/fornitori/", response_model=FornitoreResponse, status_code=status.HTTP_201_CREATED)
def create_fornitore(fornitore: FornitoreCreate, db: Session = Depends(get_db)):
	# azienda_id è obbligatorio e deve essere passato dal frontend
	# Usa dict() per compatibilità con Pydantic v1 e v2
	fornitore_data = fornitore.dict() if hasattr(fornitore, 'dict') else fornitore.model_dump(exclude_unset=False)
	db_fornitore = Fornitore(**fornitore_data)
	db.add(db_fornitore)
	db.commit()
	db.refresh(db_fornitore)
	return db_fornitore

@router.put("/fornitori/{fornitore_id}", response_model=FornitoreResponse)
def update_fornitore(fornitore_id: int, update: FornitoreUpdate, db: Session = Depends(get_db)):
	db_fornitore = db.query(Fornitore).filter(
		Fornitore.id == fornitore_id,
		Fornitore.deleted_at.is_(None)
	).first()
	if not db_fornitore:
		raise HTTPException(status_code=404, detail="Fornitore non trovato")
	# Usa dict() per compatibilità con Pydantic v1 e v2
	update_data = update.dict(exclude_unset=True) if hasattr(update, 'dict') else update.model_dump(exclude_unset=True)
	for field, value in update_data.items():
		setattr(db_fornitore, field, value)
	db.commit()
	db.refresh(db_fornitore)
	return db_fornitore

@router.delete("/fornitori/{fornitore_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_fornitore(fornitore_id: int, db: Session = Depends(get_db)):
	"""Soft delete fornitore"""
	db_fornitore = db.query(Fornitore).filter(
		Fornitore.id == fornitore_id,
		Fornitore.deleted_at.is_(None)
	).first()
	if not db_fornitore:
		raise HTTPException(status_code=404, detail="Fornitore non trovato")
	db_fornitore.deleted_at = datetime.utcnow()
	db.commit()
	return None

# --- FORNITORI TIPI CRUD ---


@router.get("/fornitori-tipi", response_model=List[FornitoreTipoResponse])
async def get_fornitori_tipi(
    categoria: Optional[str] = None,
    fornitore_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all fornitori tipi with optional filters"""
    query = db.query(FornitoreTipo)
    
    if categoria:
        query = query.filter(FornitoreTipo.categoria == categoria)
    if fornitore_id:
        query = query.filter(FornitoreTipo.fornitore_id == fornitore_id)
    
    return query.offset(skip).limit(limit).all()


@router.get("/fornitori-tipi/{tipo_id}", response_model=FornitoreTipoResponse)
async def get_fornitore_tipo(tipo_id: int, db: Session = Depends(get_db)):
    """Get a specific fornitore tipo"""
    tipo = db.query(FornitoreTipo).filter(FornitoreTipo.id == tipo_id).first()
    if not tipo:
        raise HTTPException(status_code=404, detail="Fornitore tipo non trovato")
    return tipo


@router.post("/fornitori-tipi", response_model=FornitoreTipoResponse, status_code=status.HTTP_201_CREATED)
async def create_fornitore_tipo(tipo: FornitoreTipoCreate, db: Session = Depends(get_db)):
    """Create a new fornitore tipo"""
    fornitore = db.query(Fornitore).filter(
        Fornitore.id == tipo.fornitore_id,
        Fornitore.deleted_at.is_(None)
    ).first()
    if not fornitore:
        raise HTTPException(status_code=404, detail="Fornitore non trovato")
    
    # Usa dict() per compatibilità con Pydantic v1 e v2
    tipo_data = tipo.dict() if hasattr(tipo, 'dict') else tipo.model_dump()
    db_tipo = FornitoreTipo(**tipo_data)
    db.add(db_tipo)
    db.flush()
    apply_default_categoria_to_fatture(db, db_tipo.fornitore_id, db_tipo.categoria, db_tipo.macrocategoria)
    db.commit()
    db.refresh(db_tipo)
    return db_tipo


@router.put("/fornitori-tipi/{tipo_id}", response_model=FornitoreTipoResponse)
async def update_fornitore_tipo(
    tipo_id: int,
    update: FornitoreTipoUpdate,
    db: Session = Depends(get_db)
):
    """Update a fornitore tipo"""
    db_tipo = db.query(FornitoreTipo).filter(FornitoreTipo.id == tipo_id).first()
    if not db_tipo:
        raise HTTPException(status_code=404, detail="Fornitore tipo non trovato")
    
    # Usa dict() per compatibilità con Pydantic v1 e v2
    update_data = update.dict(exclude_unset=True) if hasattr(update, 'dict') else update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_tipo, field, value)
    
    db.flush()
    # Propaga categoria e macrocategoria alle fatture se sono state aggiornate
    if "categoria" in update_data or "macrocategoria" in update_data:
        apply_default_categoria_to_fatture(db, db_tipo.fornitore_id, db_tipo.categoria, db_tipo.macrocategoria)
    db.commit()
    db.refresh(db_tipo)
    return db_tipo


@router.delete("/fornitori-tipi/{tipo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fornitore_tipo(tipo_id: int, db: Session = Depends(get_db)):
    """Delete a fornitore tipo"""
    db_tipo = db.query(FornitoreTipo).filter(FornitoreTipo.id == tipo_id).first()
    if not db_tipo:
        raise HTTPException(status_code=404, detail="Fornitore tipo non trovato")
    
    db.delete(db_tipo)
    db.commit()
    return None

