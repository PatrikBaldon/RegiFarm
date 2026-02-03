"""
StoricoTipoAllevamento schemas
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from decimal import Decimal


class StoricoTipoAllevamentoBase(BaseModel):
    """Schema base per storico tipo allevamento"""
    tipo_allevamento_precedente: Optional[str] = Field(None, description="svezzamento, ingrasso, universale")
    tipo_allevamento_nuovo: str = Field(..., description="svezzamento, ingrasso, universale")
    peso_ingresso: Optional[Decimal] = None
    data_cambio: date
    note: Optional[str] = None


class StoricoTipoAllevamentoCreate(StoricoTipoAllevamentoBase):
    """Schema per creazione storico tipo allevamento"""
    animale_id: int
    contratto_soccida_id: Optional[int] = None


class StoricoTipoAllevamentoUpdate(BaseModel):
    """Schema per aggiornamento storico (solo per annullamento)"""
    annullato: bool = True
    motivo_annullamento: Optional[str] = None


class StoricoTipoAllevamentoResponse(StoricoTipoAllevamentoBase):
    """Schema per risposta storico tipo allevamento"""
    id: int
    animale_id: int
    contratto_soccida_id: Optional[int] = None
    annullato: bool = False
    data_annullamento: Optional[datetime] = None
    motivo_annullamento: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

