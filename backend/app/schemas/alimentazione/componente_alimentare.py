from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ComponenteAlimentareBase(BaseModel):
    azienda_id: int
    nome: str
    tipo: Optional[str] = None
    unita_misura: Optional[str] = None
    autoprodotto: Optional[bool] = None
    costo_unitario: Optional[float] = None
    per_svezzamento: Optional[bool] = None
    per_ingrasso: Optional[bool] = None
    note: Optional[str] = None

class ComponenteAlimentareCreate(ComponenteAlimentareBase):
    nome: str

class ComponenteAlimentareUpdate(BaseModel):
    azienda_id: Optional[int] = None
    nome: Optional[str] = None
    tipo: Optional[str] = None
    unita_misura: Optional[str] = None
    autoprodotto: Optional[bool] = None
    costo_unitario: Optional[float] = None
    per_svezzamento: Optional[bool] = None
    per_ingrasso: Optional[bool] = None
    note: Optional[str] = None

class ComponenteAlimentareResponse(ComponenteAlimentareBase):
    id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    deleted_at: Optional[datetime]

    class Config:
        from_attributes = True
