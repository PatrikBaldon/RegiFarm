"""
Sede schemas
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class SedeBase(BaseModel):
    nome: str = Field(..., max_length=100)
    codice_stalla: str = Field(..., max_length=20)
    indirizzo: Optional[str] = None
    latitudine: Optional[Decimal] = None
    longitudine: Optional[Decimal] = None


class SedeCreate(SedeBase):
    azienda_id: int


class SedeUpdate(BaseModel):
    nome: Optional[str] = Field(None, max_length=100)
    codice_stalla: Optional[str] = Field(None, max_length=20)
    indirizzo: Optional[str] = None
    latitudine: Optional[Decimal] = None
    longitudine: Optional[Decimal] = None


class SedeResponse(SedeBase):
    id: int
    azienda_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

