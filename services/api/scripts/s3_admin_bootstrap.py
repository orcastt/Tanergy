"""Bootstrap or update a global admin role for an existing Tanergy user."""

from __future__ import annotations

import argparse
import json
import os
from uuid import uuid4

from tangent_api.env_bootstrap import load_repo_env


ALLOWED_ROLES = {"owner", "admin", "finance"}


def main() -> None:
    load_repo_env()
    args = parse_args()
    database_url = os.getenv("S3_ADMIN_BOOTSTRAP_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not database_url:
        raise SystemExit("Set S3_ADMIN_BOOTSTRAP_DATABASE_URL or DATABASE_URL first.")

    role = normalize_role(args.role)
    permissions = parse_permissions(args.permissions)

    psycopg = import_psycopg()
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            user_id = resolve_user_id(cursor, args)
            actor_user_id = args.granted_by or user_id
            cursor.execute("SELECT 1 FROM tangent_users WHERE id = %s", (user_id,))
            if cursor.fetchone() is None:
                raise SystemExit(f'User "{user_id}" does not exist in tangent_users.')

            cursor.execute(
                """
                INSERT INTO tangent_admin_roles (
                    user_id,
                    role,
                    permissions,
                    note,
                    granted_by,
                    revoked_at
                ) VALUES (%s, %s, %s::jsonb, %s, %s, NULL)
                ON CONFLICT (user_id, role) DO UPDATE SET
                    permissions = EXCLUDED.permissions,
                    note = EXCLUDED.note,
                    granted_by = EXCLUDED.granted_by,
                    revoked_at = NULL
                """,
                (user_id, role, json.dumps(permissions), args.note, actor_user_id),
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
                ) VALUES (%s, %s, %s, %s, %s, %s::jsonb)
                """,
                (
                    f"admin_audit_{uuid4()}",
                    actor_user_id,
                    user_id,
                    None,
                    "admin.bootstrap.grant",
                    json.dumps({"permissions": permissions, "role": role}),
                ),
            )
        connection.commit()

    print(f"Granted {role} to {user_id}.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bootstrap a Tanergy global admin role.")
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--user-id", help="Existing tangent_users.id to grant.")
    target.add_argument("--email", help="Existing tangent_users.email to grant after first real login.")
    parser.add_argument("--role", default="admin", help="Admin role to grant.")
    parser.add_argument("--note", default="Bootstrap grant", help="Audit note stored on tangent_admin_roles.")
    parser.add_argument(
        "--granted-by",
        default=None,
        help="Actor user id for audit. Defaults to the same value as --user-id.",
    )
    parser.add_argument(
        "--permissions",
        default="{}",
        help='JSON object stored in tangent_admin_roles.permissions, for example \'{"users": true}\'.',
    )
    return parser.parse_args()


def resolve_user_id(cursor, args: argparse.Namespace) -> str:
    if args.user_id:
        return args.user_id
    email = args.email.strip().lower()
    cursor.execute(
        """
        SELECT id
        FROM tangent_users
        WHERE LOWER(email) = %s AND status <> 'deleted'
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (email,),
    )
    row = cursor.fetchone()
    if row is None:
        raise SystemExit(f'No active tangent_users row found for email "{args.email}". Sign in once first.')
    return str(row[0])


def normalize_role(value: str) -> str:
    role = value.strip().lower()
    if role not in ALLOWED_ROLES:
        raise SystemExit(f"Invalid role: {value}. Allowed roles: {', '.join(sorted(ALLOWED_ROLES))}.")
    return role


def parse_permissions(value: str) -> dict[str, object]:
    try:
        payload = json.loads(value)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Permissions must be valid JSON: {exc}") from exc
    if not isinstance(payload, dict):
        raise SystemExit("Permissions must decode to a JSON object.")
    return payload


def import_psycopg():
    try:
        import psycopg
    except ModuleNotFoundError as exc:
        raise SystemExit(
            "psycopg is required for S3 admin bootstrap. Install services/api dependencies first."
        ) from exc
    return psycopg


if __name__ == "__main__":
    main()
