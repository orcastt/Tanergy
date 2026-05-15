from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException

from tangent_api.auth_session_profile import get_auth_session_initials
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url

ALLOWED_AUTH_PROFILE_GENDERS = {
    "female",
    "male",
    "non_binary",
    "prefer_not_to_say",
}


@dataclass(frozen=True)
class StoredAuthProfile:
    avatar_initials: str
    display_name: str
    email: str
    email_verified: bool
    gender: Optional[str]
    profile_completed: bool
    user_id: str


def update_auth_profile(user_id: str, display_name: str, gender: Optional[str]) -> StoredAuthProfile:
    require_database_url()
    normalized_display_name = _normalize_display_name(display_name)
    normalized_gender = _normalize_gender(gender)

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE tangent_users
                SET
                    display_name = %s,
                    gender = %s,
                    avatar_initials = %s,
                    profile_completed_at = COALESCE(profile_completed_at, NOW()),
                    updated_at = NOW()
                WHERE id = %s
                RETURNING email, email_verified, display_name, avatar_initials, gender, profile_completed_at
                """,
                (
                    normalized_display_name,
                    normalized_gender,
                    get_auth_session_initials(normalized_display_name, ""),
                    user_id,
                ),
            )
            row = cursor.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Authenticated user was not found.")

            cursor.execute(
                """
                UPDATE tangent_workspace_members
                SET display_name = %s
                WHERE user_id = %s
                """,
                (normalized_display_name, user_id),
            )

    email, email_verified, stored_display_name, avatar_initials, stored_gender, profile_completed_at = row
    return StoredAuthProfile(
        avatar_initials=avatar_initials,
        display_name=stored_display_name,
        email=email,
        email_verified=bool(email_verified),
        gender=stored_gender,
        profile_completed=bool(profile_completed_at),
        user_id=user_id,
    )


def _normalize_display_name(value: str) -> str:
    trimmed = value.strip()
    if not trimmed:
        raise HTTPException(status_code=422, detail="Display name is required.")
    if len(trimmed) > 80:
        raise HTTPException(status_code=422, detail="Display name must be 80 characters or fewer.")
    return trimmed


def _normalize_gender(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    if trimmed not in ALLOWED_AUTH_PROFILE_GENDERS:
        raise HTTPException(status_code=422, detail="Gender must be one of the supported profile options.")
    return trimmed
