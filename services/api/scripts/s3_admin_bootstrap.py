"""Bootstrap or update a global admin role for an existing Tanergy user."""

from __future__ import annotations

import argparse
import json
import os
from uuid import uuid4


ALLOWED_ROLES = {"owner", "admin", "support", "analyst", "finance", "moderator"}


def main() -> None:
    args = parse_args()
    database_url = os.getenv("S3_ADMIN_BOOTSTRAP_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not database_url:
        raise SystemExit("Set S3_ADMIN_BOOTSTRAP_DATABASE_URL or DATABASE_URL first.")

    role = normalize_role(args.role)
    permissions = parse_permissions(args.permissions)
    actor_user_id = args.granted_by or args.user_id

    psycopg = import_psycopg()
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM tangent_users WHERE id = %s", (args.user_id,))
            if cursor.fetchone() is None:
                raise SystemExit(f'User "{args.user_id}" does not exist in tangent_users.')

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
                (args.user_id, role, json.dumps(permissions), args.note, actor_user_id),
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
                    args.user_id,
                    None,
                    "admin.bootstrap.grant",
                    json.dumps({"permissions": permissions, "role": role}),
                ),
            )
        connection.commit()

    print(f'Granted {role} to {args.user_id}.')


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bootstrap a Tanergy global admin role.")
    parser.add_argument("--user-id", required=True, help="Existing tangent_users.id to grant.")
    parser.add_argument("--role", default="owner", help="Admin role to grant.")
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
