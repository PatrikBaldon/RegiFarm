"""Schemi Pydantic per LottoFarmaco"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime, date
from decimal import Decimal


class LottoFarmacoBase(BaseModel):
    farmaco_id: int = Field(..., description="ID del farmaco")
    lotto: str = Field(..., max_length=50, description="Numero di lotto")
    scadenza: Optional[date] = Field(None, description="Data di scadenza")
    quantita_iniziale: Decimal = Field(..., ge=0, description="Quantità iniziale acquistata")
    quantita_rimanente: Optional[Decimal] = Field(None, ge=0, description="Quantità rimanente (calcolata automaticamente se non specificata)")
    fornitore: Optional[str] = Field(None, max_length=200, description="Nome del fornitore")
    numero_fattura: Optional[str] = Field(None, max_length=100, description="Numero fattura")
    data_acquisto: Optional[date] = Field(None, description="Data di acquisto")
    note: Optional[str] = Field(None, max_length=500, description="Note sul lotto")

    @field_validator('quantita_rimanente', mode='before')
    @classmethod
    def set_quantita_rimanente(cls, v, info):
        """Se quantita_rimanente non è specificata, usa quantita_iniziale"""
        if v is None and 'quantita_iniziale' in info.data:
            return info.data['quantita_iniziale']
        return v


class LottoFarmacoCreate(LottoFarmacoBase):
    azienda_id: int = Field(..., description="ID dell'azienda")


class LottoFarmacoUpdate(BaseModel):
    lotto: Optional[str] = Field(None, max_length=50)
    scadenza: Optional[date] = None
    quantita_iniziale: Optional[Decimal] = Field(None, ge=0)
    quantita_rimanente: Optional[Decimal] = Field(None, ge=0)
    fornitore: Optional[str] = Field(None, max_length=200)
    numero_fattura: Optional[str] = Field(None, max_length=100)
    data_acquisto: Optional[date] = None
    note: Optional[str] = Field(None, max_length=500)


class LottoFarmacoResponse(LottoFarmacoBase):
    id: int
    azienda_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

