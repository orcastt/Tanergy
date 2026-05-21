from __future__ import annotations

import asyncio
import json
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote, urlencode, urlparse, urlunparse

import httpx

try:
    import websockets
    from websockets.exceptions import ConnectionClosed
except ImportError as exc:  # pragma: no cover - runtime dependency guard
    raise SystemExit(
        "The 'websockets' package is required. Install services/api dependencies with uvicorn[standard]."
    ) from exc


DEFAULT_CLIENTS = 15
DEFAULT_RECV_TIMEOUT_SECONDS = 20
@dataclass
class ClientMetrics:
    client_id: str
    connected: bool = False
    initial_awareness_ok: bool = False
    initial_sync_ok: bool = False
    received_awareness_states: int = 0
    received_compaction_requests: int = 0
    received_errors: int = 0
    received_sync_accepts: int = 0
    received_yjs_updates: int = 0
    sent_awareness: int = 0
    sent_updates: int = 0
    close_error: str | None = None
    latencies_ms: list[float] = field(default_factory=list)


@dataclass
class ConnectedClient:
    index: int
    client_id: str
    metrics: ClientMetrics
    reader_task: asyncio.Task[None]
    send_lock: asyncio.Lock
    socket: Any

    async def send_json(self, payload: dict[str, Any], timeout_seconds: float) -> None:
        async with self.send_lock:
            await asyncio.wait_for(self.socket.send(json.dumps(payload)), timeout=timeout_seconds)


def build_http_headers(args: Any) -> dict[str, str]:
    headers = {"Accept": "application/json"}
    if args.bearer_token:
        headers["Authorization"] = f"Bearer {args.bearer_token}"
    if args.origin:
        headers["Origin"] = args.origin
    if args.user_id:
        headers["x-tangent-user-id"] = args.user_id
    headers["x-tangent-workspace-id"] = args.workspace_id
    headers["x-tangent-workspace-kind"] = args.workspace_kind
    headers["x-tangent-workspace-name"] = args.workspace_name
    headers["x-tangent-workspace-role"] = args.workspace_role
    return headers


async def request_json(client: httpx.AsyncClient, method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    response = await client.request(method, path, json=body)
    result: dict[str, Any] = {"ok": response.is_success, "status": response.status_code}
    try:
        result["json"] = response.json()
    except json.JSONDecodeError:
        result["text"] = response.text
    return result


async def create_load_board(client: httpx.AsyncClient, board_id: str) -> str:
    create_result = await request_json(
        client,
        "POST",
        "/api/v1/boards",
        {
            "boardId": board_id,
            "document": {"assets": [], "shapes": [{"id": f"shape_{index}"} for index in range(4)]},
            "title": "Realtime Multiplayer Load Smoke",
        },
    )
    require_ok(create_result, f"Failed to create load board {board_id!r}.")
    collaboration = await request_json(client, "GET", f"/api/v1/boards/{quote(board_id)}/collaboration")
    require_ok(collaboration, f"Failed to load collaboration room metadata for {board_id!r}.")
    room_key = collaboration.get("json", {}).get("roomKey")
    if not isinstance(room_key, str) or not room_key:
        raise AssertionError(f"Missing roomKey for load board {board_id!r}.")
    return room_key


async def connect_clients(args: Any, board_id: str, room_key: str, stop_event: asyncio.Event, sent_at: dict[tuple[int, ...], float]) -> list[ConnectedClient]:
    async def connect_one(index: int) -> ConnectedClient:
        await asyncio.sleep(index * args.stagger_ms / 1000)
        client_id = f"load_tab_{index:02d}"
        socket = await websockets.connect(build_ws_url(args, board_id, room_key, client_id), origin=args.origin, max_size=16 * 1024 * 1024)
        metrics = ClientMetrics(client_id=client_id, connected=True)
        sync = await recv_json(socket, args.recv_timeout_seconds)
        awareness = await recv_json(socket, args.recv_timeout_seconds)
        metrics.initial_sync_ok = sync.get("type") == "sync-state"
        metrics.initial_awareness_ok = awareness.get("type") == "awareness-batch"
        reader_task = asyncio.create_task(read_loop(socket, metrics, stop_event, sent_at))
        log(args, f"connected {client_id}")
        return ConnectedClient(index, client_id, metrics, reader_task, asyncio.Lock(), socket)

    return list(await asyncio.gather(*[connect_one(index) for index in range(args.clients)]))


async def seed_room_if_needed(args: Any, clients: list[ConnectedClient]) -> None:
    if clients:
        await clients[0].send_json({"documentVersion": 0, "type": "sync-state-publish", "update": [7, 7, 7]}, args.recv_timeout_seconds)


async def send_update_bursts(args: Any, clients: list[ConnectedClient], sent_at: dict[tuple[int, ...], float]) -> None:
    for update_index in range(args.updates_per_client):
        tasks = []
        for client in clients:
            update = [client.index, update_index, (client.index + update_index) % 256, 231]
            sent_at[tuple(update)] = time.monotonic()
            tasks.append(client.send_json({"type": "yjs-update", "update": update}, args.recv_timeout_seconds))
            client.metrics.sent_updates += 1
        await asyncio.gather(*tasks)
        await asyncio.sleep(args.update_interval_ms / 1000)


async def send_awareness_bursts(args: Any, clients: list[ConnectedClient]) -> None:
    for step in range(args.awareness_per_client):
        tasks = []
        for client in clients:
            tasks.append(client.send_json({"state": make_awareness_state(client, step), "type": "awareness-state"}, args.recv_timeout_seconds))
            client.metrics.sent_awareness += 1
        await asyncio.gather(*tasks)
        await asyncio.sleep(args.awareness_interval_ms / 1000)


def make_awareness_state(client: ConnectedClient, step: int) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    x = 80 + client.index * 14 + step * 8
    y = 120 + client.index * 5 + step * 3
    return {
        "expiresAt": (now + timedelta(seconds=30)).isoformat(),
        "presence": {
            "activePageId": "page_load",
            "displayName": f"Load User {client.index + 1}",
            "editingShapeIds": [f"shape_{client.index % 4}"],
            "selectionIds": [f"shape_{client.index % 4}"],
            "state": "moving",
            "tool": "select",
            "transformBox": {"maxX": x + 160, "maxY": y + 100, "minX": x, "minY": y},
            "transformKind": "move",
        },
        "updatedAt": now.isoformat(),
    }


async def read_loop(socket: Any, metrics: ClientMetrics, stop_event: asyncio.Event, sent_at: dict[tuple[int, ...], float]) -> None:
    while not stop_event.is_set():
        try:
            payload = await recv_json(socket, timeout_seconds=0.25)
        except asyncio.TimeoutError:
            continue
        except ConnectionClosed as exc:
            if not stop_event.is_set():
                metrics.close_error = f"{exc.code}: {exc.reason}"
            return
        except Exception as exc:  # noqa: BLE001
            if not stop_event.is_set():
                metrics.close_error = str(exc)
            return
        message_type = payload.get("type")
        if message_type == "yjs-update":
            metrics.received_yjs_updates += 1
            update = payload.get("update")
            if isinstance(update, list):
                sent_time = sent_at.get(tuple(item for item in update if isinstance(item, int)))
                if sent_time is not None:
                    metrics.latencies_ms.append((time.monotonic() - sent_time) * 1000)
        elif message_type == "awareness-state":
            metrics.received_awareness_states += 1
        elif message_type == "document-compact-request":
            metrics.received_compaction_requests += 1
        elif message_type == "sync-state-accepted":
            metrics.received_sync_accepts += 1
        elif message_type == "error":
            metrics.received_errors += 1


async def close_clients(clients: list[ConnectedClient]) -> None:
    await asyncio.gather(*[client.socket.close() for client in clients], return_exceptions=True)
    await asyncio.gather(*[client.reader_task for client in clients], return_exceptions=True)


async def verify_reconnect(args: Any, board_id: str, room_key: str) -> dict[str, Any]:
    socket = await websockets.connect(build_ws_url(args, board_id, room_key, "load_verify"), origin=args.origin, max_size=16 * 1024 * 1024)
    try:
        sync = await recv_json(socket, args.recv_timeout_seconds)
        awareness = await recv_json(socket, args.recv_timeout_seconds)
    finally:
        await socket.close()
    updates = sync.get("updates")
    return {
        "awarenessOk": awareness.get("type") == "awareness-batch",
        "documentVersion": sync.get("documentVersion"),
        "ok": sync.get("type") == "sync-state" and isinstance(updates, list) and len(updates) > 0,
        "syncType": sync.get("type"),
        "updateCount": len(updates) if isinstance(updates, list) else None,
    }


async def recv_json(socket: Any, timeout_seconds: float) -> dict[str, Any]:
    raw = await asyncio.wait_for(socket.recv(), timeout=timeout_seconds)
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", errors="replace")
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise AssertionError("Expected websocket JSON object payload.")
    return payload


def build_ws_url(args: Any, board_id: str, room_key: str, client_instance_id: str) -> str:
    parsed = urlparse(args.base_url.rstrip("/"))
    query = {
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
    scheme = "wss" if parsed.scheme == "https" else "ws"
    return urlunparse((scheme, parsed.netloc, f"/api/v1/boards/{quote(board_id)}/realtime", "", urlencode(query), ""))


def assert_receive_counts(args: Any, clients: list[ConnectedClient]) -> dict[str, Any]:
    expected = args.updates_per_client * max(0, args.clients - 1)
    minimum = int(expected * args.min_receive_ratio)
    failures = [
        {"clientId": client.client_id, "received": client.metrics.received_yjs_updates}
        for client in clients
        if client.metrics.received_yjs_updates < minimum or client.metrics.close_error or client.metrics.received_errors
    ]
    return {"expectedPerClient": expected, "failures": failures, "minimumPerClient": minimum, "ok": not failures}


def metrics_to_report(metrics: ClientMetrics) -> dict[str, Any]:
    latencies = metrics.latencies_ms
    return {
        "clientId": metrics.client_id,
        "closeError": metrics.close_error,
        "connected": metrics.connected,
        "initialAwarenessOk": metrics.initial_awareness_ok,
        "initialSyncOk": metrics.initial_sync_ok,
        "latencyAvgMs": round(sum(latencies) / len(latencies), 2) if latencies else None,
        "latencyMaxMs": round(max(latencies), 2) if latencies else None,
        "receivedAwarenessStates": metrics.received_awareness_states,
        "receivedCompactionRequests": metrics.received_compaction_requests,
        "receivedErrors": metrics.received_errors,
        "receivedSyncAccepts": metrics.received_sync_accepts,
        "receivedYjsUpdates": metrics.received_yjs_updates,
        "sentAwareness": metrics.sent_awareness,
        "sentUpdates": metrics.sent_updates,
    }


def summarize_clients(clients: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "clients": len(clients),
        "receivedAwarenessStates": sum(int(client["receivedAwarenessStates"]) for client in clients),
        "receivedCompactionRequests": sum(int(client["receivedCompactionRequests"]) for client in clients),
        "receivedYjsUpdates": sum(int(client["receivedYjsUpdates"]) for client in clients),
        "sendErrors": sum(1 for client in clients if client["closeError"] or client["receivedErrors"]),
    }


def require_ok(result: dict[str, Any], message: str) -> None:
    if not result.get("ok"):
        raise AssertionError(f"{message} Result: {json.dumps(result, sort_keys=True)}")


def is_report_ok(report: dict[str, Any]) -> bool:
    checks = report.get("checks", {})
    return bool(checks.get("health", {}).get("ok") and checks.get("reconnect", {}).get("ok") and checks.get("receivedEnoughUpdates", {}).get("ok"))


def log(args: Any, message: str) -> None:
    if args.verbose:
        print(f"[s4-load] {message}", file=sys.stderr, flush=True)
