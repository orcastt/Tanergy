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
    pages = document.get("pages")
    page_shape_count = 0
    if isinstance(pages, list):
        for page in pages:
            if not isinstance(page, dict):
                continue
            page_document = page.get("canvasDocument")
            page_shapes = page_document.get("shapes") if isinstance(page_document, dict) else None
            if isinstance(page_shapes, list):
                page_shape_count += len(page_shapes)
    return {
        "asset_count": len(assets) if isinstance(assets, list) else 0,
        "shape_count": page_shape_count
        if page_shape_count > 0
        else len(shapes) if isinstance(shapes, list) else len(canvas_shapes) if isinstance(canvas_shapes, list) else 0,
    }


def get_board_snapshot_display_title(document: Any, fallback_title: Optional[str]) -> str:
    fallback = (fallback_title or "").strip()
    return _get_konva_active_page_title(document) or fallback or "Untitled snapshot"


def _get_konva_active_page_title(document: Any) -> Optional[str]:
    if not isinstance(document, dict):
        return None
    if document.get("renderer") != "konva" or document.get("version") != 2:
        return None
    active_page_id = document.get("activePageId") if isinstance(document.get("activePageId"), str) else "page-1"
    pages = document.get("pages")
    if isinstance(pages, list):
        for page in pages:
            if not isinstance(page, dict) or page.get("id") != active_page_id:
                continue
            title = page.get("title")
            if isinstance(title, str) and title.strip():
                return title.strip()
    canvas_document = document.get("canvasDocument")
    metadata = canvas_document.get("metadata") if isinstance(canvas_document, dict) else None
    name = metadata.get("name") if isinstance(metadata, dict) else None
    return name.strip() if isinstance(name, str) and name.strip() else None
