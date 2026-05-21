#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid
from typing import Any

from tangent_api.security_redis import increment_security_counter, reset_security_redis_state_for_tests


def main() -> int:
    args = parse_args()
    if not redis_is_configured():
        message = {
            "ok": not args.required,
            "skipped": True,
            "reason": "TANGENT_SECURITY_REDIS_ENABLED and Redis URL are required for this smoke.",
        }
        print(json.dumps(message, indent=2, sort_keys=True))
        return 1 if args.required else 0

    reset_security_redis_state_for_tests()
    raw_key = f"security-redis-smoke:{uuid.uuid4().hex}"
    first = increment_security_counter(scope=args.scope, raw_key=raw_key, ttl_seconds=args.ttl)
    second = increment_security_counter(scope=args.scope, raw_key=raw_key, ttl_seconds=args.ttl)
    disabled = run_disabled_check(args.scope, raw_key, args.ttl)

    failures = []
    if first is None:
        failures.append("first increment did not use Redis")
    if second is None:
        failures.append("second increment did not use Redis")
    if first and first.count != 1:
        failures.append(f"first count expected 1, got {first.count}")
    if second and second.count != 2:
        failures.append(f"second count expected 2, got {second.count}")
    if first and not 1 <= first.ttl_seconds <= args.ttl:
        failures.append(f"first ttl expected 1..{args.ttl}, got {first.ttl_seconds}")
    if second and not 1 <= second.ttl_seconds <= args.ttl:
        failures.append(f"second ttl expected 1..{args.ttl}, got {second.ttl_seconds}")
    if disabled is not None:
        failures.append("disabled Redis check should return None")

    report = {
        "checks": {
            "disabledReturnsNone": disabled is None,
            "firstCount": first.count if first else None,
            "firstTtlSeconds": first.ttl_seconds if first else None,
            "secondCount": second.count if second else None,
            "secondTtlSeconds": second.ttl_seconds if second else None,
        },
        "durationMs": round((time.perf_counter() - START) * 1000, 2),
        "ok": not failures,
        "scope": args.scope,
    }
    if failures:
        report["failures"] = failures
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if not failures else 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Smoke test the configured Redis-backed security counter without touching app data.",
    )
    parser.add_argument("--required", action="store_true", help="Fail if Redis security counters are not configured.")
    parser.add_argument("--scope", default="security_smoke", help="Isolated Redis security counter scope.")
    parser.add_argument("--ttl", default=30, type=int, help="Temporary counter TTL in seconds.")
    return parser.parse_args()


def redis_is_configured() -> bool:
    enabled = os.getenv("TANGENT_SECURITY_REDIS_ENABLED", "0").strip().lower()
    if enabled in {"0", "false", "off", "no"}:
        return False
    return bool(redis_url())


def redis_url() -> str:
    return (
        os.getenv("TANGENT_REDIS_URL", "").strip()
        or os.getenv("REDIS_URL", "").strip()
        or os.getenv("UPSTASH_REDIS_URL", "").strip()
    )


def run_disabled_check(scope: str, raw_key: str, ttl: int) -> Any | None:
    previous = os.environ.get("TANGENT_SECURITY_REDIS_ENABLED")
    os.environ["TANGENT_SECURITY_REDIS_ENABLED"] = "0"
    reset_security_redis_state_for_tests()
    try:
        return increment_security_counter(scope=scope, raw_key=f"{raw_key}:disabled", ttl_seconds=ttl)
    finally:
        if previous is None:
            os.environ.pop("TANGENT_SECURITY_REDIS_ENABLED", None)
        else:
            os.environ["TANGENT_SECURITY_REDIS_ENABLED"] = previous
        reset_security_redis_state_for_tests()


START = time.perf_counter()


if __name__ == "__main__":
    sys.exit(main())
