from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class MangimeConfezionatoBase(BaseModel):
    azienda_id: int
    nome: str
    fornitore_id: Optional[int] = None
    tipo_allevamento: Optional[str] = None
    prezzo_unitario: Optional[float] = None
    unita_misura: Optional[str] = None
    fattura_id: Optional[int] = None

class MangimeConfezionatoCreate(MangimeConfezionatoBase):
    nome: str

class MangimeConfezionatoUpdate(BaseModel):
    azienda_id: Optional[int] = None
    nome: Optional[str] = None
    fornitore_id: Optional[int] = None
    tipo_allevamento: Optional[str] = None
    prezzo_unitario: Optional[float] = None
    unita_misura: Optional[str] = None
    fattura_id: Optional[int] = None

class MangimeConfezionatoResponse(MangimeConfezionatoBase):
    id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    deleted_at: Optional[datetime]

    class Config:
        from_attributes = True
