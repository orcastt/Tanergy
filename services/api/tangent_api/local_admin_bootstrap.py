import json
import os
from typing import Any, Optional
from uuid import uuid4

LOCAL_REAL_LOGIN_BOOTSTRAP_NOTE = "Local real-login admin bootstrap"


def ensure_local_real_login_admin(
    cursor: Any,
    user_id: str,
    request_ip: Optional[str] = None,
) -> None:
    if not should_bootstrap_local_real_login_admin(request_ip):
        return

    cursor.execute(
        """
        SELECT 1
        FROM tangent_admin_roles
        WHERE user_id = %s
          AND revoked_at IS NULL
        LIMIT 1
        """,
        (user_id,),
    )
    if cursor.fetchone() is not None:
        return

    permissions = {"bootstrap": True, "scope": "local_real_login"}
    cursor.execute(
        """
        INSERT INTO tangent_admin_roles (
            user_id,
            role,
            permissions,
            note,
            granted_by,
            revoked_at
        ) VALUES (%s, 'owner', %s::jsonb, %s, %s, NULL)
        ON CONFLICT (user_id, role) DO UPDATE SET
            permissions = EXCLUDED.permissions,
            note = EXCLUDED.note,
            granted_by = EXCLUDED.granted_by,
            revoked_at = NULL
        """,
        (user_id, json.dumps(permissions), LOCAL_REAL_LOGIN_BOOTSTRAP_NOTE, user_id),
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
            user_id,
            user_id,
            None,
            "admin.bootstrap.real_login",
            json.dumps({"role": "owner", **permissions}),
        ),
    )


def should_bootstrap_local_real_login_admin(request_ip: Optional[str] = None) -> bool:
    if os.getenv("TANGENT_REQUIRE_API_AUTH") == "1":
        return False
    if os.getenv("TANGENT_ENABLE_DEV_AUTH_BYPASS") == "1":
        return True
    return (request_ip or "").strip().lower() in {"127.0.0.1", "::1", "localhost"}
