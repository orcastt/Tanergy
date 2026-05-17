import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.board_access import can_write_board, resolve_effective_board_permission
from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import (
    BoardCollaborationPresence,
    BoardCollaborationSessionDeleteResponse,
    BoardCollaborationSessionRecord,
    BoardCollaborationSessionsResponse,
    BoardCollaborationSessionUpsertRequest,
)
from tangent_api.storage.postgres_board_collaboration_schema import (
    BOARD_COLLABORATION_SELECT_COLUMNS,
    ensure_board_collaboration_schema,
)
from tangent_api.storage.postgres_board_store import PostgresBoardStore
from tangent_api.storage.postgres_connection import connect_to_postgres
from tangent_api.storage.board_collaboration_store_support import (
    MAX_ACTIVE_SESSIONS_PER_BOARD,
    _normalize_presence,
    _normalize_session_identifier,
    _normalize_ttl_seconds,
    _room_key,
)
SESSION_HISTORY_RETENTION_SECONDS = 60 * 60


def claim_postgres_board_collaboration_session(
    board_id: str,
    payload: BoardCollaborationSessionUpsertRequest,
    context: ApiRequestContext,
) -> BoardCollaborationSessionsResponse:
    record, member_role, permission = _load_board_access(board_id, context)
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    history_cutoff_iso = (now - timedelta(seconds=SESSION_HISTORY_RETENTION_SECONDS)).isoformat()
    expires_at = (now + timedelta(seconds=_normalize_ttl_seconds(payload.ttl_seconds))).isoformat()
    normalized_client_instance_id = _normalize_session_identifier(payload.client_instance_id, "client instance id")
    normalized_presence = _normalize_presence(payload.presence)

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            ensure_board_collaboration_schema(cursor)
            _disconnect_expired_sessions(cursor, record.workspace_id, record.id, now_iso)
            _delete_stale_session_history(cursor, history_cutoff_iso)
            cursor.execute(
                f"""
                INSERT INTO tangent_board_collaboration_sessions (
                    id,
                    workspace_id,
                    board_id,
                    user_id,
                    client_instance_id,
                    display_name,
                    avatar_initials,
                    workspace_role,
                    permission,
                    presence,
                    last_heartbeat_at,
                    expires_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
                ON CONFLICT (workspace_id, board_id, user_id, client_instance_id) DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    avatar_initials = EXCLUDED.avatar_initials,
                    workspace_role = EXCLUDED.workspace_role,
                    permission = EXCLUDED.permission,
                    presence = EXCLUDED.presence,
                    last_heartbeat_at = EXCLUDED.last_heartbeat_at,
                    expires_at = EXCLUDED.expires_at,
                    disconnected_at = NULL
                RETURNING {BOARD_COLLABORATION_SELECT_COLUMNS}
                """,
                (
                    f"collab_{uuid4()}",
                    record.workspace_id,
                    record.id,
                    context.user_id,
                    normalized_client_instance_id,
                    context.user_display_name or context.user_id,
                    context.user_avatar_initials or "NA",
                    context.workspace_role,
                    permission,
                    json.dumps(normalized_presence),
                    now_iso,
                    expires_at,
                ),
            )
            self_row = cursor.fetchone()
            active_rows = _select_active_rows(cursor, record.workspace_id, record.id, now_iso)
        connection.commit()

    self_session = _row_to_session_record(self_row, context.user_id) if self_row else None
    return BoardCollaborationSessionsResponse(
        activeSessions=[_row_to_session_record(row, context.user_id) for row in active_rows],
        boardId=record.id,
        boardSavedAt=record.saved_at,
        canEdit=can_write_board(record, context, member_role),
        ok=True,
        permission=permission,
        roomKey=_room_key(record.workspace_id, record.id),
        selfSession=self_session,
        workspaceId=record.workspace_id,
    )


def list_postgres_board_collaboration_sessions(
    board_id: str,
    context: ApiRequestContext,
) -> BoardCollaborationSessionsResponse:
    record, member_role, permission = _load_board_access(board_id, context)
    now_iso = datetime.now(timezone.utc).isoformat()
    history_cutoff_iso = (
        datetime.now(timezone.utc) - timedelta(seconds=SESSION_HISTORY_RETENTION_SECONDS)
    ).isoformat()

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            ensure_board_collaboration_schema(cursor)
            _disconnect_expired_sessions(cursor, record.workspace_id, record.id, now_iso)
            _delete_stale_session_history(cursor, history_cutoff_iso)
            active_rows = _select_active_rows(cursor, record.workspace_id, record.id, now_iso)
        connection.commit()

    return BoardCollaborationSessionsResponse(
        activeSessions=[_row_to_session_record(row, context.user_id) for row in active_rows],
        boardId=record.id,
        boardSavedAt=record.saved_at,
        canEdit=can_write_board(record, context, member_role),
        ok=True,
        permission=permission,
        roomKey=_room_key(record.workspace_id, record.id),
        selfSession=None,
        workspaceId=record.workspace_id,
    )


def release_postgres_board_collaboration_session(
    board_id: str,
    session_id: str,
    context: ApiRequestContext,
) -> BoardCollaborationSessionDeleteResponse:
    record, _, _permission = _load_board_access(board_id, context)
    now_iso = datetime.now(timezone.utc).isoformat()
    history_cutoff_iso = (
        datetime.now(timezone.utc) - timedelta(seconds=SESSION_HISTORY_RETENTION_SECONDS)
    ).isoformat()
    normalized_session_id = _normalize_session_identifier(session_id, "session id")

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            ensure_board_collaboration_schema(cursor)
            cursor.execute(
                """
                UPDATE tangent_board_collaboration_sessions
                SET disconnected_at = %s
                WHERE workspace_id = %s
                  AND board_id = %s
                  AND id = %s
                  AND user_id = %s
                  AND disconnected_at IS NULL
                """,
                (now_iso, record.workspace_id, record.id, normalized_session_id, context.user_id),
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Collaboration session not found.")
            _disconnect_expired_sessions(cursor, record.workspace_id, record.id, now_iso)
            _delete_stale_session_history(cursor, history_cutoff_iso)
            active_rows = _select_active_rows(cursor, record.workspace_id, record.id, now_iso)
        connection.commit()

    return BoardCollaborationSessionDeleteResponse(
        activeSessions=[_row_to_session_record(row, context.user_id) for row in active_rows],
        boardId=record.id,
        boardSavedAt=record.saved_at,
        ok=True,
        sessionId=normalized_session_id,
        workspaceId=record.workspace_id,
    )


def _load_board_access(board_id: str, context: ApiRequestContext):
    store = PostgresBoardStore()
    record = store._load_board_without_touch(board_id, context, required_access="read")
    member_role = store._load_board_member_role(record.id, context)
    permission = resolve_effective_board_permission(record, context, member_role)
    return record, member_role, permission


def _disconnect_expired_sessions(cursor: object, workspace_id: str, board_id: str, now_iso: str) -> None:
    cursor.execute(
        """
        UPDATE tangent_board_collaboration_sessions
        SET disconnected_at = %s
        WHERE workspace_id = %s
          AND board_id = %s
          AND disconnected_at IS NULL
          AND expires_at <= %s
        """,
        (now_iso, workspace_id, board_id, now_iso),
    )


def _delete_stale_session_history(cursor: object, cutoff_iso: str) -> None:
    cursor.execute(
        """
        DELETE FROM tangent_board_collaboration_sessions
        WHERE disconnected_at IS NOT NULL
          AND disconnected_at <= %s
        """,
        (cutoff_iso,),
    )


def _select_active_rows(cursor: object, workspace_id: str, board_id: str, now_iso: str):
    cursor.execute(
        f"""
        SELECT {BOARD_COLLABORATION_SELECT_COLUMNS}
        FROM tangent_board_collaboration_sessions
        WHERE workspace_id = %s
          AND board_id = %s
          AND disconnected_at IS NULL
          AND expires_at > %s
        ORDER BY last_heartbeat_at DESC, created_at DESC
        LIMIT %s
        """,
        (workspace_id, board_id, now_iso, MAX_ACTIVE_SESSIONS_PER_BOARD),
    )
    return cursor.fetchall()


def _row_to_session_record(row: tuple[object, ...], current_user_id: str) -> BoardCollaborationSessionRecord:
    created_at = _iso(row[10])
    last_heartbeat_at = _iso(row[11])
    expires_at = _iso(row[12])
    return BoardCollaborationSessionRecord(
        avatarInitials=str(row[6] or "NA"),
        boardId=str(row[2]),
        clientInstanceId=str(row[4]),
        createdAt=created_at,
        displayName=str(row[5] or row[3]),
        expiresAt=expires_at,
        id=str(row[0]),
        isSelf=str(row[3]) == current_user_id,
        lastHeartbeatAt=last_heartbeat_at,
        permission=str(row[8]),
        presence=BoardCollaborationPresence.model_validate(row[9] or {}),
        userId=str(row[3]),
        workspaceId=str(row[1]),
        workspaceRole=str(row[7]),
    )


def _iso(value: object) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
