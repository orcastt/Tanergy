import ipaddress
import socket
from dataclasses import dataclass
from typing import Any, Optional
from urllib.error import HTTPError
from urllib.parse import urljoin, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

from fastapi import HTTPException

from tangent_api.image_dimensions import get_image_dimensions
from tangent_api.storage.asset_store_common import (
    assert_asset_size,
    assert_image_content_matches_mime,
    assert_image_mime,
)

REMOTE_IMPORT_TIMEOUT_SECONDS = 8
REMOTE_IMPORT_CHUNK_BYTES = 1024 * 1024
REMOTE_IMPORT_MAX_REDIRECTS = 5
REMOTE_IMPORT_HEADERS = {
    "Accept": "image/png,image/jpeg,image/webp",
    "User-Agent": "TANGENT-Asset-Importer/1.0",
}
_REDIRECT_STATUS_CODES = {301, 302, 303, 307, 308}
_METADATA_IPS = {
    ipaddress.ip_address("169.254.169.254"),
    ipaddress.ip_address("100.100.100.200"),
    ipaddress.ip_address("fd00:ec2::254"),
}
_METADATA_HOSTNAMES = {"metadata", "metadata.google.internal"}


class _NoRemoteImportRedirect(HTTPRedirectHandler):
    def http_error_301(self, req, fp, code, msg, headers):
        raise HTTPError(req.full_url, code, msg, headers, fp)

    http_error_302 = http_error_303 = http_error_307 = http_error_308 = http_error_301


_REMOTE_IMPORT_OPENER = build_opener(_NoRemoteImportRedirect())


@dataclass(frozen=True)
class RemoteImageImport:
    content: bytes
    file_name: str
    height: int
    mime: str
    width: int


def fetch_remote_image(url: str) -> RemoteImageImport:
    current_url = url.strip()
    parsed = _parse_remote_url(current_url)
    redirect_count = 0
    try:
        while True:
            response = _open_remote_response(current_url)
            close_response = True
            try:
                status = _response_status(response)
                if status in _REDIRECT_STATUS_CODES:
                    redirect_count += 1
                    if redirect_count > REMOTE_IMPORT_MAX_REDIRECTS:
                        raise HTTPException(status_code=400, detail="Remote image URL redirected too many times.")
                    current_url = _redirect_target_url(current_url, response.headers.get("location"))
                    parsed = _parse_remote_url(current_url)
                    continue
                if status >= 300:
                    raise HTTPException(status_code=400, detail="Remote image fetch failed.")
                final_url = response.geturl()
                if final_url and final_url != current_url:
                    parsed = _parse_remote_url(final_url)
                    current_url = final_url
                close_response = False
                break
            finally:
                if close_response:
                    response.close()
        try:
            mime = _parse_content_type(response.headers.get("content-type"))
            _assert_content_length(response.headers.get("content-length"))
            content = _read_response_with_limit(response)
        finally:
            response.close()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Remote image fetch failed.") from exc
    assert_image_mime(mime)
    assert_asset_size(len(content))
    assert_image_content_matches_mime(content, mime)
    width, height = get_image_dimensions(content, mime)
    return RemoteImageImport(
        content=content,
        file_name=_remote_file_name(parsed.path, mime),
        height=height,
        mime=mime,
        width=width,
    )


def _parse_remote_url(url: str):
    if not url or _has_control_characters(url):
        raise HTTPException(status_code=400, detail="Remote image URL must use HTTP or HTTPS.")
    parsed = urlparse(url)
    scheme = parsed.scheme.lower()
    if scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Remote image URL must use HTTP or HTTPS.")
    if parsed.username or parsed.password:
        raise HTTPException(status_code=400, detail="Remote image URL user info is not allowed.")
    _assert_public_host(parsed.hostname)
    return parsed


def _assert_public_host(hostname: str) -> None:
    normalized = hostname.rstrip(".").lower()
    if normalized == "localhost" or normalized.endswith(".localhost") or normalized in _METADATA_HOSTNAMES:
        raise HTTPException(status_code=400, detail="Remote image URL host is not allowed.")
    try:
        addresses = socket.getaddrinfo(normalized, None)
    except socket.gaierror as exc:
        raise HTTPException(status_code=400, detail="Remote image URL host could not be resolved.") from exc
    for address in addresses:
        try:
            ip = ipaddress.ip_address(str(address[4][0]).split("%", 1)[0])
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Remote image URL host is not allowed.") from exc
        if ip in _METADATA_IPS or not ip.is_global:
            raise HTTPException(status_code=400, detail="Remote image URL host is not allowed.")


def _parse_content_type(value: Optional[str]) -> str:
    mime = (value or "").split(";")[0].strip().lower()
    if not mime:
        raise HTTPException(status_code=400, detail="Remote URL did not return an image.")
    return mime


def _assert_content_length(value: Optional[str]) -> None:
    if not value:
        return
    try:
        byte_size = int(value)
    except ValueError:
        return
    assert_asset_size(byte_size)


def _read_response_with_limit(response: Any) -> bytes:
    content = bytearray()
    total_bytes = 0
    while True:
        chunk = response.read(REMOTE_IMPORT_CHUNK_BYTES)
        if not chunk:
            break
        total_bytes += len(chunk)
        assert_asset_size(total_bytes)
        content.extend(chunk)
    return bytes(content)


def _open_remote_response(url: str) -> Any:
    request = Request(url, headers=REMOTE_IMPORT_HEADERS)
    try:
        return _REMOTE_IMPORT_OPENER.open(request, timeout=REMOTE_IMPORT_TIMEOUT_SECONDS)
    except HTTPError as exc:
        if exc.code in _REDIRECT_STATUS_CODES:
            return exc
        raise


def _response_status(response: Any) -> int:
    status = getattr(response, "status", None) or getattr(response, "code", None)
    if isinstance(status, int):
        return status
    return int(response.getcode())


def _redirect_target_url(current_url: str, location: Optional[str]) -> str:
    if not location:
        raise HTTPException(status_code=400, detail="Remote image URL returned an invalid redirect.")
    location = location.strip()
    if _has_control_characters(location):
        raise HTTPException(status_code=400, detail="Remote image URL returned an invalid redirect.")
    return urljoin(current_url, location)


def _has_control_characters(value: str) -> bool:
    return any(ord(char) < 32 or ord(char) == 127 for char in value)


def _remote_file_name(path: str, mime: str) -> str:
    name = path.rsplit("/", 1)[-1].strip()
    if name.lower().endswith((".png", ".jpg", ".jpeg", ".webp")) and _is_safe_file_name(name):
        return name[:80]
    return f"remote-image.{_extension_for_mime(mime)}"


def _is_safe_file_name(value: str) -> bool:
    return all(char.isalnum() or char in "._-" for char in value)


def _extension_for_mime(mime: str) -> str:
    if mime == "image/png":
        return "png"
    if mime == "image/webp":
        return "webp"
    return "jpg"
