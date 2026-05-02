import json
import re
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.board_guard import audit_board_document
from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import (
    BoardRecord,
    BoardSaveRequest,
    BoardSaveResponse,
    BoardSummary,
    get_board_document_metrics,
    summarize_board_record,
)
from tangent_api.storage.postgres_connection import connect_to_postgres, should_auto_create_tables

BOARD_ID_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")


class PostgresBoardStore:
    def save_board(
        self,
        input_data: BoardSaveRequest,
        context: ApiRequestContext,
    ) -> BoardSaveResponse:
        audit = audit_board_document(input_data.document)
        if not audit.ok:
            return BoardSaveResponse(audit=audit, error="Board document failed save guard.", ok=False)

        board_id = _sanitize_board_id(input_data.board_id) or f"board_{uuid4()}"
        saved_at = datetime.now(timezone.utc).isoformat()
        metrics = get_board_document_metrics(input_data.document)
        record = BoardRecord(
            assetCount=metrics["asset_count"],
            byteSize=audit.byte_size,
            document=input_data.document,
            id=board_id,
            ownerId=context.user_id,
            savedAt=saved_at,
            shapeCount=metrics["shape_count"],
            thumbnailUrl=None,
            title=(input_data.title or "Untitled Board").strip() or "Untitled Board",
            workspaceId=context.workspace_id,
        )

        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                self._ensure_schema(cursor)
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
                        thumbnail_url,
                        last_opened_at,
                        saved_at
                    )
                    VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (workspace_id, id) DO UPDATE SET
                        owner_id = EXCLUDED.owner_id,
                        title = EXCLUDED.title,
                        document = EXCLUDED.document,
                        byte_size = EXCLUDED.byte_size,
                        asset_count = EXCLUDED.asset_count,
                        shape_count = EXCLUDED.shape_count,
                        thumbnail_url = EXCLUDED.thumbnail_url,
                        saved_at = EXCLUDED.saved_at
                    """,
                    (
                        record.id,
                        record.workspace_id,
                        record.owner_id,
                        record.title,
                        json.dumps(record.document),
                        record.byte_size,
                        record.asset_count,
                        record.shape_count,
                        record.thumbnail_url,
                        record.last_opened_at,
                        record.saved_at,
                    ),
                )
            connection.commit()

        return BoardSaveResponse(audit=audit, board=summarize_board_record(record), ok=True)

    def load_board(self, board_id: str, context: ApiRequestContext) -> BoardRecord:
        safe_board_id = _sanitize_board_id(board_id)
        if not safe_board_id:
            raise HTTPException(status_code=400, detail="Invalid board id.")

        record = self._load_board_without_touch(safe_board_id, context)
        opened_at = datetime.now(timezone.utc).isoformat()
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                self._ensure_schema(cursor)
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
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                self._ensure_schema(cursor)
                cursor.execute(
                    """
                    SELECT
                        id,
                        workspace_id,
                        owner_id,
                        title,
                        document,
                        byte_size,
                        asset_count,
                        shape_count,
                        thumbnail_url,
                        last_opened_at,
                        saved_at
                    FROM tangent_boards
                    WHERE workspace_id = %s
                    ORDER BY saved_at DESC
                    """,
                    (context.workspace_id,),
                )
                rows = cursor.fetchall()

        return [summarize_board_record(_board_record_from_row(row)) for row in rows]

    def rename_board(self, board_id: str, title: str, context: ApiRequestContext) -> BoardSummary:
        record = self._load_board_without_touch(board_id, context)
        next_title = title.strip()
        if not next_title:
            raise HTTPException(status_code=400, detail="Board title is required.")
        if len(next_title) > 80:
            raise HTTPException(status_code=400, detail="Board title must be 80 characters or fewer.")

        saved_at = datetime.now(timezone.utc).isoformat()
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                self._ensure_schema(cursor)
                cursor.execute(
                    """
                    UPDATE tangent_boards
                    SET title = %s, saved_at = %s
                    WHERE workspace_id = %s AND id = %s
                    """,
                    (next_title, saved_at, context.workspace_id, record.id),
                )
            connection.commit()

        return summarize_board_record(record.model_copy(update={"title": next_title, "saved_at": saved_at}))

    def delete_board(self, board_id: str, context: ApiRequestContext) -> str:
        record = self._load_board_without_touch(board_id, context)
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                self._ensure_schema(cursor)
                cursor.execute(
                    """
                    DELETE FROM tangent_boards
                    WHERE workspace_id = %s AND id = %s
                    """,
                    (context.workspace_id, record.id),
                )
            connection.commit()
        return record.id

    def _ensure_schema(self, cursor: Any) -> None:
        if not should_auto_create_tables():
            return
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS tangent_boards (
                id TEXT NOT NULL,
                workspace_id TEXT NOT NULL,
                owner_id TEXT NOT NULL,
                title TEXT NOT NULL,
                document JSONB NOT NULL,
                byte_size INTEGER NOT NULL,
                asset_count INTEGER NOT NULL DEFAULT 0,
                shape_count INTEGER NOT NULL DEFAULT 0,
                thumbnail_url TEXT,
                last_opened_at TIMESTAMPTZ,
                saved_at TIMESTAMPTZ NOT NULL,
                PRIMARY KEY (workspace_id, id)
            )
            """
        )
        cursor.execute("ALTER TABLE tangent_boards ADD COLUMN IF NOT EXISTS asset_count INTEGER NOT NULL DEFAULT 0")
        cursor.execute("ALTER TABLE tangent_boards ADD COLUMN IF NOT EXISTS shape_count INTEGER NOT NULL DEFAULT 0")
        cursor.execute("ALTER TABLE tangent_boards ADD COLUMN IF NOT EXISTS thumbnail_url TEXT")
        cursor.execute("ALTER TABLE tangent_boards ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ")
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS tangent_boards_owner_idx
            ON tangent_boards (workspace_id, owner_id, saved_at DESC)
            """
        )
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS tangent_boards_opened_idx
            ON tangent_boards (workspace_id, last_opened_at DESC, saved_at DESC)
            """
        )

    def _load_board_without_touch(self, board_id: str, context: ApiRequestContext) -> BoardRecord:
        safe_board_id = _sanitize_board_id(board_id)
        if not safe_board_id:
            raise HTTPException(status_code=400, detail="Invalid board id.")

        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                self._ensure_schema(cursor)
                cursor.execute(
                    """
                    SELECT
                        id,
                        workspace_id,
                        owner_id,
                        title,
                        document,
                        byte_size,
                        asset_count,
                        shape_count,
                        thumbnail_url,
                        last_opened_at,
                        saved_at
                    FROM tangent_boards
                    WHERE workspace_id = %s AND id = %s
                    """,
                    (context.workspace_id, safe_board_id),
                )
                row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Board not found in workspace.")
        return _board_record_from_row(row)


def _board_record_from_row(row: tuple[Any, ...]) -> BoardRecord:
    last_opened_at = row[9].isoformat() if hasattr(row[9], "isoformat") else row[9]
    saved_at = row[10].isoformat() if hasattr(row[10], "isoformat") else str(row[10])
    document = row[4] if not isinstance(row[4], str) else json.loads(row[4])
    return BoardRecord(
        assetCount=row[6] or 0,
        byteSize=row[5],
        document=document,
        id=row[0],
        lastOpenedAt=last_opened_at,
        ownerId=row[2],
        savedAt=saved_at,
        shapeCount=row[7] or 0,
        thumbnailUrl=row[8],
        title=row[3],
        workspaceId=row[1],
    )


def _sanitize_board_id(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    if BOARD_ID_PATTERN.match(value) and ".." not in value:
        return value
    raise HTTPException(status_code=400, detail="Invalid board id.")
