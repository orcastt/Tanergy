import json
import math
import re
from datetime import datetime, timedelta, timezone
from typing import Optional
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

SESSION_ID_PATTERN = re.compile(r"^[a-zA-Z0-9._-]{1,120}$")
ACTIVE_STATES = {"idle", "viewing", "drawing", "typing", "selecting", "panning", "running"}
ACTIVE_TRANSFORM_KINDS = {"move", "resize", "rotate"}
ACTIVE_CONNECTION_DATA_TYPES = {"image", "text"}
MAX_SELECTION_IDS = 50
MAX_TTL_SECONDS = 300
MIN_TTL_SECONDS = 15
MAX_ACTIVE_SESSIONS_PER_BOARD = 100
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


def _normalize_presence(payload: object) -> dict[str, object]:
    presence = BoardCollaborationPresence.model_validate(payload or {})
    editing_shape_ids = [
        _normalize_session_identifier(item, "editing shape id")
        for item in presence.editing_shape_ids[:MAX_SELECTION_IDS]
        if isinstance(item, str) and item.strip()
    ]
    selection_ids = [
        _normalize_session_identifier(item, "selection id")
        for item in presence.selection_ids[:MAX_SELECTION_IDS]
        if isinstance(item, str) and item.strip()
    ]
    tool = presence.tool.strip()[:40] if isinstance(presence.tool, str) and presence.tool.strip() else None
    state = presence.state.strip().lower()[:24] if isinstance(presence.state, str) and presence.state.strip() else None
    if state and state not in ACTIVE_STATES:
        state = "idle"
    active_page_id = None
    if isinstance(presence.active_page_id, str) and presence.active_page_id.strip():
        active_page_id = _normalize_session_identifier(presence.active_page_id, "active page id")
    connection_preview = _normalize_connection_preview(presence.connection_preview)
    hovered_shape_id = None
    if isinstance(presence.hovered_shape_id, str) and presence.hovered_shape_id.strip():
        hovered_shape_id = _normalize_session_identifier(presence.hovered_shape_id, "hovered shape id")
    selected_edge_id = None
    if isinstance(presence.selected_edge_id, str) and presence.selected_edge_id.strip():
        selected_edge_id = _normalize_session_identifier(presence.selected_edge_id, "selected edge id")
    selection_box = None
    if (
        presence.selection_box is not None
        and _is_finite_number(presence.selection_box.min_x)
        and _is_finite_number(presence.selection_box.min_y)
        and _is_finite_number(presence.selection_box.max_x)
        and _is_finite_number(presence.selection_box.max_y)
    ):
        selection_box = _normalize_selection_box(presence.selection_box)
    transform_box = None
    if (
        presence.transform_box is not None
        and _is_finite_number(presence.transform_box.min_x)
        and _is_finite_number(presence.transform_box.min_y)
        and _is_finite_number(presence.transform_box.max_x)
        and _is_finite_number(presence.transform_box.max_y)
    ):
        transform_box = _normalize_selection_box(presence.transform_box)
    transform_kind = presence.transform_kind.strip().lower()[:24] if isinstance(presence.transform_kind, str) and presence.transform_kind.strip() else None
    if transform_kind and transform_kind not in ACTIVE_TRANSFORM_KINDS:
        transform_kind = None
    cursor = None
    if presence.cursor is not None and _is_finite_number(presence.cursor.x) and _is_finite_number(presence.cursor.y):
        cursor = {
            "x": round(float(presence.cursor.x), 3),
            "y": round(float(presence.cursor.y), 3),
        }
    return {
        "activePageId": active_page_id,
        "connectionPreview": connection_preview,
        "cursor": cursor,
        "editingShapeIds": editing_shape_ids,
        "hoveredShapeId": hovered_shape_id,
        "selectedEdgeId": selected_edge_id,
        "selectionBox": selection_box,
        "selectionIds": selection_ids,
        "state": state,
        "tool": tool,
        "transformBox": transform_box,
        "transformKind": transform_kind,
    }


def _normalize_connection_preview(value: object) -> Optional[dict[str, object]]:
    if value is None:
        return None
    pointer = getattr(value, "pointer", None)
    source = _normalize_port_endpoint(getattr(value, "source", None))
    if pointer is None or source is None:
        return None
    if not _is_finite_number(pointer.x) or not _is_finite_number(pointer.y):
        return None
    data_type = _normalize_connection_data_type(getattr(value, "data_type", None))
    if data_type is None:
        return None
    sources_payload = getattr(value, "sources", None)
    sources = [
        endpoint
        for endpoint in (
            _normalize_port_endpoint(item)
            for item in (sources_payload[:MAX_SELECTION_IDS] if isinstance(sources_payload, list) else [])
        )
        if endpoint is not None
    ]
    return {
        "dataType": data_type,
        "pointer": {
            "x": round(float(pointer.x), 3),
            "y": round(float(pointer.y), 3),
        },
        "source": source,
        "sources": sources or [source],
        "target": _normalize_port_endpoint(getattr(value, "target", None)),
    }


def _normalize_selection_box(value: object) -> Optional[dict[str, float]]:
    min_x = round(float(min(value.min_x, value.max_x)), 3)
    max_x = round(float(max(value.min_x, value.max_x)), 3)
    min_y = round(float(min(value.min_y, value.max_y)), 3)
    max_y = round(float(max(value.min_y, value.max_y)), 3)
    if max_x <= min_x or max_y <= min_y:
        return None
    return {
        "maxX": max_x,
        "maxY": max_y,
        "minX": min_x,
        "minY": min_y,
    }


def _normalize_port_endpoint(value: object) -> Optional[dict[str, str]]:
    if value is None:
        return None
    port_id = getattr(value, "port_id", None)
    shape_id = getattr(value, "shape_id", None)
    if not isinstance(port_id, str) or not port_id.strip():
        return None
    if not isinstance(shape_id, str) or not shape_id.strip():
        return None
    return {
        "portId": _normalize_session_identifier(port_id, "connection port id"),
        "shapeId": _normalize_session_identifier(shape_id, "connection shape id"),
    }


def _normalize_connection_data_type(value: object) -> Optional[str]:
    if not isinstance(value, str):
        return None
    normalized = value.strip().lower()
    return normalized if normalized in ACTIVE_CONNECTION_DATA_TYPES else None


def _normalize_session_identifier(value: str, label: str) -> str:
    trimmed = value.strip()
    if not trimmed or not SESSION_ID_PATTERN.fullmatch(trimmed) or ".." in trimmed:
        raise HTTPException(status_code=400, detail=f"Invalid {label}.")
    return trimmed


def _normalize_ttl_seconds(value: Optional[int]) -> int:
    if value is None:
        return 45
    return max(MIN_TTL_SECONDS, min(int(value), MAX_TTL_SECONDS))


def _is_finite_number(value: object) -> bool:
    if not isinstance(value, (float, int)):
        return False
    return math.isfinite(float(value))


def _room_key(workspace_id: str, board_id: str) -> str:
    return f"board:{workspace_id}:{board_id}"
