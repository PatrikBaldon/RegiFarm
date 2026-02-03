from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime


class DdtBase(BaseModel):
	azienda_id: int
	data: date
	numero: str
	fornitore_id: Optional[int] = None
	note: Optional[str] = None


class DdtCreate(DdtBase):
	pass


class DdtUpdate(BaseModel):
	azienda_id: Optional[int] = None
	data: Optional[date] = None
	numero: Optional[str] = None
	fornitore_id: Optional[int] = None
	note: Optional[str] = None


class DdtResponse(DdtBase):
	id: int
	created_at: Optional[datetime]
	updated_at: Optional[datetime]
	deleted_at: Optional[datetime]

	class Config:
		from_attributes = True
