"""Schemi Pydantic per VenditaProdottoAgricolo"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from decimal import Decimal


class VenditaProdottoAgricoloBase(BaseModel):
    azienda_id: int = Field(..., description="ID azienda")
    prodotto: str = Field(..., max_length=200, description="Prodotto venduto (mais, grano, fieno, etc.)")
    data_vendita: date = Field(..., description="Data vendita")
    quantita: Decimal = Field(..., description="Quantità venduta")
    unita_misura: str = Field("kg", max_length=20, description="Unità di misura")
    prezzo_unitario: Decimal = Field(..., description="Prezzo per unità")
    importo_totale: Decimal = Field(..., description="Importo totale")
    terreno_id: Optional[int] = Field(None, description="ID terreno collegato")
    raccolto_id: Optional[int] = Field(None, description="ID raccolto collegato")
    acquirente: Optional[str] = Field(None, max_length=200, description="Nome acquirente")
    numero_fattura: Optional[str] = Field(None, max_length=50, description="Numero fattura")
    numero_ddt: Optional[str] = Field(None, max_length=50, description="Numero DDT")
    costi_terreno_totale: Decimal = Field(default=0, description="Costi totali terreno attribuiti")
    costi_terreno_quantita: Decimal = Field(default=0, description="Costi per unità prodotta")
    margine: Optional[Decimal] = Field(None, description="Margine (ricavi - costi)")
    note: Optional[str] = Field(None, description="Note aggiuntive")


class VenditaProdottoAgricoloCreate(VenditaProdottoAgricoloBase):
    pass


class VenditaProdottoAgricoloUpdate(BaseModel):
    prodotto: Optional[str] = Field(None, max_length=200)
    data_vendita: Optional[date] = None
    quantita: Optional[Decimal] = None
    unita_misura: Optional[str] = Field(None, max_length=20)
    prezzo_unitario: Optional[Decimal] = None
    importo_totale: Optional[Decimal] = None
    terreno_id: Optional[int] = None
    raccolto_id: Optional[int] = None
    acquirente: Optional[str] = Field(None, max_length=200)
    numero_fattura: Optional[str] = Field(None, max_length=50)
    numero_ddt: Optional[str] = Field(None, max_length=50)
    costi_terreno_totale: Optional[Decimal] = None
    costi_terreno_quantita: Optional[Decimal] = None
    margine: Optional[Decimal] = None
    note: Optional[str] = None


class VenditaProdottoAgricoloResponse(VenditaProdottoAgricoloBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

