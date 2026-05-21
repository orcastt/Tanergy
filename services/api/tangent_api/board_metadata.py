import base64
import hashlib
import secrets
from typing import Any, Optional

from fastapi import HTTPException

from tangent_api.safe_text import normalize_optional_safe_text, normalize_safe_label

BOARD_CARD_COLORS = {"cream", "mint", "peach", "yellow", "soft"}
BOARD_VISIBILITY = {"private", "workspace", "public"}
BOARD_SHARE_ID_BYTES = 32
BOARD_SHARE_PASSWORD_HASH_ITERATIONS = 210_000
BOARD_SHARE_PASSWORD_MAX_LENGTH = 256


def normalize_board_title(value: Optional[str], fallback: str = "Untitled Board") -> str:
    if value is None:
        return coerce_board_title(fallback)
    title = normalize_safe_label(value, field_name="Board title")
    if any(not _is_board_title_char_allowed(char) for char in title):
        raise HTTPException(
            status_code=400,
            detail="Board title can only use letters, numbers, spaces, hyphen, underscore, and dot.",
        )
    return title


def coerce_board_title(value: Optional[str], fallback: str = "Untitled Board") -> str:
    safe = _coerce_board_title_text(value)
    if not safe:
        return _coerce_board_title_text(fallback) or "Untitled Board"
    return safe[:80]


def _coerce_board_title_text(value: Optional[str]) -> str:
    normalized = " ".join((value or "").strip().split())
    safe = "".join(char for char in normalized if _is_board_title_char_allowed(char)).strip()
    return " ".join(safe.split())


def _is_board_title_char_allowed(char: str) -> bool:
    return char.isalnum() or char.isspace() or char in "-_."


def normalize_board_card_color(value: Optional[str]) -> Optional[str]:
    return value if value in BOARD_CARD_COLORS else None


def normalize_board_description(value: Optional[str]) -> Optional[str]:
    return normalize_optional_safe_text(value, field_name="Board note", max_length=280)


def normalize_board_share_id(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    trimmed = value.strip()
    if 8 <= len(trimmed) <= 64 and all(char.isalnum() or char in "_-" for char in trimmed):
        return trimmed
    return None


def create_board_share_id() -> str:
    return secrets.token_urlsafe(BOARD_SHARE_ID_BYTES)


def normalize_board_share_password(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail="Invalid board share password.")
    if not value.strip():
        raise HTTPException(status_code=400, detail="Board share password cannot be empty.")
    if len(value) > BOARD_SHARE_PASSWORD_MAX_LENGTH:
        raise HTTPException(status_code=400, detail="Board share password is too long.")
    return value


def create_board_share_password_hash(password: str) -> str:
    normalized = normalize_board_share_password(password)
    if normalized is None:
        raise HTTPException(status_code=400, detail="Board share password is required.")
    salt = secrets.token_bytes(16)
    digest = _hash_board_share_password(normalized, salt, BOARD_SHARE_PASSWORD_HASH_ITERATIONS)
    return "$".join(
        [
            "pbkdf2_sha256",
            str(BOARD_SHARE_PASSWORD_HASH_ITERATIONS),
            _urlsafe_b64encode(salt),
            _urlsafe_b64encode(digest),
        ]
    )


def verify_board_share_password(password: Optional[str], password_hash: Optional[str]) -> bool:
    if not password_hash:
        return True
    try:
        normalized = normalize_board_share_password(password)
    except HTTPException:
        return False
    if normalized is None:
        return False
    try:
        algorithm, iterations_value, salt_value, digest_value = password_hash.split("$", 3)
        iterations = int(iterations_value)
        salt = _urlsafe_b64decode(salt_value)
        expected_digest = _urlsafe_b64decode(digest_value)
    except (TypeError, ValueError):
        return False
    if algorithm != "pbkdf2_sha256" or iterations < 100_000:
        return False
    actual_digest = _hash_board_share_password(normalized, salt, iterations)
    return secrets.compare_digest(actual_digest, expected_digest)


def _hash_board_share_password(password: str, salt: bytes, iterations: int) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)


def _urlsafe_b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _urlsafe_b64decode(value: str) -> bytes:
    padded = value + "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def normalize_board_thumbnail_url(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    trimmed = value.strip()
    if trimmed.startswith("/api/assets/") or trimmed.startswith("http://") or trimmed.startswith("https://"):
        return trimmed[:512]
    return None


def normalize_board_visibility(value: Optional[str]) -> str:
    return value if value in BOARD_VISIBILITY else "private"


def detect_board_canvas_engine(document: Any) -> Optional[str]:
    if not isinstance(document, dict):
        return None
    if document.get("version") != 2:
        return None
    if document.get("renderer") != "konva":
        return None
    if not isinstance(document.get("canvasDocument"), dict):
        return None
    return "konva"


def get_board_document_metrics(document: Any) -> dict[str, int]:
    if not isinstance(document, dict):
        return {"asset_count": 0, "page_count": 1, "shape_count": 0}
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
    page_count = len(pages) if isinstance(pages, list) and pages else 1
    return {
        "asset_count": len(assets) if isinstance(assets, list) else 0,
        "page_count": page_count,
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
