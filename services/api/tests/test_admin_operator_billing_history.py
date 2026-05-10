from tangent_api.admin_operator_billing_history_rows import (
    audit_history_from_row,
    ledger_history_from_row,
    payment_history_from_row,
    subscription_history_from_row,
)


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
