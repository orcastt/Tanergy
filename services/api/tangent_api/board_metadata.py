from typing import Any, Optional

BOARD_CARD_COLORS = {"cream", "mint", "peach", "yellow", "soft"}
BOARD_VISIBILITY = {"private", "workspace", "public"}


def normalize_board_card_color(value: Optional[str]) -> Optional[str]:
    return value if value in BOARD_CARD_COLORS else None


def normalize_board_description(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    trimmed = value.strip()
    return trimmed[:280] if trimmed else None


def normalize_board_share_id(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    trimmed = value.strip()
    if 8 <= len(trimmed) <= 64 and all(char.isalnum() or char in "_-" for char in trimmed):
        return trimmed
    return None


def normalize_board_thumbnail_url(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    trimmed = value.strip()
    if trimmed.startswith("/api/assets/") or trimmed.startswith("http://") or trimmed.startswith("https://"):
        return trimmed[:512]
    return None


def normalize_board_visibility(value: Optional[str]) -> str:
    return value if value in BOARD_VISIBILITY else "private"


def get_board_document_metrics(document: Any) -> dict[str, int]:
    if not isinstance(document, dict):
        return {"asset_count": 0, "shape_count": 0}
    assets = document.get("assets")
    shapes = document.get("shapes")
    canvas_document = document.get("canvasDocument")
    canvas_shapes = canvas_document.get("shapes") if isinstance(canvas_document, dict) else None
    return {
        "asset_count": len(assets) if isinstance(assets, list) else 0,
        "shape_count": len(shapes) if isinstance(shapes, list) else len(canvas_shapes) if isinstance(canvas_shapes, list) else 0,
    }
