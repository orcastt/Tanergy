import math
from typing import Any, Optional

from tangent_api.schemas import BoardDocumentGuardIssue

KONVA_ISSUE_CODE = "konva-v2-invalid"
ALLOWED_SHAPE_TYPES = {
    "arrow",
    "cloud",
    "diamond",
    "ellipse",
    "frame",
    "image",
    "line",
    "node_card",
    "rect",
    "sticky",
    "stroke",
    "text",
    "triangle",
}
BOX_SHAPE_TYPES = {"cloud", "diamond", "ellipse", "frame", "image", "node_card", "rect", "sticky", "text", "triangle"}
NODE_TYPES = {"analysis", "image", "image_gen", "image_gen_4", "prompt"}
RUNTIME_DATA_TYPES = {"image", "text"}


def audit_konva_board_document_schema(document: Any) -> list[BoardDocumentGuardIssue]:
    if not _looks_like_konva_document(document):
        return []
    issues: list[BoardDocumentGuardIssue] = []
    root = _require_dict(document, "document", issues)
    if root is None:
        return issues

    if root.get("version") != 2:
        _add_issue(issues, "document.version", "Konva board document must use version 2.")
    if root.get("renderer") != "konva":
        _add_issue(issues, "document.renderer", 'Konva board document renderer must be "konva".')
    _require_string(root.get("serializedAt"), "document.serializedAt", issues)
    assets = _require_list(root.get("assets"), "document.assets", issues)
    canvas_document = _require_dict(root.get("canvasDocument"), "document.canvasDocument", issues)

    if assets is not None:
        for index, asset in enumerate(assets):
            _validate_asset(asset, f"document.assets.{index}", issues)
    if canvas_document is not None:
        _validate_canvas_document(canvas_document, issues)
    return issues


def _looks_like_konva_document(value: Any) -> bool:
    return isinstance(value, dict) and (
        value.get("renderer") == "konva" or value.get("version") == 2 or "canvasDocument" in value
    )


def _validate_canvas_document(document: dict[str, Any], issues: list[BoardDocumentGuardIssue]) -> None:
    _require_string(document.get("id"), "document.canvasDocument.id", issues)
    if document.get("schemaVersion") != 1:
        _add_issue(issues, "document.canvasDocument.schemaVersion", "Canvas document schemaVersion must be 1.")
    _validate_camera(document.get("camera"), "document.canvasDocument.camera", issues)
    _validate_metadata(document.get("metadata"), "document.canvasDocument.metadata", issues)
    shapes = _require_list(document.get("shapes"), "document.canvasDocument.shapes", issues)
    edges = _require_list(document.get("runtimeEdges"), "document.canvasDocument.runtimeEdges", issues)
    shape_ids: set[str] = set()

    if shapes is not None:
        for index, shape in enumerate(shapes):
            shape_id = _validate_shape(shape, f"document.canvasDocument.shapes.{index}", issues)
            if not shape_id:
                continue
            if shape_id in shape_ids:
                _add_issue(issues, f"document.canvasDocument.shapes.{index}.id", f'Duplicate shape id "{shape_id}".')
            shape_ids.add(shape_id)
    if edges is not None:
        for index, edge in enumerate(edges):
            _validate_runtime_edge(edge, f"document.canvasDocument.runtimeEdges.{index}", shape_ids, issues)


def _validate_asset(value: Any, path: str, issues: list[BoardDocumentGuardIssue]) -> None:
    asset = _require_dict(value, path, issues)
    if asset is None:
        return
    _require_string(asset.get("id"), f"{path}.id", issues)
    if asset.get("type") != "image":
        _add_issue(issues, f"{path}.type", 'Konva board asset type must be "image".')
    _validate_optional_number(asset.get("width"), f"{path}.width", issues)
    _validate_optional_number(asset.get("height"), f"{path}.height", issues)


def _validate_camera(value: Any, path: str, issues: list[BoardDocumentGuardIssue]) -> None:
    camera = _require_dict(value, path, issues)
    if camera is None:
        return
    _require_number(camera.get("x"), f"{path}.x", issues)
    _require_number(camera.get("y"), f"{path}.y", issues)
    _require_number(camera.get("zoom"), f"{path}.zoom", issues)
    zoom = camera.get("zoom")
    if isinstance(zoom, (int, float)) and zoom <= 0:
        _add_issue(issues, f"{path}.zoom", "Camera zoom must be greater than 0.")


def _validate_metadata(value: Any, path: str, issues: list[BoardDocumentGuardIssue]) -> None:
    metadata = _require_dict(value, path, issues)
    if metadata is None:
        return
    _require_string(metadata.get("createdAt"), f"{path}.createdAt", issues)
    _require_string(metadata.get("updatedAt"), f"{path}.updatedAt", issues)


def _validate_shape(value: Any, path: str, issues: list[BoardDocumentGuardIssue]) -> Optional[str]:
    shape = _require_dict(value, path, issues)
    if shape is None:
        return None
    shape_id = _require_string(shape.get("id"), f"{path}.id", issues)
    _require_number(shape.get("x"), f"{path}.x", issues)
    _require_number(shape.get("y"), f"{path}.y", issues)
    _validate_optional_number(shape.get("rotation"), f"{path}.rotation", issues)
    shape_type = _require_string(shape.get("type"), f"{path}.type", issues)
    if shape_type and shape_type not in ALLOWED_SHAPE_TYPES:
        _add_issue(issues, f"{path}.type", f'Unsupported Konva shape type "{shape_type}".')
    props = _require_dict(shape.get("props"), f"{path}.props", issues)
    if not shape_type or props is None:
        return shape_id

    if shape_type in BOX_SHAPE_TYPES:
        _validate_size_props(props, f"{path}.props", issues)
    if shape_type == "image":
        _require_string(props.get("assetId"), f"{path}.props.assetId", issues)
    if shape_type == "node_card":
        _validate_node_card_props(props, f"{path}.props", issues)
    if shape_type in {"line", "arrow"}:
        _validate_line_props(props, f"{path}.props", issues)
    if shape_type == "stroke":
        _validate_stroke_props(props, f"{path}.props", issues)
    return shape_id


def _validate_node_card_props(props: dict[str, Any], path: str, issues: list[BoardDocumentGuardIssue]) -> None:
    _require_string(props.get("nodeId"), f"{path}.nodeId", issues)
    node_type = _require_string(props.get("nodeType"), f"{path}.nodeType", issues)
    if node_type and node_type not in NODE_TYPES:
        _add_issue(issues, f"{path}.nodeType", f'Unsupported node type "{node_type}".')
    _require_dict(props.get("data"), f"{path}.data", issues)
    _require_dict(props.get("runtimeSummary"), f"{path}.runtimeSummary", issues)
    _require_number(props.get("version"), f"{path}.version", issues)


def _validate_line_props(props: dict[str, Any], path: str, issues: list[BoardDocumentGuardIssue]) -> None:
    _validate_point(props.get("end"), f"{path}.end", issues)
    if props.get("control") is not None:
        _validate_point(props.get("control"), f"{path}.control", issues)
    if "bends" in props:
        bends = _require_list(props.get("bends"), f"{path}.bends", issues)
        if bends is not None:
            for index, point in enumerate(bends):
                _validate_point(point, f"{path}.bends.{index}", issues)


def _validate_stroke_props(props: dict[str, Any], path: str, issues: list[BoardDocumentGuardIssue]) -> None:
    points = _require_list(props.get("points"), f"{path}.points", issues)
    if points is not None:
        for index, point in enumerate(points):
            _validate_point(point, f"{path}.points.{index}", issues)


def _validate_runtime_edge(
    value: Any,
    path: str,
    shape_ids: set[str],
    issues: list[BoardDocumentGuardIssue],
) -> None:
    edge = _require_dict(value, path, issues)
    if edge is None:
        return
    _require_string(edge.get("id"), f"{path}.id", issues)
    source_shape_id = _require_string(edge.get("sourceShapeId"), f"{path}.sourceShapeId", issues)
    target_shape_id = _require_string(edge.get("targetShapeId"), f"{path}.targetShapeId", issues)
    _require_string(edge.get("sourcePortId"), f"{path}.sourcePortId", issues)
    _require_string(edge.get("targetPortId"), f"{path}.targetPortId", issues)
    data_type = _require_string(edge.get("dataType"), f"{path}.dataType", issues)
    if data_type and data_type not in RUNTIME_DATA_TYPES:
        _add_issue(issues, f"{path}.dataType", f'Unsupported runtime edge data type "{data_type}".')
    if source_shape_id and source_shape_id not in shape_ids:
        _add_issue(issues, f"{path}.sourceShapeId", f'Runtime edge source shape "{source_shape_id}" is missing.')
    if target_shape_id and target_shape_id not in shape_ids:
        _add_issue(issues, f"{path}.targetShapeId", f'Runtime edge target shape "{target_shape_id}" is missing.')


def _validate_size_props(props: dict[str, Any], path: str, issues: list[BoardDocumentGuardIssue]) -> None:
    _require_number(props.get("width"), f"{path}.width", issues)
    _require_number(props.get("height"), f"{path}.height", issues)
    width = props.get("width")
    height = props.get("height")
    if isinstance(width, (int, float)) and width <= 0:
        _add_issue(issues, f"{path}.width", "Shape width must be greater than 0.")
    if isinstance(height, (int, float)) and height <= 0:
        _add_issue(issues, f"{path}.height", "Shape height must be greater than 0.")


def _validate_point(value: Any, path: str, issues: list[BoardDocumentGuardIssue]) -> None:
    point = _require_dict(value, path, issues)
    if point is None:
        return
    _require_number(point.get("x"), f"{path}.x", issues)
    _require_number(point.get("y"), f"{path}.y", issues)


def _require_dict(value: Any, path: str, issues: list[BoardDocumentGuardIssue]) -> Optional[dict[str, Any]]:
    if isinstance(value, dict):
        return value
    _add_issue(issues, path, f"{path} must be an object.")
    return None


def _require_list(value: Any, path: str, issues: list[BoardDocumentGuardIssue]) -> Optional[list[Any]]:
    if isinstance(value, list):
        return value
    _add_issue(issues, path, f"{path} must be an array.")
    return None


def _require_string(value: Any, path: str, issues: list[BoardDocumentGuardIssue]) -> Optional[str]:
    if isinstance(value, str) and value.strip():
        return value
    _add_issue(issues, path, f"{path} must be a non-empty string.")
    return None


def _require_number(value: Any, path: str, issues: list[BoardDocumentGuardIssue]) -> None:
    if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value):
        return
    _add_issue(issues, path, f"{path} must be a finite number.")


def _validate_optional_number(value: Any, path: str, issues: list[BoardDocumentGuardIssue]) -> None:
    if value is None:
        return
    _require_number(value, path, issues)


def _add_issue(issues: list[BoardDocumentGuardIssue], path: str, message: str) -> None:
    issues.append(BoardDocumentGuardIssue(blocking=True, code=KONVA_ISSUE_CODE, message=message, path=path))
