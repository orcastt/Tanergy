from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket

from tangent_api.realtime.board_realtime_limits import (
    BOARD_REALTIME_DOCUMENT_COMPACTION_REQUEST_COOLDOWN_SECONDS,
    BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD,
    can_append_realtime_document_update,
    encode_realtime_update_payload,
    normalize_realtime_awareness_state,
    normalize_realtime_document_updates,
)
from tangent_api.realtime.board_realtime_abuse import realtime_room_connection_limit
from tangent_api.realtime.board_realtime_room_support import (
    BoardRealtimeConnection,
    _broadcast_json,
    _limit_awareness_states,
    _parse_awareness_expiry,
    _prune_expired_awareness_states,
    _should_request_compaction,
)
from tangent_api.realtime.board_realtime_hub_registry import BoardRealtimeHub


class BoardRealtimeRoom:
    def __init__(self, room_key: str) -> None:
        self.room_key = room_key
        self.compaction_requested = False
        self.document_version = 0
        self.document_updates: list[list[int]] = []
        self.last_compaction_request_at: datetime | None = None
        self.awareness_states: dict[str, dict[str, Any]] = {}
        self.connections: dict[str, BoardRealtimeConnection] = {}
        self.lock = asyncio.Lock()

    async def connect(
        self,
        websocket: WebSocket,
        client_instance_id: str,
        initial_updates: list[list[int]] | None = None,
        *,
        can_edit: bool = False,
    ) -> str:
        connection_id = f"conn_{uuid.uuid4()}"
        connection = BoardRealtimeConnection(
            can_edit=can_edit,
            client_instance_id=client_instance_id,
            connection_id=connection_id,
            websocket=websocket,
        )
        await connection.send_lock.acquire()
        async with self.lock:
            if len(self.connections) >= realtime_room_connection_limit():
                connection.send_lock.release()
                raise RuntimeError("Realtime room connection limit exceeded.")
            if not self.document_updates and initial_updates:
                self.document_updates = normalize_realtime_document_updates(initial_updates)
                self.document_version = len(self.document_updates)
            removed_client_ids = _prune_expired_awareness_states(self.awareness_states)
            self.compaction_requested = _should_request_compaction(self.document_updates)
            self.connections[connection_id] = connection
            document_updates = [list(update) for update in self.document_updates]
            awareness_states = [dict(state) for state in self.awareness_states.values()]
            document_version = self.document_version
        try:
            await websocket.send_json({
                "documentVersion": document_version,
                "requestCompaction": self.compaction_requested,
                "seedRoom": len(document_updates) == 0,
                "type": "sync-state",
                "updates": _encode_document_updates(document_updates),
            })
            await websocket.send_json({
                "states": awareness_states,
                "type": "awareness-batch",
            })
            connection.send_lock.release()
            if removed_client_ids:
                recipients = [
                    item
                    for item in self.connections.values()
                    if item.connection_id != connection_id
                ]
                for removed_client_id in removed_client_ids:
                    await _broadcast_json(recipients, {
                        "clientInstanceId": removed_client_id,
                        "type": "awareness-remove",
                    })
        except Exception:
            if connection.send_lock.locked():
                connection.send_lock.release()
            await self.disconnect(connection_id)
            raise
        return connection_id

    async def disconnect(self, connection_id: str) -> None:
        async with self.lock:
            connection = self.connections.pop(connection_id, None)
            if connection is None:
                return
            client_instance_id = connection.client_instance_id
            if any(item.client_instance_id == client_instance_id for item in self.connections.values()):
                return
            removed = self.awareness_states.pop(client_instance_id, None)
            recipients = [item for item in self.connections.values()]
        if removed is not None:
            await _broadcast_json(recipients, {
                "clientInstanceId": client_instance_id,
                "type": "awareness-remove",
            })

    async def set_connection_can_edit(self, connection_id: str, can_edit: bool) -> None:
        async with self.lock:
            connection = self.connections.get(connection_id)
            if connection is not None:
                connection.can_edit = can_edit

    async def publish_document_update(
        self,
        connection_id: str,
        client_instance_id: str,
        update: list[int],
    ) -> tuple[list[list[int]], bool, int, bool]:
        async with self.lock:
            now = datetime.now(timezone.utc)
            removed_client_ids = _prune_expired_awareness_states(self.awareness_states)
            was_compaction_requested = self.compaction_requested
            if not can_append_realtime_document_update(self.document_updates, update):
                self.compaction_requested = True
                document_updates = [list(item) for item in self.document_updates]
                document_version = self.document_version
                recipients = [
                    item
                    for item_id, item in self.connections.items()
                    if item_id != connection_id
                ]
                accepted = False
            else:
                self.document_updates.append(update)
                self.document_version += 1
                if _should_request_compaction(self.document_updates):
                    self.compaction_requested = True
                document_updates = [list(item) for item in self.document_updates]
                document_version = self.document_version
                recipients = [
                    item
                    for item_id, item in self.connections.items()
                    if item_id != connection_id
                ]
                accepted = True
            request_compaction = self.compaction_requested
            compaction_recipients = (
                [item for item in self.connections.values() if item.can_edit]
                if self._should_emit_compaction_request_locked(now, was_compaction_requested)
                else []
            )
            if compaction_recipients:
                self.last_compaction_request_at = now
        for removed_client_id in removed_client_ids:
            await _broadcast_json(recipients, {
                "clientInstanceId": removed_client_id,
                "type": "awareness-remove",
            })
        if accepted:
            await _broadcast_json(recipients, {
                "documentVersion": document_version,
                "from": client_instance_id,
                "type": "yjs-update",
                "update": encode_realtime_update_payload(update),
            })
        if compaction_recipients:
            await _broadcast_json(compaction_recipients, {
                "documentVersion": document_version,
                "requestCompaction": True,
                "type": "document-compact-request",
                "updateCount": len(document_updates),
            })
        return document_updates, request_compaction, document_version, accepted

    async def replace_document_state(
        self,
        update: list[int],
        expected_document_version: int | None,
    ) -> tuple[list[list[int]], bool, bool, int]:
        async with self.lock:
            _prune_expired_awareness_states(self.awareness_states)
            if self.document_version > 0 and expected_document_version != self.document_version:
                return (
                    [list(item) for item in self.document_updates],
                    False,
                    self.compaction_requested,
                    self.document_version,
                )
            self.document_updates = [list(update)]
            self.document_version = len(self.document_updates)
            self.compaction_requested = False
            self.last_compaction_request_at = None
            document_updates = [list(item) for item in self.document_updates]
            document_version = self.document_version
            recipients = [item for item in self.connections.values()]
        await _broadcast_json(recipients, {
            "documentVersion": document_version,
            "requestCompaction": False,
            "type": "sync-state-accepted",
            "updateCount": len(document_updates),
        })
        return (
            document_updates,
            True,
            False,
            document_version,
        )

    async def publish_awareness_state(
        self,
        client_instance_id: str,
        state: dict[str, Any] | None,
    ) -> None:
        async with self.lock:
            removed_client_ids = _prune_expired_awareness_states(self.awareness_states)
            if state is None:
                removed = self.awareness_states.pop(client_instance_id, None)
                recipients = [item for item in self.connections.values()]
                payload = {
                    "clientInstanceId": client_instance_id,
                    "type": "awareness-remove",
                } if removed is not None else None
            else:
                expires_at = _parse_awareness_expiry(state)
                if expires_at is None or expires_at <= datetime.now(timezone.utc):
                    removed = self.awareness_states.pop(client_instance_id, None)
                    recipients = [item for item in self.connections.values()]
                    payload = {
                        "clientInstanceId": client_instance_id,
                        "type": "awareness-remove",
                    } if removed is not None else None
                else:
                    normalized_state = normalize_realtime_awareness_state(
                        state,
                        client_instance_id,
                    )
                    recipients = [item for item in self.connections.values()]
                    if normalized_state is None:
                        removed = self.awareness_states.pop(client_instance_id, None)
                        payload = {
                            "clientInstanceId": client_instance_id,
                            "type": "awareness-remove",
                        } if removed is not None else None
                    else:
                        self.awareness_states[client_instance_id] = normalized_state
                        _limit_awareness_states(self.awareness_states)
                        payload = {
                            "from": client_instance_id,
                            "state": normalized_state,
                            "type": "awareness-state",
                        }
        for removed_client_id in removed_client_ids:
            if payload is not None and payload.get("clientInstanceId") == removed_client_id:
                continue
            await _broadcast_json(recipients, {
                "clientInstanceId": removed_client_id,
                "type": "awareness-remove",
            })
        if payload is not None:
            await _broadcast_json(recipients, payload)

    async def is_empty(self) -> bool:
        async with self.lock:
            return len(self.connections) == 0

    async def snapshot_document(self) -> list[list[int]]:
        async with self.lock:
            return [list(item) for item in self.document_updates]

    def _should_emit_compaction_request_locked(
        self,
        now: datetime,
        was_compaction_requested: bool,
    ) -> bool:
        if not self.compaction_requested:
            return False
        if not was_compaction_requested:
            return True
        if self.last_compaction_request_at is None:
            return True
        elapsed = (now - self.last_compaction_request_at).total_seconds()
        return elapsed >= BOARD_REALTIME_DOCUMENT_COMPACTION_REQUEST_COOLDOWN_SECONDS


board_realtime_hub = BoardRealtimeHub(BoardRealtimeRoom)


def _encode_document_updates(document_updates: list[list[int]]) -> list[list[int] | dict[str, Any]]:
    return [encode_realtime_update_payload(update) for update in document_updates]
