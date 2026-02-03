"""Pydantic schemas for Azienda"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict


class AziendaBase(BaseModel):
    nome: str = Field(..., max_length=100)
    partita_iva: Optional[str] = Field(None, max_length=11)
    codice_fiscale: str = Field(..., max_length=16)
    indirizzo: Optional[str] = Field(None, max_length=255)
    indirizzo_cap: Optional[str] = Field(None, max_length=10)
    indirizzo_comune: Optional[str] = Field(None, max_length=120)
    indirizzo_provincia: Optional[str] = Field(None, max_length=10)
    indirizzo_nazione: Optional[str] = Field(None, max_length=5)
    telefono: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    pec: Optional[str] = Field(None, max_length=150)
    codice_sdi: Optional[str] = Field(None, max_length=10)
    rea_ufficio: Optional[str] = Field(None, max_length=50)
    rea_numero: Optional[str] = Field(None, max_length=50)
    rea_capitale_sociale: Optional[str] = Field(None, max_length=50)
    referente_nome: Optional[str] = Field(None, max_length=120)
    referente_email: Optional[str] = Field(None, max_length=150)
    referente_telefono: Optional[str] = Field(None, max_length=50)
    sito_web: Optional[str] = Field(None, max_length=150)
    iban: Optional[str] = Field(None, max_length=34)
    veterinario_id: Optional[int] = Field(None, description="ID fornitore veterinario associato")
    logo_storage_path: Optional[str] = Field(None, max_length=255)
    logo_public_url: Optional[str] = Field(None, max_length=500)


class AziendaCreate(AziendaBase):
    pass


class AziendaUpdate(BaseModel):
    nome: Optional[str] = Field(None, max_length=100)
    partita_iva: Optional[str] = Field(None, max_length=11)
    codice_fiscale: Optional[str] = Field(None, max_length=16)
    indirizzo: Optional[str] = Field(None, max_length=255)
    indirizzo_cap: Optional[str] = Field(None, max_length=10)
    indirizzo_comune: Optional[str] = Field(None, max_length=120)
    indirizzo_provincia: Optional[str] = Field(None, max_length=10)
    indirizzo_nazione: Optional[str] = Field(None, max_length=5)
    telefono: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    pec: Optional[str] = Field(None, max_length=150)
    codice_sdi: Optional[str] = Field(None, max_length=10)
    rea_ufficio: Optional[str] = Field(None, max_length=50)
    rea_numero: Optional[str] = Field(None, max_length=50)
    rea_capitale_sociale: Optional[str] = Field(None, max_length=50)
    referente_nome: Optional[str] = Field(None, max_length=120)
    referente_email: Optional[str] = Field(None, max_length=150)
    referente_telefono: Optional[str] = Field(None, max_length=50)
    sito_web: Optional[str] = Field(None, max_length=150)
    iban: Optional[str] = Field(None, max_length=34)
    veterinario_id: Optional[int] = Field(None, description="ID fornitore veterinario associato")
    logo_storage_path: Optional[str] = Field(None, max_length=255)
    logo_public_url: Optional[str] = Field(None, max_length=500)


class VeterinarioResponse(BaseModel):
    id: int
    nome: str

    model_config = ConfigDict(from_attributes=True)


class AziendaResponse(AziendaBase):
    id: int
    created_at: datetime
    updated_at: datetime
    veterinario: Optional[VeterinarioResponse] = None

    model_config = ConfigDict(from_attributes=True)

