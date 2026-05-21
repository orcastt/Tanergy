import math
import re
from typing import Optional

from fastapi import HTTPException

from tangent_api.schemas import BoardCollaborationPresence

SESSION_ID_PATTERN = re.compile(r"^[a-zA-Z0-9._-]{1,120}$")
ACTIVE_STATES = {"idle", "viewing", "drawing", "typing", "selecting", "panning", "running"}
ACTIVE_TRANSFORM_KINDS = {"move", "resize", "rotate"}
ACTIVE_CONNECTION_DATA_TYPES = {"image", "text"}
MAX_SELECTION_IDS = 50
MAX_TTL_SECONDS = 300
MIN_TTL_SECONDS = 15
MAX_ACTIVE_SESSIONS_PER_BOARD = 100


def _normalize_presence(payload: object) -> dict[str, object]:
    presence = BoardCollaborationPresence.model_validate(payload or {})
    editing_shape_ids = [
        _normalize_session_identifier(item, "editing shape id")
        for item in presence.editing_shape_ids[:MAX_SELECTION_IDS]
        if isinstance(item, str) and item.strip()
    ]
    selection_ids = [
        _normalize_session_identifier(item, "selection id")
        for item in presence.selection_ids[:MAX_SELECTION_IDS]
        if isinstance(item, str) and item.strip()
    ]
    tool = presence.tool.strip()[:40] if isinstance(presence.tool, str) and presence.tool.strip() else None
    state = presence.state.strip().lower()[:24] if isinstance(presence.state, str) and presence.state.strip() else None
    if state and state not in ACTIVE_STATES:
        state = "idle"
    active_page_id = None
    if isinstance(presence.active_page_id, str) and presence.active_page_id.strip():
        active_page_id = _normalize_session_identifier(presence.active_page_id, "active page id")
    connection_preview = _normalize_connection_preview(presence.connection_preview)
    hovered_shape_id = None
    if isinstance(presence.hovered_shape_id, str) and presence.hovered_shape_id.strip():
        hovered_shape_id = _normalize_session_identifier(presence.hovered_shape_id, "hovered shape id")
    selected_edge_id = None
    if isinstance(presence.selected_edge_id, str) and presence.selected_edge_id.strip():
        selected_edge_id = _normalize_session_identifier(presence.selected_edge_id, "selected edge id")
    selection_box = None
    if (
        presence.selection_box is not None
        and _is_finite_number(presence.selection_box.min_x)
        and _is_finite_number(presence.selection_box.min_y)
        and _is_finite_number(presence.selection_box.max_x)
        and _is_finite_number(presence.selection_box.max_y)
    ):
        selection_box = _normalize_selection_box(presence.selection_box)
    transform_box = None
    if (
        presence.transform_box is not None
        and _is_finite_number(presence.transform_box.min_x)
        and _is_finite_number(presence.transform_box.min_y)
        and _is_finite_number(presence.transform_box.max_x)
        and _is_finite_number(presence.transform_box.max_y)
    ):
        transform_box = _normalize_selection_box(presence.transform_box)
    transform_kind = (
        presence.transform_kind.strip().lower()[:24]
        if isinstance(presence.transform_kind, str) and presence.transform_kind.strip()
        else None
    )
    if transform_kind and transform_kind not in ACTIVE_TRANSFORM_KINDS:
        transform_kind = None
    cursor = None
    if presence.cursor is not None and _is_finite_number(presence.cursor.x) and _is_finite_number(presence.cursor.y):
        cursor = {
            "x": round(float(presence.cursor.x), 3),
            "y": round(float(presence.cursor.y), 3),
        }
    return {
        "activePageId": active_page_id,
        "connectionPreview": connection_preview,
        "cursor": cursor,
        "editingShapeIds": editing_shape_ids,
        "hoveredShapeId": hovered_shape_id,
        "selectedEdgeId": selected_edge_id,
        "selectionBox": selection_box,
        "selectionIds": selection_ids,
        "state": state,
        "tool": tool,
        "transformBox": transform_box,
        "transformKind": transform_kind,
    }


def _normalize_connection_preview(value: object) -> Optional[dict[str, object]]:
    if value is None:
        return None
    pointer = getattr(value, "pointer", None)
    source = _normalize_port_endpoint(getattr(value, "source", None))
    if pointer is None or source is None:
        return None
    if not _is_finite_number(pointer.x) or not _is_finite_number(pointer.y):
        return None
    data_type = _normalize_connection_data_type(getattr(value, "data_type", None))
    if data_type is None:
        return None
    sources_payload = getattr(value, "sources", None)
    sources = [
        endpoint
        for endpoint in (
            _normalize_port_endpoint(item)
            for item in (sources_payload[:MAX_SELECTION_IDS] if isinstance(sources_payload, list) else [])
        )
        if endpoint is not None
    ]
    return {
        "dataType": data_type,
        "pointer": {
            "x": round(float(pointer.x), 3),
            "y": round(float(pointer.y), 3),
        },
        "source": source,
        "sources": sources or [source],
        "target": _normalize_port_endpoint(getattr(value, "target", None)),
    }


def _normalize_selection_box(value: object) -> Optional[dict[str, float]]:
    min_x = round(float(min(value.min_x, value.max_x)), 3)
    max_x = round(float(max(value.min_x, value.max_x)), 3)
    min_y = round(float(min(value.min_y, value.max_y)), 3)
    max_y = round(float(max(value.min_y, value.max_y)), 3)
    if max_x <= min_x or max_y <= min_y:
        return None
    return {
        "maxX": max_x,
        "maxY": max_y,
        "minX": min_x,
        "minY": min_y,
    }


def _normalize_port_endpoint(value: object) -> Optional[dict[str, str]]:
    if value is None:
        return None
    port_id = getattr(value, "port_id", None)
    shape_id = getattr(value, "shape_id", None)
    if not isinstance(port_id, str) or not port_id.strip():
        return None
    if not isinstance(shape_id, str) or not shape_id.strip():
        return None
    return {
        "portId": _normalize_session_identifier(port_id, "connection port id"),
        "shapeId": _normalize_session_identifier(shape_id, "connection shape id"),
    }


def _normalize_connection_data_type(value: object) -> Optional[str]:
    if not isinstance(value, str):
        return None
    normalized = value.strip().lower()
    return normalized if normalized in ACTIVE_CONNECTION_DATA_TYPES else None


def _normalize_session_identifier(value: str, label: str) -> str:
    trimmed = value.strip()
    if not trimmed or not SESSION_ID_PATTERN.fullmatch(trimmed) or ".." in trimmed:
        raise HTTPException(status_code=400, detail=f"Invalid {label}.")
    return trimmed


def _normalize_ttl_seconds(value: Optional[int]) -> int:
    if value is None:
        return 45
    return max(MIN_TTL_SECONDS, min(int(value), MAX_TTL_SECONDS))


def _is_finite_number(value: object) -> bool:
    if not isinstance(value, (float, int)):
        return False
    return math.isfinite(float(value))


def _room_key(workspace_id: str, board_id: str) -> str:
    return f"board:{workspace_id}:{board_id}"
