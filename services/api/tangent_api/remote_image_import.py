import ipaddress
import socket
from dataclasses import dataclass
from typing import Any, Optional
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from fastapi import HTTPException

from tangent_api.image_dimensions import get_image_dimensions
from tangent_api.storage.asset_store_common import assert_asset_size, assert_image_mime

REMOTE_IMPORT_TIMEOUT_SECONDS = 8
REMOTE_IMPORT_CHUNK_BYTES = 1024 * 1024


@dataclass(frozen=True)
class RemoteImageImport:
    content: bytes
    file_name: str
    height: int
    mime: str
    width: int


def fetch_remote_image(url: str) -> RemoteImageImport:
    parsed = _parse_remote_url(url)
    request = Request(
        url,
        headers={"Accept": "image/png,image/jpeg,image/webp", "User-Agent": "TANGENT-Asset-Importer/1.0"},
    )
    try:
        with urlopen(request, timeout=REMOTE_IMPORT_TIMEOUT_SECONDS) as response:
            mime = _parse_content_type(response.headers.get("content-type"))
            _assert_content_length(response.headers.get("content-length"))
            content = _read_response_with_limit(response)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Remote image fetch failed.") from exc
    assert_image_mime(mime)
    assert_asset_size(len(content))
    width, height = get_image_dimensions(content, mime)
    return RemoteImageImport(
        content=content,
        file_name=_remote_file_name(parsed.path, mime),
        height=height,
        mime=mime,
        width=width,
    )


def _parse_remote_url(url: str):
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Remote image URL must use HTTP or HTTPS.")
    _assert_public_host(parsed.hostname)
    return parsed


def _assert_public_host(hostname: str) -> None:
    if hostname.lower() == "localhost" or hostname.lower().endswith(".localhost"):
        raise HTTPException(status_code=400, detail="Remote image URL host is not allowed.")
    try:
        addresses = socket.getaddrinfo(hostname, None)
    except socket.gaierror as exc:
        raise HTTPException(status_code=400, detail="Remote image URL host could not be resolved.") from exc
    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
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
    chunks: list[bytes] = []
    total_bytes = 0
    while True:
        chunk = response.read(REMOTE_IMPORT_CHUNK_BYTES)
        if not chunk:
            break
        total_bytes += len(chunk)
        assert_asset_size(total_bytes)
        chunks.append(chunk)
    return b"".join(chunks)


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
