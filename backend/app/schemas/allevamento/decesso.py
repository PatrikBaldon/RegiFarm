"""Schemi Pydantic per Decesso"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from decimal import Decimal


class DecessoBase(BaseModel):
    animale_id: int = Field(..., description="ID animale")
    data_ora: Optional[datetime] = Field(None, description="Data e ora del decesso")
    causa: Optional[str] = Field(None, max_length=100, description="Causa del decesso")
    note: Optional[str] = Field(None, description="Note aggiuntive")
    valore_capo: Optional[Decimal] = Field(None, description="Valore economico del capo")
    costi_fino_al_decesso: Optional[Decimal] = Field(None, description="Costi sostenuti fino al decesso")
    perdita_totale: Optional[Decimal] = Field(None, description="Perdita totale (valore + costi)")
    tipo_contratto: Optional[str] = Field(None, max_length=50, description="Tipo contratto soccida")
    quota_decesso: Optional[Decimal] = Field(None, description="Quota decesso")
    responsabile: Optional[str] = Field('soccidario', max_length=20, description="Responsabile decesso")
    giorni_dall_arrivo: Optional[int] = Field(None, description="Giorni dall'arrivo")
    entro_termine_responsabilita: Optional[bool] = Field(None, description="Entro termine responsabilità")
    limite_esonero: Optional[Decimal] = Field(None, description="Limite esonero")
    fattura_smaltimento_id: Optional[int] = Field(None, description="ID fattura smaltimento")
    costo_smaltimento: Optional[Decimal] = Field(None, description="Costo smaltimento")


class DecessoCreate(DecessoBase):
    pass


class DecessoUpdate(BaseModel):
    data_ora: Optional[datetime] = None
    causa: Optional[str] = Field(None, max_length=100)
    note: Optional[str] = None
    valore_capo: Optional[Decimal] = None
    costi_fino_al_decesso: Optional[Decimal] = None
    perdita_totale: Optional[Decimal] = None
    tipo_contratto: Optional[str] = Field(None, max_length=50)
    quota_decesso: Optional[Decimal] = None
    responsabile: Optional[str] = Field(None, max_length=20)
    giorni_dall_arrivo: Optional[int] = None
    entro_termine_responsabilita: Optional[bool] = None
    limite_esonero: Optional[Decimal] = None
    fattura_smaltimento_id: Optional[int] = None
    costo_smaltimento: Optional[Decimal] = None


class DecessoResponse(DecessoBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class DecessoConfirm(BaseModel):
    """Schema per conferma decesso da anagrafe"""
    animale_id: int = Field(..., description="ID animale (deve esistere nel database)")
    codice_capo: str = Field(..., description="Codice auricolare (per riferimento)")
    data_decesso: str = Field(..., description="Data decesso (ISO format o YYYY-MM-DD)")
    valore_capo: Optional[Decimal] = Field(None, description="Valore economico del capo")
    causa: Optional[str] = Field(None, max_length=100, description="Causa del decesso")
    note: Optional[str] = Field(None, description="Note aggiuntive")
    numero_modello: Optional[str] = Field(None, max_length=50, description="Numero modello uscita")
    file_anagrafe_origine: Optional[str] = Field(None, max_length=500, description="File origine anagrafe")
    codice_stalla_azienda: Optional[str] = Field(None, max_length=20, description="Codice stalla dell'allevamento da cui esce il capo (per creazione partita uscita)")
    azienda_id: Optional[int] = Field(None, description="ID azienda (per creazione partita uscita)")

