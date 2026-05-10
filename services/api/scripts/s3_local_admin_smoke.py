"""Run a local admin/operator smoke against the current web + API dev servers."""

from __future__ import annotations

import argparse
import json
import sys
from http.cookiejar import CookieJar
from typing import Any, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPCookieProcessor, Request, build_opener


def main() -> None:
    args = parse_args()
    opener = build_opener(HTTPCookieProcessor(CookieJar()))

    report: dict[str, Any] = {
        "apiBaseUrl": args.api_base_url.rstrip("/"),
        "webBaseUrl": args.web_base_url.rstrip("/"),
        "checks": {},
    }

    report["checks"]["apiHealth"] = fetch_json(opener, args.api_base_url, "/health")
    report["checks"]["apiAdminMe"] = fetch_json(opener, args.api_base_url, "/api/v1/admin/me")
    users_check = fetch_json(opener, args.api_base_url, "/api/v1/admin/operator/users?limit=3")
    report["checks"]["apiOperatorUsers"] = users_check

    users_payload = users_check.get("json") or {}
    first_user_id = first_operator_user_id(users_payload)
    if first_user_id:
        report["checks"]["apiOperatorUserDetail"] = fetch_json(
            opener,
            args.api_base_url,
            f"/api/v1/admin/operator/users/{first_user_id}",
        )

    report["checks"]["webAdminProxyMe"] = fetch_json(opener, args.web_base_url, "/api/admin-proxy/me")
    report["checks"]["webAdminProxyUsers"] = fetch_json(opener, args.web_base_url, "/api/admin-proxy/operator/users?limit=3")
    report["checks"]["webAuthSessionWithoutBypass"] = fetch_json(opener, args.web_base_url, "/api/auth/session")

    report["checks"]["webDevBypass"] = post_form(
        opener,
        args.web_base_url,
        "/api/auth/dev-bypass",
        {"next": "/admin"},
    )
    report["checks"]["webAuthSessionWithBypass"] = fetch_json(opener, args.web_base_url, "/api/auth/session")

    print(json.dumps(report, indent=2, sort_keys=True))

    if not is_smoke_successful(report):
        raise SystemExit(1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run local admin/operator smoke.")
    parser.add_argument("--api-base-url", default="http://127.0.0.1:8100")
    parser.add_argument("--web-base-url", default="http://127.0.0.1:3000")
    return parser.parse_args()


def fetch_json(opener: Any, base_url: str, path: str) -> dict[str, Any]:
    return request_json(opener, "GET", f"{base_url.rstrip('/')}{path}")


def post_form(opener: Any, base_url: str, path: str, params: dict[str, str]) -> dict[str, Any]:
    query = urlencode(params)
    return request_json(opener, "POST", f"{base_url.rstrip('/')}{path}?{query}")


def request_json(opener: Any, method: str, url: str) -> dict[str, Any]:
    request = Request(url, method=method)
    request.add_header("Accept", "application/json")
    try:
        with opener.open(request, timeout=10) as response:
            return build_result(response.status, response.read().decode("utf-8"), response.headers)
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return build_result(exc.code, body, exc.headers)
    except URLError as exc:
        return {"error": f"Failed to reach {url}: {exc.reason}", "ok": False, "status": 0}


def build_result(status: int, body: str, headers: Any) -> dict[str, Any]:
    result: dict[str, Any] = {
        "contentType": headers.get("Content-Type"),
        "ok": 200 <= status < 300,
        "status": status,
    }
    try:
        result["json"] = json.loads(body)
    except json.JSONDecodeError:
        result["text"] = body
    return result


def first_operator_user_id(payload: dict[str, Any]) -> Optional[str]:
    users = payload.get("users")
    if not isinstance(users, list) or not users:
        return None
    first = users[0]
    if not isinstance(first, dict):
        return None
    user_id = first.get("id")
    return user_id if isinstance(user_id, str) and user_id.strip() else None


def is_smoke_successful(report: dict[str, Any]) -> bool:
    checks = report["checks"]
    required_ok = [
        "apiHealth",
        "apiAdminMe",
        "apiOperatorUsers",
        "webAdminProxyMe",
        "webAdminProxyUsers",
    ]
    for key in required_ok:
        if not checks.get(key, {}).get("ok"):
            return False

    detail = checks.get("apiOperatorUserDetail")
    if detail and not detail.get("ok"):
        return False

    # Local dev-bypass may be intentionally disabled. When it is enabled,
    # the follow-up session check should succeed; when it is disabled, the
    # session route can still return 401 and the rest of the admin smoke is fine.
    bypass = checks.get("webDevBypass", {})
    session_with_bypass = checks.get("webAuthSessionWithBypass", {})
    if bypass.get("ok") and not session_with_bypass.get("ok"):
        return False
    return True


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
