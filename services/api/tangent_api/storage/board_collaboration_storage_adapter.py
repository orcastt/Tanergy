import os

from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import (
    BoardCollaborationSessionDeleteResponse,
    BoardCollaborationSessionsResponse,
    BoardCollaborationSessionUpsertRequest,
)
from tangent_api.storage.local_board_collaboration_store import (
    claim_local_board_collaboration_session,
    list_local_board_collaboration_sessions,
    release_local_board_collaboration_session,
)
from tangent_api.storage.postgres_board_collaboration_store import (
    claim_postgres_board_collaboration_session,
    list_postgres_board_collaboration_sessions,
    release_postgres_board_collaboration_session,
)


class BoardCollaborationStorageAdapter:
    def claim_session(
        self,
        board_id: str,
        payload: BoardCollaborationSessionUpsertRequest,
        context: ApiRequestContext,
    ) -> BoardCollaborationSessionsResponse:
        raise NotImplementedError

    def list_sessions(
        self,
        board_id: str,
        context: ApiRequestContext,
    ) -> BoardCollaborationSessionsResponse:
        raise NotImplementedError

    def release_session(
        self,
        board_id: str,
        session_id: str,
        context: ApiRequestContext,
    ) -> BoardCollaborationSessionDeleteResponse:
        raise NotImplementedError


class LocalBoardCollaborationStorageAdapter(BoardCollaborationStorageAdapter):
    def claim_session(
        self,
        board_id: str,
        payload: BoardCollaborationSessionUpsertRequest,
        context: ApiRequestContext,
    ) -> BoardCollaborationSessionsResponse:
        return claim_local_board_collaboration_session(board_id, payload, context)

    def list_sessions(
        self,
        board_id: str,
        context: ApiRequestContext,
    ) -> BoardCollaborationSessionsResponse:
        return list_local_board_collaboration_sessions(board_id, context)

    def release_session(
        self,
        board_id: str,
        session_id: str,
        context: ApiRequestContext,
    ) -> BoardCollaborationSessionDeleteResponse:
        return release_local_board_collaboration_session(board_id, session_id, context)


class PostgresBoardCollaborationStorageAdapter(BoardCollaborationStorageAdapter):
    def claim_session(
        self,
        board_id: str,
        payload: BoardCollaborationSessionUpsertRequest,
        context: ApiRequestContext,
    ) -> BoardCollaborationSessionsResponse:
        return claim_postgres_board_collaboration_session(board_id, payload, context)

    def list_sessions(
        self,
        board_id: str,
        context: ApiRequestContext,
    ) -> BoardCollaborationSessionsResponse:
        return list_postgres_board_collaboration_sessions(board_id, context)

    def release_session(
        self,
        board_id: str,
        session_id: str,
        context: ApiRequestContext,
    ) -> BoardCollaborationSessionDeleteResponse:
        return release_postgres_board_collaboration_session(board_id, session_id, context)


local_adapter = LocalBoardCollaborationStorageAdapter()
postgres_adapter = PostgresBoardCollaborationStorageAdapter()


def get_board_collaboration_storage_adapter() -> BoardCollaborationStorageAdapter:
    driver = os.getenv("TANGENT_BOARD_STORAGE_DRIVER", "local-dev")
    if driver == "local-dev":
        return local_adapter
    if driver == "postgres":
        return postgres_adapter
    raise RuntimeError(f'Unsupported board storage driver "{driver}".')
