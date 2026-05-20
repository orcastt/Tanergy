from __future__ import annotations

from fastapi import Request
from starlette.responses import Response

ANTI_CRAWL_HEADER_VALUE = "noindex, nofollow"
ASSET_FILE_PREFIX = "/api/v1/assets/files/"
PUBLIC_SHARE_PREFIX = "/api/v1/boards/share-links/"


def apply_security_headers(request: Request, response: Response) -> Response:
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if request.url.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")
        response.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
    if _is_asset_file_path(request.url.path):
        response.headers.setdefault("Cross-Origin-Resource-Policy", "same-site")
        response.headers.setdefault("X-Robots-Tag", ANTI_CRAWL_HEADER_VALUE)
    if _is_public_share_path(request.url.path):
        response.headers.setdefault("Cross-Origin-Resource-Policy", "same-origin")
        response.headers.setdefault("X-Robots-Tag", ANTI_CRAWL_HEADER_VALUE)
    return response


def _is_asset_file_path(path: str) -> bool:
    return path.startswith(ASSET_FILE_PREFIX)


def _is_public_share_path(path: str) -> bool:
    return path.startswith(PUBLIC_SHARE_PREFIX)
