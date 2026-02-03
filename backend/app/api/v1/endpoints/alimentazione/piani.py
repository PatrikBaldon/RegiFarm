"""Piani Alimentazione endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.models.alimentazione.piano_alimentazione import PianoAlimentazione as PianoAlimentazioneModel
from app.models.alimentazione.composizione_piano import ComposizionePiano as ComposizionePianoModel
from app.schemas.alimentazione import (
    PianoAlimentazioneCreate, PianoAlimentazioneUpdate, PianoAlimentazioneResponse,
    ComposizionePianoCreate, ComposizionePianoUpdate, ComposizionePianoResponse
)

router = APIRouter()

@router.get("/piani-alimentazione", response_model=List[PianoAlimentazioneResponse])
def list_piani_alimentazione(
	skip: int = 0,
	limit: int = 100,
	azienda_id: Optional[int] = None,
	db: Session = Depends(get_db)
):
	"""Get all piani alimentazione with optional filters"""
	query = db.query(PianoAlimentazioneModel).filter(PianoAlimentazioneModel.deleted_at.is_(None))
	
	if azienda_id is not None:
		query = query.filter(PianoAlimentazioneModel.azienda_id == azienda_id)
	
	return query.order_by(PianoAlimentazioneModel.nome).offset(skip).limit(limit).all()

@router.get("/piani-alimentazione/{piano_id}", response_model=PianoAlimentazioneResponse)
def get_piano_alimentazione(piano_id: int, db: Session = Depends(get_db)):
	obj = db.query(PianoAlimentazioneModel).filter(
		PianoAlimentazioneModel.id == piano_id,
		PianoAlimentazioneModel.deleted_at.is_(None)
	).first()
	if not obj:
		raise HTTPException(status_code=404, detail="Piano alimentazione non trovato")
	return obj

@router.post("/piani-alimentazione", response_model=PianoAlimentazioneResponse, status_code=status.HTTP_201_CREATED)
def create_piano_alimentazione(data: PianoAlimentazioneCreate, db: Session = Depends(get_db)):
	# azienda_id è obbligatorio e deve essere passato dal frontend
	# Usa dict() per compatibilità con Pydantic v1 e v2
	payload = data.dict() if hasattr(data, 'dict') else data.model_dump()
	db_obj = PianoAlimentazioneModel(**payload)
	db.add(db_obj)
	db.commit()
	db.refresh(db_obj)
	return db_obj

@router.put("/piani-alimentazione/{piano_id}", response_model=PianoAlimentazioneResponse)
def update_piano_alimentazione(piano_id: int, update: PianoAlimentazioneUpdate, db: Session = Depends(get_db)):
	obj = db.query(PianoAlimentazioneModel).filter(
		PianoAlimentazioneModel.id == piano_id,
		PianoAlimentazioneModel.deleted_at.is_(None)
	).first()
	if not obj:
		raise HTTPException(status_code=404, detail="Piano alimentazione non trovato")
	# Usa dict() per compatibilità con Pydantic v1 e v2
	update_data = update.dict(exclude_unset=True) if hasattr(update, 'dict') else update.model_dump(exclude_unset=True)
	for field, value in update_data.items():
		setattr(obj, field, value)
	db.commit()
	db.refresh(obj)
	return obj

@router.delete("/piani-alimentazione/{piano_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_piano_alimentazione(piano_id: int, db: Session = Depends(get_db)):
	"""Soft delete piano alimentazione"""
	obj = db.query(PianoAlimentazioneModel).filter(
		PianoAlimentazioneModel.id == piano_id,
		PianoAlimentazioneModel.deleted_at.is_(None)
	).first()
	if not obj:
		raise HTTPException(status_code=404, detail="Piano alimentazione non trovato")
	obj.deleted_at = datetime.utcnow()
	db.commit()
	return None

# --- COMPOSIZIONE PIANO CRUD ---
@router.get("/composizioni-piano", response_model=List[ComposizionePianoResponse])
def list_composizioni_piano(
	skip: int = 0,
	limit: int = 100,
	piano_alimentazione_id: Optional[int] = None,
	db: Session = Depends(get_db)
):
	"""Get all composizioni piano with optional filters"""
	query = db.query(ComposizionePianoModel).filter(ComposizionePianoModel.deleted_at.is_(None))
	
	if piano_alimentazione_id is not None:
		query = query.filter(ComposizionePianoModel.piano_alimentazione_id == piano_alimentazione_id)
	
	return query.order_by(ComposizionePianoModel.ordine, ComposizionePianoModel.id).offset(skip).limit(limit).all()

@router.get("/composizioni-piano/{comp_id}", response_model=ComposizionePianoResponse)
def get_composizione_piano(comp_id: int, db: Session = Depends(get_db)):
	obj = db.query(ComposizionePianoModel).filter(
		ComposizionePianoModel.id == comp_id,
		ComposizionePianoModel.deleted_at.is_(None)
	).first()
	if not obj:
		raise HTTPException(status_code=404, detail="Composizione piano non trovata")
	return obj

@router.post("/composizioni-piano", response_model=ComposizionePianoResponse, status_code=status.HTTP_201_CREATED)
def create_composizione_piano(data: ComposizionePianoCreate, db: Session = Depends(get_db)):
	# Verifica che il piano esista e non sia eliminato
	piano = db.query(PianoAlimentazioneModel).filter(
		PianoAlimentazioneModel.id == data.piano_alimentazione_id,
		PianoAlimentazioneModel.deleted_at.is_(None)
	).first()
	if not piano:
		raise HTTPException(status_code=404, detail="Piano alimentazione non trovato")
	
	# Usa dict() per compatibilità con Pydantic v1 e v2
	payload = data.dict() if hasattr(data, 'dict') else data.model_dump()
	db_obj = ComposizionePianoModel(**payload)
	db.add(db_obj)
	db.commit()
	db.refresh(db_obj)
	return db_obj

@router.put("/composizioni-piano/{comp_id}", response_model=ComposizionePianoResponse)
def update_composizione_piano(comp_id: int, update: ComposizionePianoUpdate, db: Session = Depends(get_db)):
	obj = db.query(ComposizionePianoModel).filter(
		ComposizionePianoModel.id == comp_id,
		ComposizionePianoModel.deleted_at.is_(None)
	).first()
	if not obj:
		raise HTTPException(status_code=404, detail="Composizione piano non trovata")
	# Usa dict() per compatibilità con Pydantic v1 e v2
	update_data = update.dict(exclude_unset=True) if hasattr(update, 'dict') else update.model_dump(exclude_unset=True)
	for field, value in update_data.items():
		setattr(obj, field, value)
	db.commit()
	db.refresh(obj)
	return obj

@router.delete("/composizioni-piano/{comp_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_composizione_piano(comp_id: int, db: Session = Depends(get_db)):
	"""Soft delete composizione piano"""
	obj = db.query(ComposizionePianoModel).filter(
		ComposizionePianoModel.id == comp_id,
		ComposizionePianoModel.deleted_at.is_(None)
	).first()
	if not obj:
		raise HTTPException(status_code=404, detail="Composizione piano non trovata")
	obj.deleted_at = datetime.utcnow()
	db.commit()
	return None

