from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

class PianoAlimentazioneBase(BaseModel):
    azienda_id: int
    nome: str
    descrizione: Optional[str] = None
    tipo_allevamento: Optional[str] = None
    versione: Optional[str] = None
    validita_da: Optional[date] = None
    validita_a: Optional[date] = None

class PianoAlimentazioneCreate(PianoAlimentazioneBase):
    nome: str

class PianoAlimentazioneUpdate(BaseModel):
    azienda_id: Optional[int] = None
    nome: Optional[str] = None
    descrizione: Optional[str] = None
    tipo_allevamento: Optional[str] = None
    versione: Optional[str] = None
    validita_da: Optional[date] = None
    validita_a: Optional[date] = None

class PianoAlimentazioneResponse(PianoAlimentazioneBase):
    id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    deleted_at: Optional[datetime]

    class Config:
        from_attributes = True
