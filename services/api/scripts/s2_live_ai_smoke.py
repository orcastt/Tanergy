"""Run a real AI smoke against the FastAPI AiRun contract.

This script first creates one image-generation run, waits for it to settle,
then feeds the generated asset into one image-analysis run. It is useful for
local real-DB smoke and later staging/provider acceptance.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from typing import Any, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


TERMINAL_STATUSES = {"canceled", "failed", "succeeded"}


def main() -> None:
    args = parse_args()
    headers = build_headers(args)

    report: dict[str, Any] = {
        "baseUrl": args.base_url.rstrip("/"),
        "checks": {},
        "headers": {
            "hasAuthorization": "Authorization" in headers,
            "origin": headers.get("Origin"),
            "workspaceId": headers.get("x-tangent-workspace-id"),
            "workspaceKind": headers.get("x-tangent-workspace-kind"),
        },
    }

    report["checks"]["health"] = request_json("GET", args.base_url, "/health", headers)
    if not report["checks"]["health"].get("ok"):
        print(json.dumps(report, indent=2, sort_keys=True))
        raise SystemExit(1)

    image_payload = {
        "boardId": args.board_id,
        "nodeId": "smoke_image_gen_node",
        "nodeType": "image_gen",
        "params": {
            "count": 1,
            "resolution": args.image_resolution,
        },
        "prompt": args.image_prompt,
        "runType": "image_generation",
        "selectedModelId": args.image_model_id,
    }
    created_image = request_json("POST", args.base_url, "/api/v1/ai/runs", headers, image_payload)
    report["checks"]["createImageRun"] = created_image
    if not created_image.get("ok"):
        print(json.dumps(report, indent=2, sort_keys=True))
        raise SystemExit(1)

    image_run = poll_run(
        args.base_url,
        created_image["json"]["run"]["runId"],
        headers,
        timeout_seconds=args.timeout_seconds,
    )
    report["checks"]["settledImageRun"] = image_run
    if image_run["status"] != "succeeded":
        print(json.dumps(report, indent=2, sort_keys=True))
        raise SystemExit(1)

    output_asset_ids = image_run.get("outputAssetIds") or []
    if not output_asset_ids or args.skip_analysis:
        print(json.dumps(report, indent=2, sort_keys=True))
        if output_asset_ids:
            return
        raise SystemExit(1)

    analysis_payload = {
        "boardId": args.board_id,
        "inputAssetIds": [output_asset_ids[0]],
        "nodeId": "smoke_analysis_node",
        "nodeType": "analysis",
        "prompt": args.analysis_prompt,
        "runType": "image_analysis",
        "selectedModelId": args.analysis_model_id,
    }
    created_analysis = request_json("POST", args.base_url, "/api/v1/ai/runs", headers, analysis_payload)
    report["checks"]["createAnalysisRun"] = created_analysis
    if not created_analysis.get("ok"):
        print(json.dumps(report, indent=2, sort_keys=True))
        raise SystemExit(1)

    analysis_run = poll_run(
        args.base_url,
        created_analysis["json"]["run"]["runId"],
        headers,
        timeout_seconds=args.timeout_seconds,
    )
    report["checks"]["settledAnalysisRun"] = analysis_run
    print(json.dumps(report, indent=2, sort_keys=True))

    if analysis_run["status"] != "succeeded" or not analysis_run.get("textOutput"):
        raise SystemExit(1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run live image + analysis AiRun smoke.")
    parser.add_argument("--base-url", default=os.getenv("S2_SMOKE_BASE_URL", "http://127.0.0.1:8100"))
    parser.add_argument("--bearer-token", default=os.getenv("S2_SMOKE_BEARER_TOKEN"))
    parser.add_argument("--origin", default=os.getenv("S2_SMOKE_ORIGIN"))
    parser.add_argument("--board-id", default="s2-live-smoke-board")
    parser.add_argument("--user-id", default=os.getenv("S2_SMOKE_USER_ID"))
    parser.add_argument("--workspace-id", default=os.getenv("S2_SMOKE_WORKSPACE_ID"))
    parser.add_argument("--workspace-kind", default=os.getenv("S2_SMOKE_WORKSPACE_KIND"))
    parser.add_argument("--image-model-id", default="gpt-image-2")
    parser.add_argument("--analysis-model-id", default="gpt-5-mini")
    parser.add_argument("--image-prompt", default="A simple geometric poster with one bold shape on a clean background.")
    parser.add_argument("--analysis-prompt", default="Describe the composition, colors, and subject in one concise paragraph.")
    parser.add_argument("--image-resolution", default="0.5K")
    parser.add_argument("--skip-analysis", action="store_true")
    parser.add_argument("--timeout-seconds", default=240, type=int)
    return parser.parse_args()


def build_headers(args: argparse.Namespace) -> dict[str, str]:
    headers = {
        "Accept": "application/json",
    }
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
    return headers


def poll_run(base_url: str, run_id: str, headers: dict[str, str], timeout_seconds: int) -> dict[str, Any]:
    deadline = time.time() + max(5, timeout_seconds)
    last_result: Optional[dict[str, Any]] = None
    while time.time() < deadline:
        result = request_json("GET", base_url, f"/api/v1/ai/runs/{run_id}", headers)
        if not result.get("ok"):
            return result
        run = result["json"]["run"]
        last_result = run
        if run.get("status") in TERMINAL_STATUSES:
            return run
        time.sleep(0.75)
    return {
        "error": f"Timed out waiting for {run_id} to settle.",
        "ok": False,
        "runId": run_id,
        "status": last_result.get("status") if isinstance(last_result, dict) else "unknown",
    }


def request_json(
    method: str,
    base_url: str,
    path: str,
    headers: dict[str, str],
    body: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    url = f"{base_url.rstrip('/')}{path}"
    payload = None if body is None else json.dumps(body).encode("utf-8")
    request = Request(url, data=payload, method=method)
    for key, value in headers.items():
        request.add_header(key, value)
    if payload is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urlopen(request, timeout=20) as response:
            return build_result(response.status, response.read().decode("utf-8"), response.headers)
    except HTTPError as exc:
        return build_result(exc.code, exc.read().decode("utf-8", errors="replace"), exc.headers)
    except URLError as exc:
        return {"error": f"Failed to reach {url}: {exc.reason}", "ok": False, "status": 0}


def build_result(status: int, body: str, headers: Any) -> dict[str, Any]:
    result: dict[str, Any] = {
        "contentType": headers.get("Content-Type"),
        "ok": 200 <= status < 300,
        "status": status,
    }
    try:
        result["json"] = json.loads(body)
    except json.JSONDecodeError:
        result["text"] = body
    return result


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
