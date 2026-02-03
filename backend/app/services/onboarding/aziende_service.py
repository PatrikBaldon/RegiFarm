"""Servizi di onboarding per aziende e utenti Supabase"""
from __future__ import annotations

from datetime import datetime
from typing import Dict, Optional
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from app.models.allevamento import Azienda, AziendaUtente
from app.schemas.allevamento import AziendaCreate, AziendaUtenteCreate
from app.services.supabase_client import (
    SupabaseAdminError,
    create_supabase_user,
)


class OnboardingError(RuntimeError):
    """Errore generico nel processo di onboarding."""


def _prepare_metadata(
    base_metadata: Optional[dict], azienda_id: int, ruolo: str
) -> Dict[str, object]:
    metadata: Dict[str, object] = {
        "azienda_id": azienda_id,
        "ruolo": ruolo,
    }
    if base_metadata:
        metadata.update(base_metadata)
    return metadata


def create_azienda_with_admin(
    db: Session,
    azienda_data: AziendaCreate,
    admin_data: AziendaUtenteCreate,
) -> Dict[str, object]:
    """Crea l'anagrafica aziendale e l'utente amministratore su Supabase."""
    try:
        # Step 1: create azienda record
        azienda = Azienda(**azienda_data.model_dump())
        db.add(azienda)
        db.flush()  # obtain azienda.id before calling Supabase

        metadata = _prepare_metadata(admin_data.metadata, azienda.id, admin_data.ruolo)
        supabase_result = create_supabase_user(
            email=admin_data.email,
            password=admin_data.temporary_password,
            user_metadata=metadata,
            app_metadata=metadata,
            send_password_reset=admin_data.send_password_reset,
        )
        user = supabase_result["user"]
        auth_user_id: UUID = user.id  # type: ignore[assignment]

        azienda.supabase_user_id = auth_user_id
        azienda_utente = AziendaUtente(
            auth_user_id=auth_user_id,
            email=admin_data.email,
            ruolo=admin_data.ruolo,
            stato="invited",
            invite_sent_at=datetime.utcnow(),
            azienda_id=azienda.id,
        )
        db.add(azienda_utente)
        db.commit()
        db.refresh(azienda)
        db.refresh(azienda_utente)

        return {
            "azienda": azienda,
            "utente": azienda_utente,
            "password_reset_link": supabase_result.get("password_reset_link"),
            "temporary_password": supabase_result.get("temporary_password"),
        }
    except (SupabaseAdminError, SQLAlchemyError) as exc:
        db.rollback()
        raise OnboardingError(str(exc)) from exc


def invite_user_to_azienda(
    db: Session,
    azienda: Azienda,
    utente_data: AziendaUtenteCreate,
) -> Dict[str, object]:
    """Invita un nuovo utente operativo per l'azienda indicata."""
    try:
        # Validate duplicates
        existing = (
            db.query(AziendaUtente)
            .filter(
                AziendaUtente.email == utente_data.email,
                AziendaUtente.azienda_id == azienda.id,
            )
            .first()
        )
        if existing:
            raise OnboardingError("Utente già presente per questa azienda")

        metadata = _prepare_metadata(utente_data.metadata, azienda.id, utente_data.ruolo)
        supabase_result = create_supabase_user(
            email=utente_data.email,
            password=utente_data.temporary_password,
            user_metadata=metadata,
            app_metadata=metadata,
            send_password_reset=utente_data.send_password_reset,
        )
        user = supabase_result["user"]
        auth_user_id: UUID = user.id  # type: ignore[assignment]

        azienda_utente = AziendaUtente(
            auth_user_id=auth_user_id,
            email=utente_data.email,
            ruolo=utente_data.ruolo,
            stato="invited",
            invite_sent_at=datetime.utcnow(),
            azienda_id=azienda.id,
        )
        db.add(azienda_utente)
        db.commit()
        db.refresh(azienda_utente)

        return {
            "utente": azienda_utente,
            "password_reset_link": supabase_result.get("password_reset_link"),
            "temporary_password": supabase_result.get("temporary_password"),
        }
    except (SupabaseAdminError, SQLAlchemyError, OnboardingError) as exc:
        db.rollback()
        raise OnboardingError(str(exc)) from exc


def mark_user_first_login(db: Session, auth_user_id: UUID) -> AziendaUtente:
    """Aggiorna lo stato dell'utente al primo accesso."""
    user = (
        db.query(AziendaUtente)
        .filter(AziendaUtente.auth_user_id == auth_user_id)
        .first()
    )
    if user is None:
        raise OnboardingError("Utente non trovato per l'ID specificato")

    user.stato = "active"
    user.first_login_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user


def get_user_profile(db: Session, auth_user_id: UUID) -> AziendaUtente:
    """Recupera l'utente e l'azienda associata partendo dall'UUID Supabase."""
    user = (
        db.query(AziendaUtente)
        .options(joinedload(AziendaUtente.azienda))
        .filter(AziendaUtente.auth_user_id == auth_user_id)
        .first()
    )
    if user is None:
        raise OnboardingError("Utente non trovato")
    return user


def register_pending_user(
    db: Session,
    email: str,
    nome: Optional[str] = None,
    note: Optional[str] = None,
) -> Dict[str, object]:
    """
    Registra un nuovo utente in stato 'pending'.
    L'utente viene creato su Supabase ma NON può accedere finché non viene approvato.
    """
    try:
        # Verifica se esiste già un utente con questa email
        existing = db.query(AziendaUtente).filter(AziendaUtente.email == email).first()
        if existing:
            raise OnboardingError("Email già registrata. Se hai già un account, prova ad accedere.")
        
        # Crea l'utente su Supabase con una password temporanea
        import secrets
        temp_password = secrets.token_urlsafe(16)
        
        metadata = {
            "pending": True,
            "display_name": nome or email.split("@")[0],
            "registration_note": note,
        }
        
        supabase_result = create_supabase_user(
            email=email,
            password=temp_password,
            user_metadata=metadata,
            app_metadata={"pending": True},
            send_password_reset=False,  # Non inviare email finché non approvato
        )
        user = supabase_result["user"]
        auth_user_id: UUID = user.id  # type: ignore[assignment]
        
        # Crea il record locale in stato pending (azienda_id temporaneo = 0 o nullable)
        # Per ora usiamo azienda_id = 1 come placeholder, verrà aggiornato all'approvazione
        azienda_utente = AziendaUtente(
            auth_user_id=auth_user_id,
            email=email,
            ruolo="pending",  # Usiamo ruolo temporaneo per indicare pending
            stato="pending",
            azienda_id=1,  # Placeholder, verrà aggiornato all'approvazione
        )
        db.add(azienda_utente)
        db.commit()
        db.refresh(azienda_utente)
        
        return {"utente": azienda_utente}
        
    except (SupabaseAdminError, SQLAlchemyError) as exc:
        db.rollback()
        raise OnboardingError(str(exc)) from exc


def approve_pending_user(
    db: Session,
    user_id: int,
    azienda_id: int,
    ruolo: str = "operatore",
) -> AziendaUtente:
    """
    Approva un utente pending e lo associa a un'azienda.
    """
    user = db.query(AziendaUtente).filter(AziendaUtente.id == user_id).first()
    if user is None:
        raise OnboardingError("Utente non trovato")
    
    if user.stato != "pending":
        raise OnboardingError("L'utente non è in stato pending")
    
    # Verifica che l'azienda esista
    azienda = db.query(Azienda).filter(Azienda.id == azienda_id, Azienda.deleted_at.is_(None)).first()
    if azienda is None:
        raise OnboardingError("Azienda non trovata")
    
    # Aggiorna l'utente
    user.azienda_id = azienda_id
    user.ruolo = ruolo
    user.stato = "invited"  # Passa a invited, dovrà fare il primo login
    user.invite_sent_at = datetime.utcnow()
    
    db.commit()
    db.refresh(user)
    
    return user


def reject_pending_user(db: Session, user_id: int) -> None:
    """
    Rifiuta e elimina un utente pending.
    """
    from app.services.supabase_client import delete_supabase_user
    
    user = db.query(AziendaUtente).filter(AziendaUtente.id == user_id).first()
    if user is None:
        raise OnboardingError("Utente non trovato")
    
    if user.stato != "pending":
        raise OnboardingError("L'utente non è in stato pending")
    
    # Elimina l'utente da Supabase
    try:
        delete_supabase_user(user.auth_user_id)
    except Exception as e:
        # Log ma continua con l'eliminazione locale
        print(f"Errore eliminazione utente Supabase: {e}")
    
    # Elimina il record locale
    db.delete(user)
    db.commit()

