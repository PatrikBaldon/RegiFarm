"""Magazzino e Scorte endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import List, Optional
from datetime import datetime, date

from app.core.database import get_db
from app.models.alimentazione.magazzino_movimento import MagazzinoMovimento as MagazzinoMovimentoModel
from app.models.alimentazione.componente_alimentare import ComponenteAlimentare as ComponenteAlimentareModel
from app.models.alimentazione.mangime_confezionato import MangimeConfezionato as MangimeConfezionatoModel
from app.schemas.alimentazione import (
    MagazzinoMovimentoCreate,
    MagazzinoMovimentoUpdate,
    MagazzinoMovimentoResponse,
    ScortaItem,
)

router = APIRouter()

@router.get("/magazzino/movimenti", response_model=List[MagazzinoMovimentoResponse])
def list_magazzino_movimenti(
	skip: int = 0,
	limit: int = 100,
	azienda_id: Optional[int] = None,
	tipo: Optional[str] = None,
	componente_alimentare_id: Optional[int] = None,
	mangime_confezionato_id: Optional[int] = None,
	data_da: Optional[date] = None,
	data_a: Optional[date] = None,
	db: Session = Depends(get_db)
):
	"""Get all magazzino movimenti with optional filters"""
	query = db.query(MagazzinoMovimentoModel).filter(MagazzinoMovimentoModel.deleted_at.is_(None))
	
	if azienda_id is not None:
		query = query.filter(MagazzinoMovimentoModel.azienda_id == azienda_id)
	if tipo:
		query = query.filter(MagazzinoMovimentoModel.tipo == tipo)
	if componente_alimentare_id is not None:
		query = query.filter(MagazzinoMovimentoModel.componente_alimentare_id == componente_alimentare_id)
	if mangime_confezionato_id is not None:
		query = query.filter(MagazzinoMovimentoModel.mangime_confezionato_id == mangime_confezionato_id)
	if data_da is not None:
		query = query.filter(MagazzinoMovimentoModel.data >= data_da)
	if data_a is not None:
		query = query.filter(MagazzinoMovimentoModel.data <= data_a)
	
	return query.order_by(MagazzinoMovimentoModel.data.desc(), MagazzinoMovimentoModel.id.desc()).offset(skip).limit(limit).all()

@router.get("/magazzino/movimenti/{mov_id}", response_model=MagazzinoMovimentoResponse)
def get_magazzino_movimento(mov_id: int, db: Session = Depends(get_db)):
	obj = db.query(MagazzinoMovimentoModel).filter(
		MagazzinoMovimentoModel.id == mov_id,
		MagazzinoMovimentoModel.deleted_at.is_(None)
	).first()
	if not obj:
		raise HTTPException(status_code=404, detail="Movimento non trovato")
	return obj

@router.post("/magazzino/movimenti", response_model=MagazzinoMovimentoResponse, status_code=status.HTTP_201_CREATED)
def create_magazzino_movimento(data: MagazzinoMovimentoCreate, db: Session = Depends(get_db)):
	# azienda_id è obbligatorio e deve essere passato dal frontend
	# Usa dict() per compatibilità con Pydantic v1 e v2
	payload = data.dict() if hasattr(data, 'dict') else data.model_dump()
	db_obj = MagazzinoMovimentoModel(**payload)
	db.add(db_obj)
	db.commit()
	db.refresh(db_obj)
	return db_obj

@router.put("/magazzino/movimenti/{mov_id}", response_model=MagazzinoMovimentoResponse)
def update_magazzino_movimento(mov_id: int, update: MagazzinoMovimentoUpdate, db: Session = Depends(get_db)):
	obj = db.query(MagazzinoMovimentoModel).filter(
		MagazzinoMovimentoModel.id == mov_id,
		MagazzinoMovimentoModel.deleted_at.is_(None)
	).first()
	if not obj:
		raise HTTPException(status_code=404, detail="Movimento non trovato")
	# Usa dict() per compatibilità con Pydantic v1 e v2
	update_data = update.dict(exclude_unset=True) if hasattr(update, 'dict') else update.model_dump(exclude_unset=True)
	for field, value in update_data.items():
		setattr(obj, field, value)
	db.commit()
	db.refresh(obj)
	return obj

@router.delete("/magazzino/movimenti/{mov_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_magazzino_movimento(mov_id: int, db: Session = Depends(get_db)):
	"""Soft delete movimento magazzino"""
	obj = db.query(MagazzinoMovimentoModel).filter(
		MagazzinoMovimentoModel.id == mov_id,
		MagazzinoMovimentoModel.deleted_at.is_(None)
	).first()
	if not obj:
		raise HTTPException(status_code=404, detail="Movimento non trovato")
	obj.deleted_at = datetime.utcnow()
	db.commit()
	return None

# --- SCORTE SUMMARY ---
@router.get("/magazzino/scorte", response_model=List[ScortaItem])
def get_scorte(
	azienda_id: Optional[int] = None,
	componente_alimentare_id: Optional[int] = None,
	mangime_confezionato_id: Optional[int] = None,
	db: Session = Depends(get_db),
):
	"""Get scorte (stock) summary with optional filters"""
	query = db.query(
		MagazzinoMovimentoModel.componente_alimentare_id,
		MagazzinoMovimentoModel.mangime_confezionato_id,
		MagazzinoMovimentoModel.unita_misura,
		func.sum(
			case(
				(
					MagazzinoMovimentoModel.tipo == 'carico',
					MagazzinoMovimentoModel.quantita
				),
				else_=0
			)
			- case(
				(
					MagazzinoMovimentoModel.tipo == 'scarico',
					MagazzinoMovimentoModel.quantita
				),
				else_=0
			)
			+ case(
				(
					MagazzinoMovimentoModel.tipo == 'rettifica',
					MagazzinoMovimentoModel.quantita
				),
				else_=0
			)
		).label('quantita_disponibile')
	).filter(
		MagazzinoMovimentoModel.deleted_at.is_(None)
	).group_by(
		MagazzinoMovimentoModel.componente_alimentare_id,
		MagazzinoMovimentoModel.mangime_confezionato_id,
		MagazzinoMovimentoModel.unita_misura,
	)
	
	if azienda_id is not None:
		query = query.filter(MagazzinoMovimentoModel.azienda_id == azienda_id)
	if componente_alimentare_id is not None:
		query = query.filter(MagazzinoMovimentoModel.componente_alimentare_id == componente_alimentare_id)
	if mangime_confezionato_id is not None:
		query = query.filter(MagazzinoMovimentoModel.mangime_confezionato_id == mangime_confezionato_id)

	rows = query.all()
	return [
		ScortaItem(
			componente_alimentare_id=r[0],
			mangime_confezionato_id=r[1],
			unita_misura=r[2],
			quantita_disponibile=float(r[3] or 0),
		)
		for r in rows
	]
