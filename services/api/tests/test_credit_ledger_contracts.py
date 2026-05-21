from fastapi import HTTPException
import pytest

from tangent_api.credit_ledger import (
    grant_subscription_credits,
    record_admin_adjustment,
    record_topup_purchase,
    settle_usage_charge,
    settle_usage_refund,
)
from tangent_api.request_context import ApiRequestContext
from tests.persistence_fakes import FakePostgresDatabase


def test_credit_ledger_grants_and_topups_increase_balance(monkeypatch):
    fake_db = _install_fake_credit_db(monkeypatch)
    context = _context("user_credit_grant")

    grant = grant_subscription_credits(
        context,
        credits=100,
        source_id="sub_1",
        metadata={"period": "2026-05"},
    )
    topup = record_topup_purchase(context, credits=35, source_id="payment_1")

    assert grant.account_id == "credit_user_user_credit_grant"
    assert grant.balance_credits == 100
    assert grant.entry.reason == "subscription_grant"
    assert grant.entry.metadata == {"period": "2026-05"}
    assert topup.balance_credits == 135
    assert [row["reason"] for row in fake_db.credit_ledger] == ["subscription_grant", "topup_purchase"]


def test_credit_ledger_usage_charge_preflights_and_writes_negative_entry(monkeypatch):
    fake_db = _install_fake_credit_db(monkeypatch)
    fake_db.credit_ledger = [
        {
            "account_id": "credit_user_user_credit_charge",
            "credits_delta": 30,
            "id": "ledger_seed",
            "reason": "topup_purchase",
            "source_type": "payment",
        }
    ]
    context = _context("user_credit_charge")

    response = settle_usage_charge(
        context,
        credits=12.5,
        run_id="airun_1",
        metadata={"model": "mock-image"},
    )

    assert response.account_id == "credit_user_user_credit_charge"
    assert response.balance_credits == 17.5
    assert response.entry.credits_delta == -12.5
    assert response.entry.reason == "usage_charge"
    assert response.entry.source_id == "airun_1"
    assert response.entry.metadata == {"model": "mock-image"}


def test_credit_ledger_usage_charge_rejects_insufficient_balance(monkeypatch):
    fake_db = _install_fake_credit_db(monkeypatch)
    fake_db.credit_ledger = [
        {
            "account_id": "credit_user_user_credit_short",
            "credits_delta": 3,
            "id": "ledger_seed",
            "reason": "topup_purchase",
            "source_type": "payment",
        }
    ]
    context = _context("user_credit_short")

    with pytest.raises(HTTPException) as exc:
        settle_usage_charge(context, credits=5, run_id="airun_short")

    assert exc.value.status_code == 402
    assert len(fake_db.credit_ledger) == 1


def test_credit_ledger_refunds_and_admin_adjustments_write_auditable_reasons(monkeypatch):
    fake_db = _install_fake_credit_db(monkeypatch)
    context = _context("user_credit_refund")

    refund = settle_usage_refund(context, credits=8, run_id="airun_refund")
    adjustment = record_admin_adjustment(
        context,
        credits_delta=-2,
        adjustment_id="admin_adjustment_1",
        metadata={"note": "manual correction"},
    )

    assert refund.balance_credits == 8
    assert refund.entry.reason == "usage_refund"
    assert adjustment.balance_credits == 6
    assert adjustment.entry.reason == "admin_adjustment"
    assert adjustment.entry.metadata == {"note": "manual correction"}
    assert [row["credits_delta"] for row in fake_db.credit_ledger] == [8, -2]


def test_credit_ledger_rejects_zero_or_negative_grants(monkeypatch):
    _install_fake_credit_db(monkeypatch)
    context = _context("user_credit_invalid")

    with pytest.raises(HTTPException) as zero_adjustment:
        record_admin_adjustment(context, credits_delta=0, adjustment_id="admin_zero")
    with pytest.raises(HTTPException) as negative_grant:
        grant_subscription_credits(context, credits=-1, source_id="sub_bad")

    assert zero_adjustment.value.status_code == 400
    assert negative_grant.value.status_code == 400


def _install_fake_credit_db(monkeypatch) -> FakePostgresDatabase:
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    return fake_db


def _context(user_id: str) -> ApiRequestContext:
    return ApiRequestContext(
        auth_mode="dev",
        is_dev_fallback=False,
        user_avatar_initials="DU",
        user_display_name="Dev User",
        user_email="dev@tangent.local",
        user_email_verified=True,
        user_id=user_id,
        workspace_board_count=0,
        workspace_id="workspace_group",
        workspace_kind="group_workspace",
        workspace_name="Group workspace",
        workspace_plan_key="collaborate_start",
        workspace_role="owner",
    )
