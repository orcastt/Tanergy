from __future__ import annotations

from datetime import datetime, timezone
from importlib import import_module
from typing import Optional

from fastapi import HTTPException

from tangent_api.board_access import (
    assert_can_manage_board,
    assert_can_read_board,
    assert_can_write_board,
    can_read_board,
    can_read_workspace,
)
from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import (
    BoardSaveRequest,
    BoardRecord,
    BoardSummary,
    normalize_board_card_color,
    normalize_board_description,
    normalize_board_share_id,
    normalize_board_thumbnail_url,
    normalize_board_visibility,
)
from tangent_api.storage.postgres_board_codec import board_record_from_row, sanitize_board_id
from tangent_api.storage.postgres_board_schema import BOARD_SELECT_COLUMNS, ensure_board_schema
from tangent_api.storage.postgres_connection import connect_to_postgres as default_connect_to_postgres


class PostgresBoardStoreAccessMixin:
    def _load_board_without_touch(
        self,
        board_id: str,
        context: ApiRequestContext,
        required_access: str = "read",
    ) -> BoardRecord:
        safe_board_id = sanitize_board_id(board_id)
        if not safe_board_id:
            raise HTTPException(status_code=400, detail="Invalid board id.")

        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                ensure_board_schema(cursor)
                cursor.execute(
                    f"""
                    SELECT {BOARD_SELECT_COLUMNS}
                    FROM tangent_boards
                    WHERE workspace_id = %s AND id = %s
                    """,
                    (context.workspace_id, safe_board_id),
                )
                row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Board not found in workspace.")
        record = board_record_from_row(row)
        member_role = self._load_board_member_role(record.id, context)
        if required_access == "manage":
            assert_can_manage_board(record, context, member_role)
        elif required_access == "write":
            assert_can_write_board(record, context, member_role)
        else:
            assert_can_read_board(record, context, member_role)
        return record

    def _read_existing_board(self, board_id: str, context: ApiRequestContext) -> Optional[BoardRecord]:
        try:
            return self._load_board_without_touch(board_id, context)
        except HTTPException as exc:
            if exc.status_code == 404:
                return None
            raise

    def _load_board_member_role(self, board_id: str, context: ApiRequestContext) -> Optional[str]:
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT role
                    FROM tangent_board_members
                    WHERE workspace_id = %s AND board_id = %s AND user_id = %s
                      AND (expires_at IS NULL OR expires_at > NOW())
                    """,
                    (context.workspace_id, board_id, context.user_id),
                )
                row = cursor.fetchone()
        if not row:
            return None
        return str(row[0]).strip().lower()

    def _load_workspace_board_member_roles(self, context: ApiRequestContext) -> dict[str, str]:
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT board_id, role
                    FROM tangent_board_members
                    WHERE workspace_id = %s AND user_id = %s
                      AND (expires_at IS NULL OR expires_at > NOW())
                    """,
                    (context.workspace_id, context.user_id),
                )
                rows = cursor.fetchall()
        return {str(row[0]): str(row[1]).strip().lower() for row in rows}


def connect_to_postgres_via_store():
    store_module = import_module("tangent_api.storage.postgres_board_store")
    connection_factory = getattr(store_module, "connect_to_postgres", default_connect_to_postgres)
    if connection_factory is connect_to_postgres_via_store:
        connection_factory = default_connect_to_postgres
    return connection_factory()


connect_to_postgres = connect_to_postgres_via_store


def paginate_board_summaries(
    summaries: list[BoardSummary],
    cursor: Optional[str],
    limit: int,
) -> tuple[list[BoardSummary], Optional[str]]:
    normalized_limit = max(1, min(limit, 100))
    start_index = 0
    if cursor:
        for index, item in enumerate(summaries):
            if _encode_board_cursor(item) == cursor:
                start_index = index + 1
                break
    page = summaries[start_index:start_index + normalized_limit]
    next_cursor = _encode_board_cursor(page[-1]) if start_index + normalized_limit < len(summaries) and page else None
    return page, next_cursor


def board_summary_from_row(row: tuple[object, ...]) -> BoardSummary:
    return BoardSummary(
        assetCount=int(row[5] or 0),
        byteSize=int(row[4] or 0),
        cardColor=row[8],
        canvasEngine=row[17] if len(row) > 17 else None,
        createdAt=_optional_iso(row[12]),
        description=row[7],
        id=str(row[0]),
        isPinned=bool(row[14]),
        isStarred=bool(row[13]),
        lastOpenedAt=_optional_iso(row[10]),
        ownerId=str(row[2]),
        savedAt=_required_iso(row[11]),
        shapeCount=int(row[6] or 0),
        shareId=normalize_board_share_id(str(row[16])) if row[16] else None,
        thumbnailUrl=normalize_board_thumbnail_url(row[9]),
        title=str(row[3] or "Untitled Board"),
        visibility=normalize_board_visibility(str(row[15]) if row[15] else None),
        workspaceId=str(row[1]),
    )


def copy_title(title: str) -> str:
    return f"{title} Copy" if title else "Untitled Board Copy"


def build_board_record(
    input_data: BoardSaveRequest,
    context: ApiRequestContext,
    board_id: str,
    existing: Optional[BoardRecord],
    byte_size: int,
    metrics: dict[str, int],
    saved_at: str,
) -> BoardRecord:
    return BoardRecord(
        assetCount=metrics["asset_count"],
        byteSize=byte_size,
        cardColor=normalize_board_card_color(input_data.card_color or (existing.card_color if existing else None)),
        createdAt=existing.created_at if existing else saved_at,
        description=normalize_board_description(input_data.description or (existing.description if existing else None)),
        document=input_data.document,
        id=board_id,
        isPinned=existing.is_pinned if existing else False,
        isStarred=existing.is_starred if existing else False,
        lastOpenedAt=existing.last_opened_at if existing else None,
        ownerId=existing.owner_id if existing else context.user_id,
        savedAt=saved_at,
        shapeCount=metrics["shape_count"],
        shareId=normalize_board_share_id(existing.share_id if existing else None),
        thumbnailUrl=normalize_board_thumbnail_url(input_data.thumbnail_url or (existing.thumbnail_url if existing else None)),
        title=(input_data.title or "Untitled Board").strip() or "Untitled Board",
        visibility=normalize_board_visibility(existing.visibility if existing else None),
        workspaceId=context.workspace_id,
    )


def _encode_board_cursor(board: BoardSummary) -> str:
    return f"{board.saved_at.replace('+00:00', 'Z')}|{board.id}"


def _optional_iso(value: object) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _required_iso(value: object) -> str:
    return _optional_iso(value) or datetime.now(timezone.utc).isoformat()
