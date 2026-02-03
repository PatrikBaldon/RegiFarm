"""
Assicurazioni Aziendali endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.models.amministrazione import AssicurazioneAziendale
from app.models.allevamento.azienda import Azienda
from app.schemas.amministrazione import (
    AssicurazioneAziendaleCreate,
    AssicurazioneAziendaleResponse,
    AssicurazioneAziendaleUpdate,
)

router = APIRouter()


@router.get("/assicurazioni-aziendali", response_model=List[AssicurazioneAziendaleResponse])
async def get_assicurazioni_aziendali(
    azienda_id: int = Query(..., description="ID azienda"),
    tipo: Optional[str] = None,
    attiva: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all assicurazioni aziendali con filtri"""
    query = db.query(AssicurazioneAziendale).filter(
        AssicurazioneAziendale.azienda_id == azienda_id,
        AssicurazioneAziendale.deleted_at.is_(None)
    )
    
    if tipo:
        query = query.filter(AssicurazioneAziendale.tipo == tipo)
    if attiva is not None:
        query = query.filter(AssicurazioneAziendale.attiva == attiva)
    
    return query.order_by(AssicurazioneAziendale.data_scadenza).offset(skip).limit(limit).all()


@router.get("/assicurazioni-aziendali/{assicurazione_id}", response_model=AssicurazioneAziendaleResponse)
async def get_assicurazione_aziendale(assicurazione_id: int, db: Session = Depends(get_db)):
    """Get a specific assicurazione aziendale"""
    assicurazione = db.query(AssicurazioneAziendale).filter(
        AssicurazioneAziendale.id == assicurazione_id,
        AssicurazioneAziendale.deleted_at.is_(None)
    ).first()
    if not assicurazione:
        raise HTTPException(status_code=404, detail="Assicurazione aziendale non trovata")
    return assicurazione


@router.post("/assicurazioni-aziendali", response_model=AssicurazioneAziendaleResponse, status_code=status.HTTP_201_CREATED)
async def create_assicurazione_aziendale(
    assicurazione: AssicurazioneAziendaleCreate,
    db: Session = Depends(get_db)
):
    """Create a new assicurazione aziendale"""
    azienda = db.query(Azienda).filter(Azienda.id == assicurazione.azienda_id).first()
    if not azienda:
        raise HTTPException(status_code=404, detail="Azienda non trovata")
    
    db_assicurazione = AssicurazioneAziendale(**assicurazione.dict())
    db.add(db_assicurazione)
    db.commit()
    db.refresh(db_assicurazione)
    return db_assicurazione


@router.put("/assicurazioni-aziendali/{assicurazione_id}", response_model=AssicurazioneAziendaleResponse)
async def update_assicurazione_aziendale(
    assicurazione_id: int,
    update: AssicurazioneAziendaleUpdate,
    db: Session = Depends(get_db)
):
    """Update an assicurazione aziendale"""
    db_assicurazione = db.query(AssicurazioneAziendale).filter(
        AssicurazioneAziendale.id == assicurazione_id,
        AssicurazioneAziendale.deleted_at.is_(None)
    ).first()
    if not db_assicurazione:
        raise HTTPException(status_code=404, detail="Assicurazione aziendale non trovata")
    
    for key, value in update.dict(exclude_unset=True).items():
        setattr(db_assicurazione, key, value)
    
    db.commit()
    db.refresh(db_assicurazione)
    return db_assicurazione


@router.delete("/assicurazioni-aziendali/{assicurazione_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assicurazione_aziendale(assicurazione_id: int, db: Session = Depends(get_db)):
    """Soft delete an assicurazione aziendale"""
    db_assicurazione = db.query(AssicurazioneAziendale).filter(
        AssicurazioneAziendale.id == assicurazione_id,
        AssicurazioneAziendale.deleted_at.is_(None)
    ).first()
    if not db_assicurazione:
        raise HTTPException(status_code=404, detail="Assicurazione aziendale non trovata")
    
    db_assicurazione.deleted_at = datetime.utcnow()
    db.commit()
    return None

