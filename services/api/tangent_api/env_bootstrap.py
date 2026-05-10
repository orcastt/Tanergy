from __future__ import annotations

import os
from pathlib import Path


def load_repo_env() -> None:
    if os.getenv("TANGENT_SKIP_ENV_FILE_LOAD") == "1":
        return

    repo_root = Path(__file__).resolve().parents[3]
    protected_keys = set(os.environ)

    for path in (
        repo_root / ".env",
        repo_root / ".env.local",
        repo_root / "services/api/.env",
        repo_root / "services/api/.env.local",
    ):
        _load_env_file(path, protected_keys)


def _load_env_file(path: Path, protected_keys: set[str]) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        parsed = _parse_env_line(line)
        if parsed is None:
            continue
        key, value = parsed
        if key in protected_keys:
            continue
        os.environ[key] = value


def _parse_env_line(line: str) -> tuple[str, str] | None:
    stripped = line.strip()
    if not stripped or stripped.startswith("#"):
        return None
    if stripped.startswith("export "):
        stripped = stripped[7:].lstrip()
    if "=" not in stripped:
        return None

    key, value = stripped.split("=", 1)
    key = key.strip()
    if not key:
        return None

    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        value = value[1:-1]
    return key, value
