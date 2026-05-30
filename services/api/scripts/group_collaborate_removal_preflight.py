"""Preflight inventory + full-DB pg_dump for the group/collaborate removal (PR [4]).

Snapshots existing group/collaborate state, runs four hard abort checks, then takes
two full-DB pg_dump artifacts (schema-only + data-only) as PR [4]'s rollback substrate.

Usage: PYTHONPATH=services/api python3 services/api/scripts/group_collaborate_removal_preflight.py

Prereqs: source deploy/<env>/api.env first so DATABASE_URL,
TANGENT_BILLING_SELF_SERVE_CHECKOUT and TANGENT_ENV (staging|production) load;
non-TTY runs also need TANGENT_PREFLIGHT_CONFIRM=<env>; pg_dump >= 14 on PATH.

Outputs (gitignored except manifest):
    scripts/_local/group_removal_preflight_<ts>.json    full snapshot
    scripts/_local/group_removal_schema_<ts>.sql        pg_dump --schema-only
    scripts/_local/group_removal_data_<ts>.sql          pg_dump --data-only (entire DB)
    migrations/_evidence/group_removal_<ts>.md          redacted manifest (COMMIT)

Plan ref: GitHub epic #50, slice issue #55 (preflight + static grep gate).
"""

from __future__ import annotations

import datetime as _dt
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, unquote, urlencode, urlsplit, urlunsplit

import psycopg


API_ROOT = Path(__file__).resolve().parents[1]
LOCAL_DIR = API_ROOT / "scripts" / "_local"
EVIDENCE_DIR = API_ROOT / "migrations" / "_evidence"

# 35 tables migration 0034 is expected to touch. This tuple is ONLY a schema-existence
# assertion (see _assert_tables_exist), not proof of per-table impact — the full
# data-only pg_dump is the authoritative blast-radius evidence; the manifest is a subset.
MUTATED_TABLES: tuple[str, ...] = (
    "tangent_workspaces", "tangent_plan_catalog", "tangent_workspace_dashboard_snapshots",
    "tangent_subscriptions", "tangent_credit_accounts", "tangent_security_daily_usage",
    "tangent_workspace_memberships", "tangent_workspace_members", "tangent_workspace_invitations",
    "tangent_collections", "tangent_auth_sessions", "tangent_boards", "tangent_assets",
    "tangent_ai_runs", "tangent_api_call_logs", "tangent_workspace_seat_assignments",
    "tangent_workspace_usage_rollups", "tangent_ai_api_calls", "tangent_api_cost_ledger",
    "tangent_collection_boards", "tangent_board_assets", "tangent_board_snapshots",
    "tangent_board_members", "tangent_board_user_preferences", "tangent_board_share_links",
    "tangent_board_collaboration_sessions", "tangent_board_realtime_documents",
    "tangent_asset_variants", "tangent_ai_run_assets", "tangent_admin_audit_logs",
    "tangent_analytics_events", "tangent_moderation_items", "tangent_ai_control_plane_versions",
    "tangent_credit_ledger", "tangent_security_events",
)


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
        SELECT id, account_id, kind, status, provider, amount_cents, checkout_session_id, created_at
        FROM tangent_payments WHERE kind = 'collaborate_subscription'
    """)
    snap["group_structure_dashboards"] = _rows(conn, """
        SELECT id, workspace_id, snapshot_kind, period_start
        FROM tangent_workspace_dashboard_snapshots WHERE snapshot_kind = 'group_structure'
    """)
    cascade = ("boards", "assets", "ai_runs", "api_call_logs", "auth_sessions")
    snap["cascade_row_counts"] = (
        {n: _scalar(conn, f"SELECT COUNT(*) FROM tangent_{n} WHERE workspace_id = ANY(%s)", (gw,)) for n in cascade}
        if gw else {n: 0 for n in cascade})
    snap["in_flight_checkouts"] = _rows(conn,
        "SELECT id, provider_payment_id, provider, status FROM tangent_payments"
        " WHERE kind = 'collaborate_subscription' AND status IN ('pending', 'requires_action')"
        " AND checkout_session_id IS NOT NULL")
    # workspace_id ON DELETE SET NULL (nullable FK) — rows survive, fk cleared. EXCEPT
    # security_daily_usage: workspace_id is NOT NULL + PK (migration 0031), so PR4 must
    # DELETE those rows, not null them — hence the _delete_count key, not _setnull_count.
    for key, tbl in (("credit_ledger_setnull_count", "tangent_credit_ledger"),
                     ("security_events_setnull_count", "tangent_security_events"),
                     ("security_daily_usage_delete_count", "tangent_security_daily_usage")):
        snap[key] = _scalar(conn, f"SELECT COUNT(*) FROM {tbl} WHERE workspace_id = ANY(%s)", (gw,)) if gw else 0
    return snap


def check_aborts(conn: psycopg.Connection) -> list[dict[str, Any]]:
    a1 = _scalar(conn, "SELECT COUNT(*) FROM tangent_subscriptions WHERE plan_family = 'collaborate'"
                 " AND status IN ('active', 'trialing', 'paused')"
                 " AND provider NOT IN ('admin_manual', 'manual_test')")
    a2 = _scalar(conn, "SELECT COUNT(*) FROM tangent_payments WHERE kind = 'collaborate_subscription'"
                 " AND status IN ('pending', 'succeeded', 'requires_action')"
                 " AND provider NOT IN ('admin_manual', 'manual_test')")
    a3 = _scalar(conn, "SELECT COUNT(*) FROM tangent_payments WHERE kind = 'collaborate_subscription'"
                 " AND checkout_session_id IS NOT NULL AND status IN ('pending', 'requires_action')"
                 " AND provider NOT IN ('admin_manual', 'manual_test')")
    a4 = _check_self_serve_gate()
    specs = [("A1", "real-provider active/trialing/paused collaborate subscriptions", a1),
             ("A2", "real-provider pending/succeeded/requires_action collaborate payments", a2),
             ("A3", "open hosted-checkout sessions for collaborate", a3)]
    return [{"id": i, "description": d, "count": c, "passed": c == 0} for i, d, c in specs] + [a4]


def _check_self_serve_gate() -> dict[str, Any]:
    """A4: self-serve hosted checkout must be EXPLICITLY closed for a destructive preflight.

    Fail closed — an unset or unrecognized TANGENT_BILLING_SELF_SERVE_CHECKOUT does
    NOT pass; the operator must source the real env so the gate state is unambiguous.
    Source of truth is the env var (routers/billing.py
    `_require_self_serve_checkout_enabled`); HTTP probing is unreliable (auth/Pydantic
    layers can mask it), so read directly.
    """
    raw = os.environ.get("TANGENT_BILLING_SELF_SERVE_CHECKOUT")
    val = (raw or "").strip().lower()
    if val in {"0", "false", "off", "no"}:
        passed, state = True, f"explicitly closed ('{raw}')"
    elif val in {"1", "true", "on", "yes"}:
        passed, state = False, f"OPEN ('{raw}')"
    else:
        passed, state = False, f"unset/ambiguous ('{raw}') — source env explicitly"
    return {
        "id": "A4",
        "description": f"TANGENT_BILLING_SELF_SERVE_CHECKOUT — {state}",
        "value": raw or "",
        "passed": passed,
    }


def pg_dump_full(database_url: str, dest: Path, mode: str) -> None:
    assert mode in {"schema-only", "data-only"}, mode
    dsn, pw = _argv_safe_dsn(database_url)  # password -> PGPASSWORD, never argv (`ps`/proc)
    env = {**os.environ, "PGPASSWORD": pw} if pw is not None else dict(os.environ)
    subprocess.run(
        ["pg_dump", "--no-owner", "--no-privileges", f"--{mode}", "--file", str(dest), dsn],
        check=True, env=env,
    )


def _argv_safe_dsn(url: str) -> tuple[str, str | None]:
    """Return (DSN with all password material stripped from argv, decoded password).

    IPv6-safe (edits netloc/query, no host+port rebuild); captures a password from
    netloc OR ?password= and drops both. PGPASSWORD isn't URL-decoded by libpq, so unquoted.
    """
    p = urlsplit(url)
    pairs = parse_qsl(p.query, keep_blank_values=True)
    q_pw = next((v for k, v in pairs if k.lower() == "password"), None)
    if not p.password and q_pw is None:
        return url, None
    netloc = p.netloc.replace(":" + p.password + "@", "@", 1) if p.password else p.netloc
    query = urlencode([(k, v) for k, v in pairs if k.lower() != "password"])  # passfile is a path, not a secret — leave it
    return urlunsplit(p._replace(netloc=netloc, query=query)), (unquote(p.password) if p.password else q_pw)


def write_manifest(path: Path, *, ts: str, snap: dict[str, Any], aborts: list[dict[str, Any]],
                   schema_dump: Path, data_dump: Path, script_sha: str) -> None:
    lines = [
        f"# Group/Collaborate removal preflight — {ts}",
        "",
        f"- Repo HEAD: `{script_sha}`",
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
        f"- security_daily_usage_delete_count: {snap['security_daily_usage_delete_count']}",
        "",
        "### Cascade row counts",
        "",
    ]
    lines.extend(f"- {n}: {c}" for n, c in snap["cascade_row_counts"].items())
    lines.extend(["", "## Abort checks", "", "| ID | Description | Result |", "| --- | --- | --- |"])
    for c in aborts:
        result = "PASS" if c["passed"] else "FAIL"
        detail = c.get("count", c.get("status", c.get("error", c.get("value", ""))))
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


def _script_sha() -> str:
    """Repo HEAD commit, suffixed `-dirty` if this script has uncommitted edits."""
    try:
        head = subprocess.run(["git", "rev-parse", "HEAD"],
                              capture_output=True, text=True, check=True).stdout.strip()[:12]
        dirty = subprocess.run(["git", "status", "--porcelain", "--", __file__],
                               capture_output=True, text=True, check=True).stdout.strip()
        return f"{head}-dirty" if dirty else head
    except Exception:
        return "unknown"


def main() -> int:
    ts = _dt.datetime.now(_dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not set (source deploy/staging/api.env first)", file=sys.stderr)
        return 1
    env_name = os.environ.get("TANGENT_ENV", "").strip().lower()
    if env_name not in {"staging", "production"}:
        print("ERROR: TANGENT_ENV must be 'staging' or 'production' (source the env file)", file=sys.stderr)
        return 1
    print(f"[preflight] target env: {env_name} · DB: {_argv_safe_dsn(database_url)[0]}")
    confirm = os.environ.get("TANGENT_PREFLIGHT_CONFIRM", "").strip()
    if not confirm and sys.stdin.isatty():
        confirm = input(f"Type '{env_name}' to confirm destructive-preflight target: ").strip()
    if confirm != env_name:
        print(f"ERROR: confirmation required — set TANGENT_PREFLIGHT_CONFIRM={env_name} or run on a TTY", file=sys.stderr)
        return 1

    LOCAL_DIR.mkdir(parents=True, exist_ok=True)
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    json_path = LOCAL_DIR / f"group_removal_preflight_{ts}.json"
    schema_path = LOCAL_DIR / f"group_removal_schema_{ts}.sql"
    data_path = LOCAL_DIR / f"group_removal_data_{ts}.sql"
    manifest_path = EVIDENCE_DIR / f"group_removal_{ts}.md"

    print(f"[preflight] outputs: {LOCAL_DIR} (snapshot + dumps), {manifest_path} (manifest)")

    with psycopg.connect(database_url) as conn:
        missing = _assert_tables_exist(conn)
        if missing:
            print(f"ERROR: schema drift — mutated tables missing: {missing}", file=sys.stderr)
            return 1
        print(f"[preflight] schema-drift check OK ({len(MUTATED_TABLES)} tables present)")
        snap = fetch_inventory(conn)
        aborts = check_aborts(conn)

    failed = [c for c in aborts if not c["passed"]]
    if failed:
        print("ABORT — one or more checks failed; no pg_dump written:", file=sys.stderr)
        for c in failed:
            d = c.get("count", c.get("status", c.get("error", c.get("value", ""))))
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
