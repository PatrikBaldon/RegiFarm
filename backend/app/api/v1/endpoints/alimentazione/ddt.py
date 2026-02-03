"""DDT endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date

from app.core.database import get_db
from app.models.alimentazione.ddt import Ddt as DdtModel
from app.models.alimentazione.ddt_riga import DdtRiga as DdtRigaModel
from app.schemas.alimentazione import (
    DdtCreate, DdtUpdate, DdtResponse,
    DdtRigaCreate, DdtRigaUpdate, DdtRigaResponse,
)

router = APIRouter()

@router.get("/ddt", response_model=List[DdtResponse])
def list_ddt(
    skip: int = 0,
    limit: int = 100,
    azienda_id: Optional[int] = None,
    fornitore_id: Optional[int] = None,
    data_da: Optional[date] = None,
    data_a: Optional[date] = None,
    db: Session = Depends(get_db)
):
	"""Get all DDT with optional filters"""
	query = db.query(DdtModel).filter(DdtModel.deleted_at.is_(None))
	
	if azienda_id is not None:
		query = query.filter(DdtModel.azienda_id == azienda_id)
	if fornitore_id is not None:
		query = query.filter(DdtModel.fornitore_id == fornitore_id)
	if data_da is not None:
		query = query.filter(DdtModel.data >= data_da)
	if data_a is not None:
		query = query.filter(DdtModel.data <= data_a)
	
	return query.order_by(DdtModel.data.desc(), DdtModel.id.desc()).offset(skip).limit(limit).all()

@router.get("/ddt/{ddt_id}", response_model=DdtResponse)
def get_ddt(ddt_id: int, db: Session = Depends(get_db)):
	obj = db.query(DdtModel).filter(
		DdtModel.id == ddt_id,
		DdtModel.deleted_at.is_(None)
	).first()
	if not obj:
		raise HTTPException(status_code=404, detail="DDT non trovato")
	return obj

@router.post("/ddt", response_model=DdtResponse, status_code=status.HTTP_201_CREATED)
def create_ddt(data: DdtCreate, db: Session = Depends(get_db)):
	# azienda_id è obbligatorio e deve essere passato dal frontend
	# Usa dict() per compatibilità con Pydantic v1 e v2
	payload = data.dict() if hasattr(data, 'dict') else data.model_dump()
	db_obj = DdtModel(**payload)
	db.add(db_obj)
	db.commit()
	db.refresh(db_obj)
	return db_obj

@router.put("/ddt/{ddt_id}", response_model=DdtResponse)
def update_ddt(ddt_id: int, update: DdtUpdate, db: Session = Depends(get_db)):
	obj = db.query(DdtModel).filter(
		DdtModel.id == ddt_id,
		DdtModel.deleted_at.is_(None)
	).first()
	if not obj:
		raise HTTPException(status_code=404, detail="DDT non trovato")
	# Usa dict() per compatibilità con Pydantic v1 e v2
	update_data = update.dict(exclude_unset=True) if hasattr(update, 'dict') else update.model_dump(exclude_unset=True)
	for field, value in update_data.items():
		setattr(obj, field, value)
	db.commit()
	db.refresh(obj)
	return obj

@router.delete("/ddt/{ddt_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ddt(ddt_id: int, db: Session = Depends(get_db)):
	"""Soft delete DDT"""
	obj = db.query(DdtModel).filter(
		DdtModel.id == ddt_id,
		DdtModel.deleted_at.is_(None)
	).first()
	if not obj:
		raise HTTPException(status_code=404, detail="DDT non trovato")
	obj.deleted_at = datetime.utcnow()
	db.commit()
	return None

# --- DDT RIGHE CRUD ---
@router.get("/ddt/{ddt_id}/righe", response_model=List[DdtRigaResponse])
def list_ddt_righe(ddt_id: int, db: Session = Depends(get_db)):
	"""Get all righe for a DDT"""
	# Verifica che il DDT esista e non sia eliminato
	ddt = db.query(DdtModel).filter(
		DdtModel.id == ddt_id,
		DdtModel.deleted_at.is_(None)
	).first()
	if not ddt:
		raise HTTPException(status_code=404, detail="DDT non trovato")
	
	return db.query(DdtRigaModel).filter(
		DdtRigaModel.ddt_id == ddt_id,
		DdtRigaModel.deleted_at.is_(None)
	).all()

@router.get("/ddt-righe/{riga_id}", response_model=DdtRigaResponse)
def get_ddt_riga(riga_id: int, db: Session = Depends(get_db)):
	obj = db.query(DdtRigaModel).filter(
		DdtRigaModel.id == riga_id,
		DdtRigaModel.deleted_at.is_(None)
	).first()
	if not obj:
		raise HTTPException(status_code=404, detail="Riga DDT non trovata")
	return obj

@router.post("/ddt-righe", response_model=DdtRigaResponse, status_code=status.HTTP_201_CREATED)
def create_ddt_riga(data: DdtRigaCreate, db: Session = Depends(get_db)):
	"""Create a new DDT riga with validation"""
	# Valida che almeno uno tra componente_alimentare_id e mangime_confezionato_id sia presente
	if not data.componente_alimentare_id and not data.mangime_confezionato_id:
		raise HTTPException(
			status_code=400,
			detail="Almeno uno tra componente_alimentare_id e mangime_confezionato_id deve essere specificato"
		)
	
	# Verifica che il DDT esista e non sia eliminato
	ddt = db.query(DdtModel).filter(
		DdtModel.id == data.ddt_id,
		DdtModel.deleted_at.is_(None)
	).first()
	if not ddt:
		raise HTTPException(status_code=404, detail="DDT non trovato")
	
	# Usa dict() per compatibilità con Pydantic v1 e v2
	payload = data.dict() if hasattr(data, 'dict') else data.model_dump()
	db_obj = DdtRigaModel(**payload)
	db.add(db_obj)
	db.commit()
	db.refresh(db_obj)
	return db_obj

@router.put("/ddt-righe/{riga_id}", response_model=DdtRigaResponse)
def update_ddt_riga(riga_id: int, update: DdtRigaUpdate, db: Session = Depends(get_db)):
	obj = db.query(DdtRigaModel).filter(
		DdtRigaModel.id == riga_id,
		DdtRigaModel.deleted_at.is_(None)
	).first()
	if not obj:
		raise HTTPException(status_code=404, detail="Riga DDT non trovata")
	
	# Valida che dopo l'update almeno uno tra componente_alimentare_id e mangime_confezionato_id sia presente
	update_data = update.dict(exclude_unset=True) if hasattr(update, 'dict') else update.model_dump(exclude_unset=True)
	
	# Simula l'update per validare
	test_componente = update_data.get('componente_alimentare_id', obj.componente_alimentare_id)
	test_mangime = update_data.get('mangime_confezionato_id', obj.mangime_confezionato_id)
	
	if test_componente is None and test_mangime is None:
		raise HTTPException(
			status_code=400,
			detail="Almeno uno tra componente_alimentare_id e mangime_confezionato_id deve essere specificato"
		)
	
	for field, value in update_data.items():
		setattr(obj, field, value)
	db.commit()
	db.refresh(obj)
	return obj

@router.delete("/ddt-righe/{riga_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ddt_riga(riga_id: int, db: Session = Depends(get_db)):
	"""Soft delete DDT riga"""
	obj = db.query(DdtRigaModel).filter(
		DdtRigaModel.id == riga_id,
		DdtRigaModel.deleted_at.is_(None)
	).first()
	if not obj:
		raise HTTPException(status_code=404, detail="Riga DDT non trovata")
	obj.deleted_at = datetime.utcnow()
	db.commit()
	return None

# --- MAGAZZINO MOVIMENTI CRUD ---
