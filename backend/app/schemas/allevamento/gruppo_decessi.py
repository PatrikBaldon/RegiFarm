"""Schemi Pydantic per GruppoDecessi"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal


class GruppoDecessiBase(BaseModel):
    azienda_id: int = Field(..., description="ID azienda")
    data_uscita: date = Field(..., description="Data uscita (per raggruppamento)")
    numero_certificato_smaltimento: Optional[str] = Field(None, max_length=100, description="Numero certificato smaltimento")
    fattura_smaltimento_id: Optional[int] = Field(None, description="ID fattura smaltimento (opzionale)")
    valore_economico_totale: Optional[Decimal] = Field(None, description="Valore economico totale gruppo")
    a_carico: bool = Field(True, description="True = a carico, False = non a carico")
    file_anagrafe_origine: Optional[str] = Field(None, max_length=500, description="File origine anagrafe")
    note: Optional[str] = Field(None, max_length=500, description="Note")


class GruppoDecessiCreate(GruppoDecessiBase):
    pass


class GruppoDecessiUpdate(BaseModel):
    numero_certificato_smaltimento: Optional[str] = Field(None, max_length=100)
    fattura_smaltimento_id: Optional[int] = None
    valore_economico_totale: Optional[Decimal] = None
    a_carico: Optional[bool] = None
    note: Optional[str] = Field(None, max_length=500)


class GruppoDecessiResponse(GruppoDecessiBase):
    id: int
    data_importazione: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class GruppoDecessiWithDecessi(GruppoDecessiResponse):
    """Risposta con lista decessi inclusa"""
    decessi: List[dict] = Field(default_factory=list)


class GruppoDecessiConfirm(BaseModel):
    """Schema per conferma gruppo decessi da anagrafe"""
    azienda_id: int
    data_uscita: str  # ISO format o YYYY-MM-DD
    numero_certificato_smaltimento: Optional[str] = Field(None, max_length=100)
    fattura_smaltimento_id: Optional[int] = None
    valore_economico_totale: Optional[Decimal] = None
    a_carico: bool = Field(True)
    note: Optional[str] = Field(None, max_length=500)
    file_anagrafe_origine: Optional[str] = Field(None, max_length=500)
    codici_capi: List[str] = Field(..., description="Lista codici auricolare capi deceduti")
    animali_dati: Optional[dict] = Field(None, description="Dati completi per ogni animale (codice_stalla_decesso, numero_modello_uscita, data_modello_uscita, ecc.)")

