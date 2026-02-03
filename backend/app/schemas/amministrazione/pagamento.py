"""Schemi Pydantic per Pagamento"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from decimal import Decimal
from app.models.amministrazione.pagamento import TipoPagamento, MetodoPagamento


class PagamentoBase(BaseModel):
    azienda_id: int = Field(..., description="ID azienda")
    tipo: TipoPagamento = Field(..., description="Tipo pagamento (entrata/uscita)")
    fattura_emessa_id: Optional[int] = Field(None, description="ID fattura emessa collegata")
    fattura_amministrazione_id: Optional[int] = Field(None, description="ID fattura amministrazione collegata")
    importo: Decimal = Field(..., description="Importo pagamento")
    data_pagamento: date = Field(..., description="Data pagamento")
    data_valuta: Optional[date] = Field(None, description="Data valuta (per bonifici)")
    metodo: MetodoPagamento = Field(MetodoPagamento.CONTANTI, description="Metodo pagamento")
    numero_riferimento: Optional[str] = Field(None, max_length=100, description="Numero riferimento (bonifico, assegno, etc.)")
    banca: Optional[str] = Field(None, max_length=200, description="Nome banca")
    iban: Optional[str] = Field(None, max_length=34, description="IBAN")
    descrizione: Optional[str] = Field(None, max_length=500, description="Descrizione")
    note: Optional[str] = Field(None, description="Note")


class PagamentoCreate(PagamentoBase):
    pass


class PagamentoUpdate(BaseModel):
    tipo: Optional[TipoPagamento] = None
    fattura_emessa_id: Optional[int] = None
    fattura_amministrazione_id: Optional[int] = None
    importo: Optional[Decimal] = None
    data_pagamento: Optional[date] = None
    data_valuta: Optional[date] = None
    metodo: Optional[MetodoPagamento] = None
    numero_riferimento: Optional[str] = Field(None, max_length=100)
    banca: Optional[str] = Field(None, max_length=200)
    iban: Optional[str] = Field(None, max_length=34)
    descrizione: Optional[str] = Field(None, max_length=500)
    note: Optional[str] = None


class PagamentoResponse(PagamentoBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

