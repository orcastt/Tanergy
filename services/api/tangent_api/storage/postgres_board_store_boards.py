from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

from tangent_api.board_access import (
    can_read_board,
    can_read_workspace,
)
from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import BoardRecord, BoardSummary
from tangent_api.storage.postgres_board_codec import sanitize_board_id
from tangent_api.storage.postgres_board_schema import ensure_board_schema
from tangent_api.storage.postgres_board_store_support import (
    board_summary_from_row,
    connect_to_postgres_via_store as connect_to_postgres,
    paginate_board_summaries,
)


class PostgresBoardStoreBoardsMixin:
    def load_board(self, board_id: str, context: ApiRequestContext) -> BoardRecord:
        safe_board_id = sanitize_board_id(board_id)
        if not safe_board_id:
            raise HTTPException(status_code=400, detail="Invalid board id.")
        record = self._load_board_without_touch(safe_board_id, context)
        opened_at = datetime.now(timezone.utc).isoformat()
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                ensure_board_schema(cursor)
                cursor.execute(
                    """
                    UPDATE tangent_boards
                    SET last_opened_at = %s
                    WHERE workspace_id = %s AND id = %s
                    """,
                    (opened_at, context.workspace_id, safe_board_id),
                )
            connection.commit()
        return record.model_copy(update={"last_opened_at": opened_at})

    def list_boards(self, context: ApiRequestContext) -> list[BoardSummary]:
        boards, _ = self.list_boards_paginated(context)
        return boards

    def list_boards_paginated(
        self,
        context: ApiRequestContext,
        cursor: Optional[str] = None,
        limit: int = 50,
    ) -> tuple[list[BoardSummary], Optional[str]]:
        if not can_read_workspace(context):
            return [], None
        member_roles = self._load_workspace_board_member_roles(context) if context.workspace_role == "guest" else {}
        with connect_to_postgres() as connection:
            with connection.cursor() as db_cursor:
                ensure_board_schema(db_cursor)
                db_cursor.execute(
                    """
                    SELECT id, workspace_id, owner_id, title, byte_size, asset_count, shape_count,
                           description, card_color, thumbnail_url, last_opened_at, saved_at, created_at,
                           is_starred, is_pinned, visibility, share_id,
                           CASE
                               WHEN document->>'version' = '2'
                                AND document->>'renderer' = 'konva'
                                AND jsonb_typeof(document->'canvasDocument') = 'object'
                               THEN 'konva'
                               ELSE NULL
                           END AS canvas_engine
                    FROM tangent_boards
                    WHERE workspace_id = %s
                    ORDER BY saved_at DESC
                    """,
                    (context.workspace_id,),
                )
                rows = db_cursor.fetchall()
        summaries = [
            record
            for record in [board_summary_from_row(row) for row in rows]
            if can_read_board(record, context, member_roles.get(record.id))
        ]
        return paginate_board_summaries(summaries, cursor, limit)

    def rename_board(self, board_id: str, title: str, context: ApiRequestContext) -> BoardSummary:
        return self.update_board_metadata(board_id, title, None, None, None, None, None, None, None, context)
