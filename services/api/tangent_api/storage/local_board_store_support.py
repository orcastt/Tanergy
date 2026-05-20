import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.safe_text import normalize_safe_label
from tangent_api.schemas import BoardShareLinkRecord, BoardSummary, create_board_share_id, normalize_board_share_id

BOARD_ID_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")
BOARD_MEMBER_ROLE_PATTERN = {"admin", "editor", "viewer"}
BOARD_SHARE_ACCESS_ROLE_PATTERN = {"viewer", "editor"}
WORKSPACE_ROLE_PATTERN = {"owner", "admin", "member", "guest"}


def _storage_root() -> Path:
    return Path(os.getenv("TANGENT_BOARD_STORAGE_DIR", ".tangent-boards"))


def _assert_local_driver() -> None:
    driver = os.getenv("TANGENT_BOARD_STORAGE_DRIVER", "local-dev")
    if driver != "local-dev":
        raise HTTPException(
            status_code=501,
            detail=f'Unsupported board storage driver "{driver}". Supported driver: local-dev.',
        )


def _board_path(board_id: str) -> Path:
    return _storage_root() / "boards" / f"{board_id}.json"


def _member_path(board_id: str) -> Path:
    return _storage_root() / "boards" / f"{board_id}.members.json"


def _share_link_path(board_id: str) -> Path:
    return _storage_root() / "boards" / f"{board_id}.shares.json"


def _workspace_people_path(workspace_id: str) -> Path:
    return _storage_root() / "workspaces" / f"{workspace_id}.people.json"


def _paginate_board_summaries(
    summaries: list[BoardSummary],
    cursor: Optional[str],
    limit: int,
) -> tuple[list[BoardSummary], Optional[str]]:
    normalized_limit = max(1, min(limit, 100))
    start_index = 0
    if cursor:
        for index, item in enumerate(summaries):
            if _encode_board_cursor(item) == cursor:
                start_index = index + 1
                break
    page = summaries[start_index:start_index + normalized_limit]
    next_cursor = _encode_board_cursor(page[-1]) if start_index + normalized_limit < len(summaries) and page else None
    return page, next_cursor


def _encode_board_cursor(board: BoardSummary) -> str:
    return f"{board.saved_at.replace('+00:00', 'Z')}|{board.id}"


def _copy_title(title: str) -> str:
    return f"{title} Copy" if title else "Untitled Board Copy"


def _normalize_board_member_role(role: str) -> str:
    normalized = role.strip().lower()
    if normalized not in BOARD_MEMBER_ROLE_PATTERN:
        raise HTTPException(status_code=400, detail="Invalid board member role.")
    return normalized


def _normalize_board_share_access_role(role: str) -> str:
    normalized = role.strip().lower()
    if normalized not in BOARD_SHARE_ACCESS_ROLE_PATTERN:
        raise HTTPException(status_code=400, detail="Invalid board share access role.")
    return normalized


def _normalize_display_name(value: object) -> Optional[str]:
    if not isinstance(value, str):
        return None
    if not value.strip():
        return None
    return normalize_safe_label(value, field_name="Display name")


def _normalize_email(value: object) -> str:
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail="Valid email is required.")
    trimmed = value.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", trimmed):
        raise HTTPException(status_code=400, detail="Valid email is required.")
    return trimmed[:320]


def _sanitize_user_id(value: str) -> str:
    trimmed = value.strip()
    if not trimmed or not BOARD_ID_PATTERN.match(trimmed) or ".." in trimmed:
        raise HTTPException(status_code=400, detail="Invalid user id.")
    return trimmed


def _create_local_person_id(email: str) -> str:
    local_part = re.sub(r"[^a-z0-9]+", "_", email.split("@", 1)[0].lower()).strip("_")
    suffix = uuid4().hex[:6]
    return _sanitize_user_id(f"user_{local_part or 'member'}_{suffix}")


def _create_share_id() -> str:
    return create_board_share_id()


def _require_share_id(value: str) -> str:
    normalized = normalize_board_share_id(value)
    if not normalized:
        raise HTTPException(status_code=400, detail="Invalid board share id.")
    return normalized


def _sanitize_board_id(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    if BOARD_ID_PATTERN.match(value) and ".." not in value:
        return value
    raise HTTPException(status_code=400, detail="Invalid board id.")


def _normalize_share_expires_at(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        expires_at = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid board share expiry.") from exc
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Board share expiry must be in the future.")
    return expires_at.isoformat()


def _is_share_link_active(link: BoardShareLinkRecord) -> bool:
    if not link.expires_at:
        return True
    try:
        expires_at = datetime.fromisoformat(link.expires_at.replace("Z", "+00:00"))
    except ValueError:
        return False
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at > datetime.now(timezone.utc)
