"""Ensure the local dev admin principal exists in Postgres."""

from __future__ import annotations

import json
import os
from uuid import uuid4

from tangent_api.billing_credit_accounts import ensure_credit_account
from tangent_api.env_bootstrap import load_repo_env


def main() -> None:
    load_repo_env()
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is required.")

    user_id = os.getenv("TANGENT_DEV_USER_ID", "dev-user").strip() or "dev-user"
    workspace_id = os.getenv("TANGENT_DEV_WORKSPACE_ID", "dev-workspace").strip() or "dev-workspace"
    workspace_name = os.getenv("TANGENT_DEV_WORKSPACE_NAME", "Personal workspace").strip() or "Personal workspace"

    psycopg = import_psycopg()
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO tangent_users (
                    id,
                    email,
                    display_name,
                    avatar_initials,
                    email_verified,
                    status,
                    locale,
                    last_login_at
                )
                VALUES (%s, %s, %s, %s, FALSE, 'active', 'en', NOW())
                ON CONFLICT (id) DO UPDATE SET
                    email = EXCLUDED.email,
                    display_name = EXCLUDED.display_name,
                    avatar_initials = EXCLUDED.avatar_initials,
                    status = 'active',
                    updated_at = NOW(),
                    last_login_at = NOW()
                """,
                (user_id, "dev@tangent.local", "Dev User", "DU"),
            )
            cursor.execute(
                """
                INSERT INTO tangent_workspaces (
                    id,
                    name,
                    owner_id,
                    kind,
                    slug,
                    status,
                    billing_owner_user_id
                )
                VALUES (%s, %s, %s, 'solo_workspace', NULL, 'active', %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    owner_id = EXCLUDED.owner_id,
                    kind = EXCLUDED.kind,
                    status = 'active',
                    billing_owner_user_id = EXCLUDED.billing_owner_user_id,
                    updated_at = NOW()
                """,
                (workspace_id, workspace_name, user_id, user_id),
            )
            cursor.execute(
                """
                INSERT INTO tangent_workspace_members (
                    workspace_id,
                    user_id,
                    role,
                    display_name
                )
                VALUES (%s, %s, 'owner', 'Dev User')
                ON CONFLICT (workspace_id, user_id) DO UPDATE SET
                    role = 'owner',
                    display_name = EXCLUDED.display_name
                """,
                (workspace_id, user_id),
            )
            ensure_credit_account(cursor, "user", user_id)
            cursor.execute(
                """
                INSERT INTO tangent_admin_roles (
                    user_id,
                    role,
                    permissions,
                    note,
                    granted_by,
                    revoked_at
                )
                VALUES (%s, 'owner', %s::jsonb, %s, %s, NULL)
                ON CONFLICT (user_id, role) DO UPDATE SET
                    permissions = EXCLUDED.permissions,
                    note = EXCLUDED.note,
                    granted_by = EXCLUDED.granted_by,
                    revoked_at = NULL
                """,
                (
                    user_id,
                    json.dumps({"bootstrap": True, "scope": "local_dev"}),
                    "Local admin bootstrap",
                    user_id,
                ),
            )
            cursor.execute(
                """
                INSERT INTO tangent_admin_audit_logs (
                    id,
                    actor_user_id,
                    target_user_id,
                    workspace_id,
                    action,
                    metadata
                )
                VALUES (%s, %s, %s, %s, %s, %s::jsonb)
                """,
                (
                    f"admin_audit_{uuid4()}",
                    user_id,
                    user_id,
                    workspace_id,
                    "admin.bootstrap.local_dev",
                    json.dumps({"workspaceId": workspace_id}),
                ),
            )
        connection.commit()

    print(f"Bootstrapped local admin {user_id} in workspace {workspace_id}.")


def import_psycopg():
    try:
        import psycopg
    except ModuleNotFoundError as exc:
        raise SystemExit("psycopg is required. Install services/api dependencies first.") from exc
    return psycopg


if __name__ == "__main__":
    main()
