"""Utility helpers to interact with Supabase Auth"""
from __future__ import annotations

import secrets
from functools import lru_cache
from typing import Any, Dict, Optional

from gotrue.errors import AuthApiError
from supabase import Client, create_client

from app.core.config import settings


class SupabaseNotConfigured(RuntimeError):
    """Raised when Supabase credentials are missing."""


class SupabaseAdminError(RuntimeError):
    """Raised when Supabase admin operations fail."""


@lru_cache
def get_supabase_client() -> Client:
    """Instantiate a Supabase client using the service role key."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise SupabaseNotConfigured(
            "Supabase URL o Service Role Key non configurati. Aggiorna le variabili d'ambiente."
        )
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def _extract_action_link(link_response: Any) -> Optional[str]:
    if link_response is None:
        return None
    if isinstance(link_response, dict):
        return link_response.get("action_link")
    return getattr(link_response, "action_link", None)


def create_supabase_user(
    *,
    email: str,
    password: Optional[str] = None,
    user_metadata: Optional[Dict[str, Any]] = None,
    app_metadata: Optional[Dict[str, Any]] = None,
    send_password_reset: bool = True,
) -> Dict[str, Any]:
    """Create a Supabase Auth user and optionally generate a password reset link."""
    client = get_supabase_client()
    tmp_password = password or secrets.token_urlsafe(16)

    try:
        response = client.auth.admin.create_user(  # type: ignore[arg-type]
            {
                "email": email,
                "password": tmp_password,
                "email_confirm": True,
                "user_metadata": user_metadata or {},
                "app_metadata": app_metadata or {},
            }
        )
    except AuthApiError as exc:  # pragma: no cover - passthrough for clarity
        raise SupabaseAdminError(str(exc)) from exc
    except Exception as exc:  # pragma: no cover - safeguard for unexpected errors
        raise SupabaseAdminError(f"Errore creazione utente Supabase: {exc}") from exc

    user = response.user
    if user is None:
        raise SupabaseAdminError("La risposta di Supabase non contiene un utente valido.")

    reset_link: Optional[str] = None
    if send_password_reset:
        try:
            link_response = client.auth.admin.generate_link(
                type="recovery",
                email=email,
            )
            reset_link = _extract_action_link(link_response)
        except AuthApiError as exc:  # pragma: no cover - optional link failure
            raise SupabaseAdminError(str(exc)) from exc
        except Exception as exc:  # pragma: no cover
            raise SupabaseAdminError(
                f"Impossibile generare il link di reset per l'utente Supabase: {exc}"
            ) from exc

    return {
        "user": user,
        "temporary_password": None if send_password_reset else tmp_password,
        "password_reset_link": reset_link,
    }


def delete_supabase_user(auth_user_id) -> None:
    """Delete a Supabase Auth user by their UUID."""
    client = get_supabase_client()
    try:
        client.auth.admin.delete_user(str(auth_user_id))
    except AuthApiError as exc:
        raise SupabaseAdminError(str(exc)) from exc
    except Exception as exc:
        raise SupabaseAdminError(f"Errore eliminazione utente Supabase: {exc}") from exc

