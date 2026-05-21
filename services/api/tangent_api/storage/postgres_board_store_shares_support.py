from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

from tangent_api.board_metadata import (
    normalize_board_share_id,
    verify_board_share_password,
)
from tangent_api.schemas import BoardShareLinkRecord
from tangent_api.storage.postgres_board_schema import ensure_board_schema

BOARD_SHARE_ACCESS_ROLE_PATTERN = {"viewer", "editor"}
SHARE_PASSWORD_ERROR = "Board share password is required."


def ensure_board_share_security_schema(cursor: object) -> None:
    ensure_board_schema(cursor)
    cursor.execute("ALTER TABLE IF EXISTS tangent_board_share_links ADD COLUMN IF NOT EXISTS password_hash TEXT")


def board_share_link_from_row(row: tuple[object, ...]) -> BoardShareLinkRecord:
    created_at = row[7].isoformat() if hasattr(row[7], "isoformat") else str(row[7])
    expires_at = row[6].isoformat() if hasattr(row[6], "isoformat") else row[6]
    password_hash = row[8] if len(row) > 8 else None
    return BoardShareLinkRecord(
        accessRole=row[4],
        boardId=row[2],
        createdAt=created_at,
        createdBy=row[5],
        expiresAt=expires_at,
        id=row[0],
        passwordProtected=bool(password_hash),
        shareId=row[3],
        workspaceId=row[1],
    )


def normalize_board_share_access_role(role: str) -> str:
    normalized = role.strip().lower()
    if normalized not in BOARD_SHARE_ACCESS_ROLE_PATTERN:
        raise HTTPException(status_code=400, detail="Invalid board share access role.")
    return normalized


def normalize_share_expires_at(value: Optional[str]) -> Optional[str]:
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


def require_share_id(value: str) -> str:
    normalized = normalize_board_share_id(value)
    if not normalized:
        raise HTTPException(status_code=400, detail="Invalid board share id.")
    return normalized


def assert_share_password(password_hash: Optional[str], password: Optional[str]) -> None:
    if not verify_board_share_password(password, password_hash):
        raise HTTPException(status_code=401, detail=SHARE_PASSWORD_ERROR)
