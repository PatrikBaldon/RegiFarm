from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

class TerrenoBase(BaseModel):
    azienda_id: int
    denominazione: str
    localita: Optional[str] = None
    superficie: Optional[float] = None
    unita_misura: Optional[str] = 'ha'
    di_proprieta: Optional[bool] = True
    in_affitto: Optional[bool] = False
    canone_mensile: Optional[float] = None
    canone_annuale: Optional[float] = None
    fattura_id: Optional[int] = None
    note: Optional[str] = None

class TerrenoCreate(TerrenoBase):
    azienda_id: int
    denominazione: str

class TerrenoUpdate(BaseModel):
    azienda_id: Optional[int] = None
    denominazione: Optional[str] = None
    localita: Optional[str] = None
    superficie: Optional[float] = None
    unita_misura: Optional[str] = None
    di_proprieta: Optional[bool] = None
    in_affitto: Optional[bool] = None
    canone_mensile: Optional[float] = None
    canone_annuale: Optional[float] = None
    fattura_id: Optional[int] = None
    note: Optional[str] = None

class TerrenoResponse(TerrenoBase):
    id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    deleted_at: Optional[datetime]

    class Config:
        from_attributes = True


# Schema per prodotto raccolto con informazioni scorte
class ProdottoRaccoltoInfo(BaseModel):
    prodotto: str
    quantita_totale: Decimal = Field(..., description="Quantità totale raccolta")
    unita_misura: str
    quantita_venduta: Decimal = Field(default=0, description="Quantità venduta")
    quantita_disponibile: Decimal = Field(default=0, description="Quantità disponibile nelle scorte")
    prezzo_medio_vendita: Optional[Decimal] = Field(None, description="Prezzo medio di vendita")
    ricavi_totali: Decimal = Field(default=0, description="Ricavi totali dalle vendite")
    
    class Config:
        from_attributes = True


# Schema per riepilogo costi/ricavi terreno
class TerrenoRiepilogoResponse(BaseModel):
    terreno_id: int
    terreno_denominazione: str
    costi_totali: Decimal = Field(default=0, description="Costi totali dalle fatture")
    ricavi_totali: Decimal = Field(default=0, description="Ricavi totali dalle vendite")
    margine: Decimal = Field(default=0, description="Margine (ricavi - costi)")
    prodotti_raccolti: List[ProdottoRaccoltoInfo] = Field(default_factory=list, description="Prodotti raccolti con dettagli")
    
    # Dettaglio costi
    costi_fatture_emesse: Decimal = Field(default=0, description="Costi da fatture emesse (se negativo)")
    costi_fatture_ricevute: Decimal = Field(default=0, description="Costi da fatture ricevute")
    numero_fatture_costi: int = Field(default=0, description="Numero di fatture di costo")
    
    # Dettaglio ricavi
    numero_vendite: int = Field(default=0, description="Numero di vendite prodotti agricoli")
    
    # Informazioni per calcolo risparmio alimentazione
    prodotti_autoprodotti_disponibili: List[dict] = Field(default_factory=list, description="Prodotti disponibili per alimentazione con quantità e costi unitari")

    class Config:
        from_attributes = True
