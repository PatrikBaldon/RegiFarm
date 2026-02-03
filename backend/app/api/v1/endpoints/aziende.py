"""
API endpoints for Aziende
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.allevamento import Azienda
from app.schemas.allevamento import (
    AziendaCreate,
    AziendaUpdate,
    AziendaResponse,
)

router = APIRouter(prefix="/aziende", tags=["aziende"])


# Endpoints
@router.get("", response_model=List[AziendaResponse])
async def get_aziende(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all aziende"""
    from sqlalchemy.orm import joinedload
    return (
        db.query(Azienda)
        .options(joinedload(Azienda.veterinario))
        .filter(Azienda.deleted_at.is_(None))
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{azienda_id}", response_model=AziendaResponse)
async def get_azienda(azienda_id: int, db: Session = Depends(get_db)):
    """Get a specific azienda"""
    from sqlalchemy.orm import joinedload

    azienda = (
        db.query(Azienda)
        .options(joinedload(Azienda.veterinario))
        .filter(
            Azienda.id == azienda_id,
            Azienda.deleted_at.is_(None),
        )
        .first()
    )
    if not azienda:
        raise HTTPException(status_code=404, detail="Azienda not found")
    return azienda


@router.post("", response_model=AziendaResponse, status_code=status.HTTP_201_CREATED)
async def create_azienda(azienda: AziendaCreate, db: Session = Depends(get_db)):
    """Create a new azienda"""
    # Check if codice_fiscale already exists
    existing = (
        db.query(Azienda)
        .filter(
            Azienda.codice_fiscale == azienda.codice_fiscale,
            Azienda.deleted_at.is_(None),
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Codice fiscale già esistente")

    from sqlalchemy.orm import joinedload

    db_azienda = Azienda(**azienda.model_dump())
    db.add(db_azienda)
    db.commit()
    db.refresh(db_azienda)
    # Ricarica con la relazione veterinario
    db_azienda = (
        db.query(Azienda)
        .options(joinedload(Azienda.veterinario))
        .filter(Azienda.id == db_azienda.id)
        .first()
    )
    return db_azienda


@router.put("/{azienda_id}", response_model=AziendaResponse)
async def update_azienda(azienda_id: int, azienda: AziendaUpdate, db: Session = Depends(get_db)):
    """Update an azienda"""
    db_azienda = (
        db.query(Azienda)
        .filter(
            Azienda.id == azienda_id,
            Azienda.deleted_at.is_(None),
        )
        .first()
    )
    if not db_azienda:
        raise HTTPException(status_code=404, detail="Azienda not found")

    from sqlalchemy.orm import joinedload

    update_data = azienda.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_azienda, field, value)

    db.commit()
    db.refresh(db_azienda)
    # Ricarica con la relazione veterinario
    db_azienda = (
        db.query(Azienda)
        .options(joinedload(Azienda.veterinario))
        .filter(Azienda.id == db_azienda.id)
        .first()
    )
    return db_azienda


@router.delete("/{azienda_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_azienda(azienda_id: int, db: Session = Depends(get_db)):
    """Soft delete an azienda"""
    db_azienda = (
        db.query(Azienda)
        .filter(
            Azienda.id == azienda_id,
            Azienda.deleted_at.is_(None),
        )
        .first()
    )
    if not db_azienda:
        raise HTTPException(status_code=404, detail="Azienda not found")

    from datetime import datetime

    db_azienda.deleted_at = datetime.utcnow()
    db.commit()
    return None

