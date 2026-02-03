from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

class RaccoltoTerrenoBase(BaseModel):
    terreno_id: int
    prodotto: str
    data_inizio: Optional[date] = None
    data_fine: Optional[date] = None
    resa_quantita: Optional[float] = None
    unita_misura: Optional[str] = None
    destinazione: Optional[str] = None
    prezzo_vendita: Optional[float] = None
    note: Optional[str] = None

class RaccoltoTerrenoCreate(RaccoltoTerrenoBase):
    terreno_id: int
    prodotto: str

class RaccoltoTerrenoUpdate(BaseModel):
    terreno_id: Optional[int] = None
    prodotto: Optional[str] = None
    data_inizio: Optional[date] = None
    data_fine: Optional[date] = None
    resa_quantita: Optional[float] = None
    unita_misura: Optional[str] = None
    destinazione: Optional[str] = None
    prezzo_vendita: Optional[float] = None
    note: Optional[str] = None

class RaccoltoTerrenoResponse(RaccoltoTerrenoBase):
    id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    deleted_at: Optional[datetime]

    class Config:
        from_attributes = True
