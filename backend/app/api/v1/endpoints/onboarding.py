"""Onboarding endpoints for aziende and operatori"""
from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import get_current_auth_user_id
from app.core.database import get_db
from app.models.allevamento import Azienda, AziendaUtente
from app.schemas.allevamento import (
    AziendaCreate,
    AziendaResponse,
    AziendaUtenteCreate,
    AziendaUtenteResponse,
)
from app.services.onboarding.aziende_service import (
    OnboardingError,
    create_azienda_with_admin,
    get_user_profile,
    invite_user_to_azienda,
    mark_user_first_login,
    register_pending_user,
    approve_pending_user,
    reject_pending_user,
)

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class OnboardingAccount(AziendaUtenteCreate):
    nome: Optional[str] = None
    ruolo: str = "admin"


class AziendaOnboardingPayload(BaseModel):
    azienda: AziendaCreate
    account: OnboardingAccount


class OnboardingResponse(BaseModel):
    azienda: AziendaResponse
    utente: AziendaUtenteResponse
    password_reset_link: Optional[str] = None
    temporary_password: Optional[str] = None


class InviteUserRequest(AziendaUtenteCreate):
    nome: Optional[str] = None


class OnboardingUserResponse(BaseModel):
    utente: AziendaUtenteResponse
    password_reset_link: Optional[str] = None
    temporary_password: Optional[str] = None


class FirstLoginRequest(BaseModel):
    auth_user_id: UUID


class CurrentUserResponse(BaseModel):
    utente: AziendaUtenteResponse
    azienda: Optional[AziendaResponse] = None


class SelfRegisterRequest(BaseModel):
    """Richiesta di registrazione self-service"""
    email: str
    nome: Optional[str] = None
    note: Optional[str] = None  # Motivo della richiesta


class SelfRegisterResponse(BaseModel):
    """Risposta alla registrazione self-service"""
    message: str
    pending: bool = True


class PendingUserResponse(BaseModel):
    """Utente in attesa di approvazione"""
    id: int
    email: str
    nome: Optional[str] = None
    note: Optional[str] = None
    created_at: Optional[str] = None


class ApproveUserRequest(BaseModel):
    """Richiesta di approvazione utente"""
    azienda_id: int  # A quale azienda associare l'utente
    ruolo: str = "operatore"


@router.post("/register", response_model=SelfRegisterResponse, status_code=status.HTTP_201_CREATED)
def self_register(
    payload: SelfRegisterRequest,
    db: Session = Depends(get_db),
):
    """
    Registrazione self-service. L'utente viene creato in stato 'pending'
    e deve essere approvato manualmente da un admin.
    """
    try:
        result = register_pending_user(
            db,
            email=payload.email,
            nome=payload.nome,
            note=payload.note,
        )
        return SelfRegisterResponse(
            message="Richiesta di registrazione inviata. Attendi l'approvazione dell'amministratore.",
            pending=True,
        )
    except OnboardingError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/pending-users", response_model=List[PendingUserResponse])
def get_pending_users(
    auth_user_id: UUID = Depends(get_current_auth_user_id),
    db: Session = Depends(get_db),
):
    """
    Lista utenti in attesa di approvazione (solo admin).
    """
    # Verifica che l'utente sia admin
    current_user = get_user_profile(db, auth_user_id)
    if current_user.ruolo != "admin":
        raise HTTPException(status_code=403, detail="Solo gli admin possono visualizzare le richieste pending")
    
    pending_users = (
        db.query(AziendaUtente)
        .filter(AziendaUtente.stato == "pending")
        .all()
    )
    
    return [
        PendingUserResponse(
            id=u.id,
            email=u.email,
            nome=u.ruolo if u.ruolo == "pending" else None,  # Usiamo ruolo per salvare il nome temporaneamente
            note=None,
            created_at=u.created_at.isoformat() if u.created_at else None,
        )
        for u in pending_users
    ]


@router.post("/pending-users/{user_id}/approve", response_model=AziendaUtenteResponse)
def approve_user(
    user_id: int,
    payload: ApproveUserRequest,
    auth_user_id: UUID = Depends(get_current_auth_user_id),
    db: Session = Depends(get_db),
):
    """
    Approva un utente pending e lo associa a un'azienda.
    """
    # Verifica che l'utente corrente sia admin
    current_user = get_user_profile(db, auth_user_id)
    if current_user.ruolo != "admin":
        raise HTTPException(status_code=403, detail="Solo gli admin possono approvare utenti")
    
    try:
        approved = approve_pending_user(
            db,
            user_id=user_id,
            azienda_id=payload.azienda_id,
            ruolo=payload.ruolo,
        )
        return AziendaUtenteResponse.model_validate(approved)
    except OnboardingError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/pending-users/{user_id}")
def reject_user(
    user_id: int,
    auth_user_id: UUID = Depends(get_current_auth_user_id),
    db: Session = Depends(get_db),
):
    """
    Rifiuta e elimina un utente pending.
    """
    # Verifica che l'utente corrente sia admin
    current_user = get_user_profile(db, auth_user_id)
    if current_user.ruolo != "admin":
        raise HTTPException(status_code=403, detail="Solo gli admin possono rifiutare utenti")
    
    try:
        reject_pending_user(db, user_id)
        return {"message": "Utente rifiutato e rimosso"}
    except OnboardingError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/aziende", response_model=OnboardingResponse, status_code=status.HTTP_201_CREATED)
def onboard_azienda(
    payload: AziendaOnboardingPayload,
    db: Session = Depends(get_db),
):
    """Crea un'azienda e il relativo utente amministratore su Supabase."""
    try:
        account_data = payload.account.model_dump()
        metadata = account_data.get("metadata") or {}
        if payload.account.nome:
            metadata.setdefault("display_name", payload.account.nome)
        account_data["metadata"] = metadata
        # Costruiamo il modello base per i servizi
        admin_create = AziendaUtenteCreate(**account_data)
        result = create_azienda_with_admin(db, payload.azienda, admin_create)
    except OnboardingError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return OnboardingResponse(  # type: ignore[arg-type]
        azienda=AziendaResponse.model_validate(result["azienda"]),
        utente=AziendaUtenteResponse.model_validate(result["utente"]),
        password_reset_link=result.get("password_reset_link"),
        temporary_password=result.get("temporary_password"),
    )


@router.post(
    "/aziende/{azienda_id}/utenti",
    response_model=OnboardingUserResponse,
    status_code=status.HTTP_201_CREATED,
)
def invite_user(
    azienda_id: int,
    payload: InviteUserRequest,
    db: Session = Depends(get_db),
):
    """Invita un nuovo operatore per l'azienda indicata."""
    azienda = (
        db.query(Azienda)
        .filter(Azienda.id == azienda_id, Azienda.deleted_at.is_(None))
        .first()
    )
    if azienda is None:
        raise HTTPException(status_code=404, detail="Azienda non trovata")

    metadata = payload.metadata or {}
    if payload.nome:
        metadata.setdefault("display_name", payload.nome)
    utente_create = AziendaUtenteCreate(
        email=payload.email,
        ruolo=payload.ruolo,
        send_password_reset=payload.send_password_reset,
        temporary_password=payload.temporary_password,
        metadata=metadata,
    )

    try:
        result = invite_user_to_azienda(db, azienda, utente_create)
    except OnboardingError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return OnboardingUserResponse(  # type: ignore[arg-type]
        utente=AziendaUtenteResponse.model_validate(result["utente"]),
        password_reset_link=result.get("password_reset_link"),
        temporary_password=result.get("temporary_password"),
    )


@router.post("/utenti/first-login", response_model=AziendaUtenteResponse)
def complete_first_login(
    payload: FirstLoginRequest,
    db: Session = Depends(get_db),
):
    """Segna un utente come attivo al termine del primo accesso."""
    try:
        updated = mark_user_first_login(db, payload.auth_user_id)
    except OnboardingError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return AziendaUtenteResponse.model_validate(updated)


@router.get("/me", response_model=CurrentUserResponse)
def get_current_user(
    auth_user_id: UUID = Depends(get_current_auth_user_id),
    db: Session = Depends(get_db),
):
    """Restituisce i dettagli dell'utente autenticato e l'azienda associata."""
    try:
        user = get_user_profile(db, auth_user_id)
    except OnboardingError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    azienda = user.azienda
    return CurrentUserResponse(  # type: ignore[arg-type]
        utente=AziendaUtenteResponse.model_validate(user),
        azienda=AziendaResponse.model_validate(azienda) if azienda else None,
    )
