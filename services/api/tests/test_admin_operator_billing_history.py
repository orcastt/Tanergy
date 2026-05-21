from tangent_api.admin_operator_billing_history_rows import (
    audit_history_from_row,
    ledger_history_from_row,
    payment_history_from_row,
    subscription_history_from_row,
)
from tangent_api.admin_operator_billing_history import load_admin_operator_billing_history


def test_payment_history_row_maps_team_subscription_details():
    row = (
        "payment_team_1",
        4500,
        "usd",
        "succeeded",
        "2026-05-10T10:00:00Z",
        "team_subscription",
        "manual_test",
        "provider_team_1",
        "checkout_team_1",
        {"planKey": "team_growth", "quantity": 3, "teamName": "North Star"},
        "user",
        "user_ada",
        "personal_wallet",
        None,
        "",
    )

    entry = payment_history_from_row(row)

    assert entry.item == "Team Payment"
    assert entry.amount_cents == 4500
    assert entry.reason == "North Star"
    assert entry.metadata["entryType"] == "payment"
    assert entry.metadata["paymentKind"] == "team_subscription"
    assert entry.metadata["status"] == "succeeded"


def test_ledger_history_row_maps_workspace_adjustment_to_team_delta():
    row = (
        "ledger_workspace_adjust",
        "admin_adjustment",
        -50,
        "workspace_team_1",
        "workspace",
        "workspace_team_1",
        "team_wallet",
        "North Star",
        "2026-05-10T09:00:00Z",
        {"note": "refund correction"},
        "workspace",
        "workspace_team_1",
    )

    entry = ledger_history_from_row(row)

    assert entry.item == "Admin adjustment"
    assert entry.team_credits_delta == -50
    assert entry.personal_credits_delta == 0
    assert entry.reason == "refund correction"
    assert entry.metadata["entryType"] == "ledger"
    assert entry.metadata["workspaceName"] == "North Star"


def test_subscription_history_row_uses_plan_label_and_period():
    row = (
        "subscription_collab_1",
        "collaborate",
        "collaborate_plus",
        "active",
        1,
        "2026-05-10T00:00:00Z",
        "2026-06-09T00:00:00Z",
        "2026-05-10T00:00:00Z",
        "2026-05-10T01:00:00Z",
        None,
        "",
        "user",
        "user_ada",
        "manual_test",
        "payment_collab_1",
    )

    entry = subscription_history_from_row(row)

    assert entry.item == "Collaborate Plus"
    assert entry.reason == "2026-05-10 to 2026-06-09"
    assert entry.metadata["entryType"] == "subscription"
    assert entry.metadata["status"] == "active"


def test_audit_history_row_prefers_note_and_role_status():
    row = (
        "admin_audit_member_role",
        "admin.operator.workspace_member.role",
        {"newRole": "editor", "note": "align permissions", "previousRole": "viewer"},
        "2026-05-10T08:00:00Z",
        "workspace_team_1",
        "North Star",
    )

    entry = audit_history_from_row(row)

    assert entry.item == "Member role updated"
    assert entry.reason == "align permissions"
    assert entry.metadata["entryType"] == "audit"
    assert entry.metadata["status"] == "editor"
    assert entry.workspace_id == "workspace_team_1"


def test_audit_history_row_falls_back_to_role_transition_without_note():
    row = (
        "admin_audit_member_role_2",
        "admin.operator.workspace_member.role",
        {"newRole": "admin", "previousRole": "editor"},
        "2026-05-10T07:00:00Z",
        "workspace_team_1",
        "North Star",
    )

    entry = audit_history_from_row(row)

    assert entry.reason == "editor -> admin"


def test_billing_history_includes_joined_team_actor_ledger(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    fake_connection = BillingHistoryConnection()
    monkeypatch.setattr("tangent_api.admin_operator_billing_history.connect_to_postgres", lambda: fake_connection)

    rows = load_admin_operator_billing_history("user_target", limit=20)

    assert [row.id for row in rows] == ["ledger_joined_team_usage"]
    assert rows[0].team_credits_delta == -15
    assert rows[0].personal_credits_delta == 0
    assert rows[0].workspace_id == "workspace_team_joined"
    assert fake_connection.cursor_obj.saw_joined_team_filter is True


class BillingHistoryConnection:
    def __init__(self):
        self.cursor_obj = BillingHistoryCursor()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def cursor(self):
        return self.cursor_obj


class BillingHistoryCursor:
    def __init__(self):
        self.rows = []
        self.saw_joined_team_filter = False

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def execute(self, query, params=None):
        normalized = " ".join(query.split())
        self.rows = []
        if "FROM tangent_credit_ledger l" in normalized:
            self.saw_joined_team_filter = (
                "tangent_workspace_members wm" in normalized
                and "l.actor_user_id = %s" in normalized
                and params == ("user_target", "user_target", "user_target", "user_target", "user_target", 20)
            )
            self.rows = [
                (
                    "ledger_joined_team_usage",
                    "usage_charge",
                    -15,
                    "workspace_team_joined",
                    "workspace",
                    "workspace_team_joined",
                    "team_wallet",
                    "Joined Team",
                    "2026-05-10T12:00:00Z",
                    {"runId": "run_joined_team"},
                    "ai_run",
                    "run_joined_team",
                )
            ]

    def fetchall(self):
        return self.rows
