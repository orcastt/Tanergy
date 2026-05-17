from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Optional

from fastapi import HTTPException

from tangent_api.storage.postgres_connection import connect_to_postgres

CURRENT_SUBSCRIPTION_STATUSES = ("active", "trialing", "paused")


@dataclass(frozen=True)
class UserAccountDeletionBlocker:
    code: str
    message: str
    invite_id: Optional[str] = None
    plan_key: Optional[str] = None
    role: Optional[str] = None
    subscription_id: Optional[str] = None
    workspace_id: Optional[str] = None
    workspace_kind: Optional[str] = None
    workspace_name: Optional[str] = None

    def to_detail(self) -> dict[str, str]:
        raw = {key: value for key, value in asdict(self).items() if isinstance(value, str) and value}
        return {
            _to_camel_case(key): value
            for key, value in raw.items()
        }


def load_account_delete_blockers(user_id: str) -> list[UserAccountDeletionBlocker]:
    blockers: list[UserAccountDeletionBlocker] = []
    blockers.extend(load_owned_non_solo_workspace_blockers(user_id))
    blockers.extend(load_joined_workspace_blockers(user_id))
    blockers.extend(load_active_team_seat_blockers(user_id))
    blockers.extend(load_active_subscription_blockers(user_id))
    blockers.extend(load_orphaned_invite_blockers(user_id))
    return blockers


def raise_account_delete_blocked(blockers: list[UserAccountDeletionBlocker]) -> None:
    if not blockers:
        return
    raise HTTPException(
        status_code=409,
        detail={
            "blockers": [blocker.to_detail() for blocker in blockers],
            "error": "account_delete_blocked",
            "message": "Account deletion is blocked until Team, Group, seat, subscription, and invite bindings are cleared.",
        },
    )


def load_owned_non_solo_workspace_blockers(user_id: str) -> list[UserAccountDeletionBlocker]:
    rows = _fetchall(
        """
        SELECT id, name, COALESCE(kind, 'solo_workspace')
        FROM tangent_workspaces
        WHERE owner_id = %s
          AND COALESCE(kind, 'solo_workspace') <> 'solo_workspace'
          AND COALESCE(status, 'active') <> 'deleted'
        ORDER BY created_at ASC
        """,
        (user_id,),
    )
    return [_workspace_blocker(_owned_workspace_code(row[2]), "Owns workspace that must be transferred or deleted first.", row) for row in rows]


def load_joined_workspace_blockers(user_id: str) -> list[UserAccountDeletionBlocker]:
    rows = _fetchall(
        """
        SELECT w.id, w.name, COALESCE(w.kind, 'solo_workspace'), wm.role
        FROM tangent_workspace_members wm
        JOIN tangent_workspaces w ON w.id = wm.workspace_id
        WHERE wm.user_id = %s
          AND COALESCE(w.owner_id, '') <> %s
          AND COALESCE(w.kind, 'solo_workspace') <> 'solo_workspace'
          AND COALESCE(w.status, 'active') <> 'deleted'
        ORDER BY w.created_at ASC
        """,
        (user_id, user_id),
    )
    return [
        _workspace_blocker(_joined_workspace_code(row[2]), "Still a member of a Team or Group workspace.", row, role=_optional_str(row[3]))
        for row in rows
    ]


def load_active_team_seat_blockers(user_id: str) -> list[UserAccountDeletionBlocker]:
    rows = _fetchall(
        """
        SELECT sa.id, sa.workspace_id, w.name, COALESCE(w.kind, 'team_workspace'), sa.plan_key
        FROM tangent_workspace_seat_assignments sa
        JOIN tangent_workspaces w ON w.id = sa.workspace_id
        WHERE sa.user_id = %s
          AND sa.status = 'active'
          AND COALESCE(w.status, 'active') <> 'deleted'
        ORDER BY w.created_at ASC
        """,
        (user_id,),
    )
    return [
        UserAccountDeletionBlocker(
            code="active_team_seat",
            message="Has an active Team seat assignment.",
            invite_id=None,
            plan_key=_optional_str(row[4]),
            role=None,
            subscription_id=None,
            workspace_id=_optional_str(row[1]),
            workspace_kind=_optional_str(row[3]),
            workspace_name=_optional_str(row[2]),
        )
        for row in rows
    ]


def load_active_subscription_blockers(user_id: str) -> list[UserAccountDeletionBlocker]:
    rows = _fetchall(
        """
        SELECT
            s.id,
            s.plan_key,
            s.owner_type,
            COALESCE(s.workspace_id, CASE WHEN s.owner_type = 'workspace' THEN s.owner_id ELSE NULL END),
            w.name,
            COALESCE(w.kind, 'solo_workspace')
        FROM tangent_subscriptions s
        LEFT JOIN tangent_workspaces w
          ON w.id = COALESCE(s.workspace_id, CASE WHEN s.owner_type = 'workspace' THEN s.owner_id ELSE NULL END)
        WHERE s.status IN ('active', 'trialing', 'paused')
          AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
          AND (
            (s.owner_type = 'user' AND s.owner_id = %s AND s.plan_family = 'collaborate')
            OR (
              s.owner_type = 'workspace'
              AND COALESCE(w.owner_id, '') = %s
              AND COALESCE(w.kind, 'solo_workspace') <> 'solo_workspace'
              AND COALESCE(w.status, 'active') <> 'deleted'
            )
          )
        ORDER BY s.created_at ASC
        """,
        (user_id, user_id),
    )
    return [
        UserAccountDeletionBlocker(
            code="active_subscription",
            message="Has an active subscription that must be canceled or cleared first.",
            plan_key=_optional_str(row[1]),
            subscription_id=_optional_str(row[0]),
            workspace_id=_optional_str(row[3]),
            workspace_kind=_optional_str(row[5]),
            workspace_name=_optional_str(row[4]),
        )
        for row in rows
    ]


def load_orphaned_invite_blockers(user_id: str) -> list[UserAccountDeletionBlocker]:
    rows = _fetchall(
        """
        SELECT i.id, i.workspace_id, w.name, COALESCE(w.kind, 'solo_workspace'), i.role
        FROM tangent_workspace_invitations i
        JOIN tangent_workspaces w ON w.id = i.workspace_id
        WHERE i.invited_by = %s
          AND i.accepted_at IS NULL
          AND i.revoked_at IS NULL
          AND (i.expires_at IS NULL OR i.expires_at > NOW())
          AND COALESCE(w.kind, 'solo_workspace') <> 'solo_workspace'
          AND COALESCE(w.status, 'active') <> 'deleted'
        ORDER BY i.created_at ASC
        """,
        (user_id,),
    )
    return [
        UserAccountDeletionBlocker(
            code="orphaned_invites",
            message="Has pending workspace invitations that would become orphaned.",
            invite_id=_optional_str(row[0]),
            role=_optional_str(row[4]),
            workspace_id=_optional_str(row[1]),
            workspace_kind=_optional_str(row[3]),
            workspace_name=_optional_str(row[2]),
        )
        for row in rows
    ]


def _workspace_blocker(
    code: str,
    message: str,
    row: tuple[object, ...],
    *,
    role: Optional[str] = None,
) -> UserAccountDeletionBlocker:
    return UserAccountDeletionBlocker(
        code=code,
        message=message,
        role=role,
        workspace_id=_optional_str(row[0]),
        workspace_kind=_optional_str(row[2]),
        workspace_name=_optional_str(row[1]),
    )


def _owned_workspace_code(workspace_kind: object) -> str:
    return "owned_team_workspace" if str(workspace_kind or "").strip() == "team_workspace" else "owned_group_workspace"


def _joined_workspace_code(workspace_kind: object) -> str:
    return "joined_team_workspace" if str(workspace_kind or "").strip() == "team_workspace" else "joined_group_workspace"


def _fetchall(query: str, params: tuple[object, ...]) -> list[tuple[object, ...]]:
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchall()


def _optional_str(value: object) -> Optional[str]:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _to_camel_case(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part[:1].upper() + part[1:] for part in tail)
