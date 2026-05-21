import json
import re
from typing import Any, Optional
from urllib.parse import urlsplit

from tangent_api.board_konva_guard import audit_konva_board_document_schema
from tangent_api.schemas import BoardDocumentGuardIssue, BoardDocumentGuardResult

DEFAULT_MAX_BASE64_STRING_LENGTH = 2_048
DEFAULT_MAX_DOCUMENT_BYTES = 2_000_000
UNSAFE_URL_PREFIXES = ("blob:", "data:", "file:", "javascript:", "vbscript:")
BOARD_URL_FIELD_NAMES = {
    "imageUrl",
    "originalUrl",
    "sourceUrl",
    "thumbnail1024Url",
    "thumbnail256Url",
    "thumbnail512Url",
    "thumbnailUrl",
    "url",
}
BASE64_RE = re.compile(r"^[A-Za-z0-9+/]+={0,2}$")
CONTROL_AND_WHITESPACE_RE = re.compile(r"[\u0000-\u001f\u007f\s]")


def audit_board_document(document: Any) -> BoardDocumentGuardResult:
    issues: list[BoardDocumentGuardIssue] = []
    json_payload = _safe_json(document, issues)
    byte_size = len(json_payload.encode("utf-8")) if json_payload else 0

    if json_payload and byte_size > DEFAULT_MAX_DOCUMENT_BYTES:
        issues.append(
            BoardDocumentGuardIssue(
                blocking=True,
                code="document-too-large",
                message=(
                    f"Board document is {byte_size} bytes; split heavy data into Asset / "
                    "AiRun records before saving."
                ),
                path="document",
            )
        )

    _walk_document(document, [], issues)
    if is_legacy_tldraw_board_document(document):
        issues.append(
            BoardDocumentGuardIssue(
                blocking=True,
                code="legacy-tldraw-document",
                message="Legacy tldraw board documents are no longer supported in the Konva-only app path.",
                path="document",
            )
        )
    issues.extend(audit_konva_board_document_schema(document))
    return BoardDocumentGuardResult(byteSize=byte_size, issues=issues, ok=_is_ok(issues))


def _safe_json(document: Any, issues: list[BoardDocumentGuardIssue]) -> str:
    try:
        return json.dumps(document, separators=(",", ":"), ensure_ascii=False)
    except (TypeError, ValueError):
        issues.append(
            BoardDocumentGuardIssue(
                blocking=True,
                code="document-not-json",
                message="Board document must be JSON serializable before saving.",
                path="document",
            )
        )
        return ""


def is_legacy_tldraw_board_document(document: Any) -> bool:
    if not isinstance(document, dict):
        return False
    return (
        document.get("version") == 1
        and isinstance(document.get("shapes"), list)
        and isinstance(document.get("runtimeEdges"), list)
        and isinstance(document.get("camera"), dict)
    )


def _walk_document(value: Any, path: list[str], issues: list[BoardDocumentGuardIssue]) -> None:
    if isinstance(value, str):
        _audit_string(value, path, issues)
        return

    if isinstance(value, list):
        for index, item in enumerate(value):
            _walk_document(item, [*path, str(index)], issues)
        return

    if isinstance(value, dict):
        for key, item in value.items():
            if item is not None:
                _walk_document(item, [*path, str(key)], issues)


def _audit_string(value: str, path: list[str], issues: list[BoardDocumentGuardIssue]) -> None:
    trimmed = value.strip()
    unsafe_prefix = _get_unsafe_url_prefix(trimmed)
    if unsafe_prefix:
        issues.append(
            BoardDocumentGuardIssue(
                blocking=True,
                code="runtime-url",
                message=(
                    f"{_format_path(path)} contains an unsafe {unsafe_prefix} URL; "
                    "upload it as an Asset before saving."
                ),
                path=_format_path(path),
            )
        )
        return

    if _is_board_url_field(path) and not _is_allowed_board_url(trimmed):
        issues.append(
            BoardDocumentGuardIssue(
                blocking=True,
                code="runtime-url",
                message=(
                    f"{_format_path(path)} contains an unsupported URL; "
                    "use http(s) or an uploaded Asset URL before saving."
                ),
                path=_format_path(path),
            )
        )
        return

    if _is_likely_large_base64(trimmed):
        issues.append(
            BoardDocumentGuardIssue(
                blocking=True,
                code="large-base64-string",
                message=(
                    f"{_format_path(path)} looks like a large base64 payload; "
                    "store binary data in Asset storage instead."
                ),
                path=_format_path(path),
            )
        )


def _get_unsafe_url_prefix(value: str) -> Optional[str]:
    compact_prefix = CONTROL_AND_WHITESPACE_RE.sub("", value[:32]).lower()
    for prefix in UNSAFE_URL_PREFIXES:
        if compact_prefix.startswith(prefix):
            return prefix
    return None


def _is_board_url_field(path: list[str]) -> bool:
    if not path:
        return False
    return path[-1] in BOARD_URL_FIELD_NAMES


def _is_allowed_board_url(value: str) -> bool:
    if not value:
        return True
    if value.startswith("/"):
        return not value.startswith("//")
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"}:
        return False
    return bool(parsed.netloc)


def _is_likely_large_base64(value: str) -> bool:
    if len(value) < DEFAULT_MAX_BASE64_STRING_LENGTH:
        return False
    if any(character.isspace() for character in value):
        return False
    return bool(BASE64_RE.match(value)) and len(value) % 4 == 0


def _format_path(path: list[str]) -> str:
    return ".".join(path) if path else "document"


def _is_ok(issues: list[BoardDocumentGuardIssue]) -> bool:
    return all(not issue.blocking for issue in issues)
