from typing import Any, Optional

from fastapi import HTTPException

from tangent_api.auth_provider import VerifiedAuthIdentity


def identity_exists(cursor: Any, identity: VerifiedAuthIdentity) -> bool:
    cursor.execute(
        """
        SELECT 1
        FROM tangent_user_identities
        WHERE provider = %s AND provider_subject = %s
        LIMIT 1
        """,
        (identity.provider, identity.provider_subject),
    )
    return cursor.fetchone() is not None


def load_identity_user_status(cursor: Any, identity: VerifiedAuthIdentity) -> Optional[str]:
    cursor.execute(
        """
        SELECT COALESCE(u.status, 'active')
        FROM tangent_user_identities ui
        JOIN tangent_users u ON u.id = ui.user_id
        WHERE ui.provider = %s AND ui.provider_subject = %s
        LIMIT 1
        """,
        (identity.provider, identity.provider_subject),
    )
    row = cursor.fetchone()
    return str(row[0] or "active") if row else None


def require_active_auth_user_status(status: Optional[str]) -> None:
    normalized = (status or "active").strip().lower()
    if normalized == "active":
        return
    if normalized == "suspended":
        raise HTTPException(status_code=403, detail="User account is suspended.")
    if normalized == "deleted":
        raise HTTPException(status_code=403, detail="User account is deleted.")
    raise HTTPException(status_code=403, detail="User account is not active.")
