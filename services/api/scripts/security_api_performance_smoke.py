#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import tempfile
import time
from dataclasses import dataclass

from fastapi.testclient import TestClient


@dataclass(frozen=True)
class Probe:
    method: str
    path: str
    expected_statuses: set[int]


PROBES = [
    Probe("GET", "/health", {200}),
    Probe("GET", "/api/v1/boards/share-links/perf_missing", {404}),
    Probe("GET", "/api/v1/boards/share-links/perf_missing/board", {404}),
]


def main() -> int:
    args = parse_args()
    if not args.use_current_env:
        configure_isolated_env()
    from tangent_api.main import app
    from tangent_api.security_rate_limit import reset_http_rate_limit_state

    reset_http_rate_limit_state()
    with TestClient(app) as client:
        warm_up(client)
        results = [measure_probe(client, probe, args.iterations) for probe in PROBES]
    reset_http_rate_limit_state()

    failures = [
        result
        for result in results
        if not result["ok"] or result["p95Ms"] > args.p95_ms or result["maxMs"] > args.max_ms
    ]
    report = {
        "maxThresholdMs": args.max_ms,
        "ok": not failures,
        "p95ThresholdMs": args.p95_ms,
        "probes": results,
    }
    if failures:
        report["failures"] = failures
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if not failures else 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run local API response-time security smoke checks.")
    parser.add_argument("--iterations", default=8, type=int)
    parser.add_argument("--p95-ms", default=250.0, type=float)
    parser.add_argument("--max-ms", default=500.0, type=float)
    parser.add_argument("--use-current-env", action="store_true")
    return parser.parse_args()


def configure_isolated_env() -> None:
    storage_dir = tempfile.mkdtemp(prefix="tangent-api-perf-")
    defaults = {
        "TANGENT_BOARD_STORAGE_DIR": storage_dir,
        "TANGENT_BOARD_STORAGE_DRIVER": "local-dev",
        "TANGENT_HTTP_RATE_LIMIT_ENABLED": "0",
        "TANGENT_REQUIRE_API_AUTH": "0",
        "TANGENT_SKIP_ENV_FILE_LOAD": "1",
    }
    for key, value in defaults.items():
        os.environ[key] = value


def warm_up(client: TestClient) -> None:
    for probe in PROBES:
        client.request(probe.method, probe.path)


def measure_probe(client: TestClient, probe: Probe, iterations: int) -> dict[str, object]:
    durations = []
    statuses = []
    for _ in range(max(1, iterations)):
        started = time.perf_counter()
        response = client.request(probe.method, probe.path)
        durations.append((time.perf_counter() - started) * 1000)
        statuses.append(response.status_code)
    unexpected = [status for status in statuses if status not in probe.expected_statuses]
    return {
        "avgMs": round(statistics.mean(durations), 2),
        "expectedStatuses": sorted(probe.expected_statuses),
        "maxMs": round(max(durations), 2),
        "method": probe.method,
        "ok": not unexpected,
        "p95Ms": round(percentile(durations, 95), 2),
        "path": probe.path,
        "unexpectedStatuses": unexpected,
    }


def percentile(values: list[float], percentile_value: int) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = int(round((len(ordered) - 1) * percentile_value / 100))
    return ordered[min(index, len(ordered) - 1)]


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
