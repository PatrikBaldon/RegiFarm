"""
Stabilimenti endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.models.allevamento import Stabilimento, Sede, Box
from app.schemas.allevamento.stabilimento import StabilimentoCreate, StabilimentoUpdate, StabilimentoResponse

router = APIRouter()

@router.get("/stabilimenti", response_model=List[StabilimentoResponse])
async def get_stabilimenti(
    sede_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all stabilimenti"""
    query = db.query(Stabilimento).filter(Stabilimento.deleted_at.is_(None))
    if sede_id is not None:
        query = query.filter(Stabilimento.sede_id == sede_id)
    return query.offset(skip).limit(limit).all()


@router.get("/stabilimenti/{stabilimento_id}", response_model=StabilimentoResponse)
async def get_stabilimento(stabilimento_id: int, db: Session = Depends(get_db)):
    """Get a specific stabilimento"""
    stabilimento = db.query(Stabilimento).filter(
        Stabilimento.id == stabilimento_id,
        Stabilimento.deleted_at.is_(None)
    ).first()
    if not stabilimento:
        raise HTTPException(status_code=404, detail="Stabilimento not found")
    return stabilimento


@router.post("/stabilimenti", response_model=StabilimentoResponse, status_code=status.HTTP_201_CREATED)
async def create_stabilimento(stabilimento: StabilimentoCreate, db: Session = Depends(get_db)):
    """Create a new stabilimento"""
    db_stabilimento = Stabilimento(**stabilimento.dict())
    db.add(db_stabilimento)
    db.commit()
    db.refresh(db_stabilimento)
    return db_stabilimento


@router.put("/stabilimenti/{stabilimento_id}", response_model=StabilimentoResponse)
async def update_stabilimento(
    stabilimento_id: int,
    stabilimento: StabilimentoUpdate,
    db: Session = Depends(get_db)
):
    """Update a stabilimento"""
    db_stabilimento = db.query(Stabilimento).filter(
        Stabilimento.id == stabilimento_id,
        Stabilimento.deleted_at.is_(None)
    ).first()
    if not db_stabilimento:
        raise HTTPException(status_code=404, detail="Stabilimento not found")
    
    update_data = stabilimento.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_stabilimento, field, value)
    
    db.commit()
    db.refresh(db_stabilimento)
    return db_stabilimento


@router.delete("/stabilimenti/{stabilimento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stabilimento(stabilimento_id: int, db: Session = Depends(get_db)):
    """Soft delete a stabilimento"""
    db_stabilimento = db.query(Stabilimento).filter(
        Stabilimento.id == stabilimento_id,
        Stabilimento.deleted_at.is_(None)
    ).first()
    if not db_stabilimento:
        raise HTTPException(status_code=404, detail="Stabilimento not found")
    
    db_stabilimento.deleted_at = datetime.utcnow()
    db.commit()
    return None


