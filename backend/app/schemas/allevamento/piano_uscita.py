"""
Piani d'uscita schemas
"""
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field, validator


class PianoUscitaBase(BaseModel):
    nome: str = Field(..., max_length=120)
    data_uscita: Optional[date] = None
    note: Optional[str] = None
    stato: Optional[str] = Field("bozza", max_length=20)

    @validator("stato")
    def validate_stato(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        allowed = {"bozza", "confermato", "completato"}
        if value not in allowed:
            raise ValueError(f"Stato non valido. Valori ammessi: {', '.join(sorted(allowed))}")
        return value


class PianoUscitaCreate(PianoUscitaBase):
    azienda_id: int
    animale_ids: List[int] = Field(default_factory=list)


class PianoUscitaUpdate(BaseModel):
    nome: Optional[str] = Field(None, max_length=120)
    data_uscita: Optional[date] = None
    note: Optional[str] = None
    stato: Optional[str] = Field(None, max_length=20)


class PianoUscitaAddAnimaliRequest(BaseModel):
    animale_ids: List[int] = Field(default_factory=list, min_items=1)


class PianoUscitaAnimaleResponse(BaseModel):
    id: int
    auricolare: str
    stato: str
    nome_sede: Optional[str] = None
    nome_stabilimento: Optional[str] = None
    nome_box: Optional[str] = None


class PianoUscitaResponse(PianoUscitaBase):
    id: int
    azienda_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PianoUscitaDetailResponse(PianoUscitaResponse):
    animali: List[PianoUscitaAnimaleResponse] = Field(default_factory=list)

