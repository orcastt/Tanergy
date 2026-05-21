"""Run the current S4 smoke suite as one readiness preflight."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any


def main() -> None:
    args = parse_args()
    script_dir = Path(__file__).resolve().parent
    checks = [
        ("invite", script_dir / "s4_workspace_invite_smoke.py"),
        ("presence", script_dir / "s4_collaboration_presence_smoke.py"),
    ]
    if not args.skip_realtime:
        checks.append(("realtime", script_dir / "s4_realtime_resync_smoke.py"))

    report: dict[str, Any] = {
        "baseUrl": args.base_url.rstrip("/"),
        "checks": {},
        "ok": True,
    }
    for check_name, script_path in checks:
        result = run_check(script_path, args)
        report["checks"][check_name] = result
        if not result["ok"]:
            report["ok"] = False

    report["nextManualSteps"] = build_next_steps(report["ok"])
    print(json.dumps(report, indent=2, sort_keys=True))
    if not report["ok"]:
        raise SystemExit(1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the S4 collaboration readiness preflight.")
    parser.add_argument("--base-url", default=os.getenv("S4_SMOKE_BASE_URL", "http://127.0.0.1:8100"))
    parser.add_argument("--origin", default=os.getenv("S4_SMOKE_ORIGIN"))
    parser.add_argument("--skip-realtime", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    return parser.parse_args()


def run_check(script_path: Path, args: argparse.Namespace) -> dict[str, Any]:
    command = [sys.executable, str(script_path), "--base-url", args.base_url]
    if args.origin:
        command.extend(["--origin", args.origin])
    if args.verbose and script_path.name == "s4_realtime_resync_smoke.py":
        command.append("--verbose")

    completed = subprocess.run(
        command,
        capture_output=True,
        env=os.environ.copy(),
        text=True,
    )
    payload = parse_json_output(completed.stdout)
    return {
        "ok": completed.returncode == 0,
        "payload": payload,
        "returnCode": completed.returncode,
        "script": script_path.name,
        "stderr": trim_text(completed.stderr),
        "stdout": None if payload is not None else trim_text(completed.stdout),
    }


def parse_json_output(stdout: str) -> dict[str, Any] | None:
    stripped = stdout.strip()
    if not stripped:
        return None
    try:
        payload = json.loads(stripped)
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else {"value": payload}


def trim_text(value: str, limit: int = 4000) -> str | None:
    stripped = value.strip()
    if not stripped:
        return None
    return stripped[:limit]


def build_next_steps(all_green: bool) -> list[str]:
    if not all_green:
        return [
            "Fix the failing smoke above before starting real signed-in browser collaboration tests.",
            "Re-run this readiness script until invite, presence, and realtime all return ok=true.",
        ]
    return [
        "Run a real signed-in Team invite: owner creates board-target invite, invitee accepts, board opens directly.",
        "Open the same board in two signed-in browsers and verify cursor, page label, activity label, and roster state.",
        "On the same board, validate focused-edit occupancy for text, node params, image crop, and chat model menu.",
        "On a multi-page board, verify page-scoped realtime edits and same-board reconnect behavior.",
    ]


if __name__ == "__main__":
    main()
