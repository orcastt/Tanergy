import pytest
from fastapi import HTTPException

from datetime import datetime, timezone

from tangent_api.admin_finance_manual_plan_operations import (
    manual_operate_group_plan,
    manual_operate_team_plan,
)
from tests.admin_finance_manual_plan_operation_fakes import (
    PlanOperationDatabase,
    install_plan_operation_db,
)


def test_team_plan_upgrade_grants_credit_delta(monkeypatch):
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
        action="upgrade",
        actor_user_id="user_admin",
        duration_count=1,
        duration_unit_days=30,
        effect_mode="immediate",
        grant_included_credits=True,
        note="upgrade team plan",
        plan_key="team_growth",
        seat_capacity=2,
        status="active",
        subscription_id="sub_team_1",
        workspace_id="workspace_team",
    )

    assert result.action == "upgrade"
    assert result.granted_credits == 6000
    assert result.plan_key == "team_growth"
    assert result.subscription_status == "active"
    assert fake_db.subscriptions[0]["plan_key"] == "team_growth"
    assert fake_db.credit_ledger[-1]["credits_delta"] == 6000


def test_team_plan_assign_multiplies_monthly_credits_by_duration(monkeypatch):
    fake_db = PlanOperationDatabase(subscriptions=[])
    install_plan_operation_db(monkeypatch, fake_db)

    result = manual_operate_team_plan(
        action="assign",
        actor_user_id="user_admin",
        duration_count=4,
        duration_unit_days=30,
        effect_mode="next_week",
        grant_included_credits=True,
        note="assign 4-month team plan",
        plan_key="team_start",
        seat_capacity=3,
        status="active",
        subscription_id=None,
        workspace_id="workspace_team",
    )

    assert result.action == "assign"
    assert result.granted_credits == 30000
    assert fake_db.credit_ledger[-1]["credits_delta"] == 30000


def test_team_plan_rejects_non_monthly_duration_unit(monkeypatch):
    fake_db = PlanOperationDatabase(subscriptions=[])
    install_plan_operation_db(monkeypatch, fake_db)

    with pytest.raises(HTTPException) as error:
        manual_operate_team_plan(
            action="assign",
            actor_user_id="user_admin",
            duration_count=2,
            duration_unit_days=7,
            effect_mode="immediate",
            grant_included_credits=True,
            note="invalid duration unit",
            plan_key="team_start",
            seat_capacity=2,
            status="active",
            subscription_id=None,
            workspace_id="workspace_team",
        )

    assert error.value.status_code == 400
    assert error.value.detail == "Team duration unit must stay fixed at 30 days."


def test_group_plan_renew_uses_current_plan_when_plan_key_omitted(monkeypatch):
    fake_db = PlanOperationDatabase(
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
                "plan_key": "collaborate_start",
                "seat_capacity": 1,
                "status": "active",
                "workspace_id": None,
            }
        ]
    )
    install_plan_operation_db(monkeypatch, fake_db)

    result = manual_operate_group_plan(
        action="renew",
        actor_user_id="user_admin",
        duration_count=2,
        duration_unit_days=30,
        effect_mode="next_week",
        grant_included_credits=True,
        note="renew group plan",
        plan_key=None,
        status="active",
        subscription_id="sub_group_1",
        target_user_id="user_member",
    )

    assert result.action == "renew"
    assert result.plan_key == "collaborate_start"
    assert result.granted_credits == 3000
    assert result.period_start is not None
    assert fake_db.credit_ledger[-1]["credits_delta"] == 3000
