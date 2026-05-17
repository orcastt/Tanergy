from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket

from tangent_api.realtime.board_realtime_limits import (
    BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD,
    can_append_realtime_document_update,
    normalize_realtime_awareness_state,
    normalize_realtime_document_updates,
)
from tangent_api.realtime.board_realtime_room_support import (
    BoardRealtimeConnection,
    _broadcast_json,
    _limit_awareness_states,
    _parse_awareness_expiry,
    _prune_expired_awareness_states,
    _should_request_compaction,
)


class BoardRealtimeRoom:
    def __init__(self, room_key: str) -> None:
        self.room_key = room_key
        self.compaction_requested = False
        self.document_version = 0
        self.document_updates: list[list[int]] = []
        self.awareness_states: dict[str, dict[str, Any]] = {}
        self.connections: dict[str, BoardRealtimeConnection] = {}
        self.lock = asyncio.Lock()

    async def connect(
        self,
        websocket: WebSocket,
        client_instance_id: str,
        initial_updates: list[list[int]] | None = None,
    ) -> str:
        connection_id = f"conn_{uuid.uuid4()}"
        async with self.lock:
            if not self.document_updates and initial_updates:
                self.document_updates = normalize_realtime_document_updates(initial_updates)
                self.document_version = len(self.document_updates)
            removed_client_ids = _prune_expired_awareness_states(self.awareness_states)
            self.compaction_requested = _should_request_compaction(self.document_updates)
            self.connections[connection_id] = BoardRealtimeConnection(
                client_instance_id=client_instance_id,
                connection_id=connection_id,
                websocket=websocket,
            )
            document_updates = [list(update) for update in self.document_updates]
            awareness_states = [dict(state) for state in self.awareness_states.values()]
            document_version = self.document_version
        try:
            await websocket.send_json({
                "documentVersion": document_version,
                "requestCompaction": self.compaction_requested,
                "seedRoom": len(document_updates) == 0,
                "type": "sync-state",
                "updates": document_updates,
            })
            await websocket.send_json({
                "states": awareness_states,
                "type": "awareness-batch",
            })
            if removed_client_ids:
                recipients = [
                    item.websocket
                    for item in self.connections.values()
                    if item.connection_id != connection_id
                ]
                for removed_client_id in removed_client_ids:
                    await _broadcast_json(recipients, {
                        "clientInstanceId": removed_client_id,
                        "type": "awareness-remove",
                    })
        except Exception:
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
            recipients = [item.websocket for item in self.connections.values()]
        if removed is not None:
            await _broadcast_json(recipients, {
                "clientInstanceId": client_instance_id,
                "type": "awareness-remove",
            })

    async def publish_document_update(
        self,
        connection_id: str,
        client_instance_id: str,
        update: list[int],
    ) -> tuple[list[list[int]], bool, int, bool]:
        async with self.lock:
            removed_client_ids = _prune_expired_awareness_states(self.awareness_states)
            if not can_append_realtime_document_update(self.document_updates, update):
                self.compaction_requested = True
                document_updates = [list(item) for item in self.document_updates]
                document_version = self.document_version
                recipients = [
                    item.websocket
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
                    item.websocket
                    for item_id, item in self.connections.items()
                    if item_id != connection_id
                ]
                accepted = True
            request_compaction = self.compaction_requested
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
                "update": update,
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
            document_updates = [list(item) for item in self.document_updates]
            document_version = self.document_version
            recipients = [item.websocket for item in self.connections.values()]
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
                recipients = [item.websocket for item in self.connections.values()]
                payload = {
                    "clientInstanceId": client_instance_id,
                    "type": "awareness-remove",
                } if removed is not None else None
            else:
                expires_at = _parse_awareness_expiry(state)
                if expires_at is None or expires_at <= datetime.now(timezone.utc):
                    removed = self.awareness_states.pop(client_instance_id, None)
                    recipients = [item.websocket for item in self.connections.values()]
                    payload = {
                        "clientInstanceId": client_instance_id,
                        "type": "awareness-remove",
                    } if removed is not None else None
                else:
                    normalized_state = normalize_realtime_awareness_state(
                        state,
                        client_instance_id,
                    )
                    recipients = [item.websocket for item in self.connections.values()]
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


class BoardRealtimeHub:
    def __init__(self) -> None:
        self._rooms: dict[str, BoardRealtimeRoom] = {}
        self._lock = asyncio.Lock()

    async def connect(
        self,
        room_key: str,
        websocket: WebSocket,
        client_instance_id: str,
        initial_updates: list[list[int]] | None = None,
    ) -> tuple[BoardRealtimeRoom, str]:
        room = await self._get_or_create_room(room_key)
        try:
            connection_id = await room.connect(websocket, client_instance_id, initial_updates)
        except Exception:
            if await room.is_empty():
                async with self._lock:
                    current = self._rooms.get(room_key)
                    if current is room and await current.is_empty():
                        self._rooms.pop(room_key, None)
            raise
        return room, connection_id

    async def disconnect(self, room_key: str, connection_id: str) -> bool:
        async with self._lock:
            room = self._rooms.get(room_key)
        if room is None:
            return True
        await room.disconnect(connection_id)
        if await room.is_empty():
            async with self._lock:
                current = self._rooms.get(room_key)
                if current is room and await current.is_empty():
                    self._rooms.pop(room_key, None)
            return True
        return False

    async def _get_or_create_room(self, room_key: str) -> BoardRealtimeRoom:
        async with self._lock:
            room = self._rooms.get(room_key)
            if room is None:
                room = BoardRealtimeRoom(room_key)
                self._rooms[room_key] = room
            return room


board_realtime_hub = BoardRealtimeHub()
