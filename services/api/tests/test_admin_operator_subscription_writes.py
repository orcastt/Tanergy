from datetime import datetime, timedelta, timezone

from tangent_api.admin_operator_subscription_writes import (
    freeze_admin_operator_subscription,
    unfreeze_admin_operator_subscription,
)


def test_freeze_admin_operator_subscription_persists_pause_facts(monkeypatch):
    paused_at = datetime(2026, 5, 10, 10, 0, tzinfo=timezone.utc)
    fake_db = _SubscriptionWriteDatabase(
        {
            "sub_team_1": {
                "current_period_end": datetime(2026, 6, 9, 10, 0, tzinfo=timezone.utc),
                "owner_id": "workspace_team_1",
                "owner_type": "workspace",
                "pause_reason": None,
                "paused_at": None,
                "paused_by": None,
                "plan_family": "team",
                "plan_key": "team_growth",
                "status": "active",
                "workspace_id": "workspace_team_1",
            }
        }
    )
    audit_calls: list[dict[str, object]] = []

    monkeypatch.setattr("tangent_api.admin_operator_subscription_writes.require_database_url", lambda: None)
    monkeypatch.setattr("tangent_api.admin_operator_subscription_writes.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.admin_operator_subscription_writes.has_postgres_column", lambda *_args, **_kwargs: True)
    monkeypatch.setattr(
        "tangent_api.admin_operator_subscription_writes._insert_admin_audit_log",
        lambda cursor, **kwargs: audit_calls.append(kwargs) or "audit_freeze_1",
    )
    monkeypatch.setattr(
        "tangent_api.admin_operator_subscription_writes._utc_now",
        lambda: paused_at,
    )

    result = freeze_admin_operator_subscription(
        actor_user_id="user_admin",
        reason="pause for refund review",
        subscription_id="sub_team_1",
    )

    updated = fake_db.subscriptions["sub_team_1"]
    assert result.status == "paused"
    assert updated["status"] == "paused"
    assert updated["paused_at"] == paused_at
    assert updated["paused_by"] == "user_admin"
    assert updated["pause_reason"] == "pause for refund review"
    assert audit_calls[-1]["metadata"]["pausedAt"] == paused_at.isoformat()


def test_unfreeze_admin_operator_subscription_restores_period_end(monkeypatch):
    paused_at = datetime(2026, 5, 10, 10, 0, tzinfo=timezone.utc)
    original_period_end = datetime(2026, 6, 9, 10, 0, tzinfo=timezone.utc)
    resumed_at = paused_at + timedelta(days=5, hours=2)
    fake_db = _SubscriptionWriteDatabase(
        {
            "sub_group_1": {
                "current_period_end": original_period_end,
                "owner_id": "user_ada",
                "owner_type": "user",
                "pause_reason": "pause for billing correction",
                "paused_at": paused_at,
                "paused_by": "user_admin",
                "plan_family": "collaborate",
                "plan_key": "collaborate_plus",
                "status": "paused",
                "workspace_id": None,
            }
        }
    )
    audit_calls: list[dict[str, object]] = []

    monkeypatch.setattr("tangent_api.admin_operator_subscription_writes.require_database_url", lambda: None)
    monkeypatch.setattr("tangent_api.admin_operator_subscription_writes.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.admin_operator_subscription_writes.has_postgres_column", lambda *_args, **_kwargs: True)
    monkeypatch.setattr(
        "tangent_api.admin_operator_subscription_writes._insert_admin_audit_log",
        lambda cursor, **kwargs: audit_calls.append(kwargs) or "audit_unfreeze_1",
    )
    monkeypatch.setattr(
        "tangent_api.admin_operator_subscription_writes._utc_now",
        lambda: resumed_at,
    )

    result = unfreeze_admin_operator_subscription(
        actor_user_id="user_admin",
        reason="resume after fix",
        subscription_id="sub_group_1",
    )

    updated = fake_db.subscriptions["sub_group_1"]
    assert result.status == "active"
    assert updated["status"] == "active"
    assert updated["paused_at"] is None
    assert updated["paused_by"] is None
    assert updated["pause_reason"] is None
    assert updated["current_period_end"] == original_period_end + (resumed_at - paused_at)
    assert audit_calls[-1]["metadata"]["pauseDurationSeconds"] == int((resumed_at - paused_at).total_seconds())


class _SubscriptionWriteConnection:
    def __init__(self, database: "_SubscriptionWriteDatabase") -> None:
        self.database = database
        self.commits = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def cursor(self):
        return _SubscriptionWriteCursor(self.database)

    def commit(self):
        self.commits += 1


class _SubscriptionWriteCursor:
    def __init__(self, database: "_SubscriptionWriteDatabase") -> None:
        self.database = database
        self.row = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def execute(self, query, params=None):
        normalized = " ".join(query.split())
        self.row = None
        if normalized.startswith(
            "SELECT id, owner_type, owner_id, workspace_id, plan_family, plan_key, status, current_period_end, paused_at, paused_by, pause_reason FROM tangent_subscriptions"
        ):
            subscription = self.database.subscriptions.get(params[0])
            if subscription:
                self.row = (
                    params[0],
                    subscription["owner_type"],
                    subscription["owner_id"],
                    subscription["workspace_id"],
                    subscription["plan_family"],
                    subscription["plan_key"],
                    subscription["status"],
                    subscription["current_period_end"],
                    subscription["paused_at"],
                    subscription["paused_by"],
                    subscription["pause_reason"],
                )
            return
        if normalized.startswith("SELECT COUNT(*) FROM tangent_subscriptions"):
            self.row = (0,)
            return
        if normalized.startswith("UPDATE tangent_subscriptions SET status = %s, paused_at = %s, paused_by = %s, pause_reason = %s, updated_at = NOW() WHERE id = %s"):
            status, paused_at, paused_by, pause_reason, subscription_id = params
            subscription = self.database.subscriptions[subscription_id]
            subscription["status"] = status
            subscription["paused_at"] = paused_at
            subscription["paused_by"] = paused_by
            subscription["pause_reason"] = pause_reason
            return
        if normalized.startswith("UPDATE tangent_subscriptions SET status = %s, current_period_end = %s, paused_at = NULL, paused_by = NULL, pause_reason = NULL, updated_at = NOW() WHERE id = %s"):
            status, current_period_end, subscription_id = params
            subscription = self.database.subscriptions[subscription_id]
            subscription["status"] = status
            subscription["current_period_end"] = current_period_end
            subscription["paused_at"] = None
            subscription["paused_by"] = None
            subscription["pause_reason"] = None
            return
        raise AssertionError(f"Unhandled subscription write query: {normalized}")

    def fetchone(self):
        return self.row


class _SubscriptionWriteDatabase:
    def __init__(self, subscriptions):
        self.subscriptions = subscriptions

    def connect(self):
        return _SubscriptionWriteConnection(self)
