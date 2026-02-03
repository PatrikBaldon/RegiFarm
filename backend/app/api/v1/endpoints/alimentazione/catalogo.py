"""Catalogo (Componenti e Mangimi) endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.models.alimentazione.componente_alimentare import ComponenteAlimentare as ComponenteAlimentareModel
from app.models.alimentazione.mangime_confezionato import MangimeConfezionato as MangimeConfezionatoModel
from app.schemas.alimentazione import (
    ComponenteAlimentareCreate, ComponenteAlimentareUpdate, ComponenteAlimentareResponse,
    MangimeConfezionatoCreate, MangimeConfezionatoUpdate, MangimeConfezionatoResponse
)

router = APIRouter()

@router.get("/componenti-alimentari", response_model=List[ComponenteAlimentareResponse])
def list_componenti_alimentari(
	skip: int = 0,
	limit: Optional[int] = None,
	azienda_id: Optional[int] = None,
	db: Session = Depends(get_db)
):
	"""Get all componenti alimentari with optional filters"""
	query = db.query(ComponenteAlimentareModel).filter(ComponenteAlimentareModel.deleted_at.is_(None))
	
	if azienda_id is not None:
		query = query.filter(ComponenteAlimentareModel.azienda_id == azienda_id)
	
	query = query.order_by(ComponenteAlimentareModel.nome).offset(skip)
	if limit is not None:
		query = query.limit(limit)
	return query.all()

@router.get("/componenti-alimentari/{comp_id}", response_model=ComponenteAlimentareResponse)
def get_componente_alimentare(comp_id: int, db: Session = Depends(get_db)):
	obj = db.query(ComponenteAlimentareModel).filter(
		ComponenteAlimentareModel.id == comp_id,
		ComponenteAlimentareModel.deleted_at.is_(None)
	).first()
	if not obj:
		raise HTTPException(status_code=404, detail="Componente alimentare non trovato")
	return obj

@router.post("/componenti-alimentari", response_model=ComponenteAlimentareResponse, status_code=status.HTTP_201_CREATED)
def create_componente_alimentare(data: ComponenteAlimentareCreate, db: Session = Depends(get_db)):
	# azienda_id è obbligatorio e deve essere passato dal frontend
	# Usa dict() per compatibilità con Pydantic v1 e v2
	payload = data.dict() if hasattr(data, 'dict') else data.model_dump()
	db_obj = ComponenteAlimentareModel(**payload)
	db.add(db_obj)
	db.commit()
	db.refresh(db_obj)
	return db_obj

@router.put("/componenti-alimentari/{comp_id}", response_model=ComponenteAlimentareResponse)
def update_componente_alimentare(comp_id: int, update: ComponenteAlimentareUpdate, db: Session = Depends(get_db)):
	obj = db.query(ComponenteAlimentareModel).filter(
		ComponenteAlimentareModel.id == comp_id,
		ComponenteAlimentareModel.deleted_at.is_(None)
	).first()
	if not obj:
		raise HTTPException(status_code=404, detail="Componente alimentare non trovato")
	# Usa dict() per compatibilità con Pydantic v1 e v2
	update_data = update.dict(exclude_unset=True) if hasattr(update, 'dict') else update.model_dump(exclude_unset=True)
	for field, value in update_data.items():
		setattr(obj, field, value)
	db.commit()
	db.refresh(obj)
	return obj

@router.delete("/componenti-alimentari/{comp_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_componente_alimentare(comp_id: int, db: Session = Depends(get_db)):
	"""Soft delete componente alimentare"""
	obj = db.query(ComponenteAlimentareModel).filter(
		ComponenteAlimentareModel.id == comp_id,
		ComponenteAlimentareModel.deleted_at.is_(None)
	).first()
	if not obj:
		raise HTTPException(status_code=404, detail="Componente alimentare non trovato")
	obj.deleted_at = datetime.utcnow()
	db.commit()
	return None

# --- MANGIMI CONFEZIONATI CRUD ---
@router.get("/mangimi-confezionati", response_model=List[MangimeConfezionatoResponse])
def list_mangimi_confezionati(
	skip: int = 0,
	limit: Optional[int] = None,
	azienda_id: Optional[int] = None,
	db: Session = Depends(get_db)
):
	"""Get all mangimi confezionati with optional filters"""
	query = db.query(MangimeConfezionatoModel).filter(MangimeConfezionatoModel.deleted_at.is_(None))
	
	if azienda_id is not None:
		query = query.filter(MangimeConfezionatoModel.azienda_id == azienda_id)
	
	query = query.order_by(MangimeConfezionatoModel.nome).offset(skip)
	if limit is not None:
		query = query.limit(limit)
	return query.all()

@router.get("/mangimi-confezionati/{mangime_id}", response_model=MangimeConfezionatoResponse)
def get_mangime_confezionato(mangime_id: int, db: Session = Depends(get_db)):
	obj = db.query(MangimeConfezionatoModel).filter(
		MangimeConfezionatoModel.id == mangime_id,
		MangimeConfezionatoModel.deleted_at.is_(None)
	).first()
	if not obj:
		raise HTTPException(status_code=404, detail="Mangime confezionato non trovato")
	return obj

@router.post("/mangimi-confezionati", response_model=MangimeConfezionatoResponse, status_code=status.HTTP_201_CREATED)
def create_mangime_confezionato(data: MangimeConfezionatoCreate, db: Session = Depends(get_db)):
	# azienda_id è obbligatorio e deve essere passato dal frontend
	# Usa dict() per compatibilità con Pydantic v1 e v2
	payload = data.dict() if hasattr(data, 'dict') else data.model_dump()
	db_obj = MangimeConfezionatoModel(**payload)
	db.add(db_obj)
	db.commit()
	db.refresh(db_obj)
	return db_obj

@router.put("/mangimi-confezionati/{mangime_id}", response_model=MangimeConfezionatoResponse)
def update_mangime_confezionato(mangime_id: int, update: MangimeConfezionatoUpdate, db: Session = Depends(get_db)):
	obj = db.query(MangimeConfezionatoModel).filter(
		MangimeConfezionatoModel.id == mangime_id,
		MangimeConfezionatoModel.deleted_at.is_(None)
	).first()
	if not obj:
		raise HTTPException(status_code=404, detail="Mangime confezionato non trovato")
	# Usa dict() per compatibilità con Pydantic v1 e v2
	update_data = update.dict(exclude_unset=True) if hasattr(update, 'dict') else update.model_dump(exclude_unset=True)
	for field, value in update_data.items():
		setattr(obj, field, value)
	db.commit()
	db.refresh(obj)
	return obj

@router.delete("/mangimi-confezionati/{mangime_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mangime_confezionato(mangime_id: int, db: Session = Depends(get_db)):
	"""Soft delete mangime confezionato"""
	obj = db.query(MangimeConfezionatoModel).filter(
		MangimeConfezionatoModel.id == mangime_id,
		MangimeConfezionatoModel.deleted_at.is_(None)
	).first()
	if not obj:
		raise HTTPException(status_code=404, detail="Mangime confezionato non trovato")
	obj.deleted_at = datetime.utcnow()
	db.commit()
	return None

