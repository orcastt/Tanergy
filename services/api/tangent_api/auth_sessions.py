import hashlib
from dataclasses import dataclass
from typing import Any, Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.auth_provider import VerifiedAuthIdentity
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url


@dataclass(frozen=True)
class ResolvedAuthSession:
    user_id: str
    workspace_id: str
    workspace_kind: str
    display_name: str
    email: str
    email_verified: bool
    avatar_initials: str
    workspace_name: str
    workspace_role: str
    board_count: int


def resolve_local_auth_session(
    identity: VerifiedAuthIdentity,
    requested_workspace_id: Optional[str] = None,
) -> ResolvedAuthSession:
    try:
        require_database_url()
    except Exception:
        return _build_ephemeral_session(identity)
    return _load_or_create_postgres_session(identity, requested_workspace_id=requested_workspace_id)


def _build_ephemeral_session(identity: VerifiedAuthIdentity) -> ResolvedAuthSession:
    suffix = hashlib.sha256(identity.provider_subject.encode("utf-8")).hexdigest()[:16]
    display_name = identity.display_name.strip() or "Tanergy user"
    email = identity.email or f"{suffix}@clerk.local"
    return ResolvedAuthSession(
        user_id=f"user_{suffix}",
        workspace_id=f"workspace_{suffix}",
        workspace_kind="solo_workspace",
        display_name=display_name,
        email=email,
        email_verified=identity.email_verified,
        avatar_initials=_get_initials(display_name, email),
        workspace_name="Tanergy Workspace",
        workspace_role="owner",
        board_count=0,
    )


def _load_or_create_postgres_session(
    identity: VerifiedAuthIdentity,
    requested_workspace_id: Optional[str] = None,
) -> ResolvedAuthSession:
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            row = _load_auth_session_row(cursor, identity, requested_workspace_id)

            if row:
                session = _row_to_session(row)
                cursor.execute(
                    """
                    UPDATE tangent_users
                    SET
                        email = %s,
                        display_name = %s,
                        avatar_initials = %s,
                        email_verified = %s,
                        last_login_at = NOW(),
                        updated_at = NOW()
                    WHERE id = %s
                    """,
                    (
                        identity.email or session.email,
                        identity.display_name or session.display_name,
                        _get_initials(identity.display_name or session.display_name, identity.email or session.email),
                        identity.email_verified,
                        session.user_id,
                    ),
                )
                cursor.execute(
                    """
                    UPDATE tangent_user_identities
                    SET email = %s, updated_at = NOW()
                    WHERE provider = %s AND provider_subject = %s
                    """,
                    (identity.email, identity.provider, identity.provider_subject),
                )

                if session.workspace_id:
                    board_count = _load_board_count(cursor, session.workspace_id)
                    connection.commit()
                    return ResolvedAuthSession(
                        user_id=session.user_id,
                        workspace_id=session.workspace_id,
                        workspace_kind=session.workspace_kind,
                        display_name=identity.display_name or session.display_name,
                        email=identity.email or session.email,
                        email_verified=identity.email_verified,
                        avatar_initials=_get_initials(identity.display_name or session.display_name, identity.email or session.email),
                        workspace_name=session.workspace_name,
                        workspace_role=session.workspace_role,
                        board_count=board_count,
                    )

                return _create_default_workspace(cursor, connection, session.user_id, identity, session.display_name, session.email)

            if requested_workspace_id and _identity_exists(cursor, identity):
                raise HTTPException(status_code=403, detail="Requested workspace is not available for this user.")

            user_id = f"user_{uuid4()}"
            email = identity.email or f"{user_id}@clerk.local"
            display_name = identity.display_name or email.split("@")[0]
            avatar_initials = _get_initials(display_name, email)

            cursor.execute(
                """
                INSERT INTO tangent_users (
                    id,
                    email,
                    display_name,
                    avatar_initials,
                    email_verified,
                    last_login_at
                ) VALUES (%s, %s, %s, %s, %s, NOW())
                """,
                (user_id, email, display_name, avatar_initials, identity.email_verified),
            )
            cursor.execute(
                """
                INSERT INTO tangent_user_identities (
                    id,
                    user_id,
                    provider,
                    provider_subject,
                    email
                ) VALUES (%s, %s, %s, %s, %s)
                """,
                (f"identity_{uuid4()}", user_id, identity.provider, identity.provider_subject, email),
            )
            return _create_default_workspace(cursor, connection, user_id, identity, display_name, email)


def _load_auth_session_row(
    cursor: Any,
    identity: VerifiedAuthIdentity,
    requested_workspace_id: Optional[str],
) -> Optional[tuple[object, ...]]:
    workspace_filter = "AND wm.workspace_id = %s" if requested_workspace_id else ""
    params: tuple[object, ...] = (
        identity.provider,
        identity.provider_subject,
        requested_workspace_id,
    ) if requested_workspace_id else (identity.provider, identity.provider_subject)
    cursor.execute(
        f"""
        SELECT
            u.id,
            u.email,
            u.display_name,
            u.avatar_initials,
            u.email_verified,
            wm.workspace_id,
            w.name,
            COALESCE(w.kind, 'solo_workspace'),
            wm.role
        FROM tangent_user_identities ui
        JOIN tangent_users u ON u.id = ui.user_id
        LEFT JOIN tangent_workspace_members wm ON wm.user_id = u.id
        LEFT JOIN tangent_workspaces w ON w.id = wm.workspace_id
        WHERE ui.provider = %s AND ui.provider_subject = %s
          {workspace_filter}
        ORDER BY
            CASE wm.role
                WHEN 'owner' THEN 0
                WHEN 'admin' THEN 1
                WHEN 'editor' THEN 2
                WHEN 'member' THEN 3
                ELSE 4
            END,
            wm.joined_at ASC NULLS LAST
        LIMIT 1
        """,
        params,
    )
    return cursor.fetchone()


def _identity_exists(cursor: Any, identity: VerifiedAuthIdentity) -> bool:
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


def _create_default_workspace(
    cursor: Any,
    connection: Any,
    user_id: str,
    identity: VerifiedAuthIdentity,
    display_name: str,
    email: str,
) -> ResolvedAuthSession:
    workspace_id = f"workspace_{uuid4()}"
    workspace_name = "Tanergy Workspace"
    cursor.execute(
        """
        INSERT INTO tangent_workspaces (
            id,
            name,
            owner_id,
            kind,
            slug
        ) VALUES (%s, %s, %s, %s, %s)
        """,
        (workspace_id, workspace_name, user_id, "solo_workspace", None),
    )
    cursor.execute(
        """
        INSERT INTO tangent_workspace_members (
            workspace_id,
            user_id,
            role,
            display_name
        ) VALUES (%s, %s, 'owner', %s)
        """,
        (workspace_id, user_id, display_name),
    )
    connection.commit()
    return ResolvedAuthSession(
        user_id=user_id,
        workspace_id=workspace_id,
        workspace_kind="solo_workspace",
        display_name=identity.display_name or display_name,
        email=identity.email or email,
        email_verified=identity.email_verified,
        avatar_initials=_get_initials(identity.display_name or display_name, identity.email or email),
        workspace_name=workspace_name,
        workspace_role="owner",
        board_count=0,
    )


def _load_board_count(cursor: Any, workspace_id: str) -> int:
    cursor.execute(
        """
        SELECT COUNT(*)
        FROM tangent_boards
        WHERE workspace_id = %s AND deleted_at IS NULL
        """,
        (workspace_id,),
    )
    row = cursor.fetchone()
    if not row:
        return 0
    value = row[0] if isinstance(row, (list, tuple)) else row
    return int(value or 0)


def _row_to_session(row: Any) -> ResolvedAuthSession:
    user_id, email, display_name, avatar_initials, email_verified, workspace_id, workspace_name, workspace_kind, workspace_role = row
    return ResolvedAuthSession(
        user_id=user_id,
        workspace_id=workspace_id or "",
        workspace_kind=workspace_kind or "solo_workspace",
        display_name=display_name,
        email=email,
        email_verified=bool(email_verified),
        avatar_initials=avatar_initials,
        workspace_name=workspace_name or "Tanergy Workspace",
        workspace_role=workspace_role or "owner",
        board_count=0,
    )


def _get_initials(display_name: str, email: str) -> str:
    source = display_name or email
    initials = "".join(part[:1].upper() for part in source.replace("_", " ").replace(".", " ").split()[:2] if part)
    return initials or "T"
