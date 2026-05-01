from typing import Any

from fastapi import HTTPException

from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import AssetRecord
from tangent_api.storage.postgres_connection import connect_to_postgres, should_auto_create_tables


class PostgresAssetMetadataStore:
    def save_record(self, record: AssetRecord) -> None:
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                self._ensure_schema(cursor)
                cursor.execute(
                    """
                    INSERT INTO tangent_assets (
                        id,
                        workspace_id,
                        created_by,
                        title,
                        origin,
                        mime,
                        byte_size,
                        width,
                        height,
                        storage,
                        original_url,
                        thumbnail_256_url,
                        thumbnail_512_url,
                        thumbnail_1024_url,
                        created_at
                    )
                    VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (workspace_id, id) DO UPDATE SET
                        created_by = EXCLUDED.created_by,
                        title = EXCLUDED.title,
                        origin = EXCLUDED.origin,
                        mime = EXCLUDED.mime,
                        byte_size = EXCLUDED.byte_size,
                        width = EXCLUDED.width,
                        height = EXCLUDED.height,
                        storage = EXCLUDED.storage,
                        original_url = EXCLUDED.original_url,
                        thumbnail_256_url = EXCLUDED.thumbnail_256_url,
                        thumbnail_512_url = EXCLUDED.thumbnail_512_url,
                        thumbnail_1024_url = EXCLUDED.thumbnail_1024_url,
                        created_at = EXCLUDED.created_at
                    """,
                    (
                        record.id,
                        record.workspace_id,
                        record.created_by,
                        record.title,
                        record.origin,
                        record.mime,
                        record.byte_size,
                        record.width,
                        record.height,
                        record.storage,
                        record.original_url,
                        record.thumbnail256_url,
                        record.thumbnail512_url,
                        record.thumbnail1024_url,
                        record.created_at,
                    ),
                )
            connection.commit()

    def get_record(self, asset_id: str, context: ApiRequestContext) -> AssetRecord:
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                self._ensure_schema(cursor)
                cursor.execute(
                    """
                    SELECT
                        id,
                        workspace_id,
                        created_by,
                        title,
                        origin,
                        mime,
                        byte_size,
                        width,
                        height,
                        storage,
                        original_url,
                        thumbnail_256_url,
                        thumbnail_512_url,
                        thumbnail_1024_url,
                        created_at
                    FROM tangent_assets
                    WHERE workspace_id = %s AND id = %s
                    """,
                    (context.workspace_id, asset_id),
                )
                row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Asset not found in workspace.")
        return _asset_record_from_row(row)

    def _ensure_schema(self, cursor: Any) -> None:
        if not should_auto_create_tables():
            return
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS tangent_assets (
                id TEXT NOT NULL,
                workspace_id TEXT NOT NULL,
                created_by TEXT NOT NULL,
                title TEXT NOT NULL,
                origin TEXT NOT NULL,
                mime TEXT NOT NULL,
                byte_size INTEGER NOT NULL,
                width INTEGER NOT NULL,
                height INTEGER NOT NULL,
                storage TEXT NOT NULL,
                original_url TEXT NOT NULL,
                thumbnail_256_url TEXT,
                thumbnail_512_url TEXT,
                thumbnail_1024_url TEXT,
                created_at TIMESTAMPTZ NOT NULL,
                PRIMARY KEY (workspace_id, id)
            )
            """
        )
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS tangent_assets_created_idx
            ON tangent_assets (workspace_id, created_by, created_at DESC)
            """
        )


def _asset_record_from_row(row: tuple[Any, ...]) -> AssetRecord:
    created_at = row[14].isoformat() if hasattr(row[14], "isoformat") else str(row[14])
    return AssetRecord(
        byteSize=row[6],
        createdAt=created_at,
        createdBy=row[2],
        height=row[8],
        id=row[0],
        mime=row[5],
        origin=row[4],
        originalUrl=row[10],
        storage=row[9],
        thumbnail256Url=row[11],
        thumbnail512Url=row[12],
        thumbnail1024Url=row[13],
        title=row[3],
        width=row[7],
        workspaceId=row[1],
    )
