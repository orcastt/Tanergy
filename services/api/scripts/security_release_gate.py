#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class GateStep:
    name: str
    command: list[str]
    cwd: Path = REPO_ROOT


def main() -> int:
    args = parse_args()
    steps = build_steps(args)
    results = [run_step(step) for step in steps]
    failures = [result for result in results if result["returnCode"] != 0]
    report = {
        "failed": len(failures),
        "ok": not failures,
        "ran": len(results),
        "skipped": skipped_checks(args),
        "steps": results,
    }
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if not failures else 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the local security release gate.")
    parser.add_argument("--env-file", default=".env", help="Dotenv file for deploy config checks.")
    parser.add_argument("--skip-e2e", action="store_true", help="Skip browser E2E checks.")
    parser.add_argument(
        "--skip-web-build",
        action="store_true",
        help="Skip the web production build.",
    )
    parser.add_argument(
        "--check-redis-connectivity",
        action="store_true",
        help="Require live Redis connectivity.",
    )
    parser.add_argument(
        "--check-object-storage",
        action="store_true",
        help="Require live S3/R2 smoke.",
    )
    parser.add_argument(
        "--require-external-ops-proof",
        action="store_true",
        help="Require WAF/PITR/status/Sentry proof.",
    )
    parser.add_argument(
        "--check-external-ops-urls",
        action="store_true",
        help="Probe configured status/monitor URLs.",
    )
    parser.add_argument("--staging-base-url", default=os.getenv("SECURITY_SMOKE_BASE_URL"))
    parser.add_argument("--staging-bearer-token", default=os.getenv("SECURITY_SMOKE_BEARER_TOKEN"))
    parser.add_argument("--staging-origin", default=os.getenv("SECURITY_SMOKE_ORIGIN"))
    parser.add_argument("--staging-workspace-id", default=os.getenv("SECURITY_SMOKE_WORKSPACE_ID"))
    return parser.parse_args()


def build_steps(args: argparse.Namespace) -> list[GateStep]:
    steps = [
        GateStep(
            "web-next-security-guard",
            ["node", "apps/web/scripts/next-security-guard-smoke.mjs"],
        ),
        GateStep(
            "web-share-password-smoke",
            ["node", "apps/web/scripts/local-share-password-smoke.mjs"],
        ),
        GateStep(
            "web-public-share-client-smoke",
            ["node", "apps/web/scripts/public-share-client-smoke.mjs"],
        ),
        GateStep(
            "web-static-security-guard",
            ["node", "apps/web/scripts/security-static-guard.mjs"],
        ),
        GateStep("npm-audit-high", ["npm", "audit", "--audit-level=high"]),
        GateStep("web-typecheck", ["npm", "-C", "apps/web", "run", "typecheck"]),
        GateStep("web-lint", ["npm", "-C", "apps/web", "run", "lint"]),
    ]
    if not args.skip_web_build:
        steps.append(GateStep("web-build", ["npm", "-C", "apps/web", "run", "build"]))
    if not args.skip_e2e:
        steps.append(GateStep("web-e2e", ["npm", "-C", "apps/web", "run", "test:e2e:ci"]))
    steps.extend(
        [
            GateStep(
                "api-compileall",
                [
                    "python3",
                    "-m",
                    "compileall",
                    "services/api/tangent_api",
                    "services/api/migrations",
                    "services/api/scripts",
                ],
            ),
            GateStep(
                "api-performance-smoke",
                ["python3", "services/api/scripts/security_api_performance_smoke.py"],
            ),
            GateStep("api-pytest", ["python3", "-m", "pytest", "services/api/tests"]),
            GateStep("deploy-config-smoke", deploy_config_command(args)),
        ]
    )
    if args.check_redis_connectivity:
        steps.append(
            GateStep(
                "redis-security-smoke",
                ["python3", "services/api/scripts/security_redis_smoke.py", "--required"],
            )
        )
    if args.check_object_storage:
        steps.append(GateStep("object-storage-security-smoke", object_storage_command(args)))
    if args.require_external_ops_proof:
        steps.append(GateStep("ops-external-proof-smoke", external_ops_command(args)))
    if has_staging_args(args):
        steps.append(GateStep("staging-auth-smoke", staging_auth_command(args)))
    steps.append(GateStep("diff-check", ["git", "diff", "--check"]))
    return steps


def deploy_config_command(args: argparse.Namespace) -> list[str]:
    command = [
        "python3",
        "services/api/scripts/security_deploy_config_smoke.py",
        "--env-file",
        args.env_file,
        "--production-like",
    ]
    if args.check_redis_connectivity:
        command.append("--check-redis-connectivity")
    return command


def object_storage_command(args: argparse.Namespace) -> list[str]:
    return [
        "python3",
        "services/api/scripts/security_object_storage_smoke.py",
        "--env-file",
        args.env_file,
        "--required",
        "--probe-public-url",
    ]


def external_ops_command(args: argparse.Namespace) -> list[str]:
    command = [
        "python3",
        "services/api/scripts/ops_external_proof_smoke.py",
        "--env-file",
        args.env_file,
        "--production-like",
        "--required",
    ]
    if args.check_external_ops_urls:
        command.append("--check-urls")
    return command


def staging_auth_command(args: argparse.Namespace) -> list[str]:
    command = [
        "python3",
        "services/api/scripts/security_staging_auth_smoke.py",
        "--base-url",
        args.staging_base_url,
        "--bearer-token",
        args.staging_bearer_token,
        "--workspace-id",
        args.staging_workspace_id,
    ]
    if args.staging_origin:
        command.extend(["--origin", args.staging_origin])
    return command


def has_staging_args(args: argparse.Namespace) -> bool:
    provided = [args.staging_base_url, args.staging_bearer_token, args.staging_workspace_id]
    if any(provided) and not all(provided):
        raise SystemExit("Provide staging base URL, bearer token and workspace id together.")
    return all(provided)


def skipped_checks(args: argparse.Namespace) -> list[str]:
    skipped = []
    if args.skip_e2e:
        skipped.append("web-e2e")
    if args.skip_web_build:
        skipped.append("web-build")
    if not args.check_redis_connectivity:
        skipped.append("redis-connectivity")
    if not args.check_object_storage:
        skipped.append("object-storage")
    if not args.require_external_ops_proof:
        skipped.append("external-ops-proof")
    if not has_staging_args(args):
        skipped.append("staging-auth-smoke")
    return skipped


def run_step(step: GateStep) -> dict[str, object]:
    print(f"==> {step.name}: {' '.join(step.command)}", flush=True)
    completed = subprocess.run(
        step.command,
        cwd=step.cwd,
        env=command_env(),
        text=True,
    )
    return {
        "command": step.command,
        "name": step.name,
        "returnCode": completed.returncode,
    }


def command_env() -> dict[str, str]:
    env = os.environ.copy()
    pythonpath = str(REPO_ROOT / "services/api")
    existing = env.get("PYTHONPATH")
    env["PYTHONPATH"] = pythonpath if not existing else f"{pythonpath}{os.pathsep}{existing}"
    return env


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
