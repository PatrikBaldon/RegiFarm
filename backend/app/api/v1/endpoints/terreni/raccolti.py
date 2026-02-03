"""Raccolti Terreno endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.core.database import get_db
from app.models.terreni.terreno import Terreno as TerrenoModel
from app.models.terreni.raccolto import RaccoltoTerreno as RaccoltoTerrenoModel
from app.schemas.terreni import RaccoltoTerrenoCreate, RaccoltoTerrenoUpdate, RaccoltoTerrenoResponse

router = APIRouter()

@router.post("/raccolti", response_model=RaccoltoTerrenoResponse, status_code=status.HTTP_201_CREATED)
def create_raccolto(data: RaccoltoTerrenoCreate, db: Session = Depends(get_db)):
    terreno = db.query(TerrenoModel).filter(TerrenoModel.id == data.terreno_id).first()
    if not terreno:
        raise HTTPException(status_code=404, detail="Terreno non trovato")
    payload = data.dict(exclude={"azienda_id"})
    obj = RaccoltoTerrenoModel(azienda_id=terreno.azienda_id, **payload)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

@router.put("/raccolti/{rac_id}", response_model=RaccoltoTerrenoResponse)
def update_raccolto(rac_id: int, update: RaccoltoTerrenoUpdate, db: Session = Depends(get_db)):
    obj = db.query(RaccoltoTerrenoModel).filter(RaccoltoTerrenoModel.id == rac_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Raccolto non trovato")
    update_data = update.dict(exclude_unset=True)
    if "azienda_id" in update_data:
        update_data.pop("azienda_id")
    if "terreno_id" in update_data and update_data["terreno_id"] is not None:
        terreno = db.query(TerrenoModel).filter(TerrenoModel.id == update_data["terreno_id"]).first()
        if not terreno:
            raise HTTPException(status_code=404, detail="Terreno non trovato")
        obj.azienda_id = terreno.azienda_id
    for k, v in update_data.items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj

@router.delete("/raccolti/{rac_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_raccolto(rac_id: int, db: Session = Depends(get_db)):
    obj = db.query(RaccoltoTerrenoModel).filter(RaccoltoTerrenoModel.id == rac_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Raccolto non trovato")
    db.delete(obj)
    db.commit()
    return None