"""Lavorazioni Terreno endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.core.database import get_db
from app.models.terreni.lavorazione import LavorazioneTerreno as LavorazioneTerrenoModel
from app.schemas.terreni import LavorazioneTerrenoCreate, LavorazioneTerrenoUpdate, LavorazioneTerrenoResponse

router = APIRouter()

@router.post("/lavorazioni", response_model=LavorazioneTerrenoResponse, status_code=status.HTTP_201_CREATED)
def create_lavorazione(data: LavorazioneTerrenoCreate, db: Session = Depends(get_db)):
    terreno = db.query(TerrenoModel).filter(TerrenoModel.id == data.terreno_id).first()
    if not terreno:
        raise HTTPException(status_code=404, detail="Terreno non trovato")
    payload = data.dict(exclude={"azienda_id"})
    obj = LavorazioneModel(azienda_id=terreno.azienda_id, **payload)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

@router.put("/lavorazioni/{lav_id}", response_model=LavorazioneTerrenoResponse)
def update_lavorazione(lav_id: int, update: LavorazioneTerrenoUpdate, db: Session = Depends(get_db)):
    obj = db.query(LavorazioneModel).filter(LavorazioneModel.id == lav_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Lavorazione non trovata")
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

@router.delete("/lavorazioni/{lav_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lavorazione(lav_id: int, db: Session = Depends(get_db)):
    obj = db.query(LavorazioneModel).filter(LavorazioneModel.id == lav_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Lavorazione non trovata")
    db.delete(obj)
    db.commit()
    return None

