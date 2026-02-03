from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class DdtRigaBase(BaseModel):
	ddt_id: int
	componente_alimentare_id: Optional[int] = None
	mangime_confezionato_id: Optional[int] = None
	quantita: float
	unita_misura: str
	prezzo_unitario: Optional[float] = None
	lotto: Optional[str] = None
	scadenza: Optional[date] = None
	note: Optional[str] = None


class DdtRigaCreate(DdtRigaBase):
	pass


class DdtRigaUpdate(BaseModel):
	componente_alimentare_id: Optional[int] = None
	mangime_confezionato_id: Optional[int] = None
	quantita: Optional[float] = None
	unita_misura: Optional[str] = None
	prezzo_unitario: Optional[float] = None
	lotto: Optional[str] = None
	scadenza: Optional[date] = None
	note: Optional[str] = None


class DdtRigaResponse(DdtRigaBase):
	id: int
	created_at: Optional[datetime]
	updated_at: Optional[datetime]
	deleted_at: Optional[datetime]

	class Config:
		from_attributes = True
