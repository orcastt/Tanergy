import os

import pytest


os.environ["TANGENT_SKIP_ENV_FILE_LOAD"] = "1"


_CLEARED_ENV_KEYS = {
    "DATABASE_URL",
    "TANGENT_AI_EXECUTION_START_DELAY_MS",
    "TANGENT_AI_MOCK_LEDGER_CHARGING",
    "TANGENT_AI_PROVIDER_EXECUTION_MODE",
    "TANGENT_AI_STUB_EXECUTION_FAIL_ROUTE_KEYS",
    "TANGENT_AI_STUB_FAIL_ROUTE_KEYS",
    "TANGENT_AI_STUB_ROUTE_LATENCY_MS",
    "TANGENT_ASSET_METADATA_DRIVER",
    "TANGENT_ASSET_STORAGE_DIR",
    "TANGENT_ASSET_STORAGE_DRIVER",
    "TANGENT_BOARD_STORAGE_DIR",
    "TANGENT_BOARD_STORAGE_DRIVER",
}

_CLEARED_ENV_PREFIXES = (
    "TANGENT_AI_PROVIDER_",
)


@pytest.fixture(autouse=True)
def isolate_runtime_env(monkeypatch: pytest.MonkeyPatch):
    for key in _CLEARED_ENV_KEYS:
        monkeypatch.delenv(key, raising=False)
    for key in tuple(os.environ):
        if key.startswith(_CLEARED_ENV_PREFIXES):
            monkeypatch.delenv(key, raising=False)
    yield
