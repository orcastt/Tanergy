from __future__ import annotations

from collections.abc import Sequence


def soft_delete_board(cursor: object, workspace_id: str, board_id: str) -> None:
    cursor.execute(
        """
        UPDATE tangent_boards
        SET deleted_at = COALESCE(deleted_at, NOW())
        WHERE workspace_id = %s
          AND id = %s
          AND deleted_at IS NULL
        """,
        (workspace_id, board_id),
    )
    cursor.execute(
        """
        DELETE FROM tangent_board_members
        WHERE workspace_id = %s
          AND board_id = %s
        """,
        (workspace_id, board_id),
    )
    cursor.execute(
        """
        DELETE FROM tangent_board_snapshots
        WHERE workspace_id = %s
          AND board_id = %s
        """,
        (workspace_id, board_id),
    )
    cursor.execute(
        """
        UPDATE tangent_board_share_links
        SET revoked_at = COALESCE(revoked_at, NOW())
        WHERE workspace_id = %s
          AND board_id = %s
          AND revoked_at IS NULL
        """,
        (workspace_id, board_id),
    )
    cursor.execute(
        """
        UPDATE tangent_board_collaboration_sessions
        SET disconnected_at = COALESCE(disconnected_at, NOW())
        WHERE workspace_id = %s
          AND board_id = %s
          AND disconnected_at IS NULL
        """,
        (workspace_id, board_id),
    )
    cursor.execute(
        """
        DELETE FROM tangent_board_realtime_documents
        WHERE workspace_id = %s
          AND board_id = %s
        """,
        (workspace_id, board_id),
    )


def soft_delete_workspace_boards(cursor: object, workspace_ids: Sequence[str]) -> None:
    normalized_workspace_ids = [str(workspace_id) for workspace_id in workspace_ids if str(workspace_id)]
    if not normalized_workspace_ids:
        return
    cursor.execute(
        """
        UPDATE tangent_boards
        SET deleted_at = COALESCE(deleted_at, NOW())
        WHERE workspace_id = ANY(%s)
          AND deleted_at IS NULL
        """,
        (normalized_workspace_ids,),
    )
    cursor.execute(
        """
        UPDATE tangent_board_share_links
        SET revoked_at = COALESCE(revoked_at, NOW())
        WHERE workspace_id = ANY(%s)
          AND revoked_at IS NULL
        """,
        (normalized_workspace_ids,),
    )
    cursor.execute(
        """
        UPDATE tangent_board_collaboration_sessions
        SET disconnected_at = COALESCE(disconnected_at, NOW())
        WHERE workspace_id = ANY(%s)
          AND disconnected_at IS NULL
        """,
        (normalized_workspace_ids,),
    )
    cursor.execute(
        """
        DELETE FROM tangent_board_members
        WHERE workspace_id = ANY(%s)
        """,
        (normalized_workspace_ids,),
    )
    cursor.execute(
        """
        DELETE FROM tangent_board_snapshots
        WHERE workspace_id = ANY(%s)
        """,
        (normalized_workspace_ids,),
    )
    cursor.execute(
        """
        DELETE FROM tangent_board_realtime_documents
        WHERE workspace_id = ANY(%s)
        """,
        (normalized_workspace_ids,),
    )
