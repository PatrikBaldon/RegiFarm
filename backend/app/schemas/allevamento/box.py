"""
Box schemas
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class BoxBase(BaseModel):
    nome: str = Field(..., max_length=50)
    capacita: int = Field(..., gt=0)
    tipo_allevamento: Optional[str] = Field(None, pattern="^(svezzamento|ingrasso|universale)$")
    stato: Optional[str] = Field("libero", pattern="^(libero|occupato|pulizia|manutenzione)$")
    note: Optional[str] = None


class BoxCreate(BoxBase):
    stabilimento_id: int


class BoxUpdate(BaseModel):
    nome: Optional[str] = Field(None, max_length=50)
    capacita: Optional[int] = Field(None, gt=0)
    tipo_allevamento: Optional[str] = Field(None, pattern="^(svezzamento|ingrasso|universale)$")
    stato: Optional[str] = Field(None, pattern="^(libero|occupato|pulizia|manutenzione)$")
    note: Optional[str] = None


class BoxResponse(BoxBase):
    id: int
    stabilimento_id: int
    occupazione: Optional[int] = None
    disponibilita: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

