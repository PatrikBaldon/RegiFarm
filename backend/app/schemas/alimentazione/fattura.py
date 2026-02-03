from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

class FatturaBase(BaseModel):
    data: Optional[date]
    numero: str
    fornitore_id: Optional[int] = None
    importo: Optional[float] = None
    note: Optional[str] = None

class FatturaCreate(FatturaBase):
    numero: str

class FatturaUpdate(BaseModel):
    data: Optional[date] = None
    numero: Optional[str] = None
    fornitore_id: Optional[int] = None
    importo: Optional[float] = None
    note: Optional[str] = None

class FatturaResponse(FatturaBase):
    id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    deleted_at: Optional[datetime]

    class Config:
        from_attributes = True
