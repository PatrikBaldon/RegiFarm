"""Schemi Pydantic per FornitoreTipo"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class FornitoreTipoBase(BaseModel):
    fornitore_id: int = Field(..., description="ID fornitore")
    categoria: str = Field(..., max_length=50, description="Categoria: mangimi, lavorazione_terreni, farmacia, veterinario, altro")
    macrocategoria: Optional[str] = Field(None, max_length=50, description="Macrocategoria: nessuna, alimento, terreno, attrezzatura, sanitario, utilities, personale, servizi, assicurazioni, finanziario, amministrativo")
    note: Optional[str] = Field(None, max_length=500, description="Note specifiche per questa categoria")


class FornitoreTipoCreate(FornitoreTipoBase):
    pass


class FornitoreTipoUpdate(BaseModel):
    categoria: Optional[str] = Field(None, max_length=50)
    macrocategoria: Optional[str] = Field(None, max_length=50)
    note: Optional[str] = Field(None, max_length=500)


class FornitoreTipoResponse(FornitoreTipoBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

