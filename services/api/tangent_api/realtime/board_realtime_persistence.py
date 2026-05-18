from __future__ import annotations

import asyncio
import os
import weakref
from dataclasses import dataclass

from tangent_api.storage.board_realtime_storage_adapter import (
    BoardRealtimeStorageAdapter,
    get_board_realtime_storage_adapter,
)

DEFAULT_PERSIST_DEBOUNCE_SECONDS = float(os.getenv("TANGENT_BOARD_REALTIME_PERSIST_DEBOUNCE_SECONDS", "0.25"))
PERSIST_MODE_FINAL_SNAPSHOT = "final_snapshot"
PERSIST_MODE_UPDATE_CHAIN = "update_chain"
DEFAULT_PERSIST_MODE = PERSIST_MODE_FINAL_SNAPSHOT


@dataclass
class _PendingDocumentWrite:
    board_id: str
    document_updates: list[list[int]]
    room_key: str
    task: asyncio.Task[None] | None = None
    workspace_id: str = ""


@dataclass
class _LoopPersistenceState:
    lock: asyncio.Lock
    pending: dict[tuple[str, str], _PendingDocumentWrite]
    write_locks: dict[tuple[str, str], asyncio.Lock]


class BoardRealtimePersistenceCoordinator:
    def __init__(
        self,
        storage: BoardRealtimeStorageAdapter | None = None,
        debounce_seconds: float = DEFAULT_PERSIST_DEBOUNCE_SECONDS,
        persist_mode: str | None = None,
    ) -> None:
        self._storage = storage
        self._debounce_seconds = max(0.0, debounce_seconds)
        self._persist_mode = persist_mode
        self._loop_states: weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, _LoopPersistenceState] = (
            weakref.WeakKeyDictionary()
        )

    def load_document(self, workspace_id: str, board_id: str) -> list[list[int]]:
        return self._get_storage().load_document(workspace_id, board_id)

    async def persist_compacted_document(
        self,
        workspace_id: str,
        board_id: str,
        room_key: str,
        document_updates: list[list[int]],
    ) -> None:
        await self.finalize_document(workspace_id, board_id, room_key, document_updates)

    async def persist_incremental_document(
        self,
        workspace_id: str,
        board_id: str,
        room_key: str,
        document_updates: list[list[int]],
    ) -> None:
        if self._get_persist_mode() != PERSIST_MODE_UPDATE_CHAIN:
            return
        await self.queue_document(workspace_id, board_id, room_key, document_updates)

    async def queue_document(
        self,
        workspace_id: str,
        board_id: str,
        room_key: str,
        document_updates: list[list[int]],
    ) -> None:
        loop_state = self._get_loop_state()
        key = (workspace_id, board_id)
        async with loop_state.lock:
            pending = loop_state.pending.get(key)
            if pending is None:
                pending = _PendingDocumentWrite(
                    board_id=board_id,
                    document_updates=[list(update) for update in document_updates],
                    room_key=room_key,
                    workspace_id=workspace_id,
                )
                loop_state.pending[key] = pending
            else:
                pending.board_id = board_id
                pending.document_updates = [list(update) for update in document_updates]
                pending.room_key = room_key
                pending.workspace_id = workspace_id
            if pending.task is None or pending.task.done():
                pending.task = asyncio.create_task(self._drain(loop_state, key))

    async def finalize_document(
        self,
        workspace_id: str,
        board_id: str,
        room_key: str,
        document_updates: list[list[int]],
    ) -> None:
        if not document_updates:
            return
        loop_state = self._get_loop_state()
        key = (workspace_id, board_id)
        async with loop_state.lock:
            pending = loop_state.pending.pop(key, None)
            task = pending.task if pending is not None else None
        if task is not None:
            if task.get_loop() is asyncio.get_running_loop():
                task.cancel()
        await self._write_serialized(loop_state, key, workspace_id, board_id, room_key, document_updates)

    async def _drain(self, loop_state: _LoopPersistenceState, key: tuple[str, str]) -> None:
        try:
            while True:
                await asyncio.sleep(self._debounce_seconds)
                async with loop_state.lock:
                    pending = loop_state.pending.get(key)
                    if pending is None:
                        return
                    snapshot = [list(update) for update in pending.document_updates]
                    workspace_id = pending.workspace_id
                    board_id = pending.board_id
                    room_key = pending.room_key
                await self._write_serialized(loop_state, key, workspace_id, board_id, room_key, snapshot)
                async with loop_state.lock:
                    pending = loop_state.pending.get(key)
                    if pending is None:
                        return
                    if pending.document_updates != snapshot:
                        continue
                    task = pending.task
                    if task is not None and not task.done():
                        pending.task = None
                    loop_state.pending.pop(key, None)
                    write_lock = loop_state.write_locks.get(key)
                if write_lock is not None:
                    await self._cleanup_write_lock(loop_state, key, write_lock)
                    return
        except asyncio.CancelledError:
            return

    async def _write_document(
        self,
        workspace_id: str,
        board_id: str,
        room_key: str,
        document_updates: list[list[int]],
    ) -> None:
        await asyncio.to_thread(
            self._get_storage().write_document,
            workspace_id,
            board_id,
            room_key,
            document_updates,
        )

    async def _write_serialized(
        self,
        loop_state: _LoopPersistenceState,
        key: tuple[str, str],
        workspace_id: str,
        board_id: str,
        room_key: str,
        document_updates: list[list[int]],
    ) -> None:
        write_lock = self._get_write_lock(loop_state, key)
        async with write_lock:
            await asyncio.shield(self._write_document(workspace_id, board_id, room_key, document_updates))
        await self._cleanup_write_lock(loop_state, key, write_lock)

    def _get_storage(self) -> BoardRealtimeStorageAdapter:
        return self._storage or get_board_realtime_storage_adapter()

    def _get_persist_mode(self) -> str:
        configured = self._persist_mode
        if configured is None:
            configured = os.getenv("TANGENT_BOARD_REALTIME_PERSIST_MODE", DEFAULT_PERSIST_MODE)
        return _normalize_persist_mode(configured)

    def _get_loop_state(self) -> _LoopPersistenceState:
        loop = asyncio.get_running_loop()
        state = self._loop_states.get(loop)
        if state is None:
            state = _LoopPersistenceState(lock=asyncio.Lock(), pending={}, write_locks={})
            self._loop_states[loop] = state
        return state

    def _get_write_lock(self, loop_state: _LoopPersistenceState, key: tuple[str, str]) -> asyncio.Lock:
        write_lock = loop_state.write_locks.get(key)
        if write_lock is None:
            write_lock = asyncio.Lock()
            loop_state.write_locks[key] = write_lock
        return write_lock

    async def _cleanup_write_lock(
        self,
        loop_state: _LoopPersistenceState,
        key: tuple[str, str],
        write_lock: asyncio.Lock,
    ) -> None:
        async with loop_state.lock:
            if loop_state.pending.get(key) is not None:
                return
            if loop_state.write_locks.get(key) is not write_lock:
                return
            if write_lock.locked():
                return
            loop_state.write_locks.pop(key, None)


def _normalize_persist_mode(value: str | None) -> str:
    normalized = (value or DEFAULT_PERSIST_MODE).strip().lower()
    if normalized == PERSIST_MODE_UPDATE_CHAIN:
        return PERSIST_MODE_UPDATE_CHAIN
    return PERSIST_MODE_FINAL_SNAPSHOT


board_realtime_persistence = BoardRealtimePersistenceCoordinator()
