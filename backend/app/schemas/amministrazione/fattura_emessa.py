"""Schemi Pydantic per FatturaEmessa"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from app.models.amministrazione.fattura_emessa import StatoPagamentoFatturaEmessa


class FatturaEmessaBase(BaseModel):
    azienda_id: int = Field(..., description="ID azienda")
    numero: str = Field(..., max_length=50, description="Numero fattura")
    data_fattura: date = Field(..., description="Data fattura")
    data_registrazione: date = Field(default_factory=date.today, description="Data registrazione")
    cliente_id: Optional[int] = Field(None, description="ID cliente (fornitore)")
    cliente_nome: Optional[str] = Field(None, max_length=200, description="Nome cliente")
    cliente_piva: Optional[str] = Field(None, max_length=50, description="Partita IVA cliente")
    cliente_cf: Optional[str] = Field(None, max_length=50, description="Codice fiscale cliente")
    importo_totale: Decimal = Field(..., description="Importo totale")
    importo_iva: Decimal = Field(default=0, description="Importo IVA")
    importo_netto: Decimal = Field(..., description="Importo netto")
    importo_incassato: Decimal = Field(default=0, description="Importo incassato")
    stato_pagamento: StatoPagamentoFatturaEmessa = Field(StatoPagamentoFatturaEmessa.DA_INCASSARE, description="Stato pagamento")
    data_scadenza: Optional[date] = Field(None, description="Data scadenza pagamento")
    data_incasso: Optional[date] = Field(None, description="Data incasso effettivo")
    aliquota_iva: Decimal = Field(default=0, description="Aliquota IVA percentuale")
    categoria: Optional[str] = Field(None, max_length=100, description="Categoria vendita")
    macrocategoria: Optional[str] = Field(None, max_length=50, description="Macrocategoria: nessuna, alimento, terreno, attrezzatura, sanitario, utilities, personale, servizi, assicurazioni, finanziario, amministrativo")
    terreno_id: Optional[int] = Field(None, description="ID terreno collegato (per attribuzione costi/ricavi)")
    note: Optional[str] = Field(None, description="Note")
    allegato_path: Optional[str] = Field(None, max_length=500, description="Path file allegato")
    righe: Optional[List[Dict[str, Any]]] = Field(None, description="Righe di dettaglio in formato JSON")


class FatturaEmessaCreate(FatturaEmessaBase):
    pass


class FatturaEmessaUpdate(BaseModel):
    numero: Optional[str] = Field(None, max_length=50)
    data_fattura: Optional[date] = None
    data_registrazione: Optional[date] = None
    cliente_id: Optional[int] = None
    cliente_nome: Optional[str] = Field(None, max_length=200)
    cliente_piva: Optional[str] = Field(None, max_length=50)
    cliente_cf: Optional[str] = Field(None, max_length=50)
    importo_totale: Optional[Decimal] = None
    importo_iva: Optional[Decimal] = None
    importo_netto: Optional[Decimal] = None
    importo_incassato: Optional[Decimal] = None
    stato_pagamento: Optional[StatoPagamentoFatturaEmessa] = None
    data_scadenza: Optional[date] = None
    data_incasso: Optional[date] = None
    aliquota_iva: Optional[Decimal] = None
    categoria: Optional[str] = Field(None, max_length=100)
    macrocategoria: Optional[str] = Field(None, max_length=50)
    terreno_id: Optional[int] = None
    note: Optional[str] = None
    allegato_path: Optional[str] = Field(None, max_length=500)
    righe: Optional[List[Dict[str, Any]]] = None


class FatturaEmessaResponse(FatturaEmessaBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    dati_xml: Optional[dict] = None
    xml_raw: Optional[str] = None
    righe: Optional[List[Dict[str, Any]]] = None
    
    class Config:
        from_attributes = True


class FatturaEmessaWithPagamenti(FatturaEmessaResponse):
    """Fattura emessa con pagamenti collegati"""
    pagamenti: List = []  # Will be populated with PagamentoResponse
    
    class Config:
        from_attributes = True


class FatturaEmessaSummary(BaseModel):
    """Riassunto fattura per liste"""
    id: int
    numero: str
    data_fattura: date
    cliente_nome: Optional[str]
    importo_totale: Decimal
    importo_incassato: Decimal
    stato_pagamento: str
    data_scadenza: Optional[date]
    
    class Config:
        from_attributes = True

