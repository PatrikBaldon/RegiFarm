"""
Movimentazione schemas
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class MovimentazioneBase(BaseModel):
    animale_id: int
    a_box_id: int
    da_box_id: Optional[int] = None
    motivo: Optional[str] = Field(None, max_length=100)
    note: Optional[str] = None


class MovimentazioneCreate(MovimentazioneBase):
    operatore_id: Optional[int] = None


class MovimentazioneResponse(MovimentazioneBase):
    id: int
    data_ora: datetime
    operatore_id: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

