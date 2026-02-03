"""
Stabilimento schemas
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class StabilimentoBase(BaseModel):
    nome: str = Field(..., max_length=100)
    tipo: Optional[str] = Field(None, max_length=50)
    capacita_totale: Optional[int] = None


class StabilimentoCreate(StabilimentoBase):
    sede_id: int


class StabilimentoUpdate(BaseModel):
    nome: Optional[str] = Field(None, max_length=100)
    tipo: Optional[str] = Field(None, max_length=50)
    capacita_totale: Optional[int] = None


class StabilimentoResponse(StabilimentoBase):
    id: int
    sede_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

