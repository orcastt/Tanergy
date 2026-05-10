import json
from copy import deepcopy
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.admin_access import _insert_admin_audit_log
from tangent_api.admin_operator_schemas import AdminOperatorBoardMutationResponse
from tangent_api.board_schemas import BoardSummary
from tangent_api.schemas import summarize_board_record
from tangent_api.storage.postgres_board_codec import board_record_from_row, sanitize_board_id
from tangent_api.storage.postgres_board_schema import BOARD_SELECT_COLUMNS, ensure_board_schema
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url


def copy_admin_operator_board(
    *,
    actor_user_id: str,
    board_id: str,
    reason: str,
    workspace_id: str,
) -> AdminOperatorBoardMutationResponse:
    require_database_url()
    normalized_workspace_id = _normalize_id(workspace_id, "workspace id")
    normalized_board_id = _normalize_board_id(board_id)
    normalized_reason = _normalize_reason(reason)
    copied_at = datetime.now(timezone.utc).isoformat()

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            source = _load_board(cursor, normalized_workspace_id, normalized_board_id)
            workspace_name = _load_workspace_name(cursor, normalized_workspace_id)
            copied_board = source.model_copy(
                update={
                    "created_at": copied_at,
                    "document": deepcopy(source.document),
                    "id": f"board_{uuid4()}",
                    "is_pinned": False,
                    "is_starred": False,
                    "last_opened_at": None,
                    "saved_at": copied_at,
                    "share_id": None,
                    "title": _copy_title(source.title),
                    "visibility": "private",
                }
            )
            cursor.execute(
                """
                INSERT INTO tangent_boards (
                    id,
                    workspace_id,
                    owner_id,
                    title,
                    document,
                    byte_size,
                    asset_count,
                    shape_count,
                    description,
                    card_color,
                    thumbnail_url,
                    last_opened_at,
                    saved_at,
                    created_at,
                    is_starred,
                    is_pinned,
                    visibility,
                    share_id
                )
                VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    copied_board.id,
                    copied_board.workspace_id,
                    copied_board.owner_id,
                    copied_board.title,
                    json.dumps(copied_board.document),
                    copied_board.byte_size,
                    copied_board.asset_count,
                    copied_board.shape_count,
                    copied_board.description,
                    copied_board.card_color,
                    copied_board.thumbnail_url,
                    copied_board.last_opened_at,
                    copied_board.saved_at,
                    copied_board.created_at,
                    copied_board.is_starred,
                    copied_board.is_pinned,
                    copied_board.visibility,
                    copied_board.share_id,
                ),
            )
            cursor.execute(
                """
                INSERT INTO tangent_board_members (
                    workspace_id,
                    board_id,
                    user_id,
                    role,
                    invited_by
                ) VALUES (%s, %s, %s, 'owner', %s)
                ON CONFLICT (workspace_id, board_id, user_id) DO NOTHING
                """,
                (normalized_workspace_id, copied_board.id, copied_board.owner_id, actor_user_id),
            )
            audit_id = _insert_admin_audit_log(
                cursor,
                action="admin.operator.board.copy",
                actor_user_id=actor_user_id,
                metadata={
                    "copiedBoardId": copied_board.id,
                    "reason": normalized_reason,
                    "sourceBoardId": source.id,
                    "sourceTitle": source.title,
                    "workspaceName": workspace_name,
                },
                target_user_id=source.owner_id,
                workspace_id=normalized_workspace_id,
            )
        connection.commit()

    summary = summarize_board_record(copied_board)
    return AdminOperatorBoardMutationResponse(
        auditId=audit_id,
        board=_to_board_summary(summary),
        boardId=copied_board.id,
        message="Board copied.",
        ok=True,
        workspaceId=normalized_workspace_id,
    )


def delete_admin_operator_board(
    *,
    actor_user_id: str,
    board_id: str,
    reason: str,
    workspace_id: str,
) -> AdminOperatorBoardMutationResponse:
    require_database_url()
    normalized_workspace_id = _normalize_id(workspace_id, "workspace id")
    normalized_board_id = _normalize_board_id(board_id)
    normalized_reason = _normalize_reason(reason)

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            board = _load_board(cursor, normalized_workspace_id, normalized_board_id)
            workspace_name = _load_workspace_name(cursor, normalized_workspace_id)
            cursor.execute(
                """
                DELETE FROM tangent_boards
                WHERE workspace_id = %s
                  AND id = %s
                """,
                (normalized_workspace_id, normalized_board_id),
            )
            audit_id = _insert_admin_audit_log(
                cursor,
                action="admin.operator.board.delete",
                actor_user_id=actor_user_id,
                metadata={
                    "reason": normalized_reason,
                    "title": board.title,
                    "workspaceName": workspace_name,
                },
                target_user_id=board.owner_id,
                workspace_id=normalized_workspace_id,
            )
        connection.commit()

    return AdminOperatorBoardMutationResponse(
        auditId=audit_id,
        board=None,
        boardId=normalized_board_id,
        message="Board deleted.",
        ok=True,
        workspaceId=normalized_workspace_id,
    )


def _load_board(cursor: object, workspace_id: str, board_id: str):
    ensure_board_schema(cursor)
    cursor.execute(
        f"""
        SELECT {BOARD_SELECT_COLUMNS}
        FROM tangent_boards
        WHERE workspace_id = %s
          AND id = %s
        LIMIT 1
        """,
        (workspace_id, board_id),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Board not found in workspace.")
    return board_record_from_row(row)


def _load_workspace_name(cursor: object, workspace_id: str) -> str:
    cursor.execute(
        """
        SELECT COALESCE(name, 'Workspace')
        FROM tangent_workspaces
        WHERE id = %s
          AND COALESCE(status, 'active') <> 'deleted'
        LIMIT 1
        """,
        (workspace_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Workspace not found.")
    return str(row[0] or "Workspace")


def _to_board_summary(summary: BoardSummary) -> BoardSummary:
    return BoardSummary.model_validate(summary.model_dump(by_alias=True))


def _copy_title(title: str) -> str:
    return f"{title} Copy" if title else "Untitled Board Copy"


def _normalize_board_id(board_id: str) -> str:
    normalized = sanitize_board_id(board_id)
    if not normalized:
        raise HTTPException(status_code=400, detail="Invalid board id.")
    return normalized


def _normalize_id(value: str, label: str) -> str:
    normalized = value.strip()
    if not normalized or ".." in normalized:
        raise HTTPException(status_code=400, detail=f"Invalid {label}.")
    return normalized


def _normalize_reason(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="Reason is required.")
    return normalized
