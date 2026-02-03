"""
ContrattoSoccida schemas
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from decimal import Decimal

from app.schemas.amministrazione.fornitore import FornitoreResponse
from app.schemas.allevamento.azienda import AziendaResponse


class ContrattoSoccidaBase(BaseModel):
    """Schema base per contratto soccida"""
    numero_contratto: Optional[str] = Field(None, max_length=50)
    data_inizio: date
    data_fine: Optional[date] = None
    tipologia: str = Field(..., description="Tipologia: semplice, parziaria, con_pascolo, monetizzato")
    modalita_remunerazione: str = Field(..., description="Modalità: ripartizione_utili, quota_giornaliera, prezzo_kg, percentuale")
    
    # Parametri remunerazione
    quota_giornaliera: Optional[Decimal] = None
    prezzo_per_kg: Optional[Decimal] = None
    percentuale_remunerazione: Optional[Decimal] = None
    percentuale_soccidante: Optional[Decimal] = None
    
    # Gestione costi
    mangimi_a_carico_soccidante: bool = False
    medicinali_a_carico_soccidante: bool = False
    
    # Gestione decessi
    quota_decesso_tipo: Optional[str] = Field(None, description="fissa, per_capo, percentuale")
    quota_decesso_valore: Optional[Decimal] = None
    termine_responsabilita_soccidario_giorni: Optional[int] = None
    copertura_totale_soccidante: bool = False
    
    # Aggiunte/sottrazioni (già presenti, usate per calcolo kg netti)
    percentuale_aggiunta_arrivo: Optional[Decimal] = Field(0, ge=0, le=100)
    percentuale_sottrazione_uscita: Optional[Decimal] = Field(0, ge=0, le=100)
    
    # Tipo di allevamento (un solo tipo per contratto)
    tipo_allevamento: Optional[str] = Field(None, description="svezzamento, ingrasso, universale")
    
    # Prezzo per tipo allevamento (esclusa IVA)
    prezzo_allevamento: Optional[Decimal] = None
    
    # Monetizzazione della quota (soccida monetizzata)
    monetizzata: bool = True
    
    # Bonus performance
    bonus_mortalita_attivo: bool = False
    bonus_mortalita_percentuale: Optional[Decimal] = None
    bonus_incremento_attivo: bool = False
    bonus_incremento_kg_soglia: Optional[Decimal] = None
    bonus_incremento_percentuale: Optional[Decimal] = None
    
    # Durata e rinnovo
    rinnovo_per_consegna: bool = True
    preavviso_disdetta_giorni: int = Field(90, ge=0)
    giorni_gestione_previsti: Optional[int] = Field(None, ge=1, description="Durata prevista gestione animali in giorni (es. 180 dalla data di arrivo)")
    
    # Scenario ripartizione utili (per modalita_remunerazione='ripartizione_utili')
    scenario_ripartizione: Optional[str] = Field(None, description="Scenario ripartizione utili: 'vendita_diretta' o 'diventano_proprieta'")
    
    # Note
    note: Optional[str] = None
    condizioni_particolari: Optional[str] = None
    attivo: bool = True


class ContrattoSoccidaCreate(ContrattoSoccidaBase):
    """Schema per creazione contratto soccida"""
    azienda_id: int
    soccidante_id: int


class ContrattoSoccidaUpdate(BaseModel):
    """Schema per aggiornamento contratto soccida"""
    numero_contratto: Optional[str] = None
    data_inizio: Optional[date] = None
    data_fine: Optional[date] = None
    tipologia: Optional[str] = None
    modalita_remunerazione: Optional[str] = None
    quota_giornaliera: Optional[Decimal] = None
    prezzo_per_kg: Optional[Decimal] = None
    percentuale_remunerazione: Optional[Decimal] = None
    percentuale_soccidante: Optional[Decimal] = None
    mangimi_a_carico_soccidante: Optional[bool] = None
    medicinali_a_carico_soccidante: Optional[bool] = None
    quota_decesso_tipo: Optional[str] = None
    quota_decesso_valore: Optional[Decimal] = None
    termine_responsabilita_soccidario_giorni: Optional[int] = None
    copertura_totale_soccidante: Optional[bool] = None
    percentuale_aggiunta_arrivo: Optional[Decimal] = None
    percentuale_sottrazione_uscita: Optional[Decimal] = None
    tipo_allevamento: Optional[str] = None
    prezzo_allevamento: Optional[Decimal] = None
    monetizzata: Optional[bool] = None
    bonus_mortalita_attivo: Optional[bool] = None
    bonus_mortalita_percentuale: Optional[Decimal] = None
    bonus_incremento_attivo: Optional[bool] = None
    bonus_incremento_kg_soglia: Optional[Decimal] = None
    bonus_incremento_percentuale: Optional[Decimal] = None
    rinnovo_per_consegna: Optional[bool] = None
    preavviso_disdetta_giorni: Optional[int] = None
    giorni_gestione_previsti: Optional[int] = None
    scenario_ripartizione: Optional[str] = None
    note: Optional[str] = None
    condizioni_particolari: Optional[str] = None
    attivo: Optional[bool] = None


class ContrattoSoccidaResponse(ContrattoSoccidaBase):
    """Schema per risposta contratto soccida"""
    id: int
    azienda_id: int
    soccidante_id: int
    created_at: datetime
    updated_at: Optional[datetime]
    deleted_at: Optional[datetime]
    
    class Config:
        from_attributes = True  # Pydantic v2: orm_mode è stato rinominato


class ContrattoSoccidaWithRelations(ContrattoSoccidaResponse):
    """Schema con relazioni (soccidante, azienda)"""
    soccidante: Optional[FornitoreResponse] = None
    azienda: Optional[AziendaResponse] = None
    numero_animali: Optional[int] = Field(None, description="Numero di animali associati al contratto")
    
    class Config:
        from_attributes = True  # Pydantic v2: orm_mode è stato rinominato

