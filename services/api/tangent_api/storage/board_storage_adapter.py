import os

from fastapi import HTTPException

from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import BoardRecord, BoardSaveRequest, BoardSaveResponse, BoardSummary
from tangent_api.storage.local_board_store import load_board as load_local_board
from tangent_api.storage.local_board_store import list_boards as list_local_boards
from tangent_api.storage.local_board_store import save_board as save_local_board
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


class PostgresBoardStorageAdapter(BoardStorageAdapter):
    def __init__(self) -> None:
        self.store = PostgresBoardStore()

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
