"""Run a 15-client websocket load smoke against the board realtime route."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from typing import Any

import httpx

from s4_realtime_multiplayer_load_support import (
    DEFAULT_CLIENTS,
    DEFAULT_RECV_TIMEOUT_SECONDS,
    assert_receive_counts,
    build_http_headers,
    close_clients,
    connect_clients,
    create_load_board,
    is_report_ok,
    metrics_to_report,
    require_ok,
    request_json,
    seed_room_if_needed,
    send_awareness_bursts,
    send_update_bursts,
    summarize_clients,
    verify_reconnect,
)


async def main_async() -> None:
    args = parse_args()
    board_id = args.board_id or f"s4-realtime-load-{int(time.time())}"
    stop_event = asyncio.Event()
    sent_at: dict[tuple[int, ...], float] = {}
    report: dict[str, Any] = {
        "baseUrl": args.base_url.rstrip("/"),
        "boardId": board_id,
        "checks": {},
        "config": {
            "awarenessPerClient": args.awareness_per_client,
            "clients": args.clients,
            "minReceiveRatio": args.min_receive_ratio,
            "updatesPerClient": args.updates_per_client,
        },
    }
    started_at = time.monotonic()
    async with httpx.AsyncClient(
        base_url=args.base_url.rstrip("/"),
        headers=build_http_headers(args),
        timeout=20,
    ) as client:
        report["checks"]["health"] = await request_json(client, "GET", "/health")
        require_ok(report["checks"]["health"], "Health check failed.")
        room_key = await create_load_board(client, board_id)
        report["roomKey"] = room_key

    clients = await connect_clients(args, board_id, room_key, stop_event, sent_at)
    try:
        await seed_room_if_needed(args, clients)
        await asyncio.gather(
            send_awareness_bursts(args, clients),
            send_update_bursts(args, clients, sent_at),
        )
        await asyncio.sleep(args.drain_seconds)
    finally:
        stop_event.set()
        await close_clients(clients)

    report["durationSeconds"] = round(time.monotonic() - started_at, 3)
    report["clients"] = [metrics_to_report(client.metrics) for client in clients]
    report["summary"] = summarize_clients(report["clients"])
    report["checks"]["reconnect"] = await verify_reconnect(args, board_id, report["roomKey"])
    report["checks"]["receivedEnoughUpdates"] = assert_receive_counts(args, clients)
    print(json.dumps(report, indent=2, sort_keys=True))
    if not is_report_ok(report):
        raise SystemExit(1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run multiplayer realtime websocket load smoke.")
    parser.add_argument("--base-url", default=os.getenv("S4_SMOKE_BASE_URL", "http://127.0.0.1:8100"))
    parser.add_argument("--board-id", default=os.getenv("S4_LOAD_BOARD_ID"))
    parser.add_argument("--bearer-token", default=os.getenv("S4_SMOKE_BEARER_TOKEN"))
    parser.add_argument("--origin", default=os.getenv("S4_SMOKE_ORIGIN"))
    parser.add_argument("--user-id", default=os.getenv("S4_SMOKE_USER_ID", "dev-user"))
    parser.add_argument("--workspace-id", default=os.getenv("S4_SMOKE_WORKSPACE_ID", "dev-workspace"))
    parser.add_argument("--workspace-kind", default=os.getenv("S4_SMOKE_WORKSPACE_KIND", "solo_workspace"))
    parser.add_argument("--workspace-name", default=os.getenv("S4_SMOKE_WORKSPACE_NAME", "Personal workspace"))
    parser.add_argument("--workspace-role", default=os.getenv("S4_SMOKE_WORKSPACE_ROLE", "owner"))
    parser.add_argument("--clients", type=int, default=int(os.getenv("S4_LOAD_CLIENTS", DEFAULT_CLIENTS)))
    parser.add_argument("--updates-per-client", type=int, default=int(os.getenv("S4_LOAD_UPDATES_PER_CLIENT", 6)))
    parser.add_argument("--awareness-per-client", type=int, default=int(os.getenv("S4_LOAD_AWARENESS_PER_CLIENT", 12)))
    parser.add_argument("--update-interval-ms", type=float, default=float(os.getenv("S4_LOAD_UPDATE_INTERVAL_MS", 12)))
    parser.add_argument("--awareness-interval-ms", type=float, default=float(os.getenv("S4_LOAD_AWARENESS_INTERVAL_MS", 40)))
    parser.add_argument("--stagger-ms", type=float, default=float(os.getenv("S4_LOAD_STAGGER_MS", 20)))
    parser.add_argument("--drain-seconds", type=float, default=float(os.getenv("S4_LOAD_DRAIN_SECONDS", 1.5)))
    parser.add_argument(
        "--recv-timeout-seconds",
        type=float,
        default=float(os.getenv("S4_SMOKE_RECV_TIMEOUT_SECONDS", DEFAULT_RECV_TIMEOUT_SECONDS)),
    )
    parser.add_argument("--min-receive-ratio", type=float, default=float(os.getenv("S4_LOAD_MIN_RECEIVE_RATIO", 0.98)))
    parser.add_argument("--verbose", action="store_true")
    return parser.parse_args()


def main() -> None:
    asyncio.run(main_async())


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
