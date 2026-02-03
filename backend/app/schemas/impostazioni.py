from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime

class ImpostazioniBase(BaseModel):
    modulo: str
    configurazione: Dict[str, Any] = {}

class ImpostazioniCreate(ImpostazioniBase):
    pass

class ImpostazioniUpdate(BaseModel):
    configurazione: Dict[str, Any] = {}

class ImpostazioniResponse(ImpostazioniBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Schema per l'intera configurazione (tutti i moduli)
class ImpostazioniCompletaResponse(BaseModel):
    moduli: Dict[str, Any] = {}
    amministrazione: Dict[str, Any] = {}
    attrezzature: Dict[str, Any] = {}
    prima_nota: Dict[str, Any] = {}
    ddt_emessi: Dict[str, Any] = {}

