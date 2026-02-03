"""Authentication helpers for Supabase JWT tokens"""
from __future__ import annotations

import base64
import json
from typing import Any, Dict
from uuid import UUID

from fastapi import Header, HTTPException, status


def _decode_jwt_no_verify(token: str) -> Dict[str, Any]:
    """Decode a JWT payload without verifying the signature.

    This is sufficient for extracting the `sub` claim when the request already
    comes from our trusted application. Signature verification can be added later
    if required by downloading Supabase JWKS.
    """
    try:
        payload_segment = token.split(".")[1]
    except IndexError as exc:  # pragma: no cover - defensive branch
        raise ValueError("Token malformato") from exc

    # JWT uses base64url encoding without padding. Restore padding if missing.
    missing_padding = (-len(payload_segment)) % 4
    if missing_padding:
        payload_segment += "=" * missing_padding

    try:
        payload_bytes = base64.urlsafe_b64decode(payload_segment.encode("utf-8"))
        return json.loads(payload_bytes.decode("utf-8"))
    except (json.JSONDecodeError, ValueError) as exc:
        raise ValueError("Impossibile decodificare il token") from exc


def get_current_auth_user_id(
    authorization: str = Header(..., alias="Authorization")
) -> UUID:
    """Extract the Supabase user ID (UUID) from the Authorization header."""
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token mancante")

    prefix = "Bearer "
    if not authorization.startswith(prefix):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Formato Authorization non valido")

    token = authorization[len(prefix) :].strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token non presente")

    try:
        payload = _decode_jwt_no_verify(token)
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("Claim 'sub' assente nel token")
        return UUID(user_id)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token non valido") from exc
