import os

from tangent_api.storage.local_board_realtime_store import (
    load_local_board_realtime_document,
    write_local_board_realtime_document,
)
from tangent_api.storage.postgres_board_realtime_store import (
    load_postgres_board_realtime_document,
    write_postgres_board_realtime_document,
)


class BoardRealtimeStorageAdapter:
    def load_document(self, workspace_id: str, board_id: str) -> list[list[int]]:
        raise NotImplementedError

    def write_document(
        self,
        workspace_id: str,
        board_id: str,
        room_key: str,
        document_updates: list[list[int]],
    ) -> None:
        raise NotImplementedError


class LocalBoardRealtimeStorageAdapter(BoardRealtimeStorageAdapter):
    def load_document(self, workspace_id: str, board_id: str) -> list[list[int]]:
        return load_local_board_realtime_document(workspace_id, board_id)

    def write_document(
        self,
        workspace_id: str,
        board_id: str,
        room_key: str,
        document_updates: list[list[int]],
    ) -> None:
        write_local_board_realtime_document(workspace_id, board_id, room_key, document_updates)


class PostgresBoardRealtimeStorageAdapter(BoardRealtimeStorageAdapter):
    def load_document(self, workspace_id: str, board_id: str) -> list[list[int]]:
        return load_postgres_board_realtime_document(workspace_id, board_id)

    def write_document(
        self,
        workspace_id: str,
        board_id: str,
        room_key: str,
        document_updates: list[list[int]],
    ) -> None:
        write_postgres_board_realtime_document(workspace_id, board_id, room_key, document_updates)


local_adapter = LocalBoardRealtimeStorageAdapter()
postgres_adapter = PostgresBoardRealtimeStorageAdapter()


def get_board_realtime_storage_adapter() -> BoardRealtimeStorageAdapter:
    driver = os.getenv("TANGENT_BOARD_STORAGE_DRIVER", "local-dev")
    if driver == "local-dev":
        return local_adapter
    if driver == "postgres":
        return postgres_adapter
    raise RuntimeError(f'Unsupported board storage driver "{driver}".')
