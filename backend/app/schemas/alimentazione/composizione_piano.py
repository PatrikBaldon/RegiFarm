from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ComposizionePianoBase(BaseModel):
    piano_alimentazione_id: int
    componente_alimentare_id: Optional[int] = None
    mangime_confezionato_id: Optional[int] = None
    quantita: float
    ordine: Optional[int] = None
    tipo_fornitura: Optional[str] = None

class ComposizionePianoCreate(ComposizionePianoBase):
    piano_alimentazione_id: int
    quantita: float

class ComposizionePianoUpdate(BaseModel):
    piano_alimentazione_id: Optional[int] = None
    componente_alimentare_id: Optional[int] = None
    mangime_confezionato_id: Optional[int] = None
    quantita: Optional[float] = None
    ordine: Optional[int] = None
    tipo_fornitura: Optional[str] = None

class ComposizionePianoResponse(ComposizionePianoBase):
    id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    deleted_at: Optional[datetime]

    class Config:
        from_attributes = True
