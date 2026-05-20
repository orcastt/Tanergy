from __future__ import annotations

from typing import Any

from fastapi import HTTPException, WebSocket

from tangent_api.request_context import ApiRequestContext
from tangent_api.security_events import record_security_event
from tangent_api.storage.board_collaboration_storage_adapter import (
    get_board_collaboration_storage_adapter,
)


async def ensure_realtime_write_access(
    *,
    board_id: str,
    connection_id: str,
    context: ApiRequestContext,
    expected_room_key: str,
    room: Any,
    websocket: WebSocket,
):
    try:
        collaboration = get_board_collaboration_storage_adapter().list_sessions(board_id, context)
    except HTTPException as error:
        await _deny_realtime_write(
            board_id=board_id,
            context=context,
            detail=str(error.detail),
            reason="realtime_write_access_revoked",
            room=room,
            connection_id=connection_id,
            websocket=websocket,
        )
        return None
    if collaboration.room_key != expected_room_key or not collaboration.can_edit:
        await _deny_realtime_write(
            board_id=board_id,
            context=context,
            detail="Realtime document writes require board edit access.",
            reason="realtime_write_access_revoked",
            room=room,
            connection_id=connection_id,
            websocket=websocket,
        )
        return None
    await room.set_connection_can_edit(connection_id, True)
    return collaboration


async def _deny_realtime_write(
    *,
    board_id: str,
    context: ApiRequestContext,
    detail: str,
    reason: str,
    room: Any,
    connection_id: str,
    websocket: WebSocket,
) -> None:
    await room.set_connection_can_edit(connection_id, False)
    record_security_event(
        action="realtime.write_access",
        context=context,
        decision="deny",
        metadata={"boardId": board_id},
        reason=reason,
        resource_id=board_id,
        resource_type="board",
    )
    await websocket.close(
        code=4403,
        reason=detail[:120] or "Realtime document writes require board edit access.",
    )
