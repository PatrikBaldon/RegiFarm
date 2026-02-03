"""Schemi Pydantic per ProdottoDerivato"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ProdottoDerivatoBase(BaseModel):
    raccolto_id: int = Field(..., description="ID raccolto principale")
    nome_prodotto: str = Field(..., max_length=200, description="Nome prodotto derivato (paglia, tortello, etc.)")
    quantita_prodotta: Decimal = Field(..., description="Quantità prodotta")
    unita_misura: str = Field("kg", max_length=20, description="Unità di misura")
    destinazione: str = Field(..., max_length=50, description="Destinazione: alimentazione, lettiera, vendita, altro")
    componente_alimentare_id: Optional[int] = Field(None, description="ID componente alimentare se utilizzato per alimentazione")
    prezzo_vendita: Optional[Decimal] = Field(None, description="Prezzo vendita se venduto")
    importo_vendita: Optional[Decimal] = Field(None, description="Importo totale vendita")
    valore_equivalente: Optional[Decimal] = Field(None, description="Valore equivalente se acquistato")
    note: Optional[str] = Field(None, description="Note aggiuntive")


class ProdottoDerivatoCreate(ProdottoDerivatoBase):
    pass


class ProdottoDerivatoUpdate(BaseModel):
    nome_prodotto: Optional[str] = Field(None, max_length=200)
    quantita_prodotta: Optional[Decimal] = None
    unita_misura: Optional[str] = Field(None, max_length=20)
    destinazione: Optional[str] = Field(None, max_length=50)
    componente_alimentare_id: Optional[int] = None
    prezzo_vendita: Optional[Decimal] = None
    importo_vendita: Optional[Decimal] = None
    valore_equivalente: Optional[Decimal] = None
    note: Optional[str] = None


class ProdottoDerivatoResponse(ProdottoDerivatoBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

