import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.board_guard import audit_board_document
from tangent_api.board_metadata import normalize_board_thumbnail_url
from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import (
    BoardSnapshotCreateRequest,
    BoardSnapshotRecord,
    BoardSnapshotSummary,
    get_board_document_metrics,
)
from tangent_api.storage.postgres_connection import connect_to_postgres, should_auto_create_tables


class PostgresBoardSnapshotStore:
    def create_snapshot(
        self,
        board_id: str,
        input_data: BoardSnapshotCreateRequest,
        context: ApiRequestContext,
    ) -> BoardSnapshotSummary:
        audit = audit_board_document(input_data.document)
        if not audit.ok:
            issue = next((item for item in audit.issues if item.blocking), None)
            raise HTTPException(status_code=422, detail=issue.message if issue else "Board document is blocked.")

        created_at = datetime.now(timezone.utc).isoformat()
        metrics = get_board_document_metrics(input_data.document)
        snapshot = BoardSnapshotRecord(
            assetCount=metrics["asset_count"],
            boardId=board_id,
            byteSize=audit.byte_size,
            createdAt=created_at,
            createdBy=context.user_id,
            document=input_data.document,
            documentHash=_hash_document(input_data.document),
            expiresAt=None,
            id=f"snapshot_{uuid4()}",
            reason=_normalize_reason(input_data.reason),
            retentionTier="free",
            shapeCount=metrics["shape_count"],
            thumbnailUrl=normalize_board_thumbnail_url(input_data.thumbnail_url),
            title=(input_data.title or "Untitled snapshot").strip() or "Untitled snapshot",
            workspaceId=context.workspace_id,
        )

        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                self._ensure_schema(cursor)
                cursor.execute(
                    """
                    INSERT INTO tangent_board_snapshots (
                        id,
                        workspace_id,
                        board_id,
                        created_by,
                        title,
                        document,
                        document_hash,
                        byte_size,
                        asset_count,
                        shape_count,
                        thumbnail_url,
                        reason,
                        retention_tier,
                        expires_at,
                        created_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        snapshot.id,
                        snapshot.workspace_id,
                        snapshot.board_id,
                        snapshot.created_by,
                        snapshot.title,
                        json.dumps(snapshot.document),
                        snapshot.document_hash,
                        snapshot.byte_size,
                        snapshot.asset_count,
                        snapshot.shape_count,
                        snapshot.thumbnail_url,
                        snapshot.reason,
                        snapshot.retention_tier,
                        snapshot.expires_at,
                        snapshot.created_at,
                    ),
                )
                self._enforce_snapshot_limit(cursor, context.workspace_id, board_id)
            connection.commit()
        return _summarize_snapshot(snapshot)

    def list_snapshots(self, board_id: str, context: ApiRequestContext) -> list[BoardSnapshotSummary]:
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                self._ensure_schema(cursor)
                cursor.execute(
                    """
                    SELECT
                        id,
                        workspace_id,
                        board_id,
                        created_by,
                        title,
                        document,
                        document_hash,
                        byte_size,
                        asset_count,
                        shape_count,
                        thumbnail_url,
                        reason,
                        retention_tier,
                        expires_at,
                        created_at
                    FROM tangent_board_snapshots
                    WHERE workspace_id = %s AND board_id = %s
                    ORDER BY created_at DESC
                    """,
                    (context.workspace_id, board_id),
                )
                rows = cursor.fetchall()
        return [_summarize_snapshot(_snapshot_from_row(row)) for row in rows]

    def load_snapshot(
        self,
        board_id: str,
        snapshot_id: str,
        context: ApiRequestContext,
    ) -> BoardSnapshotRecord:
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                self._ensure_schema(cursor)
                cursor.execute(
                    """
                    SELECT
                        id,
                        workspace_id,
                        board_id,
                        created_by,
                        title,
                        document,
                        document_hash,
                        byte_size,
                        asset_count,
                        shape_count,
                        thumbnail_url,
                        reason,
                        retention_tier,
                        expires_at,
                        created_at
                    FROM tangent_board_snapshots
                    WHERE workspace_id = %s AND board_id = %s AND id = %s
                    """,
                    (context.workspace_id, board_id, snapshot_id),
                )
                row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Board history entry not found in workspace.")
        return _snapshot_from_row(row)

    def clear_snapshots(self, board_id: str, context: ApiRequestContext) -> int:
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                self._ensure_schema(cursor)
                cursor.execute(
                    """
                    DELETE FROM tangent_board_snapshots
                    WHERE workspace_id = %s AND board_id = %s
                    """,
                    (context.workspace_id, board_id),
                )
                deleted_count = max(0, getattr(cursor, "rowcount", 0))
            connection.commit()
        return deleted_count

    def _ensure_schema(self, cursor: Any) -> None:
        if not should_auto_create_tables():
            return
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS tangent_board_snapshots (
                id TEXT NOT NULL,
                workspace_id TEXT NOT NULL,
                board_id TEXT NOT NULL,
                created_by TEXT NOT NULL,
                title TEXT NOT NULL,
                document JSONB NOT NULL,
                document_hash TEXT NOT NULL,
                byte_size INTEGER NOT NULL,
                asset_count INTEGER NOT NULL DEFAULT 0,
                shape_count INTEGER NOT NULL DEFAULT 0,
                thumbnail_url TEXT,
                reason TEXT NOT NULL,
                retention_tier TEXT NOT NULL,
                expires_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL,
                PRIMARY KEY (workspace_id, board_id, id)
            )
            """
        )
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS tangent_board_snapshots_created_idx
            ON tangent_board_snapshots (workspace_id, board_id, created_at DESC)
            """
        )

    def _enforce_snapshot_limit(self, cursor: Any, workspace_id: str, board_id: str) -> None:
        limit = _snapshot_limit()
        cursor.execute(
            """
            WITH ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY CASE WHEN reason IN ('autosave', 'auto_interval') THEN 'autosave' ELSE 'user' END
                        ORDER BY created_at DESC
                    ) AS retention_rank
                FROM tangent_board_snapshots
                WHERE workspace_id = %s AND board_id = %s
            )
            DELETE FROM tangent_board_snapshots
            WHERE workspace_id = %s
              AND board_id = %s
              AND id IN (SELECT id FROM ranked WHERE retention_rank > %s)
            """,
            (workspace_id, board_id, workspace_id, board_id, limit),
        )


def _snapshot_from_row(row: tuple[Any, ...]) -> BoardSnapshotRecord:
    expires_at = row[13].isoformat() if hasattr(row[13], "isoformat") else row[13]
    created_at = row[14].isoformat() if hasattr(row[14], "isoformat") else str(row[14])
    document = row[5] if not isinstance(row[5], str) else json.loads(row[5])
    return BoardSnapshotRecord(
        assetCount=row[8] or 0,
        boardId=row[2],
        byteSize=row[7],
        createdAt=created_at,
        createdBy=row[3],
        document=document,
        documentHash=row[6],
        expiresAt=expires_at,
        id=row[0],
        reason=row[11],
        retentionTier=row[12],
        shapeCount=row[9] or 0,
        thumbnailUrl=row[10],
        title=row[4],
        workspaceId=row[1],
    )


def _summarize_snapshot(snapshot: BoardSnapshotRecord) -> BoardSnapshotSummary:
    return BoardSnapshotSummary(**snapshot.model_dump(by_alias=True, exclude={"document"}))


def _hash_document(document: object) -> str:
    return hashlib.sha256(json.dumps(document, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def _normalize_reason(value: str) -> str:
    reasons = {"autosave", "auto_interval", "keyboard", "manual", "manual_save", "pre_restore"}
    return value if value in reasons else "manual"


def _snapshot_limit() -> int:
    try:
        value = int(os.getenv("TANGENT_FREE_BOARD_SNAPSHOT_LIMIT", "100"))
    except ValueError:
        value = 100
    return value if value > 0 else 100
