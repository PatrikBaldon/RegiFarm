from pydantic import BaseModel, ConfigDict, Field, condecimal, model_validator
from typing import Optional, List, Literal
from datetime import date, datetime


class RegistroAlimentazioneDettaglioBase(BaseModel):
    box_id: Optional[int] = None
    numero_capi: int
    quantita: condecimal(max_digits=12, decimal_places=4)
    note: Optional[str] = None
    box_nome: Optional[str] = None
    stabilimento_id: Optional[int] = None
    stabilimento_nome: Optional[str] = None


class RegistroAlimentazioneDettaglioResponse(RegistroAlimentazioneDettaglioBase):
    id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class RegistroAlimentazioneBase(BaseModel):
    data: date
    quantita_totale: condecimal(max_digits=12, decimal_places=4)
    target_tipo: Literal["box", "stabilimento", "sede"]
    target_id: int
    tipo_alimento: Literal["piano", "singolo"]
    razione_id: Optional[int] = None
    componente_alimentare_id: Optional[int] = None
    mangime_confezionato_id: Optional[int] = None
    giorni_permanenza_min: Optional[int] = None
    giorni_permanenza_max: Optional[int] = None
    note: Optional[str] = None

    @model_validator(mode="after")
    def validate_alimento(cls, model: "RegistroAlimentazioneBase"):
        if model.tipo_alimento == "piano" and not model.razione_id:
            raise ValueError(
                "Per le somministrazioni di tipo 'piano' è necessario selezionare un piano alimentare"
            )
        if model.tipo_alimento == "singolo" and not (
            model.componente_alimentare_id or model.mangime_confezionato_id
        ):
            raise ValueError(
                "Per le somministrazioni di tipo 'singolo' è necessario scegliere un alimento"
            )
        return model


class RegistroAlimentazioneCreate(RegistroAlimentazioneBase):
    pass


class RegistroAlimentazioneUpdate(BaseModel):
    data: Optional[date] = None
    quantita_totale: Optional[condecimal(max_digits=12, decimal_places=4)] = None
    target_tipo: Optional[Literal["box", "stabilimento", "sede"]] = None
    target_id: Optional[int] = None
    tipo_alimento: Optional[Literal["piano", "singolo"]] = None
    razione_id: Optional[int] = None
    componente_alimentare_id: Optional[int] = None
    mangime_confezionato_id: Optional[int] = None
    giorni_permanenza_min: Optional[int] = None
    giorni_permanenza_max: Optional[int] = None
    note: Optional[str] = None


class RegistroAlimentazioneResponse(RegistroAlimentazioneBase):
    id: int
    numero_capi: Optional[int] = None
    quota_per_capo: Optional[condecimal(max_digits=12, decimal_places=4)] = None
    azienda_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    dettagli: List[RegistroAlimentazioneDettaglioResponse] = Field(default_factory=list)
    stock_warning: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RegistroAlimentazionePreviewResponse(BaseModel):
    numero_capi: int
    quota_per_capo: condecimal(max_digits=12, decimal_places=4)
    dettagli: List[RegistroAlimentazioneDettaglioResponse]
    stock_warning: Optional[str] = None
