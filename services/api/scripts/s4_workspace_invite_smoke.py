"""Run Team/Group invite acceptance smoke with board continuation checks."""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from typing import Any
from uuid import uuid4
from urllib.parse import quote

import httpx


@dataclass(frozen=True)
class Identity:
    bearer_token: str | None
    user_id: str | None
    workspace_id: str
    workspace_kind: str
    workspace_role: str


def main() -> None:
    args = parse_args()
    report: dict[str, Any] = {
        "baseUrl": args.base_url.rstrip("/"),
        "checks": {},
        "matrix": {
            "group": {"workspaceId": args.group_workspace_id},
            "team": {"workspaceId": args.team_workspace_id},
        },
    }
    with httpx.Client(base_url=args.base_url.rstrip("/"), timeout=20) as client:
        report["checks"]["health"] = request_json(client, "GET", "/health", headers=build_headers(args.origin))
        flows = {
            "team": run_workspace_invite_flow(
                client,
                flow_key="team",
                invitee_context=Identity(
                    bearer_token=args.team_invitee_bearer_token,
                    user_id=args.team_invitee_user_id,
                    workspace_id=args.team_invitee_home_workspace_id,
                    workspace_kind=args.team_invitee_home_workspace_kind,
                    workspace_role=args.team_invitee_home_workspace_role,
                ),
                invitee_workspace=Identity(
                    bearer_token=args.team_invitee_bearer_token,
                    user_id=args.team_invitee_user_id,
                    workspace_id=args.team_workspace_id,
                    workspace_kind="team_workspace",
                    workspace_role=args.team_role,
                ),
                kind="team_workspace",
                origin=args.origin,
                owner=Identity(
                    bearer_token=args.team_owner_bearer_token,
                    user_id=args.team_owner_user_id,
                    workspace_id=args.team_workspace_id,
                    workspace_kind="team_workspace",
                    workspace_role="owner",
                ),
                role=args.team_role,
            ),
            "group": run_workspace_invite_flow(
                client,
                flow_key="group",
                invitee_context=Identity(
                    bearer_token=args.group_invitee_bearer_token,
                    user_id=args.group_invitee_user_id,
                    workspace_id=args.group_invitee_home_workspace_id,
                    workspace_kind=args.group_invitee_home_workspace_kind,
                    workspace_role=args.group_invitee_home_workspace_role,
                ),
                invitee_workspace=Identity(
                    bearer_token=args.group_invitee_bearer_token,
                    user_id=args.group_invitee_user_id,
                    workspace_id=args.group_workspace_id,
                    workspace_kind="group_workspace",
                    workspace_role=args.group_role,
                ),
                kind="group_workspace",
                origin=args.origin,
                owner=Identity(
                    bearer_token=args.group_owner_bearer_token,
                    user_id=args.group_owner_user_id,
                    workspace_id=args.group_workspace_id,
                    workspace_kind="group_workspace",
                    workspace_role="owner",
                ),
                role=args.group_role,
            ),
        }
        report["checks"].update(flows)

    print(json.dumps(report, indent=2, sort_keys=True))
    if not is_report_ok(report):
        raise SystemExit(1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run workspace invite acceptance smoke.")
    parser.add_argument("--base-url", default=os.getenv("S4_SMOKE_BASE_URL", "http://127.0.0.1:8100"))
    parser.add_argument("--origin", default=os.getenv("S4_SMOKE_ORIGIN"))

    parser.add_argument("--team-workspace-id", default=os.getenv("S4_TEAM_WORKSPACE_ID", "workspace_team"))
    parser.add_argument("--team-role", default=os.getenv("S4_TEAM_INVITE_ROLE", "editor"))
    parser.add_argument("--team-owner-user-id", default=os.getenv("S4_TEAM_OWNER_USER_ID", "user_team_owner"))
    parser.add_argument("--team-owner-bearer-token", default=os.getenv("S4_TEAM_OWNER_BEARER_TOKEN"))
    parser.add_argument("--team-invitee-user-id", default=os.getenv("S4_TEAM_INVITEE_USER_ID", "user_team_invitee"))
    parser.add_argument("--team-invitee-bearer-token", default=os.getenv("S4_TEAM_INVITEE_BEARER_TOKEN"))
    parser.add_argument("--team-invitee-home-workspace-id", default=os.getenv("S4_TEAM_INVITEE_HOME_WORKSPACE_ID", "workspace_team_invitee_home"))
    parser.add_argument("--team-invitee-home-workspace-kind", default=os.getenv("S4_TEAM_INVITEE_HOME_WORKSPACE_KIND", "solo_workspace"))
    parser.add_argument("--team-invitee-home-workspace-role", default=os.getenv("S4_TEAM_INVITEE_HOME_WORKSPACE_ROLE", "owner"))

    parser.add_argument("--group-workspace-id", default=os.getenv("S4_GROUP_WORKSPACE_ID", "workspace_group"))
    parser.add_argument("--group-role", default=os.getenv("S4_GROUP_INVITE_ROLE", "editor"))
    parser.add_argument("--group-owner-user-id", default=os.getenv("S4_GROUP_OWNER_USER_ID", "user_group_owner"))
    parser.add_argument("--group-owner-bearer-token", default=os.getenv("S4_GROUP_OWNER_BEARER_TOKEN"))
    parser.add_argument("--group-invitee-user-id", default=os.getenv("S4_GROUP_INVITEE_USER_ID", "user_group_invitee"))
    parser.add_argument("--group-invitee-bearer-token", default=os.getenv("S4_GROUP_INVITEE_BEARER_TOKEN"))
    parser.add_argument("--group-invitee-home-workspace-id", default=os.getenv("S4_GROUP_INVITEE_HOME_WORKSPACE_ID", "workspace_group_invitee_home"))
    parser.add_argument("--group-invitee-home-workspace-kind", default=os.getenv("S4_GROUP_INVITEE_HOME_WORKSPACE_KIND", "solo_workspace"))
    parser.add_argument("--group-invitee-home-workspace-role", default=os.getenv("S4_GROUP_INVITEE_HOME_WORKSPACE_ROLE", "owner"))
    return parser.parse_args()


def run_workspace_invite_flow(
    client: httpx.Client,
    *,
    flow_key: str,
    invitee_context: Identity,
    invitee_workspace: Identity,
    kind: str,
    origin: str | None,
    owner: Identity,
    role: str,
) -> dict[str, Any]:
    board_id = f"s4-{flow_key}-invite-{uuid4().hex[:8]}"
    board_title = f"{flow_key.title()} Invite Smoke"
    report: dict[str, Any] = {
        "boardId": board_id,
        "boardRouteHref": f"/boards/{board_id}?workspace={owner.workspace_id}",
        "boardTitle": board_title,
        "kind": kind,
        "role": role,
    }
    try:
        report["createBoard"] = request_json(
            client,
            "POST",
            "/api/v1/boards",
            body={
                "boardId": board_id,
                "document": {"assets": [], "shapes": [{"id": f"shape_{board_id}"}]},
                "title": board_title,
            },
            headers=build_headers(origin, owner),
        )
        require_ok(report["createBoard"], f"{flow_key}: board create failed")

        report["createInvite"] = request_json(
            client,
            "POST",
            "/api/v1/workspaces/current/invitations",
            body={
                "expiresInDays": 7,
                "metadata": {
                    "boardId": board_id,
                    "boardTitle": board_title,
                    "source": "s4_workspace_invite_smoke",
                },
                "role": role,
            },
            headers=build_headers(origin, owner),
        )
        require_ok(report["createInvite"], f"{flow_key}: invite create failed")
        invite_result = report["createInvite"].get("json", {}).get("result", {})
        token = invite_result.get("token")
        if not isinstance(token, str) or not token:
            raise AssertionError(f"{flow_key}: invite token missing")

        report["acceptInvite"] = request_json(
            client,
            "POST",
            f"/api/v1/workspaces/invitations/{quote(token)}/accept",
            headers=build_headers(origin, invitee_context),
        )
        require_ok(report["acceptInvite"], f"{flow_key}: invite accept failed")
        accepted_result = report["acceptInvite"].get("json", {}).get("result", {})
        accepted_metadata = accepted_result.get("invitation", {}).get("metadata", {})
        if accepted_metadata.get("boardId") != board_id:
            raise AssertionError(f"{flow_key}: accepted invite lost boardId metadata")
        if accepted_metadata.get("boardTitle") != board_title:
            raise AssertionError(f"{flow_key}: accepted invite lost boardTitle metadata")
        if accepted_result.get("workspaceId") != owner.workspace_id:
            raise AssertionError(f"{flow_key}: accepted invite returned wrong workspace id")

        report["inviteeCollaboration"] = request_json(
            client,
            "GET",
            f"/api/v1/boards/{quote(board_id)}/collaboration",
            headers=build_headers(origin, invitee_workspace),
        )
        require_ok(report["inviteeCollaboration"], f"{flow_key}: collaboration open failed")
        collaboration_payload = report["inviteeCollaboration"].get("json", {})
        if collaboration_payload.get("workspaceId") != owner.workspace_id:
            raise AssertionError(f"{flow_key}: collaboration workspace mismatch")
        if not collaboration_payload.get("roomKey"):
            raise AssertionError(f"{flow_key}: collaboration roomKey missing")

        report["ok"] = True
    except Exception as exc:  # noqa: BLE001 - smoke script should capture all failures
        report["error"] = str(exc)
        report["ok"] = False
    return report


def build_headers(origin: str | None, identity: Identity | None = None) -> dict[str, str]:
    headers = {"Accept": "application/json"}
    if origin:
        headers["Origin"] = origin
    if identity is None:
        return headers
    if identity.bearer_token:
        headers["Authorization"] = f"Bearer {identity.bearer_token}"
    elif identity.user_id:
        headers["x-tangent-user-id"] = identity.user_id
    headers["x-tangent-workspace-id"] = identity.workspace_id
    headers["x-tangent-workspace-kind"] = identity.workspace_kind
    headers["x-tangent-workspace-role"] = identity.workspace_role
    return headers


def request_json(
    client: httpx.Client,
    method: str,
    path: str,
    *,
    body: dict[str, Any] | None = None,
    headers: dict[str, str],
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


def require_ok(result: dict[str, Any], message: str) -> None:
    if result.get("ok"):
        return
    payload = result.get("json")
    if isinstance(payload, dict) and payload.get("detail"):
        raise AssertionError(f"{message}: {payload['detail']}")
    if result.get("error"):
        raise AssertionError(f"{message}: {result['error']}")
    raise AssertionError(f"{message}: status={result.get('status')}")


def is_report_ok(report: dict[str, Any]) -> bool:
    checks = report.get("checks", {})
    if not isinstance(checks, dict):
        return False
    for value in checks.values():
        if not isinstance(value, dict):
            return False
        if value.get("ok") is False:
            return False
    return checks.get("health", {}).get("ok") is True


if __name__ == "__main__":
    main()
