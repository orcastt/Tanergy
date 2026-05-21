#!/usr/bin/env python3
from __future__ import annotations

import argparse
import http.client
import json
import re
import socket
import ssl
import sys
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urljoin, urlparse


STATIC_ASSET_PATTERN = re.compile(r'["\'](?P<path>/_next/static/[^"\']+)["\']')


def main() -> int:
    args = parse_args()
    checks = [
        check_tls_certificate("webTls", args.web_url, args.min_cert_days),
        check_tls_certificate("apiTls", args.api_url, args.min_cert_days),
        check_web_home(args.web_url, require_hsts=args.require_hsts),
        check_static_asset_cache(args.web_url, required=args.require_static_cache),
        check_api_health(args.api_url),
    ]
    if args.origin:
        checks.append(check_cors_preflight(args.api_url, args.origin))
    failures = [check for check in checks if not check["ok"] and not check.get("optional")]
    warnings = [check for check in checks if not check["ok"] and check.get("optional")]
    report = {"checks": checks, "ok": not failures, "warnings": warnings}
    if failures:
        report["failures"] = failures
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if not failures else 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify public deploy readiness for Web/API domains."
    )
    parser.add_argument("--web-url", required=True)
    parser.add_argument("--api-url", required=True)
    parser.add_argument("--origin", help="Expected Web origin for API CORS preflight.")
    parser.add_argument("--min-cert-days", default=21, type=int)
    parser.add_argument("--require-hsts", action="store_true")
    parser.add_argument("--require-static-cache", action="store_true")
    return parser.parse_args()


def check_tls_certificate(name: str, raw_url: str, min_days: int) -> dict[str, object]:
    parsed = urlparse(raw_url)
    if parsed.scheme != "https":
        return result(name, False, {"reason": "url_must_use_https", "url": redact_url(raw_url)})
    port = parsed.port or 443
    try:
        context = ssl.create_default_context()
        with socket.create_connection((parsed.hostname, port), timeout=10) as sock:
            with context.wrap_socket(sock, server_hostname=parsed.hostname) as tls_sock:
                certificate = tls_sock.getpeercert()
    except OSError as exc:
        return result(name, False, {"error": str(exc), "host": parsed.hostname})
    not_after = certificate.get("notAfter")
    if not not_after:
        return result(name, False, {"reason": "missing_not_after", "host": parsed.hostname})
    expires_at = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
    days_left = (expires_at - datetime.now(timezone.utc)).days
    return result(
        name,
        days_left >= min_days,
        {"daysLeft": days_left, "expiresAt": expires_at.isoformat(), "host": parsed.hostname},
    )


def check_web_home(web_url: str, *, require_hsts: bool) -> dict[str, object]:
    response = request("GET", web_url)
    headers = response["headers"]
    required_headers = {
        "content-security-policy": "present",
        "referrer-policy": "strict-origin-when-cross-origin",
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
    }
    missing = missing_headers(headers, required_headers)
    if require_hsts and "strict-transport-security" not in headers:
        missing.append("strict-transport-security")
    ok = response["status"] < 500 and not missing
    return result("webHome", ok, {"missingHeaders": missing, "status": response["status"]})


def check_static_asset_cache(web_url: str, *, required: bool) -> dict[str, object]:
    response = request("GET", web_url)
    html = response.get("body", "")
    match = STATIC_ASSET_PATTERN.search(html)
    if not match:
        return result(
            "staticAssetCache",
            not required,
            "no-next-static-asset-found",
            optional=not required,
        )
    asset_url = urljoin(web_url, match.group("path"))
    asset_response = request("GET", asset_url)
    cache_control = asset_response["headers"].get("cache-control", "")
    ok = (
        asset_response["status"] == 200
        and "immutable" in cache_control
        and "max-age" in cache_control
    )
    return result(
        "staticAssetCache",
        ok or not required,
        {"cacheControl": cache_control, "status": asset_response["status"]},
        optional=not required,
    )


def check_api_health(api_url: str) -> dict[str, object]:
    health_url = urljoin(api_url.rstrip("/") + "/", "health")
    response = request("GET", health_url)
    headers = response["headers"]
    missing = missing_headers(
        headers,
        {
            "cache-control": "no-store",
            "referrer-policy": "strict-origin-when-cross-origin",
            "x-content-type-options": "nosniff",
            "x-frame-options": "DENY",
        },
    )
    ok = response["status"] == 200 and '"status"' in response.get("body", "") and not missing
    return result("apiHealth", ok, {"missingHeaders": missing, "status": response["status"]})


def check_cors_preflight(api_url: str, origin: str) -> dict[str, object]:
    path = "/api/v1/assets/from-data-url"
    response = request(
        "OPTIONS",
        urljoin(api_url.rstrip("/") + "/", path.lstrip("/")),
        headers={
            "Access-Control-Request-Method": "POST",
            "Origin": origin,
        },
    )
    allowed_origin = response["headers"].get("access-control-allow-origin")
    ok = response["status"] < 400 and allowed_origin == origin
    return result(
        "corsPreflight",
        ok,
        {"allowOrigin": allowed_origin, "status": response["status"]},
    )


def request(
    method: str,
    raw_url: str,
    headers: Optional[dict[str, str]] = None,
) -> dict[str, object]:
    parsed = urlparse(raw_url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return {"body": "", "error": "invalid_url", "headers": {}, "status": 0}
    connection_cls = (
        http.client.HTTPSConnection
        if parsed.scheme == "https"
        else http.client.HTTPConnection
    )
    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"
    connection = connection_cls(parsed.hostname, parsed.port, timeout=15)
    try:
        connection.request(method, path, headers=headers or {})
        response = connection.getresponse()
        body = response.read(512_000).decode("utf-8", errors="replace")
        return {
            "body": body,
            "headers": {key.lower(): value for key, value in response.getheaders()},
            "status": response.status,
        }
    except OSError as exc:
        return {"body": "", "error": str(exc), "headers": {}, "status": 0}
    finally:
        connection.close()


def missing_headers(headers: dict[str, str], required: dict[str, str]) -> list[str]:
    missing = []
    for name, expected in required.items():
        value = headers.get(name)
        if not value or (expected != "present" and value != expected):
            missing.append(name)
    return missing


def redact_url(raw_url: str) -> str:
    parsed = urlparse(raw_url)
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path or '/'}"


def result(name: str, ok: bool, status: object, *, optional: bool = False) -> dict[str, object]:
    return {"name": name, "ok": ok, "optional": optional, "status": status}


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
