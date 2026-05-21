"""Run a websocket reconnect/resync smoke against the FastAPI board realtime route.

This script exercises two provider-shaped collaboration checkpoints:

1. reconnect/replay:
   seed one room, write incremental updates, reconnect, and verify replay.
2. stale-version resync:
   trigger a compaction request, advance the room from another tab, then
   attempt a stale full-state publish and verify the server returns the
   current sync-state payload for resync instead of silently dropping it.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from typing import Any, Optional
from urllib.parse import quote
from urllib.parse import urlencode, urlparse, urlunparse

import httpx

try:
    import websockets
except ImportError as exc:  # pragma: no cover - runtime dependency guard
    raise SystemExit(
        "The 'websockets' package is required for s4_realtime_resync_smoke.py. "
        "Install services/api dependencies with uvicorn[standard]."
    ) from exc


DEFAULT_COMPACTION_THRESHOLD = 48
DEFAULT_RECV_TIMEOUT_SECONDS = 20


async def main_async() -> None:
    args = parse_args()
    reconnect_board_id = f"{args.board_id}-reconnect"
    stale_board_id = f"{args.board_id}-stale"
    report: dict[str, Any] = {
        "baseUrl": args.base_url.rstrip("/"),
        "boardIds": {
            "reconnect": reconnect_board_id,
            "stale": stale_board_id,
        },
        "checks": {},
        "headers": {
            "hasAuthorization": bool(args.bearer_token),
            "origin": args.origin,
            "workspaceId": args.workspace_id,
            "workspaceKind": args.workspace_kind,
        },
    }
    async with httpx.AsyncClient(
        base_url=args.base_url.rstrip("/"),
        headers=build_http_headers(args),
        timeout=20,
    ) as client:
        report["checks"]["health"] = await request_json(client, "GET", "/health")
        require_ok(report["checks"]["health"], "Health check failed.")

        reconnect_room_key = await create_smoke_board(client, reconnect_board_id, "Reconnect Replay Smoke")
        report["checks"]["reconnectCollaboration"] = {"ok": True, "roomKey": reconnect_room_key}
        reconnect_report = await run_reconnect_flow(args, reconnect_board_id, reconnect_room_key)
        report["checks"]["reconnectReplay"] = reconnect_report["report"]

        stale_room_key = await create_smoke_board(client, stale_board_id, "Stale Version Resync Smoke")
        report["checks"]["staleCollaboration"] = {"ok": True, "roomKey": stale_room_key}
        stale_report = await run_stale_resync_flow(args, stale_board_id, stale_room_key)
        report["checks"]["staleVersionResync"] = stale_report["report"]

    print(json.dumps(report, indent=2, sort_keys=True))
    if not is_smoke_successful(report):
        raise SystemExit(1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run realtime reconnect/resync smoke.")
    parser.add_argument("--base-url", default=os.getenv("S4_SMOKE_BASE_URL", "http://127.0.0.1:8100"))
    parser.add_argument(
        "--board-id",
        default=f"s4-realtime-smoke-{int(time.time())}",
    )
    parser.add_argument("--bearer-token", default=os.getenv("S4_SMOKE_BEARER_TOKEN"))
    parser.add_argument("--origin", default=os.getenv("S4_SMOKE_ORIGIN"))
    parser.add_argument("--user-id", default=os.getenv("S4_SMOKE_USER_ID", "dev-user"))
    parser.add_argument("--workspace-id", default=os.getenv("S4_SMOKE_WORKSPACE_ID", "dev-workspace"))
    parser.add_argument("--workspace-kind", default=os.getenv("S4_SMOKE_WORKSPACE_KIND", "solo_workspace"))
    parser.add_argument("--workspace-name", default=os.getenv("S4_SMOKE_WORKSPACE_NAME", "Personal workspace"))
    parser.add_argument("--workspace-role", default=os.getenv("S4_SMOKE_WORKSPACE_ROLE", "owner"))
    parser.add_argument(
        "--compaction-threshold",
        type=int,
        default=int(os.getenv("S4_SMOKE_COMPACTION_THRESHOLD", DEFAULT_COMPACTION_THRESHOLD)),
    )
    parser.add_argument(
        "--recv-timeout-seconds",
        type=float,
        default=float(os.getenv("S4_SMOKE_RECV_TIMEOUT_SECONDS", DEFAULT_RECV_TIMEOUT_SECONDS)),
    )
    parser.add_argument("--verbose", action="store_true")
    return parser.parse_args()


def build_http_headers(args: argparse.Namespace) -> dict[str, str]:
    headers = {"Accept": "application/json"}
    if args.bearer_token:
        headers["Authorization"] = f"Bearer {args.bearer_token}"
    if args.origin:
        headers["Origin"] = args.origin
    if args.user_id:
        headers["x-tangent-user-id"] = args.user_id
    if args.workspace_id:
        headers["x-tangent-workspace-id"] = args.workspace_id
    if args.workspace_kind:
        headers["x-tangent-workspace-kind"] = args.workspace_kind
    if args.workspace_name:
        headers["x-tangent-workspace-name"] = args.workspace_name
    if args.workspace_role:
        headers["x-tangent-workspace-role"] = args.workspace_role
    return headers


async def request_json(
    client: httpx.AsyncClient,
    method: str,
    path: str,
    body: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    try:
        response = await client.request(method, path, json=body)
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


async def create_smoke_board(client: httpx.AsyncClient, board_id: str, title: str) -> str:
    create_result = await request_json(
        client,
        "POST",
        "/api/v1/boards",
        {
            "boardId": board_id,
            "document": {"assets": [], "shapes": [{"id": f"shape_{board_id}"}]},
            "title": title,
        },
    )
    require_ok(create_result, f"Failed to create smoke board {board_id!r}.")
    collaboration = await request_json(client, "GET", f"/api/v1/boards/{quote(board_id)}/collaboration")
    require_ok(collaboration, f"Failed to load collaboration room metadata for {board_id!r}.")
    room_key = collaboration.get("json", {}).get("roomKey")
    if not isinstance(room_key, str) or not room_key:
        raise AssertionError(f"Missing roomKey for smoke board {board_id!r}.")
    return room_key


def build_ws_url(args: argparse.Namespace, board_id: str, room_key: str, client_instance_id: str) -> str:
    parsed = urlparse(args.base_url.rstrip("/"))
    scheme = "wss" if parsed.scheme == "https" else "ws"
    query: dict[str, str] = {
        "clientInstanceId": client_instance_id,
        "roomKey": room_key,
        "workspaceId": args.workspace_id,
        "workspaceKind": args.workspace_kind,
        "workspaceName": args.workspace_name,
        "workspaceRole": args.workspace_role,
    }
    if args.bearer_token:
        query["token"] = args.bearer_token
    elif args.user_id:
        query["userId"] = args.user_id
    path = f"/api/v1/boards/{quote(board_id)}/realtime"
    return urlunparse((scheme, parsed.netloc, path, "", urlencode(query), ""))


async def run_reconnect_flow(args: argparse.Namespace, board_id: str, room_key: str) -> dict[str, Any]:
    report: dict[str, Any] = {}
    owner_url = build_ws_url(args, board_id, room_key, "tab_owner")
    reconnect_url = build_ws_url(args, board_id, room_key, "tab_reconnect")

    async with websockets.connect(owner_url, origin=args.origin) as owner_socket:
        log(args, "reconnect: owner connected")
        owner_sync = await recv_json(owner_socket)
        owner_awareness = await recv_json(owner_socket, args.recv_timeout_seconds)
        report["ownerInitialSync"] = owner_sync
        report["ownerInitialAwareness"] = owner_awareness
        assert_message_type(owner_sync, "sync-state")
        assert_message_type(owner_awareness, "awareness-batch")

        current_version = int(owner_sync.get("documentVersion", 0))
        if owner_sync.get("seedRoom") is True:
            await send_json(owner_socket, {
                "documentVersion": current_version,
                "type": "sync-state-publish",
                "update": [7, 7, 7],
            })
            accepted = await recv_json(owner_socket, args.recv_timeout_seconds)
            report["ownerSeedAccepted"] = accepted
            assert_message_type(accepted, "sync-state-accepted")
            current_version = int(accepted.get("documentVersion", current_version))

        await send_json(owner_socket, {"type": "yjs-update", "update": [1, 2, 3]})
        current_version += 1
        report["ownerPostUpdateVersion"] = current_version
        await asyncio.sleep(0.1)

        async with websockets.connect(reconnect_url, origin=args.origin) as reconnect_socket:
            log(args, "reconnect: replay socket connected")
            reconnect_sync = await recv_json(reconnect_socket, args.recv_timeout_seconds)
            reconnect_awareness = await recv_json(reconnect_socket, args.recv_timeout_seconds)
            report["reconnectSync"] = reconnect_sync
            report["reconnectAwareness"] = reconnect_awareness
            assert_message_type(reconnect_sync, "sync-state")
            assert_message_type(reconnect_awareness, "awareness-batch")
            updates = reconnect_sync.get("updates")
            if not isinstance(updates, list) or [1, 2, 3] not in updates:
                raise AssertionError("Reconnect replay did not include the incremental update.")
            if int(reconnect_sync.get("documentVersion", -1)) != current_version:
                raise AssertionError("Reconnect replay returned an unexpected document version.")

    report["ok"] = True
    return {"report": report, "documentVersion": current_version}


async def run_stale_resync_flow(args: argparse.Namespace, board_id: str, room_key: str) -> dict[str, Any]:
    report: dict[str, Any] = {}
    compactor_url = build_ws_url(args, board_id, room_key, "tab_compactor")
    other_url = build_ws_url(args, board_id, room_key, "tab_other")

    async with websockets.connect(compactor_url, origin=args.origin) as compactor_socket:
        log(args, "stale: compactor connected")
        compactor_sync = await recv_json(compactor_socket, args.recv_timeout_seconds)
        compactor_awareness = await recv_json(compactor_socket, args.recv_timeout_seconds)
        report["compactorInitialSync"] = compactor_sync
        report["compactorInitialAwareness"] = compactor_awareness
        assert_message_type(compactor_sync, "sync-state")
        assert_message_type(compactor_awareness, "awareness-batch")

        current_version = int(compactor_sync.get("documentVersion", 0))
        if compactor_sync.get("seedRoom") is True:
            await send_json(compactor_socket, {
                "documentVersion": current_version,
                "type": "sync-state-publish",
                "update": [5, 5, 5],
            })
            seed_accepted = await recv_json(compactor_socket, args.recv_timeout_seconds)
            report["compactorSeedAccepted"] = seed_accepted
            assert_message_type(seed_accepted, "sync-state-accepted")
            current_version = int(seed_accepted.get("documentVersion", current_version))
        sends_until_compaction = max(0, args.compaction_threshold - current_version)
        log(args, f"stale: sending {sends_until_compaction} updates to trigger compaction")
        for index in range(sends_until_compaction):
            await send_json(compactor_socket, {
                "type": "yjs-update",
                "update": [index % 256, (index + 1) % 256],
            })

        compaction_request = await recv_json(compactor_socket, args.recv_timeout_seconds)
        report["compactionRequest"] = compaction_request
        assert_message_type(compaction_request, "document-compact-request")
        stale_document_version = int(compaction_request.get("documentVersion", args.compaction_threshold))

        async with websockets.connect(other_url, origin=args.origin) as other_socket:
            log(args, "stale: other socket connected after compaction threshold")
            other_sync = await recv_json(other_socket, args.recv_timeout_seconds)
            other_awareness = await recv_json(other_socket, args.recv_timeout_seconds)
            report["otherInitialSync"] = other_sync
            report["otherInitialAwareness"] = other_awareness
            assert_message_type(other_sync, "sync-state")
            assert_message_type(other_awareness, "awareness-batch")

            await send_json(other_socket, {"type": "yjs-update", "update": [99, 100]})
            compactor_incremental = await recv_json(compactor_socket, args.recv_timeout_seconds)
            report["compactorReceivedNewerUpdate"] = compactor_incremental
            assert_message_type(compactor_incremental, "yjs-update")

            await send_json(compactor_socket, {
                "documentVersion": stale_document_version,
                "type": "sync-state-publish",
                "update": [4, 4, 4, 4],
            })
            resync_state = await recv_json(compactor_socket, args.recv_timeout_seconds)
            report["resyncState"] = resync_state
            assert_message_type(resync_state, "sync-state")
            if resync_state.get("requestCompaction") is not True:
                raise AssertionError("Stale publish resync did not preserve compaction request.")
            updates = resync_state.get("updates")
            if not isinstance(updates, list) or [99, 100] not in updates:
                raise AssertionError("Resync payload did not include the newer remote update.")
            if int(resync_state.get("documentVersion", -1)) <= stale_document_version:
                raise AssertionError("Resync payload did not advance the authoritative document version.")

    report["ok"] = True
    return {"report": report}


async def recv_json(socket: Any, timeout_seconds: float = DEFAULT_RECV_TIMEOUT_SECONDS) -> dict[str, Any]:
    raw = await asyncio.wait_for(socket.recv(), timeout=timeout_seconds)
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", errors="replace")
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise AssertionError("Expected websocket JSON object payload.")
    return payload


async def send_json(socket: Any, payload: dict[str, Any]) -> None:
    await asyncio.wait_for(socket.send(json.dumps(payload)), timeout=DEFAULT_RECV_TIMEOUT_SECONDS)


def assert_message_type(payload: dict[str, Any], expected_type: str) -> None:
    actual = payload.get("type")
    if actual != expected_type:
        raise AssertionError(f"Expected websocket message type {expected_type!r}, received {actual!r}.")


def require_ok(result: dict[str, Any], message: str) -> None:
    if result.get("ok"):
        return
    raise AssertionError(f"{message} Result: {json.dumps(result, sort_keys=True)}")


def log(args: argparse.Namespace, message: str) -> None:
    if not getattr(args, "verbose", False):
        return
    print(f"[s4-smoke] {message}", file=sys.stderr, flush=True)


def is_smoke_successful(report: dict[str, Any]) -> bool:
    checks = report.get("checks", {})
    health = checks.get("health", {})
    reconnect_collaboration = checks.get("reconnectCollaboration", {})
    stale_collaboration = checks.get("staleCollaboration", {})
    reconnect = checks.get("reconnectReplay", {})
    stale = checks.get("staleVersionResync", {})
    return bool(
        health.get("ok")
        and reconnect_collaboration.get("ok")
        and stale_collaboration.get("ok")
        and reconnect.get("ok")
        and stale.get("ok")
    )


def main() -> None:
    asyncio.run(main_async())


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
