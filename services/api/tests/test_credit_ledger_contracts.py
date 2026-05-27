from fastapi import HTTPException
import pytest

from tangent_api.credit_ledger import (
    grant_subscription_credits,
    record_admin_adjustment,
    record_topup_purchase,
    refund_outstanding_run_charge,
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


def test_refund_outstanding_run_charge_noop_when_no_ledger_activity(monkeypatch):
    fake_db = _install_fake_credit_db(monkeypatch)
    context = _context("user_refund_noop")

    result = refund_outstanding_run_charge(context, run_id="airun_unknown")

    assert result is None
    assert fake_db.credit_ledger == []


def test_refund_outstanding_run_charge_refunds_full_outstanding_charge(monkeypatch):
    fake_db = _install_fake_credit_db(monkeypatch)
    account_id = "credit_user_user_refund_full"
    fake_db.credit_ledger = [
        {
            "account_id": account_id,
            "credits_delta": 100,
            "id": "ledger_seed_topup",
            "reason": "topup_purchase",
            "source_type": "payment",
        },
        {
            "account_id": account_id,
            "credits_delta": -25,
            "id": "ledger_seed_charge",
            "metadata": {"runId": "airun_cancel_full"},
            "reason": "usage_charge",
            "source_id": "airun_cancel_full",
            "source_type": "ai_run",
        },
    ]
    context = _context("user_refund_full")

    result = refund_outstanding_run_charge(
        context,
        run_id="airun_cancel_full",
        metadata={"reason": "cancellation_refund"},
    )

    assert result is not None
    assert result.entry.reason == "usage_refund"
    assert result.entry.credits_delta == 25
    assert result.entry.source_id == "airun_cancel_full"
    assert result.balance_credits == 100
    assert [row["reason"] for row in fake_db.credit_ledger] == ["topup_purchase", "usage_charge", "usage_refund"]


def test_refund_outstanding_run_charge_is_idempotent_on_repeat_calls(monkeypatch):
    fake_db = _install_fake_credit_db(monkeypatch)
    account_id = "credit_user_user_refund_idem"
    fake_db.credit_ledger = [
        {
            "account_id": account_id,
            "credits_delta": 50,
            "id": "ledger_seed_topup",
            "reason": "topup_purchase",
            "source_type": "payment",
        },
        {
            "account_id": account_id,
            "credits_delta": -12,
            "id": "ledger_seed_charge",
            "reason": "usage_charge",
            "source_id": "airun_double",
            "source_type": "ai_run",
        },
    ]
    context = _context("user_refund_idem")

    first = refund_outstanding_run_charge(context, run_id="airun_double")
    second = refund_outstanding_run_charge(context, run_id="airun_double")

    assert first is not None
    assert first.entry.credits_delta == 12
    assert second is None
    refund_rows = [row for row in fake_db.credit_ledger if row["reason"] == "usage_refund"]
    assert len(refund_rows) == 1


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
