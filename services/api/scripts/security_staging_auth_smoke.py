#!/usr/bin/env python3
"""Run staging auth boundary checks with real bearer tokens.

This smoke intentionally sends only bearer + workspace id for normal requests.
It also sends spoofed workspace role/plan headers once to verify the backend
does not trust browser-provided role context.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any

import httpx


def main() -> int:
    args = parse_args()
    token = args.bearer_token or os.getenv("SECURITY_SMOKE_BEARER_TOKEN")
    workspace_id = args.workspace_id or os.getenv("SECURITY_SMOKE_WORKSPACE_ID")
    if not token:
        raise SystemExit("Provide --bearer-token or SECURITY_SMOKE_BEARER_TOKEN.")
    if not workspace_id:
        raise SystemExit("Provide --workspace-id or SECURITY_SMOKE_WORKSPACE_ID.")

    with httpx.Client(base_url=args.base_url.rstrip("/"), timeout=20) as client:
        checks = {
            "health": request_json(client, "GET", "/health"),
            "sessionMinimalHeaders": request_json(
                client,
                "GET",
                "/api/v1/auth/session",
                headers=auth_headers(token, workspace_id, args.origin),
            ),
            "sessionSpoofedRoleHeaders": request_json(
                client,
                "GET",
                "/api/v1/auth/session",
                headers={
                    **auth_headers(token, workspace_id, args.origin),
                    "x-tangent-plan-key": "enterprise_admin_spoof",
                    "x-tangent-workspace-kind": "team_workspace",
                    "x-tangent-workspace-role": "owner",
                },
            ),
            "cookieWriteBadOrigin": request_json(
                client,
                "POST",
                "/api/v1/boards",
                body={"boardId": "security-origin-smoke", "document": {"assets": [], "shapes": []}},
                headers={
                    "Cookie": "__session=security-smoke-fake",
                    "Origin": "https://evil.security-smoke.invalid",
                },
            ),
        }

    report = {
        "baseUrl": args.base_url.rstrip("/"),
        "checks": checks,
        "ok": checks_are_ok(checks),
    }
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report["ok"] else 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run staging auth/security smoke with a real bearer token.")
    parser.add_argument("--base-url", default=os.getenv("SECURITY_SMOKE_BASE_URL", "http://127.0.0.1:8100"))
    parser.add_argument("--bearer-token", default=None)
    parser.add_argument("--origin", default=os.getenv("SECURITY_SMOKE_ORIGIN"))
    parser.add_argument("--workspace-id", default=None)
    return parser.parse_args()


def auth_headers(token: str, workspace_id: str, origin: str | None = None) -> dict[str, str]:
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {token}",
        "x-tangent-workspace-id": workspace_id,
    }
    if origin:
        headers["Origin"] = origin
    return headers


def request_json(
    client: httpx.Client,
    method: str,
    path: str,
    *,
    body: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    try:
        response = client.request(method, path, headers=headers, json=body)
    except httpx.HTTPError as exc:
        return {"error": str(exc), "ok": False, "status": 0}
    result: dict[str, Any] = {
        "contentType": response.headers.get("content-type"),
        "ok": response.is_success,
        "status": response.status_code,
    }
    try:
        result["json"] = response.json()
    except json.JSONDecodeError:
        result["text"] = response.text
    return result


def checks_are_ok(checks: dict[str, dict[str, Any]]) -> bool:
    if not checks["health"].get("ok"):
        return False
    minimal = checks["sessionMinimalHeaders"]
    spoofed = checks["sessionSpoofedRoleHeaders"]
    if not minimal.get("ok") or not spoofed.get("ok"):
        return False
    if selected_workspace_role(minimal) != selected_workspace_role(spoofed):
        return False
    bad_origin = checks["cookieWriteBadOrigin"]
    return bad_origin.get("status") == 403


def selected_workspace_role(result: dict[str, Any]) -> str | None:
    payload = result.get("json")
    if not isinstance(payload, dict):
        return None
    session = payload.get("session") or payload
    if not isinstance(session, dict):
        return None
    active_workspace = session.get("activeWorkspace")
    if not isinstance(active_workspace, dict):
        return None
    role = active_workspace.get("role")
    return role if isinstance(role, str) else None


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
