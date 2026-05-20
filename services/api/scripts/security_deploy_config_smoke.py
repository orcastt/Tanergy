#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from urllib.parse import urlparse

from tangent_api.security_redis import increment_security_counter, reset_security_redis_state_for_tests


PRODUCTION_LIKE_ENVS = {"prod", "production", "staging"}


def main() -> int:
    args = parse_args()
    if args.env_file:
        load_env_file(args.env_file)
    app_env = normalized_env()
    production_like = args.production_like or app_env in PRODUCTION_LIKE_ENVS
    checks = [
        require_truthy("APP_ENV", production_like),
        require_enabled("TANGENT_REQUIRE_API_AUTH", production_like),
        require_enabled("TANGENT_SECURITY_REDIS_ENABLED", production_like),
        require_redis_url(production_like),
        require_redis_connectivity(args.check_redis_connectivity),
        require_enabled("TANGENT_REQUIRE_WEBSOCKET_ORIGIN", production_like),
        require_origins("TANGENT_ALLOWED_ORIGINS", production_like),
        require_websocket_origins(production_like),
        require_clerk_config(production_like),
        require_clerk_audience(),
        require_storage_config(production_like),
        require_no_local_storage_driver(production_like),
        require_observability_config(),
    ]
    failures = [check for check in checks if not check["ok"] and not check.get("optional")]
    warnings = [check for check in checks if not check["ok"] and check.get("optional")]
    report = {
        "appEnv": app_env or None,
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
    parser = argparse.ArgumentParser(description="Validate security-critical deployment environment settings.")
    parser.add_argument("--env-file", default=None, help="Optional dotenv file to load before checks.")
    parser.add_argument("--check-redis-connectivity", action="store_true", help="Increment a temporary Redis security counter.")
    parser.add_argument("--production-like", action="store_true", help="Require staging/production security settings.")
    return parser.parse_args()


def load_env_file(path: str) -> None:
    with open(path, "r", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            if not key:
                continue
            os.environ.setdefault(key, strip_optional_quotes(value.strip()))


def strip_optional_quotes(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value


def normalized_env() -> str:
    return (
        os.getenv("APP_ENV")
        or os.getenv("TANGENT_ENV")
        or os.getenv("ENVIRONMENT")
        or ""
    ).strip().lower()


def require_truthy(name: str, required: bool) -> dict[str, object]:
    value = os.getenv(name, "").strip()
    return result(name, bool(value) or not required, "set" if value else "missing")


def require_enabled(name: str, required: bool) -> dict[str, object]:
    value = os.getenv(name, "").strip().lower()
    enabled = value in {"1", "true", "yes", "on"}
    return result(name, enabled or not required, "enabled" if enabled else "not-enabled")


def require_redis_url(required: bool) -> dict[str, object]:
    value = (
        os.getenv("TANGENT_REDIS_URL", "").strip()
        or os.getenv("REDIS_URL", "").strip()
        or os.getenv("UPSTASH_REDIS_URL", "").strip()
    )
    return result("redisUrl", bool(value) or not required, "set" if value else "missing")


def require_redis_connectivity(required: bool) -> dict[str, object]:
    if not required:
        return result("redisConnectivity", True, "not-checked", optional=True)
    reset_security_redis_state_for_tests()
    first = increment_security_counter(
        scope="deploy_config_smoke",
        raw_key=f"deploy-config:{os.getpid()}",
        ttl_seconds=30,
    )
    second = increment_security_counter(
        scope="deploy_config_smoke",
        raw_key=f"deploy-config:{os.getpid()}",
        ttl_seconds=30,
    )
    reset_security_redis_state_for_tests()
    ok = first is not None and second is not None and first.count >= 1 and second.count == first.count + 1
    return result(
        "redisConnectivity",
        ok,
        {
            "firstCount": first.count if first else None,
            "secondCount": second.count if second else None,
        },
    )


def require_origins(name: str, required: bool) -> dict[str, object]:
    origins = parse_origins(os.getenv(name, ""))
    has_wildcard = "*" in origins
    invalid = [origin for origin in origins if not is_valid_origin(origin)]
    ok = (bool(origins) or not required) and not has_wildcard and not invalid
    return result(
        name,
        ok,
        {
            "count": len(origins),
            "hasInvalid": bool(invalid),
            "hasWildcard": has_wildcard,
        },
        optional=not required,
    )


def require_websocket_origins(required: bool) -> dict[str, object]:
    websocket_origins = parse_origins(os.getenv("TANGENT_ALLOWED_WEBSOCKET_ORIGINS", ""))
    http_origins = parse_origins(os.getenv("TANGENT_ALLOWED_ORIGINS", ""))
    origins = websocket_origins or http_origins
    has_wildcard = "*" in origins
    invalid = [origin for origin in origins if not is_valid_origin(origin)]
    ok = (bool(origins) or not required) and not has_wildcard and not invalid
    return result(
        "websocketOrigins",
        ok,
        {
            "count": len(origins),
            "hasExplicitWebSocketOrigins": bool(websocket_origins),
            "hasInvalid": bool(invalid),
            "hasWildcard": has_wildcard,
        },
    )


def require_clerk_config(required: bool) -> dict[str, object]:
    required_keys = [
        "CLERK_JWT_ISSUER",
        "CLERK_JWKS_URL",
        "CLERK_AUTHORIZED_PARTIES",
    ]
    missing_required = [key for key in required_keys if not os.getenv(key, "").strip()]
    ok = not missing_required or not required
    return result(
        "clerkVerification",
        ok,
        {
            "missingRequired": missing_required,
        },
    )


def require_clerk_audience() -> dict[str, object]:
    configured = bool(os.getenv("CLERK_JWT_AUDIENCE", "").strip())
    return result(
        "clerkAudience",
        configured,
        "set" if configured else "missing-recommended",
        optional=True,
    )


def require_storage_config(required: bool) -> dict[str, object]:
    required_keys = [
        "S3_BUCKET",
        "S3_ENDPOINT",
        "S3_ACCESS_KEY_ID",
        "S3_SECRET_ACCESS_KEY",
    ]
    missing = [key for key in required_keys if not os.getenv(key, "").strip()]
    ok = not missing or not required
    return result("assetStorage", ok, {"missing": missing})


def require_no_local_storage_driver(required: bool) -> dict[str, object]:
    local_values = {"local", "local-dev", "filesystem", "file"}
    values = {
        "TANGENT_ASSET_STORAGE_DRIVER": os.getenv("TANGENT_ASSET_STORAGE_DRIVER", "").strip(),
        "TANGENT_ASSET_METADATA_DRIVER": os.getenv("TANGENT_ASSET_METADATA_DRIVER", "").strip(),
        "TANGENT_BOARD_STORAGE_DRIVER": os.getenv("TANGENT_BOARD_STORAGE_DRIVER", "").strip(),
    }
    local_keys = [key for key, value in values.items() if value in local_values]
    ok = not local_keys or not required
    return result("nonLocalStorageDrivers", ok, {"localKeys": local_keys})


def require_observability_config() -> dict[str, object]:
    configured = {
        "alertChannel": bool(os.getenv("TANGENT_ALERT_EMAILS", "").strip() or os.getenv("TANGENT_ALERT_WEBHOOK_URL", "").strip()),
        "apiSlowResponseThreshold": bool(os.getenv("TANGENT_API_SLOW_RESPONSE_MS", "").strip()),
        "errorTracking": bool(os.getenv("SENTRY_DSN", "").strip() or os.getenv("TANGENT_ERROR_TRACKING_DSN", "").strip()),
        "memoryThreshold": bool(os.getenv("TANGENT_MEMORY_RSS_WARN_MB", "").strip()),
        "statusPage": bool(os.getenv("TANGENT_STATUS_PAGE_URL", "").strip()),
    }
    missing = [key for key, is_set in configured.items() if not is_set]
    return result(
        "opsObservability",
        not missing,
        {"missingRecommended": missing},
        optional=True,
    )


def parse_origins(value: str) -> list[str]:
    return [item.strip().rstrip("/") for item in value.split(",") if item.strip()]


def is_valid_origin(origin: str) -> bool:
    parsed = urlparse(origin)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc) and not parsed.path


def result(name: str, ok: bool, status: object, *, optional: bool = False) -> dict[str, object]:
    return {
        "name": name,
        "ok": ok,
        "optional": optional,
        "status": status,
    }


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
