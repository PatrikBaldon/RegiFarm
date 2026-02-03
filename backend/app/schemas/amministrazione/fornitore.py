from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class FornitoreBase(BaseModel):
    azienda_id: int
    nome: str
    partita_iva: Optional[str] = None
    indirizzo: Optional[str] = None
    indirizzo_cap: Optional[str] = None
    indirizzo_comune: Optional[str] = None
    indirizzo_provincia: Optional[str] = None
    indirizzo_nazione: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    pec: Optional[str] = None
    fax: Optional[str] = None
    regime_fiscale: Optional[str] = None
    rea_ufficio: Optional[str] = None
    rea_numero: Optional[str] = None
    rea_capitale_sociale: Optional[str] = None
    note: Optional[str] = None
    is_fornitore: Optional[bool] = True  # Può essere fornitore
    is_cliente: Optional[bool] = False  # Può essere cliente (soccidante)

class FornitoreCreate(FornitoreBase):
    nome: str

class FornitoreUpdate(BaseModel):
    azienda_id: Optional[int] = None
    nome: Optional[str] = None
    partita_iva: Optional[str] = None
    indirizzo: Optional[str] = None
    indirizzo_cap: Optional[str] = None
    indirizzo_comune: Optional[str] = None
    indirizzo_provincia: Optional[str] = None
    indirizzo_nazione: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    pec: Optional[str] = None
    fax: Optional[str] = None
    regime_fiscale: Optional[str] = None
    rea_ufficio: Optional[str] = None
    rea_numero: Optional[str] = None
    rea_capitale_sociale: Optional[str] = None
    note: Optional[str] = None
    is_fornitore: Optional[bool] = None
    is_cliente: Optional[bool] = None

class FornitoreResponse(FornitoreBase):
    id: int
    is_fornitore: bool
    is_cliente: bool
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    deleted_at: Optional[datetime]

    class Config:
        from_attributes = True  # Pydantic v2: orm_mode è stato rinominato

