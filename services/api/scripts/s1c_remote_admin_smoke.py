"""Run a real-token auth/admin smoke against a deployed FastAPI instance."""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def main() -> None:
    args = parse_args()
    token = args.bearer_token or os.getenv("S1C_SMOKE_BEARER_TOKEN")
    if not token:
        raise SystemExit("Provide --bearer-token or set S1C_SMOKE_BEARER_TOKEN.")

    origin = args.origin or os.getenv("S1C_SMOKE_ORIGIN")
    checks = {
        "authSession": fetch_result(args.base_url, "/api/v1/auth/session", token, origin),
        "adminMe": fetch_result(args.base_url, "/api/v1/admin/me", token, origin),
        "operatorUsers": fetch_result(args.base_url, "/api/v1/admin/operator/users?limit=3", token, origin),
        "financeSummary": fetch_result(args.base_url, "/api/v1/admin/finance/summary", token, origin),
        "routeMetrics": fetch_result(args.base_url, "/api/v1/admin/ai/route-metrics?limit=5", token, origin),
    }

    report = {
        "baseUrl": args.base_url.rstrip("/"),
        "checks": checks,
        "originSent": origin,
    }
    print(json.dumps(report, indent=2, sort_keys=True))

    if not is_smoke_successful(checks):
        raise SystemExit(1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run remote auth/admin smoke with a real Clerk bearer token.")
    parser.add_argument("--base-url", default=os.getenv("S1C_SMOKE_BASE_URL", "http://127.0.0.1:8100"))
    parser.add_argument("--bearer-token", default=None, help="Real Clerk session token.")
    parser.add_argument("--origin", default=None, help="Optional Origin header to inspect CORS behavior.")
    return parser.parse_args()


def fetch_result(base_url: str, path: str, token: str, origin: str | None) -> dict[str, Any]:
    request = Request(f"{base_url.rstrip('/')}{path}")
    request.add_header("Authorization", f"Bearer {token}")
    request.add_header("Accept", "application/json")
    if origin:
        request.add_header("Origin", origin)
    try:
        with urlopen(request, timeout=10) as response:
            return build_result(response.status, response.read().decode("utf-8"), response.headers)
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return build_result(exc.code, body, exc.headers)
    except URLError as exc:
        return {"error": f"Failed to reach {path}: {exc.reason}", "ok": False, "status": 0}


def build_result(status: int, body: str, headers: Any) -> dict[str, Any]:
    result: dict[str, Any] = {
        "allowCredentials": headers.get("Access-Control-Allow-Credentials"),
        "allowOrigin": headers.get("Access-Control-Allow-Origin"),
        "contentType": headers.get("Content-Type"),
        "ok": 200 <= status < 300,
        "status": status,
    }
    try:
        result["json"] = json.loads(body)
    except json.JSONDecodeError:
        result["text"] = body
    return result


def is_smoke_successful(checks: dict[str, dict[str, Any]]) -> bool:
    required = ["authSession", "adminMe", "operatorUsers", "financeSummary", "routeMetrics"]
    return all(checks.get(key, {}).get("ok") for key in required)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
