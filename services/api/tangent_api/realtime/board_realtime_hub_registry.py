from __future__ import annotations

import asyncio
from typing import Any, Callable

from fastapi import WebSocket


class BoardRealtimeHub:
    def __init__(self, room_factory: Callable[[str], Any]) -> None:
        self._room_factory = room_factory
        self._rooms: dict[str, Any] = {}
        self._lock = asyncio.Lock()

    async def connect(
        self,
        room_key: str,
        websocket: WebSocket,
        client_instance_id: str,
        initial_updates: list[list[int]] | None = None,
        *,
        can_edit: bool = False,
    ) -> tuple[Any, str]:
        room = await self._get_or_create_room(room_key)
        try:
            connection_id = await room.connect(
                websocket,
                client_instance_id,
                initial_updates,
                can_edit=can_edit,
            )
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

    async def _get_or_create_room(self, room_key: str) -> Any:
        async with self._lock:
            room = self._rooms.get(room_key)
            if room is None:
                room = self._room_factory(room_key)
                self._rooms[room_key] = room
            return room
