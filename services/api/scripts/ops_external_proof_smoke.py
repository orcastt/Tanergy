#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


PRODUCTION_LIKE_ENVS = {"prod", "production", "staging"}


def main() -> int:
    args = parse_args()
    if args.env_file:
        load_env_file(args.env_file)
    production_like = args.production_like or normalized_env() in PRODUCTION_LIKE_ENVS
    checks = build_checks(args, production_like)
    failures = [check for check in checks if not check["ok"] and not check["optional"]]
    warnings = [check for check in checks if not check["ok"] and check["optional"]]
    report = {
        "checks": checks,
        "ok": not failures,
        "productionLike": production_like,
        "warnings": warnings,
    }
    if failures:
        report["failures"] = failures
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if not failures else 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify external ops proof config before production launch.",
    )
    parser.add_argument("--env-file", default=None)
    parser.add_argument("--production-like", action="store_true")
    parser.add_argument(
        "--required",
        action="store_true",
        help="Treat missing external proof as failure.",
    )
    parser.add_argument(
        "--check-urls",
        action="store_true",
        help="Reachability-check public status/monitor URLs.",
    )
    parser.add_argument("--max-restore-drill-age-days", default=90, type=int)
    return parser.parse_args()


def load_env_file(path: str) -> None:
    with open(path, "r", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), strip_optional_quotes(value.strip()))


def strip_optional_quotes(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value


def normalized_env() -> str:
    return (os.getenv("APP_ENV") or os.getenv("TANGENT_ENV") or "").strip().lower()


def build_checks(args: argparse.Namespace, production_like: bool) -> list[dict[str, Any]]:
    required = args.required or production_like
    return [
        require_enabled("TANGENT_WAF_ENABLED", required),
        require_enabled("TANGENT_WAF_RATE_LIMITS_ENABLED", required),
        require_https_url("TANGENT_WAF_DASHBOARD_URL", required=False),
        require_enabled("TANGENT_DATABASE_PITR_ENABLED", required),
        require_positive_int("TANGENT_DATABASE_BACKUP_RPO_MINUTES", required),
        require_positive_int("TANGENT_DATABASE_BACKUP_RTO_MINUTES", required),
        require_recent_restore_drill(required, args.max_restore_drill_age_days),
        require_alert_channel(required),
        require_https_url("TANGENT_STATUS_PAGE_URL", required),
        require_https_url("TANGENT_UPTIME_MONITOR_URL", required=False),
        require_error_tracking(required),
        require_positive_float("SENTRY_TRACES_SAMPLE_RATE", required=False),
        require_url_reachable("TANGENT_STATUS_PAGE_URL", args.check_urls),
        require_url_reachable("TANGENT_UPTIME_MONITOR_URL", args.check_urls),
    ]


def require_enabled(name: str, required: bool) -> dict[str, Any]:
    value = os.getenv(name, "").strip().lower()
    ok = value in {"1", "true", "yes", "on"}
    return result(
        name,
        ok or not required,
        "enabled" if ok else "not-enabled",
        optional=not required,
    )


def require_positive_int(name: str, required: bool) -> dict[str, Any]:
    value = os.getenv(name, "").strip()
    ok = value.isdigit() and int(value) > 0
    return result(
        name,
        ok or not required,
        int(value) if ok else "missing-or-invalid",
        optional=not required,
    )


def require_positive_float(name: str, required: bool) -> dict[str, Any]:
    value = os.getenv(name, "").strip()
    try:
        parsed = float(value)
    except ValueError:
        parsed = -1.0
    ok = parsed > 0
    return result(
        name,
        ok or not required,
        parsed if ok else "missing-or-invalid",
        optional=not required,
    )


def require_https_url(name: str, required: bool) -> dict[str, Any]:
    value = os.getenv(name, "").strip()
    parsed = urlparse(value)
    ok = parsed.scheme == "https" and bool(parsed.netloc)
    return result(
        name,
        ok or not required,
        "set" if ok else "missing-or-invalid",
        optional=not required,
    )


def require_recent_restore_drill(required: bool, max_age_days: int) -> dict[str, Any]:
    value = os.getenv("TANGENT_DATABASE_RESTORE_DRILL_AT", "").strip()
    parsed = parse_datetime(value)
    age_days = None
    if parsed:
        age_days = (datetime.now(timezone.utc) - parsed).days
    ok = parsed is not None and 0 <= (age_days or 0) <= max_age_days
    return result(
        "TANGENT_DATABASE_RESTORE_DRILL_AT",
        ok or not required,
        {"ageDays": age_days, "maxAgeDays": max_age_days},
        optional=not required,
    )


def parse_datetime(value: str) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def require_alert_channel(required: bool) -> dict[str, Any]:
    configured = bool(
        os.getenv("TANGENT_ALERT_EMAILS", "").strip()
        or os.getenv("TANGENT_ALERT_WEBHOOK_URL", "").strip()
    )
    return result(
        "alertChannel",
        configured or not required,
        "set" if configured else "missing",
        optional=not required,
    )


def require_error_tracking(required: bool) -> dict[str, Any]:
    configured = bool(
        os.getenv("SENTRY_DSN", "").strip()
        or os.getenv("TANGENT_ERROR_TRACKING_DSN", "").strip()
    )
    return result(
        "errorTracking",
        configured or not required,
        "set" if configured else "missing",
        optional=not required,
    )


def require_url_reachable(name: str, should_check: bool) -> dict[str, Any]:
    if not should_check or not os.getenv(name, "").strip():
        return result(f"{name}:reachable", True, "not-checked", optional=True)
    try:
        request = Request(
            os.environ[name],
            method="GET",
            headers={"User-Agent": "tangent-ops-smoke"},
        )
        with urlopen(request, timeout=5) as response:
            ok = 200 <= response.status < 400
            return result(f"{name}:reachable", ok, f"http-{response.status}")
    except HTTPError as exc:
        return result(f"{name}:reachable", False, f"http-{exc.code}")
    except URLError as exc:
        return result(f"{name}:reachable", False, f"unreachable:{exc.reason}")


def result(name: str, ok: bool, status: Any, *, optional: bool = False) -> dict[str, Any]:
    return {"name": name, "ok": ok, "optional": optional, "status": status}


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
