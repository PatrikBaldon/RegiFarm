"""Schemi Pydantic per Farmaco"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class FarmacoBase(BaseModel):
    azienda_id: int = Field(..., description="ID azienda proprietaria del farmaco")
    nome_commerciale: str = Field(..., max_length=200, description="Nome commerciale del farmaco")
    principio_attivo: Optional[str] = Field(None, max_length=200, description="Principio attivo")
    unita_misura: str = Field("ml", max_length=20, description="Unità di misura (ml, gr, confezioni, unità)")
    descrizione: Optional[str] = Field(None, description="Descrizione del farmaco")
    note: Optional[str] = Field(None, description="Note aggiuntive")


class FarmacoCreate(FarmacoBase):
    pass


class FarmacoUpdate(BaseModel):
    nome_commerciale: Optional[str] = Field(None, max_length=200)
    principio_attivo: Optional[str] = Field(None, max_length=200)
    unita_misura: Optional[str] = Field(None, max_length=20)
    descrizione: Optional[str] = None
    note: Optional[str] = None


class FarmacoResponse(FarmacoBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

