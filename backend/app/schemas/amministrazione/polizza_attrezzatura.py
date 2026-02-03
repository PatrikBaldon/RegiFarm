"""Schemi Pydantic per PolizzaAttrezzatura, PolizzaPagamento e PolizzaRinnovo"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from app.models.amministrazione.polizza_attrezzatura import TipoPolizza


# ============ POLIZZA ATTREZZATURA ============
class PolizzaAttrezzaturaBase(BaseModel):
    attrezzatura_id: int = Field(..., description="ID attrezzatura")
    azienda_id: int = Field(..., description="ID azienda")
    tipo_polizza: TipoPolizza = Field(..., description="Tipo polizza")
    numero_polizza: str = Field(..., max_length=100, description="Numero polizza")
    compagnia: str = Field(..., max_length=200, description="Compagnia assicurativa")
    data_inizio: date = Field(..., description="Data inizio copertura")
    data_scadenza: date = Field(..., description="Data scadenza copertura")
    premio_annuale: Decimal = Field(..., description="Premio annuale")
    importo_assicurato: Optional[Decimal] = Field(None, description="Massimale copertura")
    coperture: Optional[List[str]] = Field(None, description="Lista coperture incluse")
    numero_rate: Optional[int] = Field(1, description="Numero rate annuali")
    data_prossimo_pagamento: Optional[date] = Field(None, description="Data prossimo pagamento")
    note: Optional[str] = Field(None, description="Note")
    allegato_path: Optional[str] = Field(None, max_length=500, description="Path file polizza")
    attiva: bool = Field(True, description="Polizza attiva")


class PolizzaAttrezzaturaCreate(PolizzaAttrezzaturaBase):
    pass


class PolizzaAttrezzaturaUpdate(BaseModel):
    tipo_polizza: Optional[TipoPolizza] = None
    numero_polizza: Optional[str] = Field(None, max_length=100)
    compagnia: Optional[str] = Field(None, max_length=200)
    data_inizio: Optional[date] = None
    data_scadenza: Optional[date] = None
    premio_annuale: Optional[Decimal] = None
    importo_assicurato: Optional[Decimal] = None
    coperture: Optional[List[str]] = None
    numero_rate: Optional[int] = None
    data_prossimo_pagamento: Optional[date] = None
    note: Optional[str] = None
    allegato_path: Optional[str] = Field(None, max_length=500)
    attiva: Optional[bool] = None


class PolizzaAttrezzaturaResponse(PolizzaAttrezzaturaBase):
    id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ POLIZZA PAGAMENTO ============
class PolizzaPagamentoBase(BaseModel):
    polizza_id: int = Field(..., description="ID polizza")
    importo: Decimal = Field(..., description="Importo pagamento")
    data_pagamento: date = Field(..., description="Data pagamento")
    numero_rate: Optional[int] = Field(None, description="Numero totale rate")
    rata_numero: Optional[int] = Field(None, description="Numero rata corrente")
    note: Optional[str] = Field(None, description="Note")


class PolizzaPagamentoCreate(PolizzaPagamentoBase):
    pass


class PolizzaPagamentoUpdate(BaseModel):
    importo: Optional[Decimal] = None
    data_pagamento: Optional[date] = None
    numero_rate: Optional[int] = None
    rata_numero: Optional[int] = None
    note: Optional[str] = None


class PolizzaPagamentoResponse(PolizzaPagamentoBase):
    id: int
    prima_nota_movimento_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ POLIZZA RINNOVO ============
class PolizzaRinnovoBase(BaseModel):
    polizza_id: int = Field(..., description="ID polizza")
    data_rinnovo: date = Field(..., description="Data rinnovo")
    premio_precedente: Optional[Decimal] = Field(None, description="Premio precedente")
    premio_nuovo: Decimal = Field(..., description="Premio nuovo")
    coperture_precedenti: Optional[List[str]] = Field(None, description="Coperture precedenti")
    coperture_nuove: Optional[List[str]] = Field(None, description="Coperture nuove")
    note_cambiamenti: Optional[str] = Field(None, description="Note sui cambiamenti")
    nuova_data_inizio: Optional[date] = Field(None, description="Nuova data inizio")
    nuova_data_scadenza: Optional[date] = Field(None, description="Nuova data scadenza")


class PolizzaRinnovoCreate(PolizzaRinnovoBase):
    pass


class PolizzaRinnovoUpdate(BaseModel):
    data_rinnovo: Optional[date] = None
    premio_precedente: Optional[Decimal] = None
    premio_nuovo: Optional[Decimal] = None
    coperture_precedenti: Optional[List[str]] = None
    coperture_nuove: Optional[List[str]] = None
    note_cambiamenti: Optional[str] = None
    nuova_data_inizio: Optional[date] = None
    nuova_data_scadenza: Optional[date] = None


class PolizzaRinnovoResponse(PolizzaRinnovoBase):
    id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True

