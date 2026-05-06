import os
from typing import Optional

from fastapi import HTTPException

from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import (
    BoardMemberCandidateRecord,
    BoardMemberRecord,
    BoardRecord,
    BoardRestoreResponse,
    BoardSaveRequest,
    BoardSaveResponse,
    BoardSnapshotRecord,
    BoardSnapshotCreateRequest,
    BoardSnapshotSummary,
    BoardShareLinkRecord,
    BoardShareLinkResolveRecord,
    BoardSummary,
)
from tangent_api.storage.local_board_snapshot_store import create_board_snapshot as create_local_snapshot
from tangent_api.storage.local_board_snapshot_store import clear_board_snapshots as clear_local_snapshots
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

    def list_boards(
        self,
        context: ApiRequestContext,
        cursor: Optional[str] = None,
        limit: int = 50,
    ) -> tuple[list[BoardSummary], Optional[str]]:
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

    def copy_board(self, board_id: str, context: ApiRequestContext) -> BoardSummary:
        raise NotImplementedError

    def restore_snapshot(
        self,
        board_id: str,
        snapshot_id: str,
        context: ApiRequestContext,
    ) -> BoardRestoreResponse:
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

    def clear_snapshots(self, board_id: str, context: ApiRequestContext) -> int:
        raise NotImplementedError

    def list_members(self, board_id: str, context: ApiRequestContext) -> list[BoardMemberRecord]:
        raise NotImplementedError

    def upsert_member(
        self,
        board_id: str,
        user_id: str,
        role: str,
        display_name: Optional[str],
        context: ApiRequestContext,
    ) -> BoardMemberRecord:
        raise NotImplementedError

    def remove_member(self, board_id: str, user_id: str, context: ApiRequestContext) -> str:
        raise NotImplementedError

    def search_member_candidates(
        self,
        board_id: str,
        query: str,
        context: ApiRequestContext,
    ) -> list[BoardMemberCandidateRecord]:
        raise NotImplementedError

    def invite_member_by_email(
        self,
        board_id: str,
        email: str,
        role: str,
        display_name: Optional[str],
        context: ApiRequestContext,
    ) -> BoardMemberRecord:
        raise NotImplementedError

    def ensure_share_link(
        self,
        board_id: str,
        access_role: str,
        context: ApiRequestContext,
        expires_at: Optional[str] = None,
    ) -> BoardShareLinkRecord:
        raise NotImplementedError

    def revoke_share_link(self, board_id: str, share_id: str, context: ApiRequestContext) -> str:
        raise NotImplementedError

    def resolve_share_link(self, share_id: str) -> BoardShareLinkResolveRecord:
        raise NotImplementedError

    def load_shared_board(self, share_id: str) -> BoardRecord:
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

    def list_boards(
        self,
        context: ApiRequestContext,
        cursor: Optional[str] = None,
        limit: int = 50,
    ) -> tuple[list[BoardSummary], Optional[str]]:
        from tangent_api.storage.local_board_store import list_boards_paginated

        return list_boards_paginated(context, cursor, limit)

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

    def copy_board(self, board_id: str, context: ApiRequestContext) -> BoardSummary:
        from tangent_api.storage.local_board_store import copy_board as copy_local_board

        return copy_local_board(board_id, context)

    def restore_snapshot(
        self,
        board_id: str,
        snapshot_id: str,
        context: ApiRequestContext,
    ) -> BoardRestoreResponse:
        from tangent_api.storage.local_board_store import restore_board_snapshot as restore_local_snapshot

        return restore_local_snapshot(board_id, snapshot_id, context)

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

    def clear_snapshots(self, board_id: str, context: ApiRequestContext) -> int:
        return clear_local_snapshots(board_id, context)

    def list_members(self, board_id: str, context: ApiRequestContext) -> list[BoardMemberRecord]:
        from tangent_api.storage.local_board_store import list_board_members

        return list_board_members(board_id, context)

    def upsert_member(
        self,
        board_id: str,
        user_id: str,
        role: str,
        display_name: Optional[str],
        context: ApiRequestContext,
    ) -> BoardMemberRecord:
        from tangent_api.storage.local_board_store import upsert_board_member

        return upsert_board_member(board_id, user_id, role, display_name, context)

    def remove_member(self, board_id: str, user_id: str, context: ApiRequestContext) -> str:
        from tangent_api.storage.local_board_store import remove_board_member

        return remove_board_member(board_id, user_id, context)

    def search_member_candidates(
        self,
        board_id: str,
        query: str,
        context: ApiRequestContext,
    ) -> list[BoardMemberCandidateRecord]:
        from tangent_api.storage.local_board_store import search_board_member_candidates

        return search_board_member_candidates(board_id, query, context)

    def invite_member_by_email(
        self,
        board_id: str,
        email: str,
        role: str,
        display_name: Optional[str],
        context: ApiRequestContext,
    ) -> BoardMemberRecord:
        from tangent_api.storage.local_board_store import invite_board_member_by_email

        return invite_board_member_by_email(board_id, email, role, display_name, context)

    def ensure_share_link(
        self,
        board_id: str,
        access_role: str,
        context: ApiRequestContext,
        expires_at: Optional[str] = None,
    ) -> BoardShareLinkRecord:
        from tangent_api.storage.local_board_store import ensure_board_share_link

        return ensure_board_share_link(board_id, access_role, context, expires_at)

    def revoke_share_link(self, board_id: str, share_id: str, context: ApiRequestContext) -> str:
        from tangent_api.storage.local_board_store import revoke_board_share_link

        return revoke_board_share_link(board_id, share_id, context)

    def resolve_share_link(self, share_id: str) -> BoardShareLinkResolveRecord:
        from tangent_api.storage.local_board_store import resolve_board_share_link

        return resolve_board_share_link(share_id)

    def load_shared_board(self, share_id: str) -> BoardRecord:
        from tangent_api.storage.local_board_store import load_shared_board

        return load_shared_board(share_id)


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

    def list_boards(
        self,
        context: ApiRequestContext,
        cursor: Optional[str] = None,
        limit: int = 50,
    ) -> tuple[list[BoardSummary], Optional[str]]:
        return self.store.list_boards_paginated(context, cursor, limit)

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

    def copy_board(self, board_id: str, context: ApiRequestContext) -> BoardSummary:
        return self.store.copy_board(board_id, context)

    def restore_snapshot(
        self,
        board_id: str,
        snapshot_id: str,
        context: ApiRequestContext,
    ) -> BoardRestoreResponse:
        return self.store.restore_snapshot(board_id, snapshot_id, context)

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

    def clear_snapshots(self, board_id: str, context: ApiRequestContext) -> int:
        return self.snapshots.clear_snapshots(board_id, context)

    def list_members(self, board_id: str, context: ApiRequestContext) -> list[BoardMemberRecord]:
        return self.store.list_members(board_id, context)

    def upsert_member(
        self,
        board_id: str,
        user_id: str,
        role: str,
        display_name: Optional[str],
        context: ApiRequestContext,
    ) -> BoardMemberRecord:
        return self.store.upsert_member(board_id, user_id, role, display_name, context)

    def remove_member(self, board_id: str, user_id: str, context: ApiRequestContext) -> str:
        return self.store.remove_member(board_id, user_id, context)

    def search_member_candidates(
        self,
        board_id: str,
        query: str,
        context: ApiRequestContext,
    ) -> list[BoardMemberCandidateRecord]:
        return self.store.search_member_candidates(board_id, query, context)

    def invite_member_by_email(
        self,
        board_id: str,
        email: str,
        role: str,
        display_name: Optional[str],
        context: ApiRequestContext,
    ) -> BoardMemberRecord:
        return self.store.invite_member_by_email(board_id, email, role, display_name, context)

    def ensure_share_link(
        self,
        board_id: str,
        access_role: str,
        context: ApiRequestContext,
        expires_at: Optional[str] = None,
    ) -> BoardShareLinkRecord:
        return self.store.ensure_share_link(board_id, access_role, context, expires_at)

    def revoke_share_link(self, board_id: str, share_id: str, context: ApiRequestContext) -> str:
        return self.store.revoke_share_link(board_id, share_id, context)

    def resolve_share_link(self, share_id: str) -> BoardShareLinkResolveRecord:
        return self.store.resolve_share_link(share_id)

    def load_shared_board(self, share_id: str) -> BoardRecord:
        return self.store.load_shared_board(share_id)


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
