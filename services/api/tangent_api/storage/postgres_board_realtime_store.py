import json

from tangent_api.realtime.board_realtime_limits import normalize_realtime_document_updates
from tangent_api.storage.postgres_board_collaboration_schema import ensure_board_collaboration_schema
from tangent_api.storage.postgres_connection import connect_to_postgres


def load_postgres_board_realtime_document(workspace_id: str, board_id: str) -> list[list[int]]:
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            ensure_board_collaboration_schema(cursor)
            cursor.execute(
                """
                SELECT document_updates
                FROM tangent_board_realtime_documents
                WHERE workspace_id = %s
                  AND board_id = %s
                """,
                (workspace_id, board_id),
            )
            row = cursor.fetchone()
        connection.commit()
    if not row:
        return []
    return _normalize_updates(row[0])


def write_postgres_board_realtime_document(
    workspace_id: str,
    board_id: str,
    room_key: str,
    document_updates: list[list[int]],
) -> None:
    payload = json.dumps(_normalize_updates(document_updates))
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            ensure_board_collaboration_schema(cursor)
            cursor.execute(
                """
                INSERT INTO tangent_board_realtime_documents (
                    workspace_id,
                    board_id,
                    room_key,
                    document_updates
                )
                VALUES (%s, %s, %s, %s::jsonb)
                ON CONFLICT (workspace_id, board_id) DO UPDATE SET
                    room_key = EXCLUDED.room_key,
                    document_updates = EXCLUDED.document_updates,
                    updated_at = NOW()
                """,
                (workspace_id, board_id, room_key, payload),
            )
        connection.commit()


def _normalize_updates(value: object) -> list[list[int]]:
    return normalize_realtime_document_updates(value)
