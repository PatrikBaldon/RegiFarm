from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

class LavorazioneTerrenoBase(BaseModel):
    terreno_id: int
    data: Optional[date] = None
    tipo: Optional[str] = None
    fattura_id: Optional[int] = None
    costo_totale: Optional[float] = None
    note: Optional[str] = None

class LavorazioneTerrenoCreate(LavorazioneTerrenoBase):
    terreno_id: int

class LavorazioneTerrenoUpdate(BaseModel):
    terreno_id: Optional[int] = None
    data: Optional[date] = None
    tipo: Optional[str] = None
    fattura_id: Optional[int] = None
    costo_totale: Optional[float] = None
    note: Optional[str] = None

class LavorazioneTerrenoResponse(LavorazioneTerrenoBase):
    id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    deleted_at: Optional[datetime]

    class Config:
        from_attributes = True
