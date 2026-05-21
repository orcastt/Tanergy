import hashlib
from typing import Any, Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.auth_session_memberships import (
    ResolvedWorkspaceMembership,
    default_workspace_membership,
    load_workspace_memberships,
)
from tangent_api.auth_session_models import ResolvedAuthSession, row_to_auth_session
from tangent_api.auth_session_identity import (
    identity_exists,
    load_identity_user_status,
    require_active_auth_user_status,
)
from tangent_api.auth_provider import VerifiedAuthIdentity
from tangent_api.auth_request_metadata import normalize_last_ip_address
from tangent_api.auth_session_profile import get_auth_session_initials
from tangent_api.auth_user_schema import (
    auth_user_last_ip_enabled,
    auth_user_last_ip_insert_field_sql,
    auth_user_last_ip_insert_value_sql,
    auth_user_last_ip_update_assignment_sql,
)
from tangent_api.billing_credit_accounts import ensure_credit_account
from tangent_api.local_admin_bootstrap import ensure_local_real_login_admin
from tangent_api.plan_catalog import registration_credits_for_plan
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url
def resolve_local_auth_session(
    identity: VerifiedAuthIdentity,
    requested_workspace_id: Optional[str] = None,
    request_ip: Optional[str] = None,
) -> ResolvedAuthSession:
    try:
        require_database_url()
    except Exception:
        return _build_ephemeral_session(identity)
    return _load_or_create_postgres_session(
        identity,
        requested_workspace_id=requested_workspace_id,
        request_ip=request_ip,
    )
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
        avatar_initials=get_auth_session_initials(display_name, email),
        workspace_name="Tanergy Workspace",
        workspace_plan_key="free_canvas",
        workspace_role="owner",
        board_count=0,
        workspaces=[default_workspace_membership(f"workspace_{suffix}", "Tanergy Workspace")],
        profile_completed=True,
    )
def _load_or_create_postgres_session(
    identity: VerifiedAuthIdentity,
    requested_workspace_id: Optional[str] = None,
    request_ip: Optional[str] = None,
) -> ResolvedAuthSession:
    normalized_request_ip = normalize_last_ip_address(request_ip)
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            row = _load_auth_session_row(cursor, identity, requested_workspace_id)

            if row:
                require_active_auth_user_status(row[9] if len(row) > 9 else "active")
                session = row_to_auth_session(row)
                resolved_display_name = (
                    session.display_name
                    if session.profile_completed
                    else (identity.display_name or session.display_name)
                )
                resolved_email = identity.email or session.email
                resolved_avatar_initials = get_auth_session_initials(resolved_display_name, resolved_email)
                cursor.execute(
                    f"""
                    UPDATE tangent_users
                    SET
                        email = %s,
                        display_name = %s,
                        avatar_initials = %s,
                        email_verified = %s,
                        {auth_user_last_ip_update_assignment_sql()}
                        last_login_at = NOW(),
                        updated_at = NOW()
                    WHERE id = %s
                    """,
                    tuple([
                        resolved_email,
                        resolved_display_name,
                        resolved_avatar_initials,
                        identity.email_verified,
                        *([normalized_request_ip] if auth_user_last_ip_enabled() else []),
                        session.user_id,
                    ]),
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
                    ensure_credit_account(cursor, "user", session.user_id)
                    ensure_local_real_login_admin(cursor, session.user_id, normalized_request_ip)
                    memberships = load_workspace_memberships(cursor, session.user_id, session.workspace_id)
                    if not memberships:
                        memberships = [
                            ResolvedWorkspaceMembership(
                                board_count=0,
                                workspace_id=session.workspace_id,
                                workspace_kind=session.workspace_kind,
                                workspace_name=session.workspace_name,
                                workspace_plan_key=session.workspace_plan_key,
                                workspace_role=session.workspace_role,
                            )
                        ]
                    active_workspace = memberships[0]
                    connection.commit()
                    return ResolvedAuthSession(
                        user_id=session.user_id,
                        workspace_id=active_workspace.workspace_id,
                        workspace_kind=active_workspace.workspace_kind,
                        display_name=resolved_display_name,
                        email=resolved_email,
                        email_verified=identity.email_verified,
                        avatar_initials=resolved_avatar_initials,
                        workspace_name=active_workspace.workspace_name,
                        workspace_plan_key=active_workspace.workspace_plan_key,
                        workspace_role=active_workspace.workspace_role,
                        board_count=active_workspace.board_count,
                        workspaces=memberships,
                        profile_completed=session.profile_completed,
                    )

                return _create_default_workspace(
                    cursor,
                    connection,
                    session.user_id,
                    identity,
                    session.display_name,
                    session.email,
                    normalized_request_ip,
                )

            if identity_exists(cursor, identity):
                require_active_auth_user_status(load_identity_user_status(cursor, identity))
                if requested_workspace_id:
                    raise HTTPException(status_code=403, detail="Requested workspace is not available for this user.")

            user_id = f"user_{uuid4()}"
            email = identity.email or f"{user_id}@clerk.local"
            display_name = identity.display_name or email.split("@")[0]
            avatar_initials = get_auth_session_initials(display_name, email)

            cursor.execute(
                f"""
                INSERT INTO tangent_users (
                    id,
                    email,
                    display_name,
                    avatar_initials,
                    email_verified,
                    {auth_user_last_ip_insert_field_sql()}
                    last_login_at
                ) VALUES (%s, %s, %s, %s, %s, {auth_user_last_ip_insert_value_sql()} NOW())
                """,
                tuple([
                    user_id,
                    email,
                    display_name,
                    avatar_initials,
                    identity.email_verified,
                    *([normalized_request_ip] if auth_user_last_ip_enabled() else []),
                ]),
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
            return _create_default_workspace(
                cursor,
                connection,
                user_id,
                identity,
                display_name,
                email,
                normalized_request_ip,
            )
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
            wm.role,
            COALESCE(u.status, 'active'),
            u.profile_completed_at
        FROM tangent_user_identities ui
        JOIN tangent_users u ON u.id = ui.user_id
        LEFT JOIN tangent_workspace_members wm ON wm.user_id = u.id
        LEFT JOIN tangent_workspaces w ON w.id = wm.workspace_id
        WHERE ui.provider = %s AND ui.provider_subject = %s
          AND COALESCE(w.status, 'active') <> 'deleted'
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
def _create_default_workspace(
    cursor: Any,
    connection: Any,
    user_id: str,
    identity: VerifiedAuthIdentity,
    display_name: str,
    email: str,
    request_ip: Optional[str],
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
    ensure_credit_account(cursor, "user", user_id)
    _grant_registration_credits_if_needed(cursor, user_id, workspace_id)
    ensure_local_real_login_admin(cursor, user_id, request_ip)
    connection.commit()
    default_workspace = default_workspace_membership(workspace_id, workspace_name)
    return ResolvedAuthSession(
        user_id=user_id,
        workspace_id=workspace_id,
        workspace_kind="solo_workspace",
        display_name=identity.display_name or display_name,
        email=identity.email or email,
        email_verified=identity.email_verified,
        avatar_initials=get_auth_session_initials(identity.display_name or display_name, identity.email or email),
        workspace_name=workspace_name,
        workspace_plan_key=default_workspace.workspace_plan_key,
        workspace_role="owner",
        board_count=0,
        workspaces=[default_workspace],
        profile_completed=False,
    )


def _grant_registration_credits_if_needed(cursor: Any, user_id: str, workspace_id: str) -> None:
    credits = registration_credits_for_plan("free_canvas")
    if credits <= 0:
        return
    account_id = f"credit_user_{user_id}"
    source_id = f"registration_free_canvas_{user_id}"
    cursor.execute(
        """
        SELECT 1
        FROM tangent_credit_ledger
        WHERE account_id = %s
          AND source_id = %s
        LIMIT 1
        """,
        (account_id, source_id),
    )
    if cursor.fetchone():
        return
    cursor.execute(
        """
        INSERT INTO tangent_credit_ledger (
            id,
            account_id,
            workspace_id,
            actor_user_id,
            source_type,
            source_id,
            credits_delta,
            reason,
            metadata
        )
        VALUES (%s, %s, %s, %s, 'subscription', %s, %s, 'subscription_grant', %s::jsonb)
        """,
        (
            f"credit_{uuid4()}",
            account_id,
            workspace_id,
            user_id,
            source_id,
            float(credits),
            '{"grantType":"registration","planKey":"free_canvas"}',
        ),
    )
