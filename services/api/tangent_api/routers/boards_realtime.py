from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect

from tangent_api.realtime.board_realtime_hub import board_realtime_hub
from tangent_api.realtime.board_realtime_limits import (
    BOARD_REALTIME_WEBSOCKET_MESSAGE_BYTE_LIMIT,
    normalize_realtime_update,
)
from tangent_api.realtime.board_realtime_persistence import board_realtime_persistence
from tangent_api.request_context import ApiRequestContext, get_request_context, get_websocket_context
from tangent_api.schemas import (
    BoardCollaborationSessionDeleteResponse,
    BoardCollaborationSessionUpsertRequest,
    BoardCollaborationSessionsResponse,
)
from tangent_api.storage.board_collaboration_storage_adapter import get_board_collaboration_storage_adapter

router = APIRouter(tags=["boards"])


@router.get("/{board_id}/collaboration", response_model=BoardCollaborationSessionsResponse)
def list_board_collaboration_sessions(
    board_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardCollaborationSessionsResponse:
    return get_board_collaboration_storage_adapter().list_sessions(board_id, context)


@router.post("/{board_id}/collaboration/sessions", response_model=BoardCollaborationSessionsResponse)
def claim_board_collaboration_session(
    board_id: str,
    payload: BoardCollaborationSessionUpsertRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardCollaborationSessionsResponse:
    return get_board_collaboration_storage_adapter().claim_session(board_id, payload, context)


@router.delete(
    "/{board_id}/collaboration/sessions/{session_id}",
    response_model=BoardCollaborationSessionDeleteResponse,
)
def release_board_collaboration_session(
    board_id: str,
    session_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardCollaborationSessionDeleteResponse:
    return get_board_collaboration_storage_adapter().release_session(board_id, session_id, context)


@router.websocket("/{board_id}/realtime")
async def board_realtime_room(websocket: WebSocket, board_id: str) -> None:
    client_instance_id = websocket.query_params.get("clientInstanceId")
    if not isinstance(client_instance_id, str) or not client_instance_id.strip():
        await websocket.close(code=4400, reason="Missing clientInstanceId.")
        return
    normalized_client_instance_id = client_instance_id.strip()

    try:
        context = await get_websocket_context(websocket)
        collaboration = get_board_collaboration_storage_adapter().list_sessions(board_id, context)
    except HTTPException as error:
        reason = str(error.detail)
        await websocket.close(code=4403, reason=reason[:120] or "Realtime access denied.")
        return
    except Exception as error:
        reason = str(error)
        await websocket.close(code=4403, reason=reason[:120] or "Realtime access denied.")
        return

    expected_room_key = collaboration.room_key
    room_key = websocket.query_params.get("roomKey")
    if not isinstance(room_key, str) or not room_key.strip():
        await websocket.close(code=4400, reason="Missing roomKey.")
        return
    room_key = room_key.strip()
    if room_key != expected_room_key:
        await websocket.close(code=4403, reason="Room key mismatch.")
        return

    persisted_updates = board_realtime_persistence.load_document(collaboration.workspace_id, board_id)
    await websocket.accept()
    room, connection_id = await board_realtime_hub.connect(
        room_key,
        websocket,
        normalized_client_instance_id,
        persisted_updates,
    )
    try:
        while True:
            payload = await _receive_realtime_json(websocket)
            message_type = payload.get("type") if isinstance(payload, dict) else None
            if message_type in {"sync-state-publish", "yjs-update"} and not collaboration.can_edit:
                await websocket.close(code=4403, reason="Realtime document writes require board edit access.")
                break
            if message_type == "sync-state-publish":
                update = _normalize_realtime_update(payload.get("update"))
                if update is not None:
                    document_version = _normalize_realtime_document_version(payload.get("documentVersion"))
                    document_updates, accepted, request_compaction, current_document_version = await room.replace_document_state(
                        update,
                        document_version,
                    )
                    if accepted:
                        await board_realtime_persistence.queue_document(
                            collaboration.workspace_id,
                            board_id,
                            room_key,
                            document_updates,
                        )
                    else:
                        await websocket.send_json({
                            "documentVersion": current_document_version,
                            "requestCompaction": request_compaction,
                            "seedRoom": len(document_updates) == 0,
                            "type": "sync-state",
                            "updates": document_updates,
                        })
                continue
            if message_type == "yjs-update":
                update = _normalize_realtime_update(payload.get("update"))
                if update is not None:
                    (
                        document_updates,
                        request_compaction,
                        current_document_version,
                        accepted,
                    ) = await room.publish_document_update(
                        connection_id,
                        normalized_client_instance_id,
                        update,
                    )
                    if accepted:
                        await board_realtime_persistence.queue_document(
                            collaboration.workspace_id,
                            board_id,
                            room_key,
                            document_updates,
                        )
                    if request_compaction:
                        await websocket.send_json({
                            "documentVersion": current_document_version,
                            "requestCompaction": True,
                            "type": "document-compact-request",
                            "updateCount": len(document_updates),
                        })
                continue
            if message_type == "awareness-state":
                state = payload.get("state") if isinstance(payload.get("state"), dict) else None
                await room.publish_awareness_state(normalized_client_instance_id, state)
                continue
            if message_type == "awareness-remove":
                await room.publish_awareness_state(normalized_client_instance_id, None)
                continue
            await websocket.send_json({"message": "Unsupported realtime message.", "type": "error"})
    except WebSocketDisconnect:
        pass
    except RuntimeError as error:
        if "WebSocket is not connected" not in str(error):
            raise
    finally:
        snapshot = await room.snapshot_document()
        room_became_empty = await board_realtime_hub.disconnect(room_key, connection_id)
        if snapshot and room_became_empty:
            await board_realtime_persistence.finalize_document(
                collaboration.workspace_id,
                board_id,
                room_key,
                snapshot,
            )


def _normalize_realtime_update(value: Any) -> list[int] | None:
    return normalize_realtime_update(value)


async def _receive_realtime_json(websocket: WebSocket) -> Any:
    raw = await websocket.receive_text()
    if len(raw.encode("utf-8")) > BOARD_REALTIME_WEBSOCKET_MESSAGE_BYTE_LIMIT:
        await websocket.close(code=4400, reason="Realtime message exceeded the size limit.")
        raise WebSocketDisconnect(code=4400)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        await websocket.close(code=4400, reason="Realtime message was invalid JSON.")
        raise WebSocketDisconnect(code=4400)


def _normalize_realtime_document_version(value: Any) -> int | None:
    if not isinstance(value, int):
        return None
    if value < 0:
        return None
    return value
