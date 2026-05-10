from datetime import datetime, timedelta, timezone

from tangent_api.admin_finance_manual_plan_operations import (
    manual_operate_group_plan,
    manual_operate_team_plan,
)
from tests.admin_finance_manual_plan_operation_fakes import (
    PlanOperationDatabase,
    install_plan_operation_db,
)


def test_team_plan_delete_cancels_subscription(monkeypatch):
    fake_db = PlanOperationDatabase(
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
    assert fake_db.subscriptions[0]["status"] == "canceled"


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
