"""Override parent conftest fixtures for static tests.

Static gate tests are pure git-grep checks — they do not need the runtime
env-isolation fixture (which imports the FastAPI app stack). This file replaces
the parent ``isolate_runtime_env`` autouse fixture with a no-op so the static
gate can run in a minimal CI environment (just pytest, no FastAPI deps).
"""

from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def isolate_runtime_env():
    yield
