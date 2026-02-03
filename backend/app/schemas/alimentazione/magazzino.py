from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class MagazzinoMovimentoBase(BaseModel):
	data: date
	tipo: str  # 'carico', 'scarico', 'rettifica'
	componente_alimentare_id: Optional[int] = None
	mangime_confezionato_id: Optional[int] = None
	quantita: float
	unita_misura: str
	causale: Optional[str] = None
	ddt_riga_id: Optional[int] = None
	note: Optional[str] = None


class MagazzinoMovimentoCreate(MagazzinoMovimentoBase):
	pass


class MagazzinoMovimentoUpdate(BaseModel):
	data: Optional[date] = None
	tipo: Optional[str] = None
	componente_alimentare_id: Optional[int] = None
	mangime_confezionato_id: Optional[int] = None
	quantita: Optional[float] = None
	unita_misura: Optional[str] = None
	causale: Optional[str] = None
	ddt_riga_id: Optional[int] = None
	note: Optional[str] = None


class MagazzinoMovimentoResponse(MagazzinoMovimentoBase):
	id: int
	created_at: Optional[datetime]
	updated_at: Optional[datetime]
	deleted_at: Optional[datetime]

	class Config:
		from_attributes = True


class ScortaItem(BaseModel):
	componente_alimentare_id: Optional[int] = None
	mangime_confezionato_id: Optional[int] = None
	unita_misura: str
	quantita_disponibile: float
