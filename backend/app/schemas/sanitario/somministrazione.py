"""Schemi Pydantic per Somministrazione"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal

# Import schemi relazioni per nested response
from app.schemas.allevamento.animale import AnimaleResponse
from app.schemas.sanitario.farmaco import FarmacoResponse
from app.schemas.sanitario.lotto_farmaco import LottoFarmacoResponse


class SomministrazioneBase(BaseModel):
    animale_id: int = Field(..., description="ID dell'animale")
    farmaco_id: int = Field(..., description="ID del farmaco")
    lotto_farmaco_id: Optional[int] = Field(None, description="ID del lotto farmaco utilizzato")
    data_ora: Optional[datetime] = Field(None, description="Data e ora della somministrazione")
    quantita: Decimal = Field(..., gt=0, description="Quantità somministrata")
    operatore_id: Optional[int] = Field(None, description="ID dell'operatore")
    operatore_nome: Optional[str] = Field(None, max_length=100, description="Nome dell'operatore")
    veterinario: Optional[str] = Field(None, max_length=100, description="Nome del veterinario")
    note: Optional[str] = Field(None, description="Note sulla somministrazione")
    reazioni_avverse: Optional[str] = Field(None, description="Eventuali reazioni avverse")
    periodo_sospensione: Optional[int] = Field(None, ge=0, description="Giorni di sospensione prima della macellazione")


class SomministrazioneCreate(SomministrazioneBase):
    pass


class SomministrazioneUpdate(BaseModel):
    animale_id: Optional[int] = Field(None, description="ID dell'animale")
    farmaco_id: Optional[int] = Field(None, description="ID del farmaco")
    lotto_farmaco_id: Optional[int] = Field(None, description="ID del lotto farmaco utilizzato")
    data_ora: Optional[datetime] = None
    quantita: Optional[Decimal] = Field(None, gt=0)
    operatore_id: Optional[int] = None
    operatore_nome: Optional[str] = Field(None, max_length=100)
    veterinario: Optional[str] = Field(None, max_length=100)
    note: Optional[str] = None
    reazioni_avverse: Optional[str] = None
    periodo_sospensione: Optional[int] = Field(None, ge=0)


class SomministrazioneResponse(SomministrazioneBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Relazioni nested (opzionali, vengono popolate quando caricate con joinedload)
    animale: Optional[AnimaleResponse] = None
    farmaco: Optional[FarmacoResponse] = None
    lotto_farmaco: Optional[LottoFarmacoResponse] = None
    
    class Config:
        from_attributes = True


# ============ SOMMINISTRAZIONI DI GRUPPO ============
class AnimaleCandidatoInfo(BaseModel):
    """Informazioni su un animale candidato per somministrazione di gruppo"""
    animale_id: int
    auricolare: str
    stato: str
    partita_ingresso_id: Optional[int] = None
    partita_ingresso_numero: Optional[str] = None
    partita_ingresso_data: Optional[date] = None
    box_id: Optional[int] = None
    box_nome: Optional[str] = None
    
    class Config:
        from_attributes = True


class PartitaAnimaliInfo(BaseModel):
    """Informazioni su una partita con i suoi animali"""
    partita_id: int
    numero_partita: Optional[str] = None
    data: Optional[date] = None
    numero_capi: int
    animali: List[AnimaleCandidatoInfo]
    
    class Config:
        from_attributes = True


class AnimaliCandidatiResponse(BaseModel):
    """Risposta con animali candidati raggruppati per partita"""
    target_tipo: str
    target_id: int
    target_label: str
    totale_animali: int
    partite: List[PartitaAnimaliInfo]
    animali_senza_partita: List[AnimaleCandidatoInfo]
    
    class Config:
        from_attributes = True


class SomministrazioneGruppoCreate(BaseModel):
    """Richiesta per creare somministrazioni di gruppo"""
    target_tipo: str = Field(..., description="box, stabilimento o sede")
    target_id: int = Field(..., description="ID del target")
    farmaco_id: int = Field(..., description="ID del farmaco")
    lotto_farmaco_id: Optional[int] = Field(None, description="ID del lotto farmaco utilizzato")
    quantita_totale: Decimal = Field(..., gt=0, description="Quantità totale da distribuire")
    data_ora: Optional[datetime] = Field(None, description="Data e ora della somministrazione")
    operatore_id: Optional[int] = Field(None, description="ID dell'operatore")
    operatore_nome: Optional[str] = Field(None, max_length=100, description="Nome dell'operatore")
    veterinario: Optional[str] = Field(None, max_length=100, description="Nome del veterinario")
    note: Optional[str] = Field(None, description="Note sulla somministrazione")
    periodo_sospensione: Optional[int] = Field(None, ge=0, description="Giorni di sospensione prima della macellazione")
    # Esclusioni
    partite_escluse: List[int] = Field(default_factory=list, description="Lista di partita_id da escludere")
    animali_esclusi: List[int] = Field(default_factory=list, description="Lista di animale_id da escludere")
    animali_reinclusi: List[int] = Field(default_factory=list, description="Lista di animale_id da reincludere (anche se la loro partita è esclusa)")
    
    class Config:
        from_attributes = True


class SomministrazioneGruppoResponse(BaseModel):
    """Risposta dopo creazione somministrazioni di gruppo"""
    somministrazioni_creates: int
    animali_inclusi: int
    animali_esclusi: int
    quota_per_capo: Decimal
    somministrazioni: List[SomministrazioneResponse]
    
    class Config:
        from_attributes = True

