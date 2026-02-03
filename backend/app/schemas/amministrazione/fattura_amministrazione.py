from __future__ import annotations

"""Schemi Pydantic per FatturaAmministrazione"""
from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field

from app.models.amministrazione.fattura_amministrazione import StatoPagamento, TipoFattura


# Schema semplificato per fornitore/cliente incluso nelle fatture
class FornitoreEmbedded(BaseModel):
    """Schema leggero per fornitore/cliente incluso nelle risposte fattura"""
    id: int
    nome: str
    partita_iva: Optional[str] = None
    
    class Config:
        from_attributes = True


class FatturaAmministrazioneBase(BaseModel):
    azienda_id: int = Field(..., description="ID azienda proprietaria della fattura")
    fattura_id: Optional[int] = Field(None, description="ID fattura base collegata")
    tipo: TipoFattura = Field(TipoFattura.ENTRATA, description="Tipo fattura")
    numero: str = Field(..., max_length=50, description="Numero fattura")
    data_fattura: date = Field(..., description="Data fattura")
    data_registrazione: date = Field(default_factory=date.today, description="Data registrazione")
    fornitore_id: Optional[int] = Field(None, description="ID fornitore")
    divisa: Optional[str] = Field(None, max_length=5, description="Divisa")
    tipo_documento: Optional[str] = Field(None, max_length=10, description="Tipo documento FatturaPA (es. TD01)")
    importo_totale: Decimal = Field(..., description="Importo totale")
    importo_iva: Decimal = Field(default=0, description="Importo IVA")
    importo_netto: Decimal = Field(..., description="Importo netto")
    importo_pagato: Decimal = Field(default=0, description="Importo pagato")
    stato_pagamento: StatoPagamento = Field(StatoPagamento.DA_PAGARE, description="Stato pagamento")
    data_scadenza: Optional[date] = Field(None, description="Data scadenza pagamento")
    data_pagamento: Optional[date] = Field(None, description="Data pagamento effettivo")
    condizioni_pagamento: Optional[str] = Field(None, max_length=10, description="Condizioni pagamento (es. TP02)")
    periodo_da: Optional[date] = Field(None, description="Inizio periodo attribuzione")
    periodo_a: Optional[date] = Field(None, description="Fine periodo attribuzione")
    periodo_attribuzione: Optional[str] = Field(None, max_length=100, description="Descrizione periodo")
    categoria: Optional[str] = Field(None, max_length=100, description="Categoria spesa (legacy)")
    categoria_id: Optional[int] = Field(None, description="ID categoria Prima Nota unificata")
    macrocategoria: Optional[str] = Field(None, max_length=50, description="Macrocategoria: nessuna, alimento, terreno, attrezzatura, sanitario, utilities, personale, servizi, assicurazioni, finanziario, amministrativo")
    terreno_id: Optional[int] = Field(None, description="ID terreno collegato (per attribuzione costi)")
    attrezzatura_id: Optional[int] = Field(None, description="ID attrezzatura collegata (per costi mezzi)")
    note: Optional[str] = Field(None, description="Note")
    allegato_path: Optional[str] = Field(None, max_length=500, description="Path file allegato")
    righe: Optional[List[Dict[str, Any]]] = Field(None, description="Righe di dettaglio in formato JSON")


class FatturaAmministrazioneCreate(FatturaAmministrazioneBase):
    pagamenti_programmati: Optional[List["FatturaAmministrazionePagamentoInput"]] = None


class FatturaAmministrazioneUpdate(BaseModel):
    tipo: Optional[TipoFattura] = None
    numero: Optional[str] = Field(None, max_length=50)
    data_fattura: Optional[date] = None
    data_registrazione: Optional[date] = None
    fornitore_id: Optional[int] = None
    divisa: Optional[str] = Field(None, max_length=5)
    tipo_documento: Optional[str] = Field(None, max_length=10)
    importo_totale: Optional[Decimal] = None
    importo_iva: Optional[Decimal] = None
    importo_netto: Optional[Decimal] = None
    importo_pagato: Optional[Decimal] = None
    stato_pagamento: Optional[StatoPagamento] = None
    data_scadenza: Optional[date] = None
    data_pagamento: Optional[date] = None
    condizioni_pagamento: Optional[str] = Field(None, max_length=10)
    periodo_da: Optional[date] = None
    periodo_a: Optional[date] = None
    periodo_attribuzione: Optional[str] = Field(None, max_length=100)
    categoria: Optional[str] = Field(None, max_length=100)
    categoria_id: Optional[int] = None
    macrocategoria: Optional[str] = Field(None, max_length=50)
    terreno_id: Optional[int] = None
    attrezzatura_id: Optional[int] = None
    note: Optional[str] = None
    allegato_path: Optional[str] = Field(None, max_length=500)
    righe: Optional[List[Dict[str, Any]]] = None
    pagamenti_programmati: Optional[List["FatturaAmministrazionePagamentoInput"]] = None


class FatturaAmministrazionePagamentoInput(BaseModel):
    id: Optional[int] = None
    modalita_pagamento: Optional[str] = Field(None, max_length=10)
    data_scadenza: Optional[date] = None
    importo: Optional[Decimal] = None
    iban: Optional[str] = Field(None, max_length=34)
    banca: Optional[str] = Field(None, max_length=200)
    note: Optional[str] = Field(None, max_length=500)


class FatturaAmministrazioneLineaResponse(BaseModel):
    id: int
    numero_linea: Optional[int] = None
    descrizione: Optional[str] = None
    quantita: Optional[Decimal] = None
    unita_misura: Optional[str] = None
    data_inizio_periodo: Optional[date] = None
    data_fine_periodo: Optional[date] = None
    prezzo_unitario: Optional[Decimal] = None
    prezzo_totale: Optional[Decimal] = None
    aliquota_iva: Optional[Decimal] = None
    natura: Optional[str] = None
    tipo_cessione_prestazione: Optional[str] = None
    riferimento_amministrazione: Optional[str] = None
    codice_articolo: Optional[str] = None

    class Config:
        from_attributes = True


class FatturaAmministrazioneRiepilogoResponse(BaseModel):
    id: int
    aliquota_iva: Optional[Decimal] = None
    natura: Optional[str] = None
    imponibile: Optional[Decimal] = None
    imposta: Optional[Decimal] = None
    esigibilita_iva: Optional[str] = None
    riferimento_normativo: Optional[str] = None

    class Config:
        from_attributes = True


class FatturaAmministrazionePagamentoResponse(BaseModel):
    id: int
    modalita_pagamento: Optional[str] = None
    data_riferimento: Optional[date] = None
    giorni_termine: Optional[int] = None
    data_scadenza: Optional[date] = None
    importo: Optional[Decimal] = None
    codice_pagamento: Optional[str] = None
    iban: Optional[str] = None
    banca: Optional[str] = None
    note: Optional[str] = None

    class Config:
        from_attributes = True


class FatturaAmministrazioneRicezioneResponse(BaseModel):
    id: int
    riferimento_numero_linea: Optional[int] = None
    id_documento: Optional[str] = None

    class Config:
        from_attributes = True


class FatturaAmministrazioneResponse(FatturaAmministrazioneBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    dati_xml: Optional[dict] = None
    xml_raw: Optional[str] = None
    righe: Optional[List[Dict[str, Any]]] = None
    linee: List["FatturaAmministrazioneLineaResponse"] = Field(default_factory=list)
    riepiloghi: List["FatturaAmministrazioneRiepilogoResponse"] = Field(default_factory=list)
    pagamenti_programmati: List["FatturaAmministrazionePagamentoResponse"] = Field(default_factory=list)
    ricezioni: List["FatturaAmministrazioneRicezioneResponse"] = Field(default_factory=list)
    
    class Config:
        from_attributes = True


# Risolvi i forward reference dopo che tutte le classi sono state definite
FatturaAmministrazioneCreate.model_rebuild()
FatturaAmministrazioneUpdate.model_rebuild()
FatturaAmministrazioneResponse.model_rebuild()

