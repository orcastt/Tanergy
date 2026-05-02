import os
from typing import Optional

from fastapi import HTTPException

from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import (
    BoardRecord,
    BoardSaveRequest,
    BoardSaveResponse,
    BoardSnapshotCreateRequest,
    BoardSnapshotRecord,
    BoardSnapshotSummary,
    BoardSummary,
)
from tangent_api.storage.local_board_snapshot_store import create_board_snapshot as create_local_snapshot
from tangent_api.storage.local_board_snapshot_store import list_board_snapshots as list_local_snapshots
from tangent_api.storage.local_board_snapshot_store import load_board_snapshot as load_local_snapshot
from tangent_api.storage.local_board_store import load_board as load_local_board
from tangent_api.storage.local_board_store import list_boards as list_local_boards
from tangent_api.storage.local_board_store import save_board as save_local_board
from tangent_api.storage.postgres_board_snapshot_store import PostgresBoardSnapshotStore
from tangent_api.storage.postgres_board_store import PostgresBoardStore


class BoardStorageAdapter:
    def save_board(
        self,
        input_data: BoardSaveRequest,
        context: ApiRequestContext,
    ) -> BoardSaveResponse:
        raise NotImplementedError

    def load_board(self, board_id: str, context: ApiRequestContext) -> BoardRecord:
        raise NotImplementedError

    def list_boards(self, context: ApiRequestContext) -> list[BoardSummary]:
        raise NotImplementedError

    def rename_board(self, board_id: str, title: str, context: ApiRequestContext) -> BoardSummary:
        raise NotImplementedError

    def update_board_metadata(
        self,
        board_id: str,
        title: Optional[str],
        description: Optional[str],
        card_color: Optional[str],
        thumbnail_url: Optional[str],
        is_starred: Optional[bool],
        is_pinned: Optional[bool],
        visibility: Optional[str],
        share_id: Optional[str],
        context: ApiRequestContext,
    ) -> BoardSummary:
        raise NotImplementedError

    def delete_board(self, board_id: str, context: ApiRequestContext) -> str:
        raise NotImplementedError

    def create_snapshot(
        self,
        board_id: str,
        input_data: BoardSnapshotCreateRequest,
        context: ApiRequestContext,
    ) -> BoardSnapshotSummary:
        raise NotImplementedError

    def list_snapshots(self, board_id: str, context: ApiRequestContext) -> list[BoardSnapshotSummary]:
        raise NotImplementedError

    def load_snapshot(
        self,
        board_id: str,
        snapshot_id: str,
        context: ApiRequestContext,
    ) -> BoardSnapshotRecord:
        raise NotImplementedError


class LocalBoardStorageAdapter(BoardStorageAdapter):
    def save_board(
        self,
        input_data: BoardSaveRequest,
        context: ApiRequestContext,
    ) -> BoardSaveResponse:
        return save_local_board(input_data, context)

    def load_board(self, board_id: str, context: ApiRequestContext) -> BoardRecord:
        return load_local_board(board_id, context)

    def list_boards(self, context: ApiRequestContext) -> list[BoardSummary]:
        return list_local_boards(context)

    def rename_board(self, board_id: str, title: str, context: ApiRequestContext) -> BoardSummary:
        from tangent_api.storage.local_board_store import rename_board as rename_local_board

        return rename_local_board(board_id, title, context)

    def update_board_metadata(
        self,
        board_id: str,
        title: Optional[str],
        description: Optional[str],
        card_color: Optional[str],
        thumbnail_url: Optional[str],
        is_starred: Optional[bool],
        is_pinned: Optional[bool],
        visibility: Optional[str],
        share_id: Optional[str],
        context: ApiRequestContext,
    ) -> BoardSummary:
        from tangent_api.storage.local_board_store import update_board_metadata

        return update_board_metadata(
            board_id, title, description, card_color, thumbnail_url, is_starred, is_pinned, visibility, share_id, context
        )

    def delete_board(self, board_id: str, context: ApiRequestContext) -> str:
        from tangent_api.storage.local_board_store import delete_board as delete_local_board

        return delete_local_board(board_id, context)

    def create_snapshot(
        self,
        board_id: str,
        input_data: BoardSnapshotCreateRequest,
        context: ApiRequestContext,
    ) -> BoardSnapshotSummary:
        return create_local_snapshot(board_id, input_data, context)

    def list_snapshots(self, board_id: str, context: ApiRequestContext) -> list[BoardSnapshotSummary]:
        return list_local_snapshots(board_id, context)

    def load_snapshot(
        self,
        board_id: str,
        snapshot_id: str,
        context: ApiRequestContext,
    ) -> BoardSnapshotRecord:
        return load_local_snapshot(board_id, snapshot_id, context)


class PostgresBoardStorageAdapter(BoardStorageAdapter):
    def __init__(self) -> None:
        self.store = PostgresBoardStore()
        self.snapshots = PostgresBoardSnapshotStore()

    def save_board(
        self,
        input_data: BoardSaveRequest,
        context: ApiRequestContext,
    ) -> BoardSaveResponse:
        return self.store.save_board(input_data, context)

    def load_board(self, board_id: str, context: ApiRequestContext) -> BoardRecord:
        return self.store.load_board(board_id, context)

    def list_boards(self, context: ApiRequestContext) -> list[BoardSummary]:
        return self.store.list_boards(context)

    def rename_board(self, board_id: str, title: str, context: ApiRequestContext) -> BoardSummary:
        return self.store.rename_board(board_id, title, context)

    def update_board_metadata(
        self,
        board_id: str,
        title: Optional[str],
        description: Optional[str],
        card_color: Optional[str],
        thumbnail_url: Optional[str],
        is_starred: Optional[bool],
        is_pinned: Optional[bool],
        visibility: Optional[str],
        share_id: Optional[str],
        context: ApiRequestContext,
    ) -> BoardSummary:
        return self.store.update_board_metadata(
            board_id, title, description, card_color, thumbnail_url, is_starred, is_pinned, visibility, share_id, context
        )

    def delete_board(self, board_id: str, context: ApiRequestContext) -> str:
        return self.store.delete_board(board_id, context)

    def create_snapshot(
        self,
        board_id: str,
        input_data: BoardSnapshotCreateRequest,
        context: ApiRequestContext,
    ) -> BoardSnapshotSummary:
        return self.snapshots.create_snapshot(board_id, input_data, context)

    def list_snapshots(self, board_id: str, context: ApiRequestContext) -> list[BoardSnapshotSummary]:
        return self.snapshots.list_snapshots(board_id, context)

    def load_snapshot(
        self,
        board_id: str,
        snapshot_id: str,
        context: ApiRequestContext,
    ) -> BoardSnapshotRecord:
        return self.snapshots.load_snapshot(board_id, snapshot_id, context)


def get_board_storage_adapter() -> BoardStorageAdapter:
    driver = os.getenv("TANGENT_BOARD_STORAGE_DRIVER", "local-dev")
    if driver == "local-dev":
        return LocalBoardStorageAdapter()
    if driver == "postgres":
        return PostgresBoardStorageAdapter()
    raise HTTPException(
        status_code=501,
        detail=f'Unsupported board storage driver "{driver}". Supported drivers: local-dev, postgres.',
    )
