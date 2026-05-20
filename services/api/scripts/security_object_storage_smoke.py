#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from tangent_api.storage.s3_client import (
    S3AssetStorageConfig,
    create_s3_client,
    is_missing_object_error,
)


PLACEHOLDER_MARKERS = ("example", "replace-with", "password", "<")


def main() -> int:
    args = parse_args()
    if args.env_file:
        load_env_file(args.env_file)
    if not should_run(args.required):
        return emit(
            {
                "ok": not args.required,
                "reason": "s3-compatible storage is not configured.",
                "skipped": True,
            }
        )

    placeholder_keys = placeholder_config_keys()
    if placeholder_keys:
        return emit(
            {
                "ok": not args.required,
                "placeholderKeys": placeholder_keys,
                "reason": "S3/R2 config contains placeholder values.",
                "skipped": not args.required,
            }
        )

    report = run_storage_smoke(args)
    return emit(report)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify S3/R2 object storage isolation with a temporary object.",
    )
    parser.add_argument(
        "--env-file",
        default=None,
        help="Optional dotenv file to load before checks.",
    )
    parser.add_argument(
        "--required",
        action="store_true",
        help="Fail instead of skip when storage is not configured.",
    )
    parser.add_argument(
        "--allow-public-base-url",
        action="store_true",
        help="Allow S3_PUBLIC_BASE_URL to be set.",
    )
    parser.add_argument(
        "--probe-public-url",
        action="store_true",
        help="Fail if the temporary object is publicly readable.",
    )
    parser.add_argument("--public-probe-timeout", default=5, type=float)
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


def should_run(required: bool) -> bool:
    driver = os.getenv("TANGENT_ASSET_STORAGE_DRIVER", "").strip()
    legacy_configured = all(
        os.getenv(key, "").strip()
        for key in ("S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY")
    )
    return required or driver == "s3-compatible" or legacy_configured


def placeholder_config_keys() -> list[str]:
    keys = ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]
    return [key for key in keys if looks_placeholder(os.getenv(key, ""))]


def looks_placeholder(value: str) -> bool:
    lowered = value.strip().lower()
    return not lowered or any(marker in lowered for marker in PLACEHOLDER_MARKERS)


def run_storage_smoke(args: argparse.Namespace) -> dict[str, Any]:
    start = time.perf_counter()
    failures: list[str] = []
    key = f"security-smoke/object-storage-{uuid.uuid4().hex}.txt"
    body = b"tangent object storage security smoke\n"
    config = S3AssetStorageConfig.from_env()
    client = create_s3_client(config)
    public_probe = "not-checked"

    delete_error = None
    try:
        client.put_object(Bucket=config.bucket, Key=key, Body=body, ContentType="text/plain")
        head = client.head_object(Bucket=config.bucket, Key=key)
        fetched = client.get_object(Bucket=config.bucket, Key=key)["Body"].read()
        if fetched != body:
            failures.append("read body did not match written smoke object")
        if int(head.get("ContentLength") or 0) != len(body):
            failures.append("head object content length did not match")
        public_probe = probe_public_url(config, key, args)
        if public_probe == "public-readable":
            failures.append("temporary object was publicly readable")
    except Exception as exc:
        failures.append(f"{type(exc).__name__}: {exc}")
    finally:
        delete_error = delete_smoke_object(client, config.bucket, key)

    if delete_error:
        failures.append(delete_error)

    if config.public_base_url and not args.allow_public_base_url:
        failures.append("S3_PUBLIC_BASE_URL is set; proxy-only private assets are expected")
    if bucket_environment_mismatch(config.bucket):
        failures.append("bucket name appears to target a different environment")

    return {
        "bucket": config.bucket,
        "durationMs": round((time.perf_counter() - start) * 1000, 2),
        "failures": failures,
        "ok": not failures,
        "publicProbe": public_probe,
    }


def probe_public_url(config: S3AssetStorageConfig, key: str, args: argparse.Namespace) -> str:
    if not config.public_base_url or not args.probe_public_url:
        return "not-checked"
    url = f"{config.public_base_url.rstrip('/')}/{key}"
    try:
        request = Request(url, method="GET", headers={"User-Agent": "tangent-security-smoke"})
        with urlopen(request, timeout=args.public_probe_timeout) as response:
            if response.status == 200:
                return "public-readable"
            return f"http-{response.status}"
    except HTTPError as exc:
        return f"http-{exc.code}"
    except URLError as exc:
        return f"unreachable:{exc.reason}"


def delete_smoke_object(client: Any, bucket: str, key: str) -> str | None:
    try:
        client.delete_object(Bucket=bucket, Key=key)
        client.get_object(Bucket=bucket, Key=key)
    except Exception as exc:
        if is_missing_object_error(exc):
            return None
        return f"delete verification failed: {type(exc).__name__}: {exc}"
    return "delete verification failed: object remained readable"


def bucket_environment_mismatch(bucket: str) -> bool:
    app_env = (os.getenv("APP_ENV") or os.getenv("TANGENT_ENV") or "").strip().lower()
    lowered = bucket.lower()
    return (
        (app_env == "production" and "staging" in lowered)
        or (app_env == "staging" and "production" in lowered)
    )


def emit(report: dict[str, Any]) -> int:
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report.get("ok") else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
