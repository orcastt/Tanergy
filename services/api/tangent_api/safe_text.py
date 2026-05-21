from __future__ import annotations

from fastapi import HTTPException

FORBIDDEN_LABEL_CHARS = frozenset("<>\"'`{}[]\\|;")
FORBIDDEN_LABEL_TOKENS = ("--", "/*", "*/")


def normalize_safe_label(
    value: str,
    *,
    field_name: str,
    max_length: int = 80,
    status_code: int = 400,
) -> str:
    normalized = " ".join(value.strip().split())
    if not normalized:
        raise HTTPException(status_code=status_code, detail=f"{field_name} is required.")
    _assert_safe_text(normalized, field_name, status_code)
    if len(normalized) > max_length:
        raise HTTPException(status_code=status_code, detail=f"{field_name} must be {max_length} characters or fewer.")
    return normalized


def normalize_optional_safe_text(
    value: str | None,
    *,
    field_name: str,
    max_length: int,
    status_code: int = 400,
) -> str | None:
    if not value:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    _assert_safe_text(normalized, field_name, status_code)
    return normalized[:max_length]


def _assert_safe_text(value: str, field_name: str, status_code: int) -> None:
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise HTTPException(status_code=status_code, detail=f"{field_name} contains unsupported characters.")
    if any(char in FORBIDDEN_LABEL_CHARS for char in value):
        raise HTTPException(status_code=status_code, detail=f"{field_name} contains unsupported characters.")
    if any(token in value for token in FORBIDDEN_LABEL_TOKENS):
        raise HTTPException(status_code=status_code, detail=f"{field_name} contains unsupported characters.")
