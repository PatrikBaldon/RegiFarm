from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field


class CicloTerrenoBase(BaseModel):
    terreno_id: int
    coltura: str = Field(..., max_length=120)
    anno: Optional[int] = Field(None, ge=1900, le=2100)
    data_inizio: Optional[date] = None
    data_fine: Optional[date] = None
    superficie_coinvolta: Optional[float] = Field(None, ge=0)
    note: Optional[str] = None


class CicloTerrenoCreate(CicloTerrenoBase):
    pass


class CicloTerrenoUpdate(BaseModel):
    coltura: Optional[str] = Field(None, max_length=120)
    anno: Optional[int] = Field(None, ge=1900, le=2100)
    data_inizio: Optional[date] = None
    data_fine: Optional[date] = None
    superficie_coinvolta: Optional[float] = Field(None, ge=0)
    note: Optional[str] = None


class CicloTerrenoSummary(BaseModel):
    id: int
    terreno_id: int
    coltura: str
    anno: Optional[int] = None
    data_inizio: Optional[date] = None
    data_fine: Optional[date] = None
    superficie_coinvolta: Optional[float] = None
    totale_costi: Decimal = Field(default=Decimal("0"))
    fasi_concluse: int = Field(default=0)
    fasi_totali: int = Field(default=0)
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CicloTerrenoResponse(CicloTerrenoBase):
    id: int
    azienda_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CicloTerrenoFaseBase(BaseModel):
    nome: str = Field(..., max_length=120)
    tipo: str = Field(..., max_length=30)
    ordine: Optional[int] = None
    data_inizio: Optional[date] = None
    data_fine: Optional[date] = None
    note: Optional[str] = None


class CicloTerrenoFaseCreate(CicloTerrenoFaseBase):
    ciclo_id: Optional[int] = None  # Opzionale perché può venire dall'URL


class CicloTerrenoFaseUpdate(BaseModel):
    nome: Optional[str] = Field(None, max_length=120)
    tipo: Optional[str] = Field(None, max_length=30)
    ordine: Optional[int] = None
    data_inizio: Optional[date] = None
    data_fine: Optional[date] = None
    note: Optional[str] = None


class CicloTerrenoFaseResponse(CicloTerrenoFaseBase):
    id: int
    ciclo_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    totale_costi: Decimal = Field(default=Decimal("0"))

    class Config:
        from_attributes = True


class CicloTerrenoCostoBase(BaseModel):
    descrizione: str = Field(..., max_length=180)
    data: Optional[date] = None
    importo: Optional[float] = Field(None, ge=0)
    fase_id: Optional[int] = None
    source_type: str = Field("manuale", pattern="^(manuale|fattura|lavorazione)$")
    fattura_amministrazione_id: Optional[int] = None
    lavorazione_id: Optional[int] = None
    note: Optional[str] = None


class CicloTerrenoCostoCreate(CicloTerrenoCostoBase):
    ciclo_id: Optional[int] = None  # Opzionale perché può venire dall'URL
    terreno_id: Optional[int] = None  # Opzionale perché può venire dal ciclo


class CicloTerrenoCostoUpdate(BaseModel):
    descrizione: Optional[str] = Field(None, max_length=180)
    data: Optional[date] = None
    importo: Optional[float] = Field(None, ge=0)
    fase_id: Optional[int] = None
    source_type: Optional[str] = Field(None, pattern="^(manuale|fattura|lavorazione)$")
    fattura_amministrazione_id: Optional[int] = None
    lavorazione_id: Optional[int] = None
    note: Optional[str] = None


class CicloTerrenoCostoResponse(CicloTerrenoCostoBase):
    id: int
    ciclo_id: int
    fase_id: Optional[int]
    terreno_id: int
    azienda_id: int
    importo_risolto: Decimal = Field(default=Decimal("0"))
    fattura: Optional[dict] = None
    lavorazione: Optional[dict] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CicloTerrenoDetail(CicloTerrenoResponse):
    totale_costi: Decimal = Field(default=Decimal("0"))
    fasi: List[CicloTerrenoFaseResponse] = Field(default_factory=list)
    costi: List[CicloTerrenoCostoResponse] = Field(default_factory=list)
    costi_per_fase: List[dict] = Field(default_factory=list)


