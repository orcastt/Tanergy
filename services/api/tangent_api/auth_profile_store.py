from dataclasses import dataclass

from fastapi import HTTPException

from tangent_api.auth_session_profile import get_auth_session_initials
from tangent_api.safe_text import normalize_safe_label
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url


@dataclass(frozen=True)
class StoredAuthProfile:
    avatar_initials: str
    display_name: str
    email: str
    email_verified: bool
    profile_completed: bool
    user_id: str


def update_auth_profile(user_id: str, display_name: str) -> StoredAuthProfile:
    require_database_url()
    normalized_display_name = _normalize_display_name(display_name)

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE tangent_users
                SET
                    display_name = %s,
                    avatar_initials = %s,
                    profile_completed_at = COALESCE(profile_completed_at, NOW()),
                    updated_at = NOW()
                WHERE id = %s
                RETURNING email, email_verified, display_name, avatar_initials, profile_completed_at
                """,
                (
                    normalized_display_name,
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

    email, email_verified, stored_display_name, avatar_initials, profile_completed_at = row
    return StoredAuthProfile(
        avatar_initials=avatar_initials,
        display_name=stored_display_name,
        email=email,
        email_verified=bool(email_verified),
        profile_completed=bool(profile_completed_at),
        user_id=user_id,
    )


def _normalize_display_name(value: str) -> str:
    return normalize_safe_label(value, field_name="Display name", status_code=422)
