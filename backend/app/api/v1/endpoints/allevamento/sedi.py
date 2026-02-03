"""
Sedi endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.models.allevamento import Sede, Stabilimento, Box
from app.schemas.allevamento.sede import SedeCreate, SedeUpdate, SedeResponse

router = APIRouter()

@router.get("/sedi", response_model=List[SedeResponse])
async def get_sedi(
    azienda_id: Optional[int] = None,
    include_stabilimenti: bool = False,
    include_box: bool = False,
    skip: int = 0,
    limit: Optional[int] = Query(None, description="Limit results. If not specified, returns all results."),
    db: Session = Depends(get_db)
):
    """
    Get all sedi with optional nested loading.
    
    Args:
        include_stabilimenti: If True, loads stabilimenti for each sede
        include_box: If True, loads box for each stabilimento (requires include_stabilimenti=True)
        limit: Optional limit. If not specified, returns all results.
    """
    from sqlalchemy.orm import selectinload
    
    query = db.query(Sede).filter(Sede.deleted_at.is_(None))
    
    if azienda_id is not None:
        query = query.filter(Sede.azienda_id == azienda_id)
    
    # Carica stabilimenti se richiesto
    if include_stabilimenti or include_box:
        query = query.options(selectinload(Sede.stabilimenti))
        
        # Carica box se richiesto
        if include_box:
            from app.models.allevamento.stabilimento import Stabilimento
            query = query.options(
                selectinload(Sede.stabilimenti).selectinload(Stabilimento.box)
            )
    
    query = query.offset(skip)
    if limit is not None:
        query = query.limit(limit)
    
    return query.all()


@router.get("/sedi/count")
async def get_sedi_count(
    azienda_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Get count of sedi - optimized endpoint for quick statistics.
    Much faster than loading all sedi data.
    """
    from sqlalchemy import func
    
    query = db.query(func.count(Sede.id)).filter(Sede.deleted_at.is_(None))
    
    if azienda_id is not None:
        query = query.filter(Sede.azienda_id == azienda_id)
    
    count = query.scalar() or 0
    return {"count": count}


@router.get("/codici-stalla-gestiti")
async def get_codici_stalla_gestiti(
    azienda_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Ottiene tutti i codici stalla gestiti (presenti nella tabella sedi).
    Questo endpoint permette al frontend di riconoscere dinamicamente quali codici stalla sono gestiti.
    """
    from app.services.allevamento.codici_stalla_service import (
        get_codici_stalla_gestiti,
        get_sedi_info,
        get_codice_stalla_default_ingresso,
        get_codice_stalla_default_uscita
    )
    
    codici_gestiti = get_codici_stalla_gestiti(db, azienda_id)
    sedi_info = get_sedi_info(db, azienda_id)
    codice_default_ingresso = get_codice_stalla_default_ingresso(db, azienda_id)
    codice_default_uscita = get_codice_stalla_default_uscita(db, azienda_id)
    
    return {
        'codici_stalla': sorted(list(codici_gestiti)),
        'sedi': sedi_info,
        'codice_default_ingresso': codice_default_ingresso,
        'codice_default_uscita': codice_default_uscita,
        'numero_sedi': len(sedi_info)
    }


@router.get("/sedi/{sede_id}", response_model=SedeResponse)
async def get_sede(sede_id: int, db: Session = Depends(get_db)):
    """Get a specific sede"""
    sede = db.query(Sede).filter(
        Sede.id == sede_id,
        Sede.deleted_at.is_(None)
    ).first()
    if not sede:
        raise HTTPException(status_code=404, detail="Sede not found")
    return sede


@router.post("/sedi", response_model=SedeResponse, status_code=status.HTTP_201_CREATED)
async def create_sede(sede: SedeCreate, db: Session = Depends(get_db)):
    """Create a new sede"""
    db_sede = Sede(**sede.dict())
    db.add(db_sede)
    db.commit()
    db.refresh(db_sede)
    return db_sede


@router.put("/sedi/{sede_id}", response_model=SedeResponse)
async def update_sede(
    sede_id: int,
    sede: SedeUpdate,
    db: Session = Depends(get_db)
):
    """Update a sede"""
    db_sede = db.query(Sede).filter(
        Sede.id == sede_id,
        Sede.deleted_at.is_(None)
    ).first()
    if not db_sede:
        raise HTTPException(status_code=404, detail="Sede not found")
    
    update_data = sede.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_sede, field, value)
    
    db.commit()
    db.refresh(db_sede)
    return db_sede


@router.delete("/sedi/{sede_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sede(sede_id: int, db: Session = Depends(get_db)):
    """Soft delete a sede"""
    db_sede = db.query(Sede).filter(
        Sede.id == sede_id,
        Sede.deleted_at.is_(None)
    ).first()
    if not db_sede:
        raise HTTPException(status_code=404, detail="Sede not found")
    
    db_sede.deleted_at = datetime.utcnow()
    db.commit()
    return None


