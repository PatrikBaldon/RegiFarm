"""
Animale schemas
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from decimal import Decimal


class AnimaleBase(BaseModel):
    auricolare: str = Field(..., max_length=20)
    specie: Optional[str] = Field("bovino", max_length=20)
    razza: Optional[str] = Field(None, max_length=50)
    sesso: Optional[str] = Field(None, pattern="^(M|F)$")
    data_nascita: Optional[date] = None
    data_arrivo: date
    peso_arrivo: Optional[Decimal] = None
    tipo_allevamento: Optional[str] = Field(None, pattern="^(svezzamento|ingrasso|universale)$")


class AnimaleCreate(AnimaleBase):
    azienda_id: int
    box_id: Optional[int] = None


class AnimaleUpdate(BaseModel):
    # Dati anagrafici base
    specie: Optional[str] = Field(None, max_length=20)
    razza: Optional[str] = Field(None, max_length=50)
    sesso: Optional[str] = Field(None, pattern="^(M|F)$")
    data_nascita: Optional[date] = None
    
    # Dati anagrafe nazionali
    codice_elettronico: Optional[str] = Field(None, max_length=50)
    codice_madre: Optional[str] = Field(None, max_length=20)
    codice_assegnato_precedenza: Optional[str] = Field(None, max_length=20)
    
    # Provenienza anagrafe
    codice_azienda_anagrafe: Optional[str] = Field(None, max_length=20)
    codice_provenienza: Optional[str] = Field(None, max_length=20)
    identificativo_fiscale_provenienza: Optional[str] = Field(None, max_length=20)
    specie_allevata_provenienza: Optional[str] = Field(None, max_length=50)
    
    # Ingresso
    motivo_ingresso: Optional[str] = Field(None, max_length=1)
    data_arrivo: Optional[date] = None
    peso_arrivo: Optional[Decimal] = None
    numero_modello_ingresso: Optional[str] = Field(None, max_length=50)
    data_modello_ingresso: Optional[date] = None
    
    # Ciclo di vita interno
    tipo_allevamento: Optional[str] = Field(None, pattern="^(svezzamento|ingrasso|universale)$")
    
    # Dati fisici attuali
    peso_attuale: Optional[Decimal] = None
    data_ultima_pesata: Optional[date] = None
    
    # Uscita
    stato: Optional[str] = Field(None, pattern="^(presente|venduto|deceduto|trasferito|macellato)$")
    motivo_uscita: Optional[str] = Field(None, max_length=1)
    data_uscita: Optional[date] = None
    numero_modello_uscita: Optional[str] = Field(None, max_length=50)
    data_modello_uscita: Optional[date] = None
    
    # Destinazione uscita
    codice_azienda_destinazione: Optional[str] = Field(None, max_length=20)
    codice_fiera_destinazione: Optional[str] = Field(None, max_length=20)
    codice_stato_destinazione: Optional[str] = Field(None, max_length=20)
    regione_macello_destinazione: Optional[str] = Field(None, max_length=100)
    codice_macello_destinazione: Optional[str] = Field(None, max_length=20)
    codice_pascolo_destinazione: Optional[str] = Field(None, max_length=20)
    codice_circo_destinazione: Optional[str] = Field(None, max_length=20)
    
    # Macellazione
    data_macellazione: Optional[date] = None
    abbattimento: Optional[str] = Field(None, max_length=1)
    data_provvvedimento: Optional[date] = None
    
    # Localizzazione attuale (box_id può essere modificato tramite movimentazione, ma lo lasciamo per compatibilità)
    box_id: Optional[int] = None
    
    # Origine e sync dati
    origine_dati: Optional[str] = Field(None, pattern="^(manuale|anagrafe|misto)$")
    
    # Valore economico specifico dell'animale
    valore: Optional[Decimal] = None


class AnimaleResponse(AnimaleBase):
    id: int
    azienda_id: int
    box_id: Optional[int] = None
    
    # Dati anagrafe nazionali
    codice_elettronico: Optional[str] = None
    codice_madre: Optional[str] = None
    codice_assegnato_precedenza: Optional[str] = None
    
    # Provenienza anagrafe
    codice_azienda_anagrafe: Optional[str] = None
    codice_provenienza: Optional[str] = None
    identificativo_fiscale_provenienza: Optional[str] = None
    specie_allevata_provenienza: Optional[str] = None
    
    # Ingresso completo
    motivo_ingresso: Optional[str] = None
    numero_modello_ingresso: Optional[str] = None
    data_modello_ingresso: Optional[date] = None
    
    # Dati fisici attuali
    peso_attuale: Optional[Decimal] = None
    data_ultima_pesata: Optional[date] = None
    
    # Uscita
    stato: str
    motivo_uscita: Optional[str] = None
    data_uscita: Optional[date] = None
    numero_modello_uscita: Optional[str] = None
    data_modello_uscita: Optional[date] = None
    
    # Destinazione uscita
    codice_azienda_destinazione: Optional[str] = None
    codice_fiera_destinazione: Optional[str] = None
    codice_stato_destinazione: Optional[str] = None
    regione_macello_destinazione: Optional[str] = None
    codice_macello_destinazione: Optional[str] = None
    codice_pascolo_destinazione: Optional[str] = None
    codice_circo_destinazione: Optional[str] = None
    
    # Macellazione
    data_macellazione: Optional[date] = None
    abbattimento: Optional[str] = None
    data_provvvedimento: Optional[date] = None
    
    # Origine e sync dati
    origine_dati: Optional[str] = None
    ultima_sync_anagrafe: Optional[datetime] = None
    data_estrazione_dati_anagrafe: Optional[date] = None
    
    # Soccida
    contratto_soccida_id: Optional[int] = None
    
    # Valore economico specifico dell'animale
    valore: Optional[Decimal] = None
    
    # Localizzazione
    data_inserimento_box: Optional[datetime] = None
    
    # Data arrivo originale (dalla prima partita di ingresso esterno, non trasferimenti interni)
    data_arrivo_originale: Optional[date] = None
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class AnimaleDetailResponse(AnimaleResponse):
    """Schema esteso per dettaglio animale con decesso e partita ingresso esterno"""
    decesso: Optional[dict] = None
    partita_ingresso_esterno: Optional[dict] = None

