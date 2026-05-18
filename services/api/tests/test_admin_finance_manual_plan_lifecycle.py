from datetime import datetime, timedelta, timezone

from tangent_api.admin_finance_manual_plan_operations import (
    manual_operate_group_plan,
    manual_operate_team_plan,
)
from tests.admin_finance_manual_plan_operation_fakes import (
    PlanOperationDatabase,
    install_plan_operation_db,
)


def test_team_plan_delete_cancels_subscription_workspace_boards_and_grants(monkeypatch):
    fake_db = PlanOperationDatabase(
        boards=[
            {
                "deleted_at": None,
                "id": "board_team_1",
                "workspace_id": "workspace_team",
            }
        ],
        credit_ledger=[
            {
                "account_id": "credit_workspace_workspace_team",
                "credits_delta": 120,
                "id": "grant_team_1",
                "reason": "subscription_grant",
                "source_id": "sub_team_1",
                "source_type": "subscription",
                "workspace_id": "workspace_team",
            }
        ],
        subscriptions=[
            {
                "account_id": "credit_workspace_workspace_team",
                "current_period_end": datetime(2026, 6, 9, 10, 0, tzinfo=timezone.utc),
                "current_period_start": datetime(2026, 5, 10, 10, 0, tzinfo=timezone.utc),
                "id": "sub_team_1",
                "owner_id": "workspace_team",
                "owner_type": "workspace",
                "pause_reason": None,
                "paused_at": None,
                "paused_by": None,
                "plan_family": "team",
                "plan_key": "team_start",
                "seat_capacity": 2,
                "status": "active",
                "workspace_id": "workspace_team",
            }
        ]
    )
    fake_db.board_share_links = [{"board_id": "board_team_1", "revoked_at": None, "workspace_id": "workspace_team"}]
    fake_db.board_collaboration_sessions = [{"board_id": "board_team_1", "disconnected_at": None, "workspace_id": "workspace_team"}]
    fake_db.board_members = [{"board_id": "board_team_1", "user_id": "user_member", "workspace_id": "workspace_team"}]
    fake_db.board_realtime_documents = [{"board_id": "board_team_1", "workspace_id": "workspace_team"}]
    fake_db.board_snapshots = [{"board_id": "board_team_1", "id": "snapshot_team_1", "workspace_id": "workspace_team"}]
    install_plan_operation_db(monkeypatch, fake_db)

    result = manual_operate_team_plan(
        action="delete",
        actor_user_id="user_admin",
        duration_count=1,
        duration_unit_days=30,
        effect_mode="immediate",
        grant_included_credits=False,
        note="delete team plan",
        plan_key=None,
        seat_capacity=None,
        status="active",
        subscription_id="sub_team_1",
        workspace_id="workspace_team",
    )

    assert result.action == "delete"
    assert result.subscription_status == "canceled"
    assert result.balance_credits == 0
    assert result.granted_credits == -120
    assert fake_db.boards[0]["deleted_at"] == "now"
    assert fake_db.workspaces["workspace_team"]["status"] == "deleted"
    assert fake_db.subscriptions[0]["status"] == "canceled"
    assert fake_db.board_share_links[0]["revoked_at"] == "now"
    assert fake_db.board_collaboration_sessions[0]["disconnected_at"] == "now"
    assert fake_db.board_members == []
    assert fake_db.board_realtime_documents == []
    assert fake_db.board_snapshots == []
    assert fake_db.credit_ledger[-1]["credits_delta"] == -120
    assert fake_db.credit_ledger[-1]["reason"] == "subscription_revoke"


def test_group_plan_delete_deactivates_group_workspace_boards_and_grants(monkeypatch):
    fake_db = PlanOperationDatabase(
        boards=[
            {
                "deleted_at": None,
                "id": "board_group_1",
                "workspace_id": "workspace_group",
            }
        ],
        credit_ledger=[
            {
                "account_id": "credit_user_user_member",
                "credits_delta": 80,
                "id": "grant_group_1",
                "reason": "subscription_grant",
                "source_id": "sub_group_1",
                "source_type": "subscription",
                "workspace_id": None,
            }
        ],
        subscriptions=[
            {
                "account_id": "credit_user_user_member",
                "current_period_end": datetime(2026, 6, 9, 10, 0, tzinfo=timezone.utc),
                "current_period_start": datetime(2026, 5, 10, 10, 0, tzinfo=timezone.utc),
                "id": "sub_group_1",
                "owner_id": "user_member",
                "owner_type": "user",
                "pause_reason": None,
                "paused_at": None,
                "paused_by": None,
                "plan_family": "collaborate",
                "plan_key": "collaborate_plus",
                "seat_capacity": 1,
                "status": "active",
                "workspace_id": None,
            }
        ],
        workspaces={
            "workspace_group": {
                "kind": "group_workspace",
                "owner_id": "user_member",
                "status": "active",
            },
        },
    )
    install_plan_operation_db(monkeypatch, fake_db)

    result = manual_operate_group_plan(
        action="delete",
        actor_user_id="user_admin",
        duration_count=1,
        duration_unit_days=30,
        effect_mode="immediate",
        grant_included_credits=False,
        note="delete group plan",
        plan_key=None,
        status="active",
        subscription_id="sub_group_1",
        target_user_id="user_member",
    )

    assert result.action == "delete"
    assert result.subscription_status == "canceled"
    assert result.balance_credits == 0
    assert result.granted_credits == -80
    assert fake_db.boards[0]["deleted_at"] == "now"
    assert fake_db.workspaces["workspace_group"]["status"] == "deleted"
    assert fake_db.subscriptions[0]["status"] == "canceled"
    assert fake_db.credit_ledger[-1]["credits_delta"] == -80
    assert fake_db.credit_ledger[-1]["reason"] == "subscription_revoke"


def test_group_plan_freeze_and_unfreeze_keep_remaining_period(monkeypatch):
    paused_at = datetime(2026, 5, 10, 10, 0, tzinfo=timezone.utc)
    resumed_at = paused_at + timedelta(days=3)
    original_period_end = datetime(2026, 6, 9, 10, 0, tzinfo=timezone.utc)
    fake_db = PlanOperationDatabase(
        subscriptions=[
            {
                "account_id": "credit_user_user_member",
                "current_period_end": original_period_end,
                "current_period_start": datetime(2026, 5, 10, 10, 0, tzinfo=timezone.utc),
                "id": "sub_group_1",
                "owner_id": "user_member",
                "owner_type": "user",
                "pause_reason": None,
                "paused_at": None,
                "paused_by": None,
                "plan_family": "collaborate",
                "plan_key": "collaborate_plus",
                "seat_capacity": 1,
                "status": "active",
                "workspace_id": None,
            }
        ]
    )
    install_plan_operation_db(monkeypatch, fake_db)

    monkeypatch.setattr("tangent_api.admin_operator_subscription_writes._utc_now", lambda: paused_at)
    frozen = manual_operate_group_plan(
        action="freeze",
        actor_user_id="user_admin",
        duration_count=1,
        duration_unit_days=30,
        effect_mode="immediate",
        grant_included_credits=False,
        note="pause group plan",
        plan_key=None,
        status="active",
        subscription_id="sub_group_1",
        target_user_id="user_member",
    )

    assert frozen.subscription_status == "paused"
    assert fake_db.subscriptions[0]["paused_at"] == paused_at

    monkeypatch.setattr("tangent_api.admin_operator_subscription_writes._utc_now", lambda: resumed_at)
    unfrozen = manual_operate_group_plan(
        action="unfreeze",
        actor_user_id="user_admin",
        duration_count=1,
        duration_unit_days=30,
        effect_mode="immediate",
        grant_included_credits=False,
        note="resume group plan",
        plan_key=None,
        status="active",
        subscription_id="sub_group_1",
        target_user_id="user_member",
    )

    assert unfrozen.subscription_status == "active"
    assert fake_db.subscriptions[0]["paused_at"] is None
    assert fake_db.subscriptions[0]["current_period_end"] == original_period_end + timedelta(days=3)
