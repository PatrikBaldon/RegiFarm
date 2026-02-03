"""Schemi Pydantic per gli utenti associati alle aziende"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


class AziendaUtenteBase(BaseModel):
    email: str
    ruolo: str = Field(..., max_length=50)
    stato: Optional[str] = Field("invited", max_length=20)


class AziendaUtenteCreate(BaseModel):
    email: str
    ruolo: str = Field("operatore", max_length=50)
    send_password_reset: bool = True
    temporary_password: Optional[str] = Field(
        None, description="Password provvisoria da comunicare manualmente"
    )
    metadata: Optional[dict] = Field(
        default=None, description="Metadati extra da associare all'utente"
    )


class AziendaUtenteResponse(AziendaUtenteBase):
    id: int
    azienda_id: int
    auth_user_id: UUID
    invite_sent_at: Optional[datetime]
    first_login_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

