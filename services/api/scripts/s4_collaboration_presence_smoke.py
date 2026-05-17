"""Run Team/Group invite plus collaboration-presence smoke against FastAPI."""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote
from uuid import uuid4

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
    }
    with httpx.Client(base_url=args.base_url.rstrip("/"), timeout=20) as client:
        report["checks"]["health"] = request_json(client, "GET", "/health", headers=build_headers(args.origin))
        report["checks"]["team"] = run_workspace_flow(
            args,
            client,
            flow_key="team",
            invitee_context=Identity(args.team_invitee_bearer_token, args.team_invitee_user_id, args.team_invitee_home_workspace_id, args.team_invitee_home_workspace_kind, args.team_invitee_home_workspace_role),
            invitee_workspace=Identity(args.team_invitee_bearer_token, args.team_invitee_user_id, args.team_workspace_id, "team_workspace", args.team_role),
            owner=Identity(args.team_owner_bearer_token, args.team_owner_user_id, args.team_workspace_id, "team_workspace", "owner"),
            role=args.team_role,
        )
        report["checks"]["group"] = run_workspace_flow(
            args,
            client,
            flow_key="group",
            invitee_context=Identity(args.group_invitee_bearer_token, args.group_invitee_user_id, args.group_invitee_home_workspace_id, args.group_invitee_home_workspace_kind, args.group_invitee_home_workspace_role),
            invitee_workspace=Identity(args.group_invitee_bearer_token, args.group_invitee_user_id, args.group_workspace_id, "group_workspace", args.group_role),
            owner=Identity(args.group_owner_bearer_token, args.group_owner_user_id, args.group_workspace_id, "group_workspace", "owner"),
            role=args.group_role,
        )
    print(json.dumps(report, indent=2, sort_keys=True))
    if not is_report_ok(report):
        raise SystemExit(1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run collaboration presence smoke.")
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


def run_workspace_flow(
    args: argparse.Namespace,
    client: httpx.Client,
    *,
    flow_key: str,
    invitee_context: Identity,
    invitee_workspace: Identity,
    owner: Identity,
    role: str,
) -> dict[str, Any]:
    board_id = f"s4-presence-{flow_key}-{uuid4().hex[:8]}"
    board_title = f"{flow_key.title()} Presence Smoke"
    report: dict[str, Any] = {
      "boardId": board_id,
      "boardTitle": board_title,
      "workspaceId": owner.workspace_id,
    }
    try:
        create_board = request_json(
            client,
            "POST",
            "/api/v1/boards",
            headers=build_headers(args.origin, owner),
            body={"boardId": board_id, "document": {"assets": [], "shapes": [{"id": "shape_owner"}, {"id": "shape_guest"}]}, "title": board_title},
        )
        require_ok(create_board, f"{flow_key}: board create failed")
        report["createBoard"] = create_board

        create_invite = request_json(
            client,
            "POST",
            "/api/v1/workspaces/current/invitations",
            headers=build_headers(args.origin, owner),
            body={"expiresInDays": 7, "metadata": {"boardId": board_id, "boardTitle": board_title, "source": "s4_collaboration_presence_smoke"}, "role": role},
        )
        require_ok(create_invite, f"{flow_key}: invite create failed")
        report["createInvite"] = create_invite
        token = create_invite.get("json", {}).get("result", {}).get("token")
        if not isinstance(token, str) or not token:
            raise AssertionError(f"{flow_key}: invite token missing")

        accept_invite = request_json(
            client,
            "POST",
            f"/api/v1/workspaces/invitations/{quote(token)}/accept",
            headers=build_headers(args.origin, invitee_context),
        )
        require_ok(accept_invite, f"{flow_key}: invite accept failed")
        report["acceptInvite"] = accept_invite

        owner_claim = claim_presence(client, board_id, owner, args.origin, make_presence("page_owner", "shape_owner", "edge_owner", 32, 48))
        invitee_claim = claim_presence(client, board_id, invitee_workspace, args.origin, make_presence("page_guest", "shape_guest", "edge_guest", 144, 188))
        report["ownerClaim"] = owner_claim
        report["inviteeClaim"] = invitee_claim

        owner_session_id = owner_claim.get("json", {}).get("selfSession", {}).get("id")
        invitee_session_id = invitee_claim.get("json", {}).get("selfSession", {}).get("id")
        if not isinstance(owner_session_id, str) or not owner_session_id:
            raise AssertionError(f"{flow_key}: owner session id missing")
        if not isinstance(invitee_session_id, str) or not invitee_session_id:
            raise AssertionError(f"{flow_key}: invitee session id missing")

        owner_list = request_json(
            client,
            "GET",
            f"/api/v1/boards/{quote(board_id)}/collaboration",
            headers=build_headers(args.origin, owner),
        )
        require_ok(owner_list, f"{flow_key}: owner collaboration list failed")
        report["ownerList"] = owner_list
        assert_presence_roundtrip(owner_list, owner.workspace_id)

        invitee_list = request_json(
            client,
            "GET",
            f"/api/v1/boards/{quote(board_id)}/collaboration",
            headers=build_headers(args.origin, invitee_workspace),
        )
        require_ok(invitee_list, f"{flow_key}: invitee collaboration list failed")
        report["inviteeList"] = invitee_list
        assert_presence_roundtrip(invitee_list, owner.workspace_id)

        owner_release = request_json(
            client,
            "DELETE",
            f"/api/v1/boards/{quote(board_id)}/collaboration/sessions/{quote(owner_session_id)}",
            headers=build_headers(args.origin, owner),
        )
        require_ok(owner_release, f"{flow_key}: owner release failed")
        invitee_release = request_json(
            client,
            "DELETE",
            f"/api/v1/boards/{quote(board_id)}/collaboration/sessions/{quote(invitee_session_id)}",
            headers=build_headers(args.origin, invitee_workspace),
        )
        require_ok(invitee_release, f"{flow_key}: invitee release failed")
        report["ownerRelease"] = owner_release
        report["inviteeRelease"] = invitee_release

        final_list = request_json(
            client,
            "GET",
            f"/api/v1/boards/{quote(board_id)}/collaboration",
            headers=build_headers(args.origin, owner),
        )
        require_ok(final_list, f"{flow_key}: final collaboration list failed")
        if final_list.get("json", {}).get("activeSessions"):
            raise AssertionError(f"{flow_key}: active sessions still remained after release")
        report["finalList"] = final_list
        report["ok"] = True
    except Exception as exc:  # noqa: BLE001
        report["error"] = str(exc)
        report["ok"] = False
    return report


def claim_presence(
    client: httpx.Client,
    board_id: string,
    identity: Identity,
    origin: str | None,
    presence: dict[str, Any],
) -> dict[str, Any]:
    result = request_json(
        client,
        "POST",
        f"/api/v1/boards/{quote(board_id)}/collaboration/sessions",
        headers=build_headers(origin, identity),
        body={"clientInstanceId": f"{identity.user_id or identity.workspace_id}-{uuid4().hex[:6]}", "presence": presence, "ttlSeconds": 45},
    )
    require_ok(result, f"{board_id}: presence claim failed")
    return result


def make_presence(page_id: str, shape_id: str, edge_id: str, x: int, y: int) -> dict[str, Any]:
    return {
        "activePageId": page_id,
        "cursor": {"x": x, "y": y},
        "editingShapeIds": [shape_id],
        "hoveredShapeId": shape_id,
        "selectedEdgeId": edge_id,
        "selectionIds": [shape_id],
        "state": "typing",
        "tool": "select",
    }


def assert_presence_roundtrip(result: dict[str, Any], workspace_id: str) -> None:
    payload = result.get("json", {})
    if payload.get("workspaceId") != workspace_id:
        raise AssertionError("Collaboration workspace id mismatch.")
    sessions = payload.get("activeSessions")
    if not isinstance(sessions, list) or len(sessions) < 2:
        raise AssertionError("Expected at least two collaboration sessions.")
    page_ids = {session.get("presence", {}).get("activePageId") for session in sessions}
    if {"page_owner", "page_guest"} - page_ids:
        raise AssertionError("Presence list did not preserve both active page ids.")
    editing_ids = {tuple(session.get("presence", {}).get("editingShapeIds", [])) for session in sessions}
    if ("shape_owner",) not in editing_ids or ("shape_guest",) not in editing_ids:
        raise AssertionError("Presence list did not preserve editing shape ids.")
    if not payload.get("roomKey"):
        raise AssertionError("Collaboration room key missing.")


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
    result: dict[str, Any] = {"contentType": response.headers.get("content-type"), "ok": response.is_success, "status": response.status_code}
    try:
        result["json"] = response.json()
    except json.JSONDecodeError:
        result["text"] = response.text
    return result


def require_ok(result: dict[str, Any], message: str) -> None:
    if result.get("ok"):
        return
    raise AssertionError(f"{message} Result: {json.dumps(result, sort_keys=True)}")


def is_report_ok(report: dict[str, Any]) -> bool:
    checks = report.get("checks", {})
    return bool(checks.get("health", {}).get("ok") and checks.get("team", {}).get("ok") and checks.get("group", {}).get("ok"))


if __name__ == "__main__":
    main()
