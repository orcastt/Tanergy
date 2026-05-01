from fastapi.testclient import TestClient

from tangent_api.main import app


def test_auth_session_dev_fallback(monkeypatch):
    monkeypatch.delenv("TANGENT_REQUIRE_API_AUTH", raising=False)
    client = TestClient(app)

    response = client.get("/api/v1/auth/session")

    assert response.status_code == 200
    session = response.json()["session"]
    assert session["authMode"] == "dev"
    assert session["isDevFallback"] is True
    assert session["user"]["id"] == "dev-user"
    assert session["activeWorkspace"]["id"] == "dev-workspace"


def test_auth_session_explicit_context(monkeypatch):
    monkeypatch.delenv("TANGENT_REQUIRE_API_AUTH", raising=False)
    client = TestClient(app)

    response = client.get(
        "/api/v1/auth/session",
        headers={"x-tangent-user-id": "user_custom", "x-tangent-workspace-id": "workspace_custom"},
    )

    assert response.status_code == 200
    session = response.json()["session"]
    assert session["isDevFallback"] is False
    assert session["user"]["id"] == "user_custom"
    assert session["activeWorkspace"]["id"] == "workspace_custom"


def test_auth_required_mode_requires_context(monkeypatch):
    monkeypatch.setenv("TANGENT_REQUIRE_API_AUTH", "1")
    client = TestClient(app)

    missing = client.get("/api/v1/auth/session")
    assert missing.status_code == 401

    explicit = client.get(
        "/api/v1/auth/session",
        headers={"x-tangent-user-id": "dev-user", "x-tangent-workspace-id": "dev-workspace"},
    )
    assert explicit.status_code == 200
    session = explicit.json()["session"]
    assert session["authMode"] == "required"
    assert session["isDevFallback"] is False
