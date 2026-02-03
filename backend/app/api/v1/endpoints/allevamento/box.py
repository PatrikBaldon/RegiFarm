"""
Box endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.models.allevamento import Box, Stabilimento, Animale
from app.schemas.allevamento.box import BoxCreate, BoxUpdate, BoxResponse

router = APIRouter()

@router.get("/box", response_model=List[BoxResponse])
async def get_box(
    stabilimento_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all box"""
    query = db.query(Box).filter(Box.deleted_at.is_(None))
    if stabilimento_id is not None:
        query = query.filter(Box.stabilimento_id == stabilimento_id)
    return query.offset(skip).limit(limit).all()


@router.get("/box/{box_id}", response_model=BoxResponse)
async def get_box_detail(box_id: int, db: Session = Depends(get_db)):
    """Get a specific box"""
    box = db.query(Box).filter(
        Box.id == box_id,
        Box.deleted_at.is_(None)
    ).first()
    if not box:
        raise HTTPException(status_code=404, detail="Box not found")
    return box


@router.post("/box", response_model=BoxResponse, status_code=status.HTTP_201_CREATED)
async def create_box(box: BoxCreate, db: Session = Depends(get_db)):
    """Create a new box"""
    db_box = Box(**box.dict())
    db.add(db_box)
    db.commit()
    db.refresh(db_box)
    return db_box


@router.put("/box/{box_id}", response_model=BoxResponse)
async def update_box(
    box_id: int,
    box: BoxUpdate,
    db: Session = Depends(get_db)
):
    """Update a box"""
    db_box = db.query(Box).filter(
        Box.id == box_id,
        Box.deleted_at.is_(None)
    ).first()
    if not db_box:
        raise HTTPException(status_code=404, detail="Box not found")
    
    update_data = box.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_box, field, value)
    
    db.commit()
    db.refresh(db_box)
    return db_box


@router.delete("/box/{box_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_box(box_id: int, db: Session = Depends(get_db)):
    """Soft delete a box"""
    db_box = db.query(Box).filter(
        Box.id == box_id,
        Box.deleted_at.is_(None)
    ).first()
    if not db_box:
        raise HTTPException(status_code=404, detail="Box not found")
    
    db_box.deleted_at = datetime.utcnow()
    db.commit()
    return None


