"""Schemi Pydantic per AssicurazioneAziendale"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from decimal import Decimal
from app.models.amministrazione.assicurazione_aziendale import TipoAssicurazione


class AssicurazioneAziendaleBase(BaseModel):
    azienda_id: int = Field(..., description="ID azienda")
    tipo: TipoAssicurazione = Field(..., description="Tipo assicurazione")
    numero_polizza: str = Field(..., max_length=100, description="Numero polizza")
    compagnia: str = Field(..., max_length=200, description="Compagnia assicurativa")
    data_inizio: date = Field(..., description="Data inizio copertura")
    data_scadenza: date = Field(..., description="Data scadenza copertura")
    premio_annuale: Decimal = Field(..., description="Premio annuale")
    importo_assicurato: Optional[Decimal] = Field(None, description="Massimale copertura")
    numero_rate: int = Field(1, description="Numero rate annuali")
    data_prossimo_pagamento: Optional[date] = Field(None, description="Data prossimo pagamento")
    note: Optional[str] = Field(None, description="Note")
    allegato_path: Optional[str] = Field(None, max_length=500, description="Path file polizza")
    attiva: bool = Field(True, description="Assicurazione attiva")


class AssicurazioneAziendaleCreate(AssicurazioneAziendaleBase):
    pass


class AssicurazioneAziendaleUpdate(BaseModel):
    tipo: Optional[TipoAssicurazione] = None
    numero_polizza: Optional[str] = Field(None, max_length=100)
    compagnia: Optional[str] = Field(None, max_length=200)
    data_inizio: Optional[date] = None
    data_scadenza: Optional[date] = None
    premio_annuale: Optional[Decimal] = None
    importo_assicurato: Optional[Decimal] = None
    numero_rate: Optional[int] = None
    data_prossimo_pagamento: Optional[date] = None
    note: Optional[str] = None
    allegato_path: Optional[str] = Field(None, max_length=500)
    attiva: Optional[bool] = None


class AssicurazioneAziendaleResponse(AssicurazioneAziendaleBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class AssicurazioneAziendaleSummary(BaseModel):
    """Riassunto assicurazione per liste"""
    id: int
    tipo: str
    numero_polizza: str
    compagnia: str
    data_scadenza: date
    premio_annuale: Decimal
    attiva: bool
    
    class Config:
        from_attributes = True

