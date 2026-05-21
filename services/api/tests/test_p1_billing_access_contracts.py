import pytest
from fastapi.testclient import TestClient

from tangent_api.main import app
from tests.persistence_fakes import FakePostgresDatabase


def test_personal_topup_payment_complete_requires_original_creator(monkeypatch):
    fake_db = _patch_billing_db(monkeypatch, patch_ledger=True)
    client = TestClient(app)

    checkout = client.post(
        "/api/v1/billing/topups/checkout",
        headers=_headers("user_topup_owner", "workspace_owner_solo"),
        json={"credits": 25, "metadata": {"pack": "personal"}},
    )
    assert checkout.status_code == 200
    payment = checkout.json()["payment"]

    wrong_user = client.post(
        f"/api/v1/billing/payments/{payment['id']}/complete",
        headers=_headers("user_topup_intruder", "workspace_intruder_solo"),
    )

    assert wrong_user.status_code == 403
    assert wrong_user.json()["detail"] == "Payment does not belong to the current user."
    assert fake_db.payments[0]["status"] == "pending"
    assert fake_db.credit_ledger == []

    owner = client.post(
        f"/api/v1/billing/payments/{payment['id']}/complete",
        headers=_headers("user_topup_owner", "workspace_owner_solo"),
    )

    assert owner.status_code == 200
    assert owner.json()["payment"]["status"] == "succeeded"
    assert fake_db.credit_ledger[-1]["account_id"] == "credit_user_user_topup_owner"


@pytest.mark.parametrize(
    ("path", "body", "payment_kind", "member_detail", "wrong_workspace_detail"),
    [
        (
            "/api/v1/billing/workspaces/current/topups/checkout",
            {"credits": 80, "metadata": {"pack": "team"}},
            "workspace_topup",
            "Only workspace owners or admins may complete Team wallet payments.",
            "Workspace payment does not belong to this workspace.",
        ),
        (
            "/api/v1/billing/workspaces/current/seats/checkout",
            {"planKey": "team_growth", "quantity": 2, "metadata": {"seatPack": "growth"}},
            "seat_purchase",
            "Only workspace owners or admins may complete seat payments.",
            "Seat payment does not belong to this workspace.",
        ),
    ],
)
def test_workspace_payment_complete_rejects_member_and_wrong_workspace(
    monkeypatch,
    path,
    body,
    payment_kind,
    member_detail,
    wrong_workspace_detail,
):
    fake_db = _patch_billing_db(monkeypatch)
    _seed_team_subscription(fake_db, "workspace_team_owner")
    client = TestClient(app)

    checkout = client.post(
        path,
        headers=_team_headers("user_team_owner", "workspace_team_owner", "owner"),
        json=body,
    )
    assert checkout.status_code == 200
    payment = checkout.json()["payment"]
    assert payment["kind"] == payment_kind

    member_complete = client.post(
        f"/api/v1/billing/payments/{payment['id']}/complete",
        headers=_team_headers("user_team_member", "workspace_team_owner", "member"),
    )
    wrong_workspace_complete = client.post(
        f"/api/v1/billing/payments/{payment['id']}/complete",
        headers=_team_headers("user_other_owner", "workspace_other_team", "owner"),
    )

    assert member_complete.status_code == 403
    assert member_complete.json()["detail"] == member_detail
    assert wrong_workspace_complete.status_code == 403
    assert wrong_workspace_complete.json()["detail"] == wrong_workspace_detail
    assert fake_db.payments[0]["status"] == "pending"
    assert fake_db.credit_ledger == []


def test_get_billing_payments_does_not_leak_other_personal_or_workspace_payments(monkeypatch):
    fake_db = _patch_billing_db(monkeypatch)
    _seed_team_subscription(fake_db, "workspace_alpha_team")
    client = TestClient(app)

    personal_checkout = client.post(
        "/api/v1/billing/topups/checkout",
        headers=_headers("user_alpha", "workspace_alpha_solo"),
        json={"credits": 11, "metadata": {"scope": "personal"}},
    )
    workspace_checkout = client.post(
        "/api/v1/billing/workspaces/current/topups/checkout",
        headers=_team_headers("user_alpha_owner", "workspace_alpha_team", "owner"),
        json={"credits": 22, "metadata": {"scope": "workspace"}},
    )
    assert personal_checkout.status_code == 200
    assert workspace_checkout.status_code == 200
    personal_payment_id = personal_checkout.json()["payment"]["id"]
    workspace_payment_id = workspace_checkout.json()["payment"]["id"]

    other_personal = client.get(
        "/api/v1/billing/payments",
        headers=_headers("user_beta", "workspace_beta_solo"),
    )
    wrong_workspace = client.get(
        "/api/v1/billing/payments?workspaceScoped=true",
        headers=_team_headers("user_beta_owner", "workspace_beta_team", "owner"),
    )
    owner_personal = client.get(
        "/api/v1/billing/payments",
        headers=_headers("user_alpha", "workspace_alpha_solo"),
    )
    workspace_owner = client.get(
        "/api/v1/billing/payments?workspaceScoped=true",
        headers=_team_headers("user_alpha_owner", "workspace_alpha_team", "owner"),
    )

    assert other_personal.status_code == 200
    assert wrong_workspace.status_code == 200
    assert [row["id"] for row in other_personal.json()["payments"]] == []
    assert [row["id"] for row in wrong_workspace.json()["payments"]] == []
    assert [row["id"] for row in owner_personal.json()["payments"]] == [personal_payment_id]
    assert [row["id"] for row in workspace_owner.json()["payments"]] == [workspace_payment_id]


@pytest.mark.parametrize(
    ("path", "body", "role", "detail"),
    [
        (
            "/api/v1/billing/workspaces/current/topups/checkout",
            {"credits": 10},
            "member",
            "Only workspace owners or admins may top up the Team wallet.",
        ),
        (
            "/api/v1/billing/workspaces/current/topups/checkout",
            {"credits": 10},
            "editor",
            "Only workspace owners or admins may top up the Team wallet.",
        ),
        (
            "/api/v1/billing/workspaces/current/seats/checkout",
            {"planKey": "team_start", "quantity": 1},
            "member",
            "Only workspace owners or admins may purchase seats.",
        ),
        (
            "/api/v1/billing/workspaces/current/seats/checkout",
            {"planKey": "team_start", "quantity": 1},
            "editor",
            "Only workspace owners or admins may purchase seats.",
        ),
    ],
)
def test_workspace_checkout_requires_owner_or_admin(monkeypatch, path, body, role, detail):
    fake_db = _patch_billing_db(monkeypatch)
    _seed_team_subscription(fake_db, "workspace_checkout_team", plan_key="team_start")
    client = TestClient(app)

    checkout = client.post(
        path,
        headers=_team_headers("user_limited_member", "workspace_checkout_team", role),
        json=body,
    )

    assert checkout.status_code == 403
    assert checkout.json()["detail"] == detail
    assert fake_db.payments == []


def _patch_billing_db(monkeypatch, *, patch_ledger: bool = False) -> FakePostgresDatabase:
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    if patch_ledger:
        monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    return fake_db


def _headers(user_id: str, workspace_id: str, role: str = "owner") -> dict[str, str]:
    return {
        "x-tangent-user-id": user_id,
        "x-tangent-workspace-id": workspace_id,
        "x-tangent-workspace-kind": "solo_workspace",
        "x-tangent-workspace-role": role,
    }


def _team_headers(user_id: str, workspace_id: str, role: str) -> dict[str, str]:
    return {
        "x-tangent-user-id": user_id,
        "x-tangent-workspace-id": workspace_id,
        "x-tangent-workspace-kind": "team_workspace",
        "x-tangent-workspace-role": role,
        "x-tangent-plan-key": "team_growth",
    }


def _seed_team_subscription(
    fake_db: FakePostgresDatabase,
    workspace_id: str,
    *,
    plan_key: str = "team_growth",
) -> None:
    fake_db.subscriptions = [
        {
            "account_id": f"credit_workspace_{workspace_id}",
            "id": f"subscription_{workspace_id}",
            "owner_id": workspace_id,
            "owner_type": "workspace",
            "plan_family": "team",
            "plan_key": plan_key,
            "seat_capacity": 1,
            "status": "active",
            "updated_at": "2026-05-06T00:00:00Z",
        }
    ]
