"""Schemi Pydantic per PartitaAnimale"""
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List, Dict, Union
from datetime import datetime, date
from decimal import Decimal
import json
from app.models.amministrazione.partita_animale import (
    ModalitaGestionePartita,
    TipoPartita,
)
from app.models.amministrazione.partita_animale_movimento_finanziario import (
    PartitaMovimentoDirezione,
    PartitaMovimentoTipo,
)


class PesoIndividuale(BaseModel):
    """Schema per peso individuale animale"""
    auricolare: str = Field(..., description="Codice auricolare")
    peso: Decimal = Field(..., description="Peso in kg")


class PartitaAnimaleBase(BaseModel):
    azienda_id: int = Field(..., description="ID azienda")
    tipo: TipoPartita = Field(..., description="Tipo partita: ingresso o uscita")
    data: date = Field(..., description="Data partita")
    numero_partita: Optional[str] = Field(None, max_length=50, description="Numero univoco partita")
    codice_stalla: str = Field(..., max_length=20, description="Codice stalla provenienza/destinazione esterna")
    nome_stalla: Optional[str] = Field(None, max_length=200, description="Nome leggibile stalla esterna")
    codice_stalla_azienda: Optional[str] = Field(None, max_length=20, description="Codice stalla dell'allevamento dell'utente (destinazione per ingressi, provenienza per uscite)")
    numero_capi: int = Field(..., description="Numero capi nella partita")
    peso_totale: Optional[Decimal] = Field(None, description="Peso totale")
    peso_medio: Optional[Decimal] = Field(None, description="Peso medio per capo")
    pesi_individuali: Optional[List[PesoIndividuale]] = Field(None, description="Pesi individuali per capo")
    modalita_gestione: Optional[ModalitaGestionePartita] = Field(
        None, description="Modalità di gestione economica della partita (NULL per trasferimenti interni o uscite verso non gestiti)"
    )
    costo_unitario: Optional[Decimal] = Field(None, description="Costo unitario stimato per capo")
    valore_totale: Optional[Decimal] = Field(None, description="Valore totale stimato della partita")
    fattura_amministrazione_id: Optional[int] = Field(
        None, description="ID fattura di acquisto collegata"
    )
    fattura_emessa_id: Optional[int] = Field(
        None, description="ID fattura emessa collegata"
    )
    file_anagrafe_origine: Optional[str] = Field(None, max_length=500, description="Path file .gzip originale")
    motivo: Optional[str] = Field(None, max_length=5, description="Motivo ingresso/uscita")
    numero_modello: Optional[str] = Field(None, max_length=50, description="Numero modello movimento")
    is_trasferimento_interno: bool = Field(False, description="True se trasferimento interno, False se esterno")
    note: Optional[str] = Field(None, description="Note")


class PartitaAnimaleCreate(PartitaAnimaleBase):
    pass


class PartitaAnimaleUpdate(BaseModel):
    tipo: Optional[TipoPartita] = None
    data: Optional[date] = None
    numero_partita: Optional[str] = Field(None, max_length=50)
    codice_stalla: Optional[str] = Field(None, max_length=20)
    nome_stalla: Optional[str] = Field(None, max_length=200)
    codice_stalla_azienda: Optional[str] = Field(None, max_length=20)
    numero_capi: Optional[int] = None
    peso_totale: Optional[Decimal] = None
    peso_medio: Optional[Decimal] = None
    pesi_individuali: Optional[List[PesoIndividuale]] = None
    motivo: Optional[str] = Field(None, max_length=5)
    numero_modello: Optional[str] = Field(None, max_length=50)
    is_trasferimento_interno: Optional[bool] = None
    note: Optional[str] = None
    modalita_gestione: Optional[ModalitaGestionePartita] = None
    costo_unitario: Optional[Decimal] = None
    valore_totale: Optional[Decimal] = None
    fattura_amministrazione_id: Optional[int] = None
    fattura_emessa_id: Optional[int] = None


class PartitaMovimentoFinanziarioBase(BaseModel):
    direzione: PartitaMovimentoDirezione
    tipo: PartitaMovimentoTipo
    modalita: Optional[ModalitaGestionePartita] = None
    data: date
    importo: Decimal
    note: Optional[str] = None
    fattura_amministrazione_id: Optional[int] = None
    fattura_emessa_id: Optional[int] = None
    pn_movimento_id: Optional[int] = None
    riferimento_documento: Optional[str] = Field(None, max_length=120)


class PartitaMovimentoFinanziarioCreate(PartitaMovimentoFinanziarioBase):
    partita_id: Optional[int] = None


class PartitaMovimentoFinanziarioUpdate(BaseModel):
    direzione: Optional[PartitaMovimentoDirezione] = None
    tipo: Optional[PartitaMovimentoTipo] = None
    modalita: Optional[ModalitaGestionePartita] = None
    data: Optional[date] = None
    importo: Optional[Decimal] = None
    note: Optional[str] = None
    fattura_amministrazione_id: Optional[int] = None
    fattura_emessa_id: Optional[int] = None
    pn_movimento_id: Optional[int] = None
    riferimento_documento: Optional[str] = Field(None, max_length=120)
    attivo: Optional[bool] = None


class PartitaMovimentoFinanziarioResponse(PartitaMovimentoFinanziarioBase):
    id: int
    partita_id: int
    attivo: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PartitaAnimaleResponse(PartitaAnimaleBase):
    id: int
    data_importazione: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    contratto_soccida_id: Optional[int] = None
    data_chiusura: Optional[date] = None  # se valorizzata la partita non compare in acconti/saldi
    movimenti_finanziari: List[PartitaMovimentoFinanziarioResponse] = Field(default_factory=list)
    
    @field_validator('pesi_individuali', mode='before')
    @classmethod
    def parse_pesi_individuali(cls, v):
        """Deserializza pesi_individuali da stringa JSON a lista"""
        if v is None:
            return None
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if parsed else None
            except (json.JSONDecodeError, TypeError):
                return None
        if isinstance(v, list):
            return v
        return None

    model_config = ConfigDict(from_attributes=True)


class PartitaAnimaleConfirm(BaseModel):
    """Schema per conferma partita da anagrafe"""
    azienda_id: int = Field(..., description="ID azienda")
    tipo: str = Field(..., description="Tipo partita: 'ingresso' o 'uscita'")
    data: str = Field(..., description="Data partita (ISO format o YYYY-MM-DD)")
    codice_stalla: str = Field(..., max_length=20, description="Codice stalla provenienza/destinazione esterna")
    codice_stalla_azienda: Optional[str] = Field(None, max_length=20, description="Codice stalla dell'allevamento dell'utente")
    numero_capi: int = Field(..., description="Numero capi")
    peso_totale: Optional[Decimal] = Field(None, description="Peso totale partita")
    is_trasferimento_interno: bool = Field(False, description="Trasferimento interno")
    codici_capi: List[str] = Field(default_factory=list, description="Lista codici capi")
    motivo: Optional[str] = Field(None, max_length=5, description="Motivo movimento (D, 02, 2 per decesso)")
    numero_modello: Optional[str] = Field(None, max_length=50, description="Numero modello")
    file_anagrafe_origine: Optional[str] = Field(None, max_length=500, description="File origine")
    animali_dati: Optional[Dict[str, Dict[str, Union[str, date]]]] = Field(None, description="Dati anagrafici per ogni animale (sesso, razza, data_nascita)")
    modalita_gestione: ModalitaGestionePartita = Field(
        ModalitaGestionePartita.PROPRIETA,
        description="Modalità di gestione economica della partita (proprieta, soccida_monetizzata, soccida_fatturata)",
    )
    
    @field_validator('modalita_gestione', mode='before')
    @classmethod
    def validate_modalita_gestione(cls, v):
        """Converte stringa a enum se necessario (supporta tutte le modalità: proprieta, soccida_monetizzata, soccida_fatturata)"""
        if isinstance(v, str):
            try:
                return ModalitaGestionePartita(v)
            except ValueError:
                # Se la stringa non corrisponde a un valore enum valido, usa il default
                return ModalitaGestionePartita.PROPRIETA
        elif isinstance(v, ModalitaGestionePartita):
            return v
        return ModalitaGestionePartita.PROPRIETA
    costo_unitario: Optional[Decimal] = Field(
        None, description="Costo unitario stimato per capo", ge=0
    )
    valore_totale: Optional[Decimal] = Field(
        None, description="Valore totale della partita", ge=0
    )
    fattura_amministrazione_id: Optional[int] = Field(
        None, description="ID fattura acquisto collegata"
    )
    fattura_emessa_id: Optional[int] = Field(
        None, description="ID fattura emessa collegata"
    )
    pesi_individuali: Optional[List[PesoIndividuale]] = Field(
        None, description="Pesi individuali per capo (opzionali)"
    )

