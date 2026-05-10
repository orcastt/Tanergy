"""Seed demo-rich admin/operator data for local visual QA."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlparse

from tangent_api.billing_credit_accounts import ensure_credit_account
from tangent_api.env_bootstrap import load_repo_env
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url


def main() -> None:
    load_repo_env()
    args = parse_args()
    database_url = require_database_url()
    guard_write(database_url, allow_remote=args.allow_remote)

    actor_user_id = args.actor_user_id.strip() or os.getenv("TANGENT_DEV_USER_ID", "dev-user")
    actor_email = args.actor_email.strip() or "dev@tangent.local"
    seed = build_seed(args.namespace.strip() or "demo_tgy", actor_user_id)

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            ensure_actor_user(cursor, actor_user_id=actor_user_id, actor_email=actor_email)
            cleanup_seed(cursor, seed)
            if not args.clean_only:
                insert_seed(cursor, seed, actor_user_id=actor_user_id)

    mode = "cleaned" if args.clean_only else "seeded"
    print(
        json.dumps(
            {
                "mode": mode,
                "namespace": seed["namespace"],
                "actorUserId": actor_user_id,
                "groupWorkspaces": len([row for row in seed["workspaces"] if row["kind"] == "group_workspace"]),
                "teamWorkspaces": len([row for row in seed["workspaces"] if row["kind"] == "team_workspace"]),
                "users": [row["id"] for row in seed["users"]],
            },
            indent=2,
            sort_keys=True,
        )
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed local admin/operator demo data.")
    parser.add_argument("--namespace", default="demo_tgy")
    parser.add_argument("--actor-user-id", default=os.getenv("TANGENT_DEV_USER_ID", "dev-user"))
    parser.add_argument("--actor-email", default="dev@tangent.local")
    parser.add_argument("--allow-remote", action="store_true")
    parser.add_argument("--clean-only", action="store_true")
    return parser.parse_args()


def guard_write(database_url: str, *, allow_remote: bool) -> None:
    host = (urlparse(database_url).hostname or "").lower()
    safe_hosts = {"localhost", "127.0.0.1", "host.docker.internal", "postgres"}
    if host in safe_hosts or host.endswith(".internal"):
        return
    if allow_remote:
        return
    raise SystemExit(f"Refusing to seed non-local database host '{host or 'unknown'}'. Re-run with --allow-remote if intended.")


def build_seed(namespace: str, actor_user_id: str) -> dict[str, Any]:
    now = datetime.now(timezone.utc).replace(microsecond=0)
    user_id = lambda slug: f"{namespace}_user_{slug}"
    workspace_id = lambda slug: f"{namespace}_workspace_{slug}"
    board_id = lambda slug: f"{namespace}_board_{slug}"
    sub_id = lambda slug: f"{namespace}_subscription_{slug}"
    invite_id = lambda slug: f"{namespace}_invite_{slug}"
    pay_id = lambda slug: f"{namespace}_payment_{slug}"
    ledger_id = lambda slug: f"{namespace}_ledger_{slug}"
    audit_id = lambda slug: f"{namespace}_audit_{slug}"
    ts = lambda days=0, hours=0: now + timedelta(days=days, hours=hours)

    users = [
        {"id": user_id("amelia"), "email": "amelia@demo.tgy", "name": "Amelia Chen", "initials": "AC", "status": "active", "created": ts(days=-72), "login": ts(days=-1, hours=-2), "ip": "34.120.8.11"},
        {"id": user_id("marco"), "email": "marco@demo.tgy", "name": "Marco Li", "initials": "ML", "status": "active", "created": ts(days=-58), "login": ts(days=-1, hours=-5), "ip": "18.212.44.29"},
        {"id": user_id("nora"), "email": "nora@demo.tgy", "name": "Nora Singh", "initials": "NS", "status": "active", "created": ts(days=-41), "login": ts(days=-2, hours=-4), "ip": "52.41.118.73"},
        {"id": user_id("oliver"), "email": "oliver@demo.tgy", "name": "Oliver Park", "initials": "OP", "status": "suspended", "created": ts(days=-19), "login": ts(days=-6), "ip": "73.162.44.103"},
    ]
    workspaces = [
        {"id": workspace_id("team_atlas"), "name": "Atlas Studio", "kind": "team_workspace", "owner": user_id("amelia"), "created": ts(days=-63)},
        {"id": workspace_id("team_legacy"), "name": "Legacy Motion", "kind": "team_workspace", "owner": user_id("amelia"), "created": ts(days=-61)},
        {"id": workspace_id("team_nova"), "name": "Nova Ops", "kind": "team_workspace", "owner": user_id("marco"), "created": ts(days=-28)},
        {"id": workspace_id("team_aurora"), "name": "Aurora Lab", "kind": "team_workspace", "owner": user_id("nora"), "created": ts(days=-17)},
        {"id": workspace_id("group_labs"), "name": "Concept Labs", "kind": "group_workspace", "owner": user_id("amelia"), "created": ts(days=-12)},
        {"id": workspace_id("group_review"), "name": "Review Circle", "kind": "group_workspace", "owner": user_id("amelia"), "created": ts(days=-8)},
        {"id": workspace_id("group_motion"), "name": "Motion Club", "kind": "group_workspace", "owner": user_id("nora"), "created": ts(days=-10)},
    ]
    memberships = [
        (workspace_id("team_atlas"), user_id("marco"), "admin"), (workspace_id("team_atlas"), user_id("oliver"), "viewer"),
        (workspace_id("team_nova"), user_id("amelia"), "editor"), (workspace_id("team_nova"), user_id("nora"), "viewer"),
        (workspace_id("group_labs"), user_id("marco"), "editor"), (workspace_id("group_labs"), user_id("nora"), "admin"),
        (workspace_id("group_motion"), user_id("amelia"), "viewer"), (workspace_id("group_motion"), user_id("oliver"), "editor"),
    ]
    boards = [
        (board_id("atlas_home"), workspace_id("team_atlas"), user_id("amelia"), "Atlas Home", "workspace", ts(days=-1)),
        (board_id("atlas_pitch"), workspace_id("team_atlas"), user_id("marco"), "Atlas Pitch", "private", ts(days=-2)),
        (board_id("legacy_archive"), workspace_id("team_legacy"), user_id("amelia"), "Legacy Archive", "private", ts(days=-25)),
        (board_id("nova_launch"), workspace_id("team_nova"), user_id("marco"), "Nova Launch", "workspace", ts(days=-1, hours=-4)),
        (board_id("nova_ops"), workspace_id("team_nova"), user_id("amelia"), "Ops Board", "workspace", ts(days=-3)),
        (board_id("aurora_staging"), workspace_id("team_aurora"), user_id("nora"), "Aurora Staging", "workspace", ts(days=-4)),
        (board_id("labs_prompts"), workspace_id("group_labs"), user_id("amelia"), "Prompt Bench", "workspace", ts(days=-1, hours=-1)),
        (board_id("review_drop"), workspace_id("group_review"), user_id("amelia"), "Review Drop", "workspace", ts(days=-2, hours=-2)),
        (board_id("motion_refs"), workspace_id("group_motion"), user_id("nora"), "Motion Refs", "workspace", ts(days=-3, hours=-1)),
    ]
    invitations = [
        {"id": invite_id("atlas_candidate"), "workspace": workspace_id("team_atlas"), "email": "candidate@demo.tgy", "role": "viewer", "invited_by": user_id("amelia"), "target_user_id": None, "created": ts(days=-1), "expires": ts(days=6), "metadata": {"workspaceKind": "team_workspace"}},
        {"id": invite_id("labs_guest"), "workspace": workspace_id("group_labs"), "email": "guest@demo.tgy", "role": "viewer", "invited_by": user_id("amelia"), "target_user_id": None, "created": ts(days=-2), "expires": ts(days=5), "metadata": {"workspaceKind": "group_workspace"}},
        {"id": invite_id("nova_producer"), "workspace": workspace_id("team_nova"), "email": "producer@demo.tgy", "role": "admin", "invited_by": user_id("marco"), "target_user_id": None, "created": ts(days=-1, hours=-3), "expires": ts(days=7), "metadata": {"workspaceKind": "team_workspace"}},
    ]
    subscriptions = [
        {"id": sub_id("amelia_collab_plus"), "account": account_id("user", user_id("amelia")), "owner_type": "user", "owner_id": user_id("amelia"), "workspace": None, "family": "collaborate", "key": "collaborate_plus", "status": "active", "seats": 1, "start": ts(days=-6), "end": ts(days=24), "paused_at": None, "paused_by": None, "pause_reason": None},
        {"id": sub_id("amelia_collab_start_old"), "account": account_id("user", user_id("amelia")), "owner_type": "user", "owner_id": user_id("amelia"), "workspace": None, "family": "collaborate", "key": "collaborate_start", "status": "canceled", "seats": 1, "start": ts(days=-66), "end": ts(days=-36), "paused_at": None, "paused_by": None, "pause_reason": None},
        {"id": sub_id("marco_collab_start"), "account": account_id("user", user_id("marco")), "owner_type": "user", "owner_id": user_id("marco"), "workspace": None, "family": "collaborate", "key": "collaborate_start", "status": "active", "seats": 1, "start": ts(days=-15), "end": ts(days=15), "paused_at": None, "paused_by": None, "pause_reason": None},
        {"id": sub_id("nora_collab_plus"), "account": account_id("user", user_id("nora")), "owner_type": "user", "owner_id": user_id("nora"), "workspace": None, "family": "collaborate", "key": "collaborate_plus", "status": "active", "seats": 1, "start": ts(days=-9), "end": ts(days=21), "paused_at": None, "paused_by": None, "pause_reason": None},
        {"id": sub_id("oliver_collab_start_old"), "account": account_id("user", user_id("oliver")), "owner_type": "user", "owner_id": user_id("oliver"), "workspace": None, "family": "collaborate", "key": "collaborate_start", "status": "canceled", "seats": 1, "start": ts(days=-48), "end": ts(days=-18), "paused_at": None, "paused_by": None, "pause_reason": None},
        {"id": sub_id("atlas_team_start"), "account": account_id("workspace", workspace_id("team_atlas")), "owner_type": "workspace", "owner_id": workspace_id("team_atlas"), "workspace": workspace_id("team_atlas"), "family": "team", "key": "team_start", "status": "active", "seats": 3, "start": ts(days=-12), "end": ts(days=18), "paused_at": None, "paused_by": None, "pause_reason": None},
        {"id": sub_id("legacy_team_growth"), "account": account_id("workspace", workspace_id("team_legacy")), "owner_type": "workspace", "owner_id": workspace_id("team_legacy"), "workspace": workspace_id("team_legacy"), "family": "team", "key": "team_growth", "status": "canceled", "seats": 5, "start": ts(days=-58), "end": ts(days=-3), "paused_at": None, "paused_by": None, "pause_reason": None},
        {"id": sub_id("nova_team_growth"), "account": account_id("workspace", workspace_id("team_nova")), "owner_type": "workspace", "owner_id": workspace_id("team_nova"), "workspace": workspace_id("team_nova"), "family": "team", "key": "team_growth", "status": "active", "seats": 4, "start": ts(days=-20), "end": ts(days=10), "paused_at": None, "paused_by": None, "pause_reason": None},
        {"id": sub_id("aurora_team_start"), "account": account_id("workspace", workspace_id("team_aurora")), "owner_type": "workspace", "owner_id": workspace_id("team_aurora"), "workspace": workspace_id("team_aurora"), "family": "team", "key": "team_start", "status": "paused", "seats": 2, "start": ts(days=-14), "end": ts(days=16), "paused_at": ts(days=-4), "paused_by": actor_user_id, "pause_reason": "Paused for operator QA"},
    ]
    ledger = [
        (ledger_id("amelia_old_grant"), account_id("user", user_id("amelia")), None, actor_user_id, 1500, "subscription_grant", sub_id("amelia_collab_start_old"), "subscription", ts(days=-66)),
        (ledger_id("amelia_old_usage"), account_id("user", user_id("amelia")), None, user_id("amelia"), -1500, "usage_charge", "run_amelia_old", "ai_run", ts(days=-39)),
        (ledger_id("amelia_grant"), account_id("user", user_id("amelia")), None, actor_user_id, 2000, "subscription_grant", sub_id("amelia_collab_plus"), "subscription", ts(days=-6)),
        (ledger_id("amelia_topup"), account_id("user", user_id("amelia")), None, actor_user_id, 600, "topup_purchase", pay_id("amelia_topup"), "payment", ts(days=-5)),
        (ledger_id("amelia_group_labs"), account_id("user", user_id("amelia")), workspace_id("group_labs"), user_id("amelia"), -280, "usage_charge", "run_amelia_labs", "ai_run", ts(days=-4)),
        (ledger_id("amelia_group_review"), account_id("user", user_id("amelia")), workspace_id("group_review"), user_id("amelia"), -170, "usage_charge", "run_amelia_review", "ai_run", ts(days=-2)),
        (ledger_id("marco_grant"), account_id("user", user_id("marco")), None, actor_user_id, 1500, "subscription_grant", sub_id("marco_collab_start"), "subscription", ts(days=-15)),
        (ledger_id("marco_group_labs"), account_id("user", user_id("marco")), workspace_id("group_labs"), user_id("marco"), -320, "usage_charge", "run_marco_labs", "ai_run", ts(days=-3)),
        (ledger_id("nora_grant"), account_id("user", user_id("nora")), None, actor_user_id, 2000, "subscription_grant", sub_id("nora_collab_plus"), "subscription", ts(days=-9)),
        (ledger_id("nora_topup"), account_id("user", user_id("nora")), None, actor_user_id, 500, "topup_purchase", pay_id("nora_topup"), "payment", ts(days=-7)),
        (ledger_id("nora_group_motion"), account_id("user", user_id("nora")), workspace_id("group_motion"), user_id("nora"), -610, "usage_charge", "run_nora_motion", "ai_run", ts(days=-2)),
        (ledger_id("oliver_old_grant"), account_id("user", user_id("oliver")), None, actor_user_id, 1500, "subscription_grant", sub_id("oliver_collab_start_old"), "subscription", ts(days=-48)),
        (ledger_id("oliver_old_usage"), account_id("user", user_id("oliver")), None, user_id("oliver"), -1500, "usage_charge", "run_oliver_old", "ai_run", ts(days=-19)),
        (ledger_id("atlas_grant"), account_id("workspace", workspace_id("team_atlas")), workspace_id("team_atlas"), actor_user_id, 7500, "subscription_grant", sub_id("atlas_team_start"), "subscription", ts(days=-12)),
        (ledger_id("atlas_topup"), account_id("workspace", workspace_id("team_atlas")), workspace_id("team_atlas"), actor_user_id, 3000, "topup_purchase", pay_id("atlas_topup"), "payment", ts(days=-10)),
        (ledger_id("atlas_use_amelia"), account_id("workspace", workspace_id("team_atlas")), workspace_id("team_atlas"), user_id("amelia"), -1200, "usage_charge", "run_atlas_amelia", "ai_run", ts(days=-4)),
        (ledger_id("atlas_use_marco"), account_id("workspace", workspace_id("team_atlas")), workspace_id("team_atlas"), user_id("marco"), -900, "usage_charge", "run_atlas_marco", "ai_run", ts(days=-3)),
        (ledger_id("atlas_use_oliver"), account_id("workspace", workspace_id("team_atlas")), workspace_id("team_atlas"), user_id("oliver"), -260, "usage_charge", "run_atlas_oliver", "ai_run", ts(days=-2)),
        (ledger_id("legacy_grant"), account_id("workspace", workspace_id("team_legacy")), workspace_id("team_legacy"), actor_user_id, 27500, "subscription_grant", sub_id("legacy_team_growth"), "subscription", ts(days=-58)),
        (ledger_id("legacy_use_amelia"), account_id("workspace", workspace_id("team_legacy")), workspace_id("team_legacy"), user_id("amelia"), -18400, "usage_charge", "run_legacy_amelia", "ai_run", ts(days=-20)),
        (ledger_id("nova_grant"), account_id("workspace", workspace_id("team_nova")), workspace_id("team_nova"), actor_user_id, 22000, "subscription_grant", sub_id("nova_team_growth"), "subscription", ts(days=-20)),
        (ledger_id("nova_topup"), account_id("workspace", workspace_id("team_nova")), workspace_id("team_nova"), actor_user_id, 4000, "topup_purchase", pay_id("nova_topup"), "payment", ts(days=-18)),
        (ledger_id("nova_use_marco"), account_id("workspace", workspace_id("team_nova")), workspace_id("team_nova"), user_id("marco"), -2100, "usage_charge", "run_nova_marco", "ai_run", ts(days=-5)),
        (ledger_id("nova_use_amelia"), account_id("workspace", workspace_id("team_nova")), workspace_id("team_nova"), user_id("amelia"), -1400, "usage_charge", "run_nova_amelia", "ai_run", ts(days=-4)),
        (ledger_id("nova_use_nora"), account_id("workspace", workspace_id("team_nova")), workspace_id("team_nova"), user_id("nora"), -800, "usage_charge", "run_nova_nora", "ai_run", ts(days=-2)),
        (ledger_id("nova_admin_cut"), account_id("workspace", workspace_id("team_nova")), workspace_id("team_nova"), actor_user_id, -400, "admin_adjustment", "adjust_nova_cut", "admin", ts(days=-1)),
        (ledger_id("aurora_grant"), account_id("workspace", workspace_id("team_aurora")), workspace_id("team_aurora"), actor_user_id, 5000, "subscription_grant", sub_id("aurora_team_start"), "subscription", ts(days=-14)),
        (ledger_id("aurora_use_nora"), account_id("workspace", workspace_id("team_aurora")), workspace_id("team_aurora"), user_id("nora"), -1200, "usage_charge", "run_aurora_nora", "ai_run", ts(days=-6)),
    ]
    payments = [
        (pay_id("amelia_topup"), account_id("user", user_id("amelia")), 900, "topup", ts(days=-5)),
        (pay_id("nora_topup"), account_id("user", user_id("nora")), 700, "topup", ts(days=-7)),
        (pay_id("atlas_topup"), account_id("workspace", workspace_id("team_atlas")), 4500, "topup", ts(days=-10)),
        (pay_id("nova_topup"), account_id("workspace", workspace_id("team_nova")), 7200, "topup", ts(days=-18)),
    ]
    audits = [
        (audit_id("atlas_create"), "admin.finance.manual.team_workspace_create", user_id("amelia"), workspace_id("team_atlas"), ts(days=-63), {"workspaceName": "Atlas Studio"}),
        (audit_id("nova_create"), "admin.finance.manual.team_workspace_create", user_id("marco"), workspace_id("team_nova"), ts(days=-28), {"workspaceName": "Nova Ops"}),
        (audit_id("aurora_pause"), "admin.operator.subscription.freeze", user_id("nora"), workspace_id("team_aurora"), ts(days=-4), {"reason": "Paused for operator QA"}),
        (audit_id("labs_create"), "admin.finance.manual.group_workspace_create", user_id("amelia"), workspace_id("group_labs"), ts(days=-12), {"workspaceName": "Concept Labs"}),
        (audit_id("oliver_suspend"), "admin.operator.user.status", user_id("oliver"), None, ts(days=-6), {"status": "suspended", "reason": "Demo moderation hold"}),
    ]
    return {"namespace": namespace, "users": users, "workspaces": workspaces, "memberships": memberships, "boards": boards, "invitations": invitations, "subscriptions": subscriptions, "ledger": ledger, "payments": payments, "audits": audits}


def ensure_actor_user(cursor: object, *, actor_user_id: str, actor_email: str) -> None:
    cursor.execute(
        """
        INSERT INTO tangent_users (id, email, display_name, avatar_initials, email_verified, status, locale, last_login_at, last_ip_address)
        VALUES (%s, %s, 'Local Admin', 'LA', FALSE, 'active', 'en', NOW(), '127.0.0.1')
        ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name, status = 'active', updated_at = NOW(), last_login_at = NOW()
        """,
        (actor_user_id, actor_email),
    )
    ensure_credit_account(cursor, "user", actor_user_id)


def cleanup_seed(cursor: object, seed: dict[str, Any]) -> None:
    workspace_ids = [row["id"] for row in seed["workspaces"]]
    user_ids = [row["id"] for row in seed["users"]]
    cursor.execute("DELETE FROM tangent_admin_audit_logs WHERE id = ANY(%s)", ([row[0] for row in seed["audits"]],))
    cursor.execute("DELETE FROM tangent_workspace_invitations WHERE id = ANY(%s)", ([row["id"] for row in seed["invitations"]],))
    cursor.execute("DELETE FROM tangent_board_members WHERE workspace_id = ANY(%s)", (workspace_ids,))
    cursor.execute("DELETE FROM tangent_boards WHERE workspace_id = ANY(%s)", (workspace_ids,))
    cursor.execute("DELETE FROM tangent_workspace_members WHERE workspace_id = ANY(%s)", (workspace_ids,))
    cursor.execute("DELETE FROM tangent_payments WHERE id = ANY(%s)", ([row[0] for row in seed["payments"]],))
    cursor.execute("DELETE FROM tangent_subscriptions WHERE id = ANY(%s)", ([row["id"] for row in seed["subscriptions"]],))
    cursor.execute("DELETE FROM tangent_credit_ledger WHERE id = ANY(%s)", ([row[0] for row in seed["ledger"]],))
    cursor.execute("DELETE FROM tangent_credit_accounts WHERE owner_type = 'workspace' AND owner_id = ANY(%s)", ([row["id"] for row in seed["workspaces"] if row["kind"] == "team_workspace"],))
    cursor.execute("DELETE FROM tangent_credit_accounts WHERE owner_type = 'user' AND owner_id = ANY(%s)", (user_ids,))
    cursor.execute("DELETE FROM tangent_workspaces WHERE id = ANY(%s)", (workspace_ids,))
    cursor.execute("DELETE FROM tangent_users WHERE id = ANY(%s)", (user_ids,))


def insert_seed(cursor: object, seed: dict[str, Any], *, actor_user_id: str) -> None:
    user_names = {row["id"]: row["name"] for row in seed["users"]}
    for row in seed["users"]:
        cursor.execute("INSERT INTO tangent_users (id, email, display_name, avatar_initials, email_verified, status, locale, created_at, last_login_at, last_ip_address) VALUES (%s, %s, %s, %s, TRUE, %s, 'en', %s, %s, %s)", (row["id"], row["email"], row["name"], row["initials"], row["status"], row["created"], row["login"], row["ip"]))
        ensure_credit_account(cursor, "user", row["id"])
    for row in seed["workspaces"]:
        cursor.execute("INSERT INTO tangent_workspaces (id, name, owner_id, kind, slug, status, billing_owner_user_id, created_at) VALUES (%s, %s, %s, %s, NULL, 'active', %s, %s)", (row["id"], row["name"], row["owner"], row["kind"], row["owner"], row["created"]))
        cursor.execute("INSERT INTO tangent_workspace_members (workspace_id, user_id, role, display_name, joined_at, invited_by) VALUES (%s, %s, 'owner', %s, %s, NULL)", (row["id"], row["owner"], row["name"], row["created"]))
        if row["kind"] == "team_workspace":
            ensure_credit_account(cursor, "workspace", row["id"])
    for workspace_id_value, user_id_value, role in seed["memberships"]:
        cursor.execute("INSERT INTO tangent_workspace_members (workspace_id, user_id, role, display_name, joined_at, invited_by) VALUES (%s, %s, %s, %s, NOW(), %s)", (workspace_id_value, user_id_value, role, user_names[user_id_value], actor_user_id))
    for board_id_value, workspace_id_value, owner_id, title, visibility, saved_at in seed["boards"]:
        cursor.execute("INSERT INTO tangent_boards (id, workspace_id, owner_id, title, document, byte_size, asset_count, shape_count, description, card_color, thumbnail_url, last_opened_at, saved_at, created_at, is_starred, is_pinned, visibility, share_id) VALUES (%s, %s, %s, %s, %s::jsonb, 256, 0, 3, '', NULL, NULL, %s, %s, %s, FALSE, FALSE, %s, NULL)", (board_id_value, workspace_id_value, owner_id, title, json.dumps({"seed": True, "version": 1, "title": title}), saved_at, saved_at, saved_at, visibility))
        cursor.execute("INSERT INTO tangent_board_members (workspace_id, board_id, user_id, role, joined_at) VALUES (%s, %s, %s, 'owner', %s)", (workspace_id_value, board_id_value, owner_id, saved_at))
    for row in seed["subscriptions"]:
        cursor.execute("INSERT INTO tangent_subscriptions (id, account_id, owner_type, owner_id, workspace_id, plan_family, provider, provider_customer_id, provider_subscription_id, plan_key, status, seat_capacity, current_period_start, current_period_end, paused_at, paused_by, pause_reason, created_at, updated_at) VALUES (%s, %s, %s, %s, %s, %s, 'admin_manual', NULL, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)", (row["id"], row["account"], row["owner_type"], row["owner_id"], row["workspace"], row["family"], row["id"], row["key"], row["status"], row["seats"], row["start"], row["end"], row["paused_at"], row["paused_by"], row["pause_reason"], row["start"], row["start"]))
    for entry_id, account, workspace, actor, delta, reason, source_id, source_type, created_at in seed["ledger"]:
        cursor.execute("INSERT INTO tangent_credit_ledger (id, account_id, workspace_id, actor_user_id, source_type, source_id, credits_delta, reason, metadata, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, '{}'::jsonb, %s)", (entry_id, account, workspace, actor, source_type, source_id, delta, reason, created_at))
    for payment_id, account, amount_cents, kind, created_at in seed["payments"]:
        cursor.execute("INSERT INTO tangent_payments (id, account_id, provider, provider_payment_id, amount_cents, currency, status, checkout_session_id, kind, metadata, created_at) VALUES (%s, %s, 'admin_manual', %s, %s, 'usd', 'succeeded', %s, %s, '{}'::jsonb, %s)", (payment_id, account, payment_id, amount_cents, f"manual_{payment_id}", kind, created_at))
    for row in seed["invitations"]:
        cursor.execute("INSERT INTO tangent_workspace_invitations (id, workspace_id, email, role, invited_by, accepted_by, expires_at, accepted_at, revoked_at, created_at, token_hash, target_user_id, metadata) VALUES (%s, %s, %s, %s, %s, NULL, %s, NULL, NULL, %s, %s, %s, %s::jsonb)", (row["id"], row["workspace"], row["email"], row["role"], row["invited_by"], row["expires"], row["created"], f"seed_{row['id']}", row["target_user_id"], json.dumps(row["metadata"])))
    for audit_id_value, action, target_user_id, workspace_id_value, created_at, metadata in seed["audits"]:
        cursor.execute("INSERT INTO tangent_admin_audit_logs (id, actor_user_id, target_user_id, workspace_id, action, metadata, created_at) VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s)", (audit_id_value, actor_user_id, target_user_id, workspace_id_value, action, json.dumps(metadata), created_at))


def account_id(owner_type: str, owner_id: str) -> str:
    return f"credit_{owner_type}_{owner_id}"


if __name__ == "__main__":
    main()
