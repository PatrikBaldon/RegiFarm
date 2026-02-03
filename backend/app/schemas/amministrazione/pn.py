from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.amministrazione.pn import (
    PNContoTipo,
    PNDocumentoTipo,
    PNMovimentoOrigine,
    PNStatoMovimento,
    PNGirocontoStrategia,
    PNTipoOperazione,
)


class PNContoBase(BaseModel):
    nome: str
    tipo: PNContoTipo
    note: Optional[str] = None
    attivo: bool = True
    giroconto_strategia: Optional[PNGirocontoStrategia] = PNGirocontoStrategia.AUTOMATICO


class PNContoCreate(PNContoBase):
    azienda_id: int
    saldo_iniziale: Decimal = Decimal("0")
    saldo_attuale: Optional[Decimal] = None


class PNContoUpdate(BaseModel):
    nome: Optional[str] = None
    tipo: Optional[PNContoTipo] = None
    note: Optional[str] = None
    attivo: Optional[bool] = None
    giroconto_strategia: Optional[PNGirocontoStrategia] = None
    saldo_iniziale: Optional[Decimal] = None
    saldo_attuale: Optional[Decimal] = None


class PNContoIbanBase(BaseModel):
    iban: str = Field(..., max_length=34)
    descrizione: Optional[str] = Field(None, max_length=120)
    predefinito: bool = False
    attivo: bool = True


class PNContoIbanCreate(PNContoIbanBase):
    conto_id: Optional[int] = None


class PNContoIbanUpdate(BaseModel):
    iban: Optional[str] = Field(None, max_length=34)
    descrizione: Optional[str] = Field(None, max_length=120)
    predefinito: Optional[bool] = None
    attivo: Optional[bool] = None


class PNContoIbanResponse(PNContoIbanBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PNMovimentoDocumentoInput(BaseModel):
    documento_tipo: PNDocumentoTipo
    documento_id: int
    importo: Decimal


class PNMovimentoDocumentoResponse(PNMovimentoDocumentoInput):
    id: int
    created_at: datetime
    updated_at: datetime
    contropartita: Optional[str] = None
    riferimento: Optional[str] = None
    data_documento: Optional[date] = None

    model_config = ConfigDict(from_attributes=True)


class PNMovimentoBase(BaseModel):
    conto_id: int
    tipo_operazione: PNTipoOperazione
    importo: Decimal
    data: date
    descrizione: str
    categoria_id: Optional[int] = None
    conto_destinazione_id: Optional[int] = None
    note: Optional[str] = None
    stato: PNStatoMovimento = PNStatoMovimento.DEFINITIVO
    contropartita_nome: Optional[str] = None
    quota_extra: Optional[Decimal] = None
    metodo_pagamento: Optional[str] = None
    documento_riferimento: Optional[str] = None
    riferimento_esterno: Optional[str] = None
    collegamenti: Optional[List[PNMovimentoDocumentoInput]] = None
    fattura_emessa_id: Optional[int] = None
    fattura_amministrazione_id: Optional[int] = None
    pagamento_id: Optional[int] = None
    partita_id: Optional[int] = None
    attrezzatura_id: Optional[int] = None
    contratto_soccida_id: Optional[int] = None


class PNMovimentoCreate(PNMovimentoBase):
    azienda_id: Optional[int] = None
    origine: PNMovimentoOrigine = PNMovimentoOrigine.MANUALE


class PNMovimentoUpdate(BaseModel):
    conto_id: Optional[int] = None
    tipo_operazione: Optional[PNTipoOperazione] = None
    importo: Optional[Decimal] = None
    data: Optional[date] = None
    descrizione: Optional[str] = None
    categoria_id: Optional[int] = None
    conto_destinazione_id: Optional[int] = None
    note: Optional[str] = None
    stato: Optional[PNStatoMovimento] = None
    contropartita_nome: Optional[str] = None
    quota_extra: Optional[Decimal] = None
    metodo_pagamento: Optional[str] = None
    documento_riferimento: Optional[str] = None
    riferimento_esterno: Optional[str] = None
    collegamenti: Optional[List[PNMovimentoDocumentoInput]] = None
    partita_id: Optional[int] = None
    attrezzatura_id: Optional[int] = None
    contratto_soccida_id: Optional[int] = None


class PNContoResponse(BaseModel):
    id: int
    nome: str
    tipo: PNContoTipo
    saldo_iniziale: Decimal
    saldo_attuale: Decimal
    attivo: bool
    note: Optional[str] = None
    giroconto_strategia: Optional[PNGirocontoStrategia] = PNGirocontoStrategia.AUTOMATICO
    created_at: datetime
    updated_at: Optional[datetime] = None
    movimenti_provvisori: int = 0
    aggiornato_il: Optional[datetime] = None
    ibans: List[PNContoIbanResponse] = Field(default_factory=list)
    sistema: bool = False  # True = conto di sistema (sola lettura in UI)

    model_config = ConfigDict(from_attributes=True)


class PNCategoriaBase(BaseModel):
    nome: str = Field(..., max_length=120)
    codice: Optional[str] = Field(None, max_length=60)
    tipo_operazione: PNTipoOperazione
    descrizione: Optional[str] = None
    ordine: int = Field(default=0, ge=0)
    attiva: bool = Field(default=True)
    richiede_terreno: bool = Field(default=False)
    richiede_attrezzatura: bool = Field(default=False)
    macrocategoria: Optional[str] = Field(None, max_length=50)


class PNCategoriaCreate(PNCategoriaBase):
    azienda_id: int


class PNCategoriaUpdate(BaseModel):
    nome: Optional[str] = Field(None, max_length=120)
    codice: Optional[str] = Field(None, max_length=60)
    tipo_operazione: Optional[PNTipoOperazione] = None
    descrizione: Optional[str] = None
    ordine: Optional[int] = Field(None, ge=0)
    attiva: Optional[bool] = None
    richiede_terreno: Optional[bool] = None
    richiede_attrezzatura: Optional[bool] = None
    macrocategoria: Optional[str] = Field(None, max_length=50)


class PNCategoriaResponse(BaseModel):
    id: int
    azienda_id: int
    nome: str
    codice: Optional[str] = None
    tipo_operazione: PNTipoOperazione
    descrizione: Optional[str] = None
    ordine: int
    attiva: bool
    creata_dal_sistema: bool
    richiede_terreno: bool
    richiede_attrezzatura: bool
    macrocategoria: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PNPreferenzeResponse(BaseModel):
    conto_predefinito_id: Optional[int] = None
    conto_incassi_id: Optional[int] = None
    conto_pagamenti_id: Optional[int] = None
    conto_debiti_fornitori_id: Optional[int] = None
    conto_crediti_clienti_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class PartitaCollegataResponse(BaseModel):
    """Partita collegata tramite PartitaMovimentoFinanziario"""
    id: int
    numero_partita: Optional[str] = None
    data: date
    tipo: str
    numero_capi: Optional[int] = None
    importo: Decimal
    direzione: str
    tipo_movimento: str

    model_config = ConfigDict(from_attributes=True)


class PNMovimentoResponse(PNMovimentoBase):
    id: int
    azienda_id: int
    origine: PNMovimentoOrigine
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    categoria_nome: Optional[str] = None
    categoria_label: Optional[str] = None
    conto_nome: Optional[str] = None
    conto_destinazione_nome: Optional[str] = None
    documenti: List[PNMovimentoDocumentoResponse] = Field(default_factory=list)
    attrezzatura_nome: Optional[str] = None
    partite_collegate: List[PartitaCollegataResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class PNRiepilogoResponse(BaseModel):
    entrate: Decimal
    uscite: Decimal
    saldo: Decimal


class PNMovimentiListResponse(BaseModel):
    movimenti: List[PNMovimentoResponse]
    riepilogo: PNRiepilogoResponse


class PNSetupResponse(BaseModel):
    conti: List[PNContoResponse]
    categorie: List[PNCategoriaResponse]
    preferenze: PNPreferenzeResponse


class PNDocumentoApertoResponse(BaseModel):
    id: int
    tipo: str
    riferimento: Optional[str] = None
    data: Optional[date] = None
    contropartita: Optional[str] = None
    residuo: Decimal
    tipo_documento: Optional[str] = None  # TD01, TD02, TD04, TD05, etc.
    condizioni_pagamento: Optional[str] = None  # TP01, TP02, TP03, etc.
    tipo_fattura: Optional[str] = None  # 'entrata' o 'uscita' - per distinguere fatture emesse/ricevute
    contratto_soccida_id: Optional[int] = None  # ID contratto soccida se il cliente è una società di soccida
    is_soccida: Optional[bool] = False  # True se il cliente/fornitore è una società di soccida

    model_config = ConfigDict(from_attributes=True)


class SoccidaAccontoCreate(BaseModel):
    """Schema per creare un acconto o saldo a chiusura per soccida monetizzata"""
    contratto_id: int
    importo: Decimal
    data: date
    partita_ids: Optional[List[int]] = None  # Se None, associa solo al contratto
    note: Optional[str] = None
    tipo: str = "acconto"  # "acconto" | "saldo" - se "saldo" le partite vengono marcate chiuse


class SoccidaAccontoResponse(BaseModel):
    """Schema di risposta per acconto soccida registrato"""
    movimento_id: int
    movimento: PNMovimentoResponse
    partita_movimenti: List[dict] = Field(default_factory=list)  # Lista di PartitaMovimentoFinanziarioResponse
    acconto_per_capo: dict = Field(default_factory=dict)  # partita_id -> importo per capo

    model_config = ConfigDict(from_attributes=True)


class SyncFattureErrorItem(BaseModel):
    """Errore su una singola fattura durante la sync Prima Nota"""
    fattura_id: int
    numero: Optional[str] = None
    azienda_id: Optional[int] = None
    error: str


class SyncFattureResponse(BaseModel):
    """Risposta del servizio di sincronizzazione fatture -> Prima Nota"""
    processed: int = Field(description="Numero di fatture elaborate con successo")
    total: int = Field(description="Numero totale di fatture considerate")
    errors: List[SyncFattureErrorItem] = Field(default_factory=list, description="Eventuali errori per fattura")
