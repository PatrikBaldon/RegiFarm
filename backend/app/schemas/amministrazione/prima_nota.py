"""Schemi Pydantic per PrimaNota"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from decimal import Decimal
from app.models.amministrazione.prima_nota import TipoMovimento, CategoriaMovimento


class PrimaNotaBase(BaseModel):
    azienda_id: int = Field(..., description="ID azienda")
    tipo: TipoMovimento = Field(..., description="Tipo movimento (entrata/uscita)")
    categoria: CategoriaMovimento = Field(CategoriaMovimento.ALTRO, description="Categoria movimento")
    data: date = Field(..., description="Data movimento")
    importo: Decimal = Field(..., description="Importo")
    descrizione: str = Field(..., max_length=500, description="Descrizione movimento")
    note: Optional[str] = Field(None, description="Note")
    fattura_emessa_id: Optional[int] = Field(None, description="ID fattura emessa collegata")
    fattura_amministrazione_id: Optional[int] = Field(None, description="ID fattura amministrazione collegata")
    pagamento_id: Optional[int] = Field(None, description="ID pagamento collegato")
    attrezzatura_id: Optional[int] = Field(None, description="ID attrezzatura collegata")
    metodo_pagamento: Optional[str] = Field(None, max_length=50, description="Metodo pagamento")


class PrimaNotaCreate(PrimaNotaBase):
    pass


class PrimaNotaUpdate(BaseModel):
    tipo: Optional[TipoMovimento] = None
    categoria: Optional[CategoriaMovimento] = None
    data: Optional[date] = None
    importo: Optional[Decimal] = None
    descrizione: Optional[str] = Field(None, max_length=500)
    note: Optional[str] = None
    fattura_emessa_id: Optional[int] = None
    fattura_amministrazione_id: Optional[int] = None
    pagamento_id: Optional[int] = None
    attrezzatura_id: Optional[int] = None
    metodo_pagamento: Optional[str] = Field(None, max_length=50)


class PrimaNotaResponse(PrimaNotaBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class PrimaNotaSummary(BaseModel):
    """Riassunto prima nota per report"""
    data: date
    tipo: str
    categoria: str
    descrizione: str
    importo: Decimal
    saldo_cumulativo: Decimal
    
    class Config:
        from_attributes = True

