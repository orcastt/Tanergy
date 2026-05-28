"""Preflight inventory + full-DB pg_dump for the group/collaborate removal (PR [4]).

Snapshots existing group/collaborate state, runs four hard abort checks, then takes
two full-DB pg_dump artifacts (schema-only + data-only) as PR [4]'s rollback substrate.

Usage:
    PYTHONPATH=services/api python3 \\
      services/api/scripts/group_collaborate_removal_preflight.py \\
      --api-base-url https://staging.api.tanergy.app

Prereqs: DATABASE_URL in env, pg_dump >= 14 on PATH, API base URL reachable.

Outputs (gitignored except manifest):
    scripts/_local/group_removal_preflight_<ts>.json    full snapshot
    scripts/_local/group_removal_schema_<ts>.sql        pg_dump --schema-only
    scripts/_local/group_removal_data_<ts>.sql          pg_dump --data-only (entire DB)
    migrations/_evidence/group_removal_<ts>.md          redacted manifest (COMMIT)

Plan ref: dev-plans/group-removal-01-preflight-gate.md §1, master plan §0.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import psycopg


API_ROOT = Path(__file__).resolve().parents[1]
LOCAL_DIR = API_ROOT / "scripts" / "_local"
EVIDENCE_DIR = API_ROOT / "migrations" / "_evidence"

# 30 tables touched by migration 0034 (direct DELETE/UPDATE, cascade, SET NULL,
# transitive cascade children). Asserted to exist for schema-drift sanity; pg_dump
# scope is the entire DB so FK-parent tables (e.g. tangent_users) are also captured.
MUTATED_TABLES: tuple[str, ...] = (
    "tangent_workspaces", "tangent_plan_catalog", "tangent_workspace_dashboard_snapshots",
    "tangent_subscriptions", "tangent_credit_accounts", "tangent_security_daily_usage",
    "tangent_workspace_memberships", "tangent_workspace_members", "tangent_workspace_invitations",
    "tangent_collections", "tangent_auth_sessions", "tangent_boards", "tangent_assets",
    "tangent_ai_runs", "tangent_api_call_logs", "tangent_workspace_seat_assignments",
    "tangent_workspace_usage_rollups", "tangent_ai_api_calls", "tangent_api_cost_ledger",
    "tangent_collection_boards", "tangent_board_assets", "tangent_board_snapshots",
    "tangent_asset_variants", "tangent_ai_run_assets", "tangent_admin_audit_logs",
    "tangent_analytics_events", "tangent_moderation_items", "tangent_ai_control_plane_versions",
    "tangent_credit_ledger", "tangent_security_events",
)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--api-base-url", required=True,
                   help="API base URL for the self-serve gate sanity POST")
    p.add_argument("--timestamp",
                   default=_dt.datetime.now(_dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ"))
    return p.parse_args()


def fetch_inventory(conn: psycopg.Connection) -> dict[str, Any]:
    snap: dict[str, Any] = {}
    snap["group_workspaces"] = _rows(conn, """
        SELECT id, owner_id, billing_owner_user_id, status, created_at
        FROM tangent_workspaces WHERE kind = 'group_workspace'
    """)
    gw = [r["id"] for r in snap["group_workspaces"]]
    snap["workspace_scoped_credit_accounts"] = _rows(conn, """
        SELECT id, owner_id, status FROM tangent_credit_accounts
        WHERE owner_type = 'workspace' AND owner_id = ANY(%s)
    """, (gw,)) if gw else []
    snap["collaborate_subscriptions"] = _rows(conn, """
        SELECT id, account_id, plan_key, workspace_id, status, provider
        FROM tangent_subscriptions WHERE plan_family = 'collaborate'
    """)
    snap["collaborate_payments"] = _rows(conn, """
        SELECT id, user_id, kind, status, provider, amount_cents, checkout_session_id, created_at
        FROM tangent_payments WHERE kind = 'collaborate_subscription'
    """)
    snap["group_structure_dashboards"] = _rows(conn, """
        SELECT id, workspace_id, snapshot_kind, period_start
        FROM tangent_workspace_dashboard_snapshots WHERE snapshot_kind = 'group_structure'
    """)
    cascade_sql = {
        "boards":         "SELECT COUNT(*) FROM tangent_boards         WHERE workspace_id = ANY(%s)",
        "assets":         "SELECT COUNT(*) FROM tangent_assets         WHERE workspace_id = ANY(%s)",
        "ai_runs":        "SELECT COUNT(*) FROM tangent_ai_runs        WHERE workspace_id = ANY(%s)",
        "api_call_logs":  "SELECT COUNT(*) FROM tangent_api_call_logs  WHERE workspace_id = ANY(%s)",
        "auth_sessions":  "SELECT COUNT(*) FROM tangent_auth_sessions  WHERE workspace_id = ANY(%s)",
    }
    snap["cascade_row_counts"] = ({n: _scalar(conn, q, (gw,)) for n, q in cascade_sql.items()}
                                  if gw else {n: 0 for n in cascade_sql})
    snap["in_flight_checkouts"] = _rows(conn, """
        SELECT id, payment_id, provider, status FROM tangent_payments
        WHERE kind = 'collaborate_subscription'
          AND status IN ('pending', 'requires_action')
          AND checkout_session_id IS NOT NULL
    """)
    snap["credit_ledger_setnull_count"] = (
        _scalar(conn, "SELECT COUNT(*) FROM tangent_credit_ledger WHERE workspace_id = ANY(%s)", (gw,)) if gw else 0)
    snap["security_events_setnull_count"] = (
        _scalar(conn, "SELECT COUNT(*) FROM tangent_security_events WHERE workspace_id = ANY(%s)", (gw,)) if gw else 0)
    snap["security_daily_usage_setnull_count"] = (
        _scalar(conn, "SELECT COUNT(*) FROM tangent_security_daily_usage WHERE workspace_id = ANY(%s)", (gw,)) if gw else 0)
    return snap


def check_aborts(conn: psycopg.Connection, api_base_url: str) -> list[dict[str, Any]]:
    a1 = _scalar(conn, """
        SELECT COUNT(*) FROM tangent_subscriptions WHERE plan_family = 'collaborate'
          AND status IN ('active', 'trialing', 'paused') AND provider != 'manual'
    """)
    a2 = _scalar(conn, """
        SELECT COUNT(*) FROM tangent_payments WHERE kind = 'collaborate_subscription'
          AND status IN ('pending', 'succeeded', 'requires_action') AND provider != 'manual'
    """)
    a3 = _scalar(conn, """
        SELECT COUNT(*) FROM tangent_payments WHERE kind = 'collaborate_subscription'
          AND checkout_session_id IS NOT NULL
          AND status NOT IN ('canceled', 'expired', 'failed')
    """)
    a4 = _check_self_serve_gate(api_base_url)
    return [
        {"id": "A1", "description": "non-manual active/trialing/paused collaborate subscriptions",
         "count": a1, "passed": a1 == 0},
        {"id": "A2", "description": "non-manual pending/succeeded/requires_action collaborate payments",
         "count": a2, "passed": a2 == 0},
        {"id": "A3", "description": "open hosted-checkout sessions for collaborate",
         "count": a3, "passed": a3 == 0},
        a4,
    ]


def _check_self_serve_gate(api_base_url: str) -> dict[str, Any]:
    """POST /api/v1/billing/collaborate/checkout; abort only on 2xx (gate open)."""
    import httpx
    url = api_base_url.rstrip("/") + "/api/v1/billing/collaborate/checkout"
    try:
        status = httpx.post(url, json={}, timeout=10.0).status_code
    except httpx.HTTPError as exc:
        return {"id": "A4", "description": f"self-serve gate POST to {url}",
                "status": "error", "error": str(exc), "passed": False}
    return {"id": "A4", "description": f"self-serve gate POST to {url}",
            "status": status, "passed": not (200 <= status < 300)}


def pg_dump_full(database_url: str, dest: Path, mode: str) -> None:
    assert mode in {"schema-only", "data-only"}, mode
    subprocess.run(
        ["pg_dump", "--no-owner", "--no-privileges", f"--{mode}", "--file", str(dest), database_url],
        check=True,
    )


def write_manifest(path: Path, *, ts: str, snap: dict[str, Any], aborts: list[dict[str, Any]],
                   schema_dump: Path, data_dump: Path, script_sha: str) -> None:
    lines = [
        f"# Group/Collaborate removal preflight — {ts}",
        "",
        f"- Script SHA: `{script_sha}`",
        f"- Schema dump: `{schema_dump.name}` (local-only, gitignored)",
        f"- Data dump: `{data_dump.name}` (local-only, gitignored, entire DB)",
        "",
        "## Inventory row counts",
        "",
        f"- group_workspaces: {len(snap['group_workspaces'])}",
        f"- workspace_scoped_credit_accounts: {len(snap['workspace_scoped_credit_accounts'])}",
        f"- collaborate_subscriptions: {len(snap['collaborate_subscriptions'])}",
        f"- collaborate_payments: {len(snap['collaborate_payments'])}",
        f"- group_structure_dashboards: {len(snap['group_structure_dashboards'])}",
        f"- in_flight_checkouts: {len(snap['in_flight_checkouts'])}",
        f"- credit_ledger_setnull_count: {snap['credit_ledger_setnull_count']}",
        f"- security_events_setnull_count: {snap['security_events_setnull_count']}",
        f"- security_daily_usage_setnull_count: {snap['security_daily_usage_setnull_count']}",
        "",
        "### Cascade row counts",
        "",
    ]
    lines.extend(f"- {n}: {c}" for n, c in snap["cascade_row_counts"].items())
    lines.extend(["", "## Abort checks", "", "| ID | Description | Result |", "| --- | --- | --- |"])
    for c in aborts:
        result = "PASS" if c["passed"] else "FAIL"
        detail = c.get("count", c.get("status", c.get("error", "")))
        lines.append(f"| {c['id']} | {c['description']} | {result} ({detail}) |")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _rows(conn: psycopg.Connection, sql: str, params: tuple = ()) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        cols = [d.name for d in cur.description] if cur.description else []
        return [dict(zip(cols, [_jsonable(v) for v in row])) for row in cur.fetchall()]


def _scalar(conn: psycopg.Connection, sql: str, params: tuple = ()) -> int:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
    return int(row[0]) if row else 0


def _jsonable(v: Any) -> Any:
    return v.isoformat() if isinstance(v, (_dt.datetime, _dt.date)) else v


def _assert_tables_exist(conn: psycopg.Connection) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = ANY(%s)",
            (list(MUTATED_TABLES),),
        )
        present = {row[0] for row in cur.fetchall()}
    return [t for t in MUTATED_TABLES if t not in present]


def _redact(url: str) -> str:
    p = urlsplit(url)
    return urlunsplit(p._replace(netloc=p.netloc.replace(":" + p.password, ":***"))) if p.password else url


def _script_sha() -> str:
    try:
        return subprocess.run(["git", "rev-parse", "HEAD"],
                              capture_output=True, text=True, check=True).stdout.strip()[:12]
    except Exception:
        return "unknown"


def main() -> int:
    args = parse_args()
    ts = args.timestamp
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not set (source deploy/staging/api.env first)", file=sys.stderr)
        return 1

    LOCAL_DIR.mkdir(parents=True, exist_ok=True)
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    json_path = LOCAL_DIR / f"group_removal_preflight_{ts}.json"
    schema_path = LOCAL_DIR / f"group_removal_schema_{ts}.sql"
    data_path = LOCAL_DIR / f"group_removal_data_{ts}.sql"
    manifest_path = EVIDENCE_DIR / f"group_removal_{ts}.md"

    print(f"[preflight] DB: {_redact(database_url)}")
    print(f"[preflight] outputs: {LOCAL_DIR} (snapshot + dumps), {manifest_path} (manifest)")

    with psycopg.connect(database_url) as conn:
        missing = _assert_tables_exist(conn)
        if missing:
            print(f"ERROR: schema drift — mutated tables missing: {missing}", file=sys.stderr)
            return 1
        print(f"[preflight] schema-drift check OK ({len(MUTATED_TABLES)} tables present)")
        snap = fetch_inventory(conn)
        aborts = check_aborts(conn, args.api_base_url)

    failed = [c for c in aborts if not c["passed"]]
    if failed:
        print("ABORT — one or more checks failed; no pg_dump written:", file=sys.stderr)
        for c in failed:
            d = c.get("count", c.get("status", c.get("error", "")))
            print(f"  {c['id']}: {c['description']} -> {d}", file=sys.stderr)
        return 1

    json_path.write_text(json.dumps(snap, indent=2, default=_jsonable), encoding="utf-8")
    print(f"[preflight] snapshot written: {json_path}")
    pg_dump_full(database_url, schema_path, "schema-only")
    print(f"[preflight] schema dump written: {schema_path}")
    pg_dump_full(database_url, data_path, "data-only")
    print(f"[preflight] data dump written: {data_path}")
    write_manifest(manifest_path, ts=ts, snap=snap, aborts=aborts,
                   schema_dump=schema_path, data_dump=data_path, script_sha=_script_sha())
    print(f"[preflight] manifest written: {manifest_path}")
    print("[preflight] OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
